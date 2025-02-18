/**
 * WASM Module configuration and type definitions
 */

export enum WasmModuleType {
  TextProcessing = 'text-processing',
  DocumentAnalysis = 'document-analysis',
  MLInference = 'ml-inference'
}

export interface WasmModuleConfig {
  modulePath: string;
  moduleType: WasmModuleType;
  memoryConfig?: {
    initialPages?: number;
    maximumPages?: number;
    sharedMemory?: boolean;
  };
}

export interface WasmModuleInstance {
  instance: WebAssembly.Instance;
  memory: WebAssembly.Memory;
  exports: Record<string, WebAssembly.ExportValue>;
}

export interface WasmMemoryStats {
  totalPages: number;
  usedPages: number;
  freePages: number;
  growthCount: number;
}

export interface WasmError extends Error {
  code: string;
  moduleType: WasmModuleType;
  operation: string;
  details?: Record<string, unknown>;
}

export type WasmModuleLoader = (config: WasmModuleConfig) => Promise<WasmModuleInstance>; 