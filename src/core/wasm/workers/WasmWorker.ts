import { Logger } from '../../utils/logger/Logger';
import { WebAssemblyLoader } from '../WasmModuleLoader';
import {
  WasmWorkerMessage,
  WasmWorkerMessageType,
  WasmWorkerResponse,
  InitializeMessage,
  ExecuteMessage,
  MemoryStatsMessage,
  ErrorMessage,
} from './types';

class WasmWorker {
  private readonly logger: Logger;
  private readonly loader: WebAssemblyLoader;
  private module: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;

  constructor() {
    this.logger = new Logger('WasmWorker');
    this.loader = new WebAssemblyLoader();
    this.setupMessageHandler();
  }

  private setupMessageHandler(): void {
    self.onmessage = async (event: MessageEvent<WasmWorkerMessage>) => {
      const { id, type, data } = event.data;

      try {
        switch (type) {
          case WasmWorkerMessageType.Initialize:
            await this.handleInitialize(id, data as InitializeMessage);
            break;

          case WasmWorkerMessageType.Execute:
            await this.handleExecute(id, data as ExecuteMessage);
            break;

          case WasmWorkerMessageType.MemoryStats:
            await this.handleMemoryStats(id, data as MemoryStatsMessage);
            break;

          case WasmWorkerMessageType.Terminate:
            await this.handleTerminate(id);
            break;

          default:
            throw new Error(`Unknown message type: ${type}`);
        }
      } catch (error) {
        this.handleError(id, error);
      }
    };
  }

  private async handleInitialize(
    id: string,
    message: InitializeMessage
  ): Promise<void> {
    try {
      const result = await this.loader.loadModule({
        modulePath: message.modulePath,
        moduleType: message.moduleType,
        memoryConfig: message.memoryConfig,
      });

      this.module = result.instance;
      this.memory = result.memory;

      this.sendResponse(id, WasmWorkerMessageType.Initialize, {
        success: true,
      });
    } catch (error) {
      this.handleError(id, error);
    }
  }

  private async handleExecute(
    id: string,
    message: ExecuteMessage
  ): Promise<void> {
    if (!this.module) {
      throw new Error('Module not initialized');
    }

    const { functionName, parameters, transferList } = message;
    const fn = this.getExportedFunction(functionName);

    try {
      const result = await fn.apply(null, parameters);
      
      this.sendResponse(
        id,
        WasmWorkerMessageType.Execute,
        { success: true, data: result },
        transferList
      );
    } catch (error) {
      this.handleError(id, error);
    }
  }

  private async handleMemoryStats(
    id: string,
    message: MemoryStatsMessage
  ): Promise<void> {
    if (!this.memory) {
      throw new Error('Memory not initialized');
    }

    const stats = {
      totalPages: this.memory.buffer.byteLength / (64 * 1024),
      usedPages: 0, // Would need to get this from memory manager
      timestamp: message.requestTime,
    };

    this.sendResponse(id, WasmWorkerMessageType.MemoryStats, {
      success: true,
      data: stats,
    });
  }

  private async handleTerminate(id: string): Promise<void> {
    try {
      // Cleanup
      this.module = null;
      this.memory = null;

      this.sendResponse(id, WasmWorkerMessageType.Terminate, {
        success: true,
      });

      // Self terminate
      self.close();
    } catch (error) {
      this.handleError(id, error);
    }
  }

  private getExportedFunction(name: string): Function {
    if (!this.module) {
      throw new Error('Module not initialized');
    }

    const exportedFn = this.module.exports[name];
    if (typeof exportedFn !== 'function') {
      throw new Error(`Export '${name}' is not a function`);
    }

    return exportedFn as Function;
  }

  private sendResponse<T>(
    id: string,
    type: WasmWorkerMessageType,
    response: Partial<WasmWorkerResponse<T>>,
    transferList?: ArrayBuffer[]
  ): void {
    const message: WasmWorkerResponse<T> = {
      id,
      type,
      success: response.success ?? false,
      data: response.data,
      error: response.error,
    };

    self.postMessage(message, { transfer: transferList ?? [] });
  }

  private handleError(id: string, error: unknown): void {
    const errorMessage: ErrorMessage = {
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
        stack: error instanceof Error ? error.stack : undefined,
        details: error instanceof Error ? (error as any).details : undefined,
      },
    };

    this.sendResponse<ErrorMessage>(id, WasmWorkerMessageType.Error, {
      success: false,
      error: errorMessage.error,
    });
  }
}

// Initialize worker
new WasmWorker(); 