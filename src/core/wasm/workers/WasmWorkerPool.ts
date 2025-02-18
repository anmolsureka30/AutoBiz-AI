import { Logger } from '../../utils/logger/Logger';
import {
  WorkerPoolConfig,
  WasmWorkerMessage,
  WasmWorkerMessageType,
  WasmWorkerResponse,
  InitializeMessage,
  ExecuteMessage,
} from './types';
import { v4 as uuidv4 } from 'uuid';

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
  lastUsed: number;
  taskCount: number;
  pendingTasks: Map<string, PendingTask>;
}

interface PendingTask {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: NodeJS.Timeout;
}

export class WasmWorkerPool {
  private readonly logger: Logger;
  private readonly workers: Map<string, WorkerInfo> = new Map();
  private readonly config: Required<WorkerPoolConfig>;
  private readonly workerScript: string;
  private initialized = false;

  constructor(workerScript: string, config: WorkerPoolConfig = {}) {
    this.logger = new Logger('WasmWorkerPool');
    this.workerScript = workerScript;
    this.config = {
      minWorkers: config.minWorkers ?? 2,
      maxWorkers: config.maxWorkers ?? navigator.hardwareConcurrency || 4,
      idleTimeout: config.idleTimeout ?? 60000, // 1 minute
      taskTimeout: config.taskTimeout ?? 30000, // 30 seconds
      memoryLimit: config.memoryLimit ?? 512 * 1024 * 1024, // 512MB
    };
  }

  async initialize(moduleConfig: InitializeMessage): Promise<void> {
    if (this.initialized) {
      throw new Error('Worker pool already initialized');
    }

    try {
      // Create initial workers
      for (let i = 0; i < this.config.minWorkers; i++) {
        await this.createWorker(moduleConfig);
      }

      this.initialized = true;
      this.startMaintenanceInterval();

      this.logger.info('Worker pool initialized', {
        workers: this.workers.size,
        config: this.config,
      });
    } catch (error) {
      this.logger.error('Failed to initialize worker pool', { error });
      throw error;
    }
  }

