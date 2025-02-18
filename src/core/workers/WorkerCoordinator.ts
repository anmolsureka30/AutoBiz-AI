import { Logger } from '../../utils/logger';
import { ProcessingOptions, ProcessingResult } from '../wasm/DocumentProcessor';

export interface WorkerMessage {
  type: string;
  payload: unknown;
}

export interface WorkerResponse {
  type: string;
  payload: ProcessingResult;
}

export interface WorkerConfig {
  workerPath: string;
  maxWorkers?: number;
  wasmModulePath: string;
}

export class WorkerCoordinator {
  private workers: Worker[] = [];
  private taskQueue: Map<string, {
    resolve: (result: ProcessingResult) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = new Map();
  private availableWorkers: Worker[] = [];
  private isInitialized = false;
  private readonly maxWorkers: number;

  constructor(
    private readonly config: WorkerConfig,
    private readonly logger: Logger,
    maxWorkers = navigator.hardwareConcurrency || 4
  ) {
    this.maxWorkers = maxWorkers;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const workerCount = this.config.maxWorkers || navigator.hardwareConcurrency || 4;
    
    try {
      for (let i = 0; i < workerCount; i++) {
        const worker = new Worker(this.config.workerPath, { type: 'module' });
        
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = this.handleWorkerError.bind(this);

        // Initialize worker with WASM module
        await this.initializeWorker(worker);
        
        this.workers.push(worker);
        this.availableWorkers.push(worker);
      }

      this.isInitialized = true;
      
      this.logger.info({
        message: 'Worker coordinator initialized',
        workerCount,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to initialize worker coordinator',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async processDocument(
    document: Uint8Array,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    if (!this.isInitialized) {
      throw new Error('Worker coordinator not initialized');
    }

    const taskId = crypto.randomUUID();
    
    return new Promise((resolve, reject) => {
      this.taskQueue.set(taskId, {
        resolve,
        reject,
        startTime: Date.now(),
      });

      this.scheduleTask(taskId, document, options);
    });
  }

  private async initializeWorker(worker: Worker): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 10000);

      worker.postMessage({
        type: 'init',
        payload: {
          wasmModulePath: this.config.wasmModulePath,
        },
      });

      const initListener = (event: MessageEvent) => {
        if (event.data.type === 'initialized') {
          clearTimeout(timeout);
          worker.removeEventListener('message', initListener);
          resolve();
        }
      };

      worker.addEventListener('message', initListener);
    });
  }

  private scheduleTask(
    taskId: string,
    document: Uint8Array,
    options: ProcessingOptions
  ): void {
    const worker = this.availableWorkers.pop();
    
    if (worker) {
      this.assignTaskToWorker(worker, taskId, document, options);
    } else {
      // Queue task for later execution
      setTimeout(() => this.scheduleTask(taskId, document, options), 100);
    }
  }

  private assignTaskToWorker(
    worker: Worker,
    taskId: string,
    document: Uint8Array,
    options: ProcessingOptions
  ): void {
    worker.postMessage({
      type: 'process',
      id: taskId,
      payload: {
        document,
        options,
      },
    }, [document.buffer]); // Transfer ownership of buffer

    this.logger.info({
      message: 'Task assigned to worker',
      taskId,
      documentSize: document.byteLength,
    });
  }

  private handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
    const { type, id, payload } = event.data;
    const task = this.taskQueue.get(id);

    if (!task) {
      this.logger.error({
        message: 'Received message for unknown task',
        taskId: id,
      });
      return;
    }

    const worker = event.target as Worker;
    this.availableWorkers.push(worker);

    if (type === 'result') {
      const duration = Date.now() - task.startTime;
      this.logger.info({
        message: 'Task completed',
        taskId: id,
        duration,
      });

      task.resolve(payload);
    } else if (type === 'error') {
      task.reject(new Error(payload.message));
    }

    this.taskQueue.delete(id);
  }

  private handleWorkerError(event: ErrorEvent): void {
    const worker = event.target as Worker;
    
    this.logger.error({
      message: 'Worker error',
      error: event.message,
    });

    // Remove failed worker and create a new one
    this.workers = this.workers.filter(w => w !== worker);
    this.availableWorkers = this.availableWorkers.filter(w => w !== worker);
    
    worker.terminate();
    this.initialize().catch(error => {
      this.logger.error({
        message: 'Failed to reinitialize worker after error',
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  async terminate(): Promise<void> {
    for (const worker of this.workers) {
      worker.terminate();
    }

    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue.clear();
    this.isInitialized = false;

    this.logger.info({
      message: 'Worker coordinator terminated',
    });
  }
} 