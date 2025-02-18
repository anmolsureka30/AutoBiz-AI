export type ModelOperation = 'summarize' | 'extractKeyPoints' | 'updateWeights';

export interface ModelConfig {
  modelPath: string;
  device?: 'cpu' | 'gpu';
  precision?: 'float32' | 'float16';
  maxBatchSize?: number;
  timeout?: number;
}

export interface ModelMetrics {
  inferenceTime: number;
  memoryUsage: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelExecutionResult<T> {
  data: T;
  metrics: ModelMetrics;
}

export interface ModelState {
  version: string;
  lastUpdated: Date;
  parameters: number;
  weights: Float32Array;
}

export interface ModelError extends Error {
  code: string;
  operation: ModelOperation;
  metrics?: Partial<ModelMetrics>;
} 