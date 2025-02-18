import { CacheEntry } from '../types';

export interface BatchOperation {
  type: 'set' | 'delete';
  key: string;
  entry?: CacheEntry;
}

export interface BatchResult {
  successful: number;
  failed: number;
  errors: Array<{
    operation: BatchOperation;
    error: Error;
  }>;
}

export interface BatchCapableStorage {
  executeBatch(operations: BatchOperation[]): Promise<BatchResult>;
  optimizeBatch?(operations: BatchOperation[]): BatchOperation[];
} 