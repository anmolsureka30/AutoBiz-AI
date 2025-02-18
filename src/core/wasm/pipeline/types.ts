export interface PipelineConfig {
  chunkSize?: number;
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  validateResults?: boolean;
}

export interface PipelineTask<TInput, TOutput> {
  id: string;
  input: TInput;
  chunkIndex?: number;
  totalChunks?: number;
  retryCount?: number;
  startTime?: number;
  endTime?: number;
  result?: TOutput;
  error?: Error;
}

export interface PipelineStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
  successRate: number;
  retryRate: number;
  errorTypes: Record<string, number>;
}

export interface ChunkingStrategy<T> {
  split(data: T, chunkSize: number): T[];
  merge(chunks: T[]): T;
  validate?(chunk: T): boolean;
}

export interface PipelineHooks<TInput, TOutput> {
  onTaskStart?: (task: PipelineTask<TInput, TOutput>) => void;
  onTaskComplete?: (task: PipelineTask<TInput, TOutput>) => void;
  onTaskError?: (task: PipelineTask<TInput, TOutput>, error: Error) => void;
  onChunkProcessed?: (chunkIndex: number, totalChunks: number) => void;
  onPipelineComplete?: (stats: PipelineStats) => void;
} 