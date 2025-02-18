export interface EmbeddingModel {
  name: string;
  dimensions: number;
  maxTokens: number;
  encode(texts: string[]): Promise<number[][]>;
  tokenize(text: string): Promise<number[]>;
  getTokenCount(text: string): Promise<number>;
}

export interface ModelConfig {
  name: string;
  path?: string;
  device?: 'cpu' | 'gpu';
  quantization?: 'int8' | 'float16' | 'float32';
  cacheSize?: number;
  batchSize?: number;
  threads?: number;
}

export interface ModelMetrics {
  totalRequests: number;
  totalTokens: number;
  averageLatency: number;
  batchesProcessed: number;
  errors: number;
  lastError?: Error;
} 