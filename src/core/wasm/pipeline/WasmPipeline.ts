import { Logger } from '../../utils/logger/Logger';
import { WasmWorkerPool } from '../workers/WasmWorkerPool';
import {
  PipelineConfig,
  PipelineTask,
  PipelineStats,
  ChunkingStrategy,
  PipelineHooks,
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class WasmPipeline<TInput, TOutput> {
  private readonly logger: Logger;
  private readonly workerPool: WasmWorkerPool;
  private readonly config: Required<PipelineConfig>;
  private readonly chunkingStrategy: ChunkingStrategy<TInput>;
  private readonly hooks: PipelineHooks<TInput, TOutput>;
  private stats: PipelineStats;

  constructor(
    workerPool: WasmWorkerPool,
    chunkingStrategy: ChunkingStrategy<TInput>,
    config: PipelineConfig = {},
    hooks: PipelineHooks<TInput, TOutput> = {}
  ) {
    this.logger = new Logger('WasmPipeline');
    this.workerPool = workerPool;
    this.chunkingStrategy = chunkingStrategy;
    this.hooks = hooks;
    
    this.config = {
      chunkSize: config.chunkSize ?? 1024 * 1024, // 1MB
      maxConcurrency: config.maxConcurrency ?? 4,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      timeout: config.timeout ?? 30000,
      validateResults: config.validateResults ?? true,
    };

    this.resetStats();
  }

  async process(
    input: TInput,
    functionName: string,
    parameters: unknown[] = []
  ): Promise<TOutput> {
    try {
      // Split input into chunks
      const chunks = this.chunkingStrategy.split(input, this.config.chunkSize);
      const tasks = this.createTasks(chunks, functionName, parameters);

      // Process chunks with controlled concurrency
      const results = await this.processTasks(tasks);

      // Merge results
      const output = this.chunkingStrategy.merge(
        results.map(task => task.result!)
      );

      // Validate final result if needed
      if (this.config.validateResults && this.chunkingStrategy.validate) {
        if (!this.chunkingStrategy.validate(output)) {
          throw new Error('Pipeline output validation failed');
        }
      }

      this.hooks.onPipelineComplete?.(this.stats);
      return output;
    } catch (error) {
      this.logger.error('Pipeline processing failed', { error });
      throw error;
    }
  }

  private createTasks(
    chunks: TInput[],
    functionName: string,
    parameters: unknown[]
  ): PipelineTask<TInput, TOutput>[] {
    return chunks.map((chunk, index) => ({
      id: uuidv4(),
      input: chunk,
      chunkIndex: index,
      totalChunks: chunks.length,
      retryCount: 0,
      startTime: Date.now(),
    }));
  }

  private async processTasks(
    tasks: PipelineTask<TInput, TOutput>[]
  ): Promise<PipelineTask<TInput, TOutput>[]> {
    const pendingTasks = [...tasks];
    const completedTasks: PipelineTask<TInput, TOutput>[] = [];
    const failedTasks: PipelineTask<TInput, TOutput>[] = [];

    while (pendingTasks.length > 0) {
      const batch = pendingTasks.splice(0, this.config.maxConcurrency);
      const promises = batch.map(task => this.processTask(task));

      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        const task = batch[index];
        if (result.status === 'fulfilled') {
          completedTasks.push(result.value);
          this.stats.completedTasks++;
          this.hooks.onChunkProcessed?.(
            task.chunkIndex!,
            task.totalChunks!
          );
        } else {
          if (task.retryCount! < this.config.retryAttempts) {
            task.retryCount!++;
            this.stats.retryRate++;
            pendingTasks.push(task);
          } else {
            failedTasks.push({
              ...task,
              error: result.reason,
            });
            this.stats.failedTasks++;
            this.recordError(result.reason);
          }
        }
      });
    }

    if (failedTasks.length > 0) {
      throw new Error(`Pipeline failed: ${failedTasks.length} tasks failed`);
    }

    return completedTasks.sort((a, b) => a.chunkIndex! - b.chunkIndex!);
  }

  private async processTask(
    task: PipelineTask<TInput, TOutput>
  ): Promise<PipelineTask<TInput, TOutput>> {
    this.hooks.onTaskStart?.(task);
    
    try {
      const result = await Promise.race([
        this.workerPool.execute<TOutput>(
          'processChunk',
          [task.input, task.chunkIndex, task.totalChunks]
        ),
        this.createTimeout(this.config.timeout),
      ]);

      const completedTask = {
        ...task,
        result,
        endTime: Date.now(),
      };

      this.hooks.onTaskComplete?.(completedTask);
      this.updateProcessingTime(completedTask);

      return completedTask;
    } catch (error) {
      this.hooks.onTaskError?.(task, error as Error);
      throw error;
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task timeout after ${ms}ms`));
      }, ms);
    });
  }

  private updateProcessingTime(task: PipelineTask<TInput, TOutput>): void {
    const processingTime = task.endTime! - task.startTime!;
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime * (this.stats.completedTasks - 1) + processingTime) /
      this.stats.completedTasks;
  }

  private recordError(error: Error): void {
    const errorType = error.name || 'UnknownError';
    this.stats.errorTypes[errorType] = (this.stats.errorTypes[errorType] || 0) + 1;
  }

  private resetStats(): void {
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageProcessingTime: 0,
      successRate: 0,
      retryRate: 0,
      errorTypes: {},
    };
  }

  getStats(): PipelineStats {
    return {
      ...this.stats,
      successRate: this.stats.completedTasks / 
        (this.stats.completedTasks + this.stats.failedTasks),
    };
  }
} 