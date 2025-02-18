import { Logger } from '../utils/logger/Logger';
import {
  WasmModuleConfig,
  WasmModuleType,
  WasmModuleInstance,
  WasmError,
  WasmModuleLoader
} from './types';

export class WebAssemblyLoader implements WasmModuleLoader {
  private readonly logger: Logger;
  private readonly moduleCache: Map<string, WebAssembly.Module>;

  constructor() {
    this.logger = new Logger('WasmModuleLoader');
    this.moduleCache = new Map();
  }

  async loadModule(config: WasmModuleConfig): Promise<WasmModuleInstance> {
    try {
      const { modulePath, moduleType, memoryConfig } = config;
      
      // Check cache first
      let module = this.moduleCache.get(modulePath);
      
      if (!module) {
        // Fetch and compile module
        const response = await fetch(modulePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
        }
        
        const wasmBytes = await response.arrayBuffer();
        module = await WebAssembly.compile(wasmBytes);
        
        // Cache the compiled module
        this.moduleCache.set(modulePath, module);
      }

      // Create memory
      const memory = this.createMemory(memoryConfig);

      // Create import object
      const importObject = this.createImportObject(moduleType, memory);

      // Instantiate module
      const instance = await WebAssembly.instantiate(module, importObject);

      this.logger.info('WASM module loaded successfully', {
        moduleType,
        modulePath,
        exports: Object.keys(instance.exports),
      });

      return {
        instance,
        memory,
        exports: instance.exports as Record<string, WebAssembly.ExportValue>,
      };
    } catch (error) {
      const wasmError = new Error(
        `Failed to load WASM module: ${error.message}`
      ) as WasmError;
      wasmError.code = 'MODULE_LOAD_ERROR';
      wasmError.moduleType = config.moduleType;
      wasmError.operation = 'load';
      
      this.logger.error('WASM module load failed', {
        error: wasmError,
        config,
      });
      
      throw wasmError;
    }
  }

  private createMemory(config: WasmModuleConfig['memoryConfig']): WebAssembly.Memory {
    const { initialPages = 1, maximumPages = 100 } = config || {};
    
    return new WebAssembly.Memory({
      initial: initialPages,
      maximum: maximumPages,
    });
  }

  private createImportObject(
    moduleType: WasmModuleType,
    memory: WebAssembly.Memory
  ): WebAssembly.Imports {
    const baseImports = {
      env: {
        memory,
        abort: (msg: number, file: number, line: number, column: number) => {
          this.logger.error('WASM abort called', {
            msg,
            file,
            line,
            column,
            moduleType,
          });
          throw new Error('WASM module aborted');
        },
      },
    };

    // Add module-specific imports
    switch (moduleType) {
      case WasmModuleType.TextProcessing:
        return {
          ...baseImports,
          text_processing: {
            log: (ptr: number, len: number) => {
              const view = new Uint8Array(memory.buffer, ptr, len);
              const text = new TextDecoder().decode(view);
              this.logger.info('WASM text processing:', { text });
            },
          },
        };
      
      case WasmModuleType.MLInference:
        return {
          ...baseImports,
          ml: {
            tensor_error: (code: number, message: number) => {
              const view = new Uint8Array(memory.buffer, message, 100);
              const text = new TextDecoder().decode(view);
              this.logger.error('WASM ML error:', { code, message: text });
            },
          },
        };
      
      default:
        return baseImports;
    }
  }
} 