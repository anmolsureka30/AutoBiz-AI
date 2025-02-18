import { Logger } from '../utils/logger';

export interface WasmModuleConfig {
  modulePath: string;
  memorySize?: number; // Initial memory in pages (64KB each)
  maxMemorySize?: number; // Maximum memory in pages
  importObjects?: WebAssembly.Imports;
}

export class WasmLoader {
  private moduleCache: Map<string, WebAssembly.Module> = new Map();
  private instanceCache: Map<string, WebAssembly.Instance> = new Map();

  constructor(private readonly logger: Logger) {}

  async loadModule(config: WasmModuleConfig): Promise<WebAssembly.Instance> {
    try {
      // Check cache first
      if (this.instanceCache.has(config.modulePath)) {
        return this.instanceCache.get(config.modulePath)!;
      }

      // Configure memory
      const memory = new WebAssembly.Memory({
        initial: config.memorySize || 256, // 16MB default
        maximum: config.maxMemorySize || 2048, // 128MB default
      });

      // Fetch and compile module
      const response = await fetch(config.modulePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.statusText}`);
      }

      const wasmBytes = await response.arrayBuffer();
      const module = await WebAssembly.compile(wasmBytes);

      // Create import object with memory and optional imports
      const imports: WebAssembly.Imports = {
        env: {
          memory,
          ...config.importObjects?.env,
        },
        ...config.importObjects,
      };

      // Instantiate module
      const instance = await WebAssembly.instantiate(module, imports);

      // Cache module and instance
      this.moduleCache.set(config.modulePath, module);
      this.instanceCache.set(config.modulePath, instance);

      this.logger.info({
        message: 'WASM module loaded successfully',
        module: config.modulePath,
        memorySize: `${config.memorySize} pages`,
      });

      return instance;
    } catch (error) {
      this.logger.error({
        message: 'Failed to load WASM module',
        module: config.modulePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`WASM module loading failed: ${error}`);
    }
  }

  // Helper method to safely transfer data between JS and WASM
  transferToWasm(
    instance: WebAssembly.Instance,
    data: Uint8Array
  ): number {
    const memory = instance.exports.memory as WebAssembly.Memory;
    const malloc = instance.exports.malloc as CallableFunction;

    if (!malloc) {
      throw new Error('WASM module must export malloc function');
    }

    // Allocate memory in WASM
    const ptr = malloc(data.length);
    
    // Get direct view of WASM memory
    const heap = new Uint8Array(memory.buffer);
    
    // Copy data to WASM memory
    heap.set(data, ptr);
    
    return ptr;
  }

  // Clean up resources
  unloadModule(modulePath: string): void {
    this.moduleCache.delete(modulePath);
    this.instanceCache.delete(modulePath);
  }
} 