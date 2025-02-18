export interface VectorizationConfig {
  model: string;
  dimensions: number;
  batchSize: number;
  maxTokens: number;
  overlap?: number;
  normalize?: boolean;
  poolingStrategy?: PoolingStrategy;
  preprocessors?: TextPreprocessor[];
  cache?: VectorCacheConfig;
}

export type PoolingStrategy = 'mean' | 'max' | 'cls' | 'weighted';

export interface TextPreprocessor {
  name: string;
  process: (text: string) => Promise<string>;
}

export interface VectorCacheConfig {
  enabled: boolean;
  ttl?: number;
  maxSize?: number;
  storage?: 'memory' | 'redis' | 'filesystem';
  path?: string;
}

export interface VectorizationResult {
  vectors: number[][];
  metadata: VectorizationMetadata;
  chunks: TextChunk[];
}

export interface VectorizationMetadata {
  model: string;
  dimensions: number;
  totalChunks: number;
  averageChunkSize: number;
  processingTime: number;
  tokenCount: number;
  originalTextLength: number;
}

export interface TextChunk {
  text: string;
  vector?: number[];
  startIndex: number;
  endIndex: number;
  tokens: number;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface VectorizationError extends Error {
  code: string;
  chunk?: TextChunk;
  details?: Record<string, unknown>;
} 