  async execute<T = unknown>(
    functionName: string,
    parameters: unknown[],
    transferList?: ArrayBuffer[]
  ): Promise<T> {
    if (!this.initialized) {
      throw new Error('Worker pool not initialized');
    }

    const taskId = uuidv4();
    const worker = await this.getAvailableWorker();

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.handleTaskTimeout(worker.worker, taskId);
      }, this.config.taskTimeout);

      worker.pendingTasks.set(taskId, { resolve, reject, timeout });

      const message: WasmWorkerMessage<ExecuteMessage> = {
        id: taskId,
        type: WasmWorkerMessageType.Execute,
        data: {
          functionName,
          parameters,
          transferList,
        },
      };

      worker.worker.postMessage(message, transferList ? { transfer: transferList } : undefined);
      worker.taskCount++;
      worker.lastUsed = Date.now();
    });
  }

  async terminate(): Promise<void> {
    this.logger.info('Terminating worker pool');

    for (const [id, info] of this.workers) {
      await this.terminateWorker(id, info);
    }

    this.workers.clear();
    this.initialized = false;
  }

  private async createWorker(moduleConfig: InitializeMessage): Promise<WorkerInfo> {
    const worker = new Worker(this.workerScript);
    const id = uuidv4();

    const info: WorkerInfo = {
      worker,
      busy: false,
      lastUsed: Date.now(),
      taskCount: 0,
      pendingTasks: new Map(),
    };

    this.setupWorkerHandlers(id, info);
    this.workers.set(id, info);

    // Initialize the worker
    await this.initializeWorker(info, moduleConfig);

    return info;
  }

  private setupWorkerHandlers(id: string, info: WorkerInfo): void {
    info.worker.onmessage = (event: MessageEvent<WasmWorkerResponse>) => {
      const { id: taskId, type, success, data, error } = event.data;
      const task = info.pendingTasks.get(taskId);

      if (!task) {
        this.logger.warn('Received response for unknown task', { taskId });
        return;
      }

      clearTimeout(task.timeout);
      info.pendingTasks.delete(taskId);
      info.busy = info.pendingTasks.size > 0;

      if (success) {
        task.resolve(data);
      } else {
        task.reject(new Error(error?.message || 'Task failed'));
      }
    };

    info.worker.onerror = (error: ErrorEvent) => {
      this.logger.error('Worker error', { id, error });
      this.handleWorkerError(id, info, error);
    };
  }

  private async initializeWorker(
    info: WorkerInfo,
    moduleConfig: InitializeMessage
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const taskId = uuidv4();
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, this.config.taskTimeout);

      info.pendingTasks.set(taskId, {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      });

      const message: WasmWorkerMessage<InitializeMessage> = {
        id: taskId,
        type: WasmWorkerMessageType.Initialize,
        data: moduleConfig,
      };

      info.worker.postMessage(message);
    });
  }

  private async getAvailableWorker(): Promise<WorkerInfo> {
    // Find non-busy worker
    for (const info of this.workers.values()) {
      if (!info.busy) {
        info.busy = true;
        return info;
      }
    }

    // Create new worker if possible
    if (this.workers.size < this.config.maxWorkers) {
      const info = await this.createWorker({
        modulePath: this.workerScript,
        moduleType: 'dynamic',
      });
      info.busy = true;
      return info;
    }

    // Wait for a worker to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        for (const info of this.workers.values()) {
          if (!info.busy) {
            clearInterval(checkInterval);
            info.busy = true;
            resolve(info);
            break;
          }
        }
      }, 100);
    });
  }

  private handleTaskTimeout(worker: Worker, taskId: string): void {
    this.logger.warn('Task timeout', { taskId });
    worker.terminate();
    // Worker will be replaced on next task
  }

  private handleWorkerError(id: string, info: WorkerInfo, error: ErrorEvent): void {
    // Fail all pending tasks
    for (const [taskId, task] of info.pendingTasks) {
      clearTimeout(task.timeout);
      task.reject(new Error(`Worker error: ${error.message}`));
    }

    // Remove and replace worker
    this.terminateWorker(id, info);
    this.createWorker({
      modulePath: this.workerScript,
      moduleType: 'dynamic',
    }).catch(error => {
      this.logger.error('Failed to replace worker', { error });
    });
  }

  private async terminateWorker(id: string, info: WorkerInfo): Promise<void> {
    try {
      const taskId = uuidv4();
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => resolve(), 1000);
        info.pendingTasks.set(taskId, {
          resolve: () => {
            clearTimeout(timeout);
            resolve();
          },
          reject,
          timeout,
        });

        info.worker.postMessage({
          id: taskId,
          type: WasmWorkerMessageType.Terminate,
        });
      });
    } catch (error) {
      this.logger.warn('Error terminating worker', { id, error });
    } finally {
      info.worker.terminate();
      this.workers.delete(id);
    }
  }

  private startMaintenanceInterval(): void {
    setInterval(() => {
      this.performMaintenance();
    }, 30000); // Every 30 seconds
  }

  private performMaintenance(): void {
    const now = Date.now();

    // Remove idle workers above minWorkers
    if (this.workers.size > this.config.minWorkers) {
      for (const [id, info] of this.workers) {
        if (
          !info.busy &&
          now - info.lastUsed > this.config.idleTimeout &&
          this.workers.size > this.config.minWorkers
        ) {
          this.terminateWorker(id, info);
        }
      }
    }

    // Log pool stats
    this.logger.debug('Worker pool stats', {
      totalWorkers: this.workers.size,
      busyWorkers: Array.from(this.workers.values()).filter(w => w.busy).length,
      totalTasks: Array.from(this.workers.values())
        .reduce((sum, w) => sum + w.taskCount, 0),
    });
  }
} 