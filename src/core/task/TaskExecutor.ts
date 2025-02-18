import { Task, TaskType, TaskStatus } from './types';
import { Logger } from '../../utils/logger';
import { ResourceMonitor } from '../system/ResourceMonitor';
import EventEmitter = require('events');

export interface TaskExecutionResult<T = unknown> {
  output: T;
  status: TaskStatus;
  error?: Error;
  metrics: {
    startTime: Date;
    endTime: Date;
    duration: number;
    cpu: number;
    memory: number;
  };
}

export interface TaskHandler<TInput = unknown, TOutput = unknown> {
  canHandle(task: Task): boolean;
  execute(task: Task<TInput, TOutput>): Promise<TaskExecutionResult<TOutput>>;
  cleanup?(task: Task): Promise<void>;
}

export class TaskExecutor extends EventEmitter {
  private handlers: Map<TaskType, TaskHandler>;
  private runningTasks: Map<string, {
    task: Task;
    startTime: Date;
    resourceUsage: {
      cpu: number[];
      memory: number[];
    };
  }>;

  constructor(
    private readonly logger: Logger,
    private readonly resourceMonitor: ResourceMonitor
  ) {
    super();
    this.handlers = new Map();
    this.runningTasks = new Map();
    this.registerDefaultHandlers();
  }

  registerHandler(type: TaskType, handler: TaskHandler): void {
    this.handlers.set(type, handler);
  }

  async executeTask<TInput, TOutput>(task: Task<TInput, TOutput>): Promise<TaskExecutionResult<TOutput>> {
    const handler = this.findHandler(task);
    if (!handler) {
      throw new Error(`No handler found for task type: ${task.type}`);
    }

    this.runningTasks.set(task.id, {
      task,
      startTime: new Date(),
      resourceUsage: {
        cpu: [],
        memory: []
      }
    });

    try {
      // Start resource monitoring
      const resourceMonitoring = this.monitorTaskResources(task.id);

      // Execute the task
      const result = await handler.execute(task);

      // Stop resource monitoring
      const resourceUsage = await resourceMonitoring;

      // Calculate average resource usage
      const avgCpu = resourceUsage.cpu.reduce((a, b) => a + b, 0) / resourceUsage.cpu.length;
      const avgMemory = resourceUsage.memory.reduce((a, b) => a + b, 0) / resourceUsage.memory.length;

      const finalResult: TaskExecutionResult<TOutput> = {
        ...result,
        metrics: {
          ...result.metrics,
          cpu: avgCpu,
          memory: avgMemory
        }
      };

      this.emit('task:completed', {
        taskId: task.id,
        type: task.type,
        duration: finalResult.metrics.duration,
        resourceUsage: {
          cpu: avgCpu,
          memory: avgMemory
        }
      });

      return finalResult;

    } catch (error) {
      this.emit('task:failed', {
        taskId: task.id,
        type: task.type,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;

    } finally {
      this.runningTasks.delete(task.id);
      await handler.cleanup?.(task);
    }
  }

  private findHandler(task: Task): TaskHandler | undefined {
    // First try exact type match
    const handler = this.handlers.get(task.type as TaskType);
    if (handler) return handler;

    // Then try finding a handler that can handle this task
    return Array.from(this.handlers.values()).find(h => h.canHandle(task));
  }

  private async monitorTaskResources(taskId: string): Promise<{ cpu: number[]; memory: number[] }> {
    const taskInfo = this.runningTasks.get(taskId);
    if (!taskInfo) throw new Error(`Task ${taskId} not found`);

    const monitor = async () => {
      while (this.runningTasks.has(taskId)) {
        const usage = await this.resourceMonitor.getResourceUsage();
        taskInfo.resourceUsage.cpu.push(usage.cpu);
        taskInfo.resourceUsage.memory.push(usage.memory);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return taskInfo.resourceUsage;
    };

    return monitor();
  }

  private registerDefaultHandlers(): void {
    // Register document processing handlers
    this.registerHandler('document_analysis', new DocumentAnalysisHandler());
    this.registerHandler('document_summarization', new DocumentSummarizationHandler());
    this.registerHandler('document_section_analysis', new DocumentSectionAnalysisHandler());
    this.registerHandler('chunk_summarization', new ChunkSummarizationHandler());
  }
}

// Example handlers for different task types
class DocumentAnalysisHandler implements TaskHandler<Document, DocumentAnalysisResult> {
  canHandle(task: Task): boolean {
    return task.type === 'document_analysis';
  }

  async execute(task: Task<Document>): Promise<TaskExecutionResult<DocumentAnalysisResult>> {
    const startTime = new Date();
    try {
      // Implement document analysis logic
      const result = await this.analyzeDocument(task.input);

      return {
        output: result,
        status: 'completed',
        metrics: {
          startTime,
          endTime: new Date(),
          duration: Date.now() - startTime.getTime(),
          cpu: 0,
          memory: 0
        }
      };
    } catch (error) {
      return {
        output: null as any,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        metrics: {
          startTime,
          endTime: new Date(),
          duration: Date.now() - startTime.getTime(),
          cpu: 0,
          memory: 0
        }
      };
    }
  }

  private async analyzeDocument(document: Document): Promise<DocumentAnalysisResult> {
    // Implement document analysis
    return {
      entities: [],
      topics: [],
      sentiment: 0,
      language: 'en'
    };
  }
}

// Add other handlers similarly... 