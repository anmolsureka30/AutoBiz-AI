import { Logger } from '../../utils/logger/Logger';
import {
  WasmModuleConfig,
  WasmModuleInstance,
  WasmMemoryStats,
  WasmError,
  WasmModuleType
} from './types';

export class WasmModule {
  protected readonly logger: Logger;
  protected readonly config: Required<WasmModuleConfig>;
  protected instance?: WasmModuleInstance;
  protected memoryStats: WasmMemoryStats;

  constructor(config: WasmModuleConfig) {
    this.logger = new Logger(`WasmModule:${config.name}`);
    this.config = {
      memorySize: 16, // 1MB initial size
      maxMemorySize: 256, // 16MB max size
      importObjects: {},
      exports: [],
      ...config,
    };
    this.memoryStats = {
      totalPages: 0,
      usedPages: 0,
      freePages: 0,
      growthCount: 0,
    };
  }

  async initialize(): Promise<void> {
    try {
      // Create memory instance
      const memory = new WebAssembly.Memory({
        initial: this.config.memorySize,
        maximum: this.config.maxMemorySize,
      });

      // Fetch and instantiate WASM module
      const response = await fetch(this.config.wasmPath);
      const wasmBytes = await response.arrayBuffer();
      const module = await WebAssembly.compile(wasmBytes);

      // Create import object with memory
      const importObject = {
        env: {
          memory,
          ...this.config.importObjects,
        },
      };

      // Instantiate module
      const instance = await WebAssembly.instantiate(module, importObject);

      this.instance = {
        module,
        instance,
        memory,
        exports: instance.exports,
      };

      // Validate required exports
      this.validateExports();

      // Initialize memory stats
      this.updateMemoryStats();

      this.logger.info('WASM module initialized successfully', {
        name: this.config.name,
        type: this.config.type,
      });
    } catch (error) {
      const wasmError: WasmError = {
        name: 'WasmInitializationError',
        message: `Failed to initialize WASM module: ${error.message}`,
        code: 'WASM_INIT_ERROR',
        moduleType: this.config.type,
        operation: 'initialize',
        cause: error,
      };
      this.logger.error('WASM module initialization failed', { error: wasmError });
      throw wasmError;
    }
  }

  protected validateExports(): void {
    if (!this.instance) {
      throw new Error('WASM module not initialized');
    }

    for (const exportName of this.config.exports) {
      if (!(exportName in this.instance.exports)) {
        throw new Error(`Required export '${exportName}' not found in WASM module`);
      }
    }
  }

  protected updateMemoryStats(): void {
    if (!this.instance) {
      throw new Error('WASM module not initialized');
    }

    const memory = this.instance.memory;
    const totalPages = memory.buffer.byteLength / (64 * 1024);
    const view = new Uint8Array(memory.buffer);
    let usedPages = 0;

    // Count used pages by checking memory usage
    for (let i = 0; i < totalPages; i++) {
      const pageStart = i * 64 * 1024;
      const pageEnd = pageStart + 64 * 1024;
      for (let j = pageStart; j < pageEnd; j++) {
        if (view[j] !== 0) {
          usedPages++;
          break;
        }
      }
    }

    this.memoryStats = {
      totalPages,
      usedPages,
      freePages: totalPages - usedPages,
      growthCount: this.memoryStats.growthCount,
    };
  }

  getMemoryStats(): WasmMemoryStats {
    return { ...this.memoryStats };
  }

  protected growMemory(additionalPages: number): void {
    if (!this.instance) {
      throw new Error('WASM module not initialized');
    }

    try {
      this.instance.memory.grow(additionalPages);
      this.memoryStats.growthCount++;
      this.updateMemoryStats();
    } catch (error) {
      throw new Error(`Failed to grow memory: ${error.message}`);
    }
  }

  protected getExport<T extends Function>(name: string): T {
    if (!this.instance) {
      throw new Error('WASM module not initialized');
    }

    const exportedFn = this.instance.exports[name];
    if (typeof exportedFn !== 'function') {
      throw new Error(`Export '${name}' is not a function`);
    }

    return exportedFn as T;
  }
} 