import { WasmModuleType, WasmModuleConfig, WasmError } from '../types';

export enum WasmWorkerMessageType {
  Initialize = 'INITIALIZE',
  Execute = 'EXECUTE',
  Terminate = 'TERMINATE',
  MemoryStats = 'MEMORY_STATS',
  Error = 'ERROR',
}

export interface WasmWorkerMessage<T = unknown> {
  id: string;
  type: WasmWorkerMessageType;
  data?: T;
}

export interface InitializeMessage {
  modulePath: string;
  moduleType: string;
  memoryConfig?: {
    initialPages: number;
    maximumPages: number;
  };
}

export interface ExecuteMessage {
  functionName: string;
  parameters: unknown[];
  transferList?: ArrayBuffer[];
}

export interface MemoryStatsMessage {
  requestTime: number;
}

export interface ErrorMessage {
  error: {
    message: string;
    code: string;
    stack?: string;
    details?: Record<string, unknown>;
  };
}

export type WasmWorkerResponse<T = unknown> = {
  id: string;
  type: WasmWorkerMessageType;
  success: boolean;
  data?: T;
  error?: ErrorMessage['error'];
};

export interface WorkerPoolConfig {
  minWorkers?: number;
  maxWorkers?: number;
  idleTimeout?: number;
  taskTimeout?: number;
  memoryLimit?: number;
} 