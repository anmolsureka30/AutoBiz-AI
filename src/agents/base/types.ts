import { Logger } from '../../utils/logger';

export type AgentId = string;

export interface AgentConfig {
  id: AgentId;
  name: string;
  version: string;
  logger: Logger;
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AgentStatus = 'idle' | 'processing' | 'learning' | 'error';
export type MessagePriority = 1 | 2 | 3; // 1: High, 2: Medium, 3: Low

export interface TaskInfo {
  id: string;
  type: string;
  status: TaskStatus;
  startTime: Date;
  endTime?: Date;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  totalTasks: number;
  successfulTasks: number;
  failedTasks: number;
  averageProcessingTime: number;
  learningIterations: number;
  lastLearningUpdate: Date;
}

export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  currentTasks: TaskInfo[];
  performance: PerformanceMetrics;
  lastUpdated: Date;
}

export interface AgentMessage<T = unknown> {
  id: string;
  type: string;
  payload: T;
  timestamp: Date;
  priority: MessagePriority;
  metadata?: Record<string, unknown>;
}

export interface LearningFeedback {
  taskId: string;
  expectedOutput: unknown;
  actualOutput: unknown;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface AgentError extends Error {
  code: string;
  details?: Record<string, unknown>;
  timestamp: Date;
} 