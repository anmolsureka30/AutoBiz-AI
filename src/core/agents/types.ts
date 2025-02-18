export interface AgentConfig {
  modelPath: string;
  learningRate?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface ProcessResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  metrics?: {
    confidence: number;
    quality: number;
    performance: number;
  };
}

export interface Feedback {
  taskId: string;
  score: number;
  comments?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface BaseAgent<TInput, TOutput> {
  process(input: TInput): Promise<ProcessResult<TOutput>>;
  validate?(input: TInput): Promise<boolean>;
  updateModel?(feedback: Feedback): Promise<void>;
  cleanup?(): Promise<void>;
} 