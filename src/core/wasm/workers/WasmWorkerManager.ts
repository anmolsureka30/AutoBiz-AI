import { Logger } from '../../../utils/logger/Logger';
import {
  WasmModuleConfig,
  WasmModuleType,
  WasmError,
  WasmMemoryStats,
} from '../types';
import {
  WasmWorkerMessage,
  WasmWorkerMessageType,
  WasmWorkerResponse,
  InitializeMessage,
  ExecuteMessage,
} from './types';

export class WasmWorkerManager {
  private readonly worker: Worker;
  private readonly logger: Logger;
  private readonly pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();

  constructor(config: WasmModuleConfig) {
    this.logger = new Logger(`WasmWorkerManager:${config.name}`);
    this.worker = new Worker(new URL('./WasmWorker.ts', import.meta.url));
    this.setupMessageHandler();
    this.initialize(config);
  }

  private setupMessageHandler(): void {
    this.worker.onmessage = (event: MessageEvent<WasmWorkerResponse>) => {
      const { id, success, data, error } = event.data;
      const request = this.pendingRequests.get(id);

      if (request) {
        this.pendingRequests.delete(id);
        if (success) {
          request.resolve(data);
        } else {
          request.reject(error);
        }
      }
    };

    this.worker.onerror = (error) => {
      this.logger.error('Worker error', { error });
    };
  }

  private async sendMessage<T, R>(
    type: WasmWorkerMessageType,
    payload: T
  ): Promise<R> {
    const id = crypto.randomUUID();
    const message: WasmWorkerMessage<T> = {
      type,
      id,
      payload,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage(message);
    });
  }

  private async initialize(config: WasmModuleConfig): Promise<void> {
    const message: InitializeMessage = { config };
    await this.sendMessage(WasmWorkerMessageType.Initialize, message);
  }

  async execute<T>(functionName: string, ...args: unknown[]): Promise<T> {
    const message: ExecuteMessage = {
      functionName,
      args,
    };

    return this.sendMessage<ExecuteMessage, T>(
      WasmWorkerMessageType.Execute,
      message
    );
  }

  async getMemoryStats(): Promise<WasmMemoryStats> {
    return this.sendMessage<null, WasmMemoryStats>(
      WasmWorkerMessageType.MemoryStats,
      null
    );
  }

  async terminate(): Promise<void> {
    await this.sendMessage(WasmWorkerMessageType.Terminate, null);
    this.worker.terminate();
  }
} 