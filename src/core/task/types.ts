import { Document } from '../../agents/document/types';
import { AgentId } from '../agents/base/types';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 1 | 2 | 3 | 4 | 5; // 1 is highest priority

export interface TaskMetadata {
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
    duration?: number;
  };
}

export interface TaskDependency {
  taskId: string;
  type: 'hard' | 'soft'; // hard = must complete, soft = best effort
  timeout?: number;
}

export interface Task<TInput = unknown, TOutput = unknown> {
  id: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  input: TInput;
  output?: TOutput;
  error?: Error;
  metadata: TaskMetadata;
  assignedTo?: AgentId;
  dependencies?: TaskDependency[];
  subtasks?: string[]; // IDs of subtasks if task was decomposed
  parentTaskId?: string; // ID of parent task if this is a subtask
  progress?: number; // 0-100
  cancelToken?: AbortController;
}

export interface TaskProgress {
  taskId: string;
  progress: number;
  status: TaskStatus;
  message?: string;
  timestamp: Date;
}

export interface TaskOptions {
  priority?: TaskPriority;
  maxAttempts?: number;
  timeout?: number;
  dependencies?: TaskDependency[];
  resourceLimits?: {
    maxCpu?: number;
    maxMemory?: number;
    maxDuration?: number;
  };
}

export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  type?: string | string[];
  assignedTo?: AgentId;
  createdBefore?: Date;
  createdAfter?: Date;
}

export interface TaskStats {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
  byType: Record<string, number>;
  averageCompletionTime: number;
  failureRate: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
  };
}

export interface TaskQueueStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  highPriorityTasks: number;
  normalPriorityTasks: number;
  lowPriorityTasks: number;
  averageWaitTime: number;
  averageProcessingTime: number;
}

export interface TaskQueueConfig {
  maxConcurrent?: number;
  maxRetries?: number;
  retryDelay?: number;
  priorityLevels?: {
    [TaskPriority.High]: number;
    [TaskPriority.Normal]: number;
    [TaskPriority.Low]: number;
  };
}

export type TaskType = 
  | 'document_summarization'
  | 'entity_extraction'
  | 'document_analysis'
  | 'table_extraction'
  | 'relationship_analysis'
  | 'custom';

export interface TaskQueue {
  initialize(): Promise<void>;
  enqueue(task: Task): Promise<void>;
  dequeue(): Promise<Task | null>;
  peek(): Promise<Task | null>;
  size(): Promise<number>;
  remove(taskId: string): Promise<void>;
  update(task: Task): Promise<void>;
  filter(filter: TaskFilter): Promise<Task[]>;
}

export interface StoreConfig {
  name: string;
  keyPath: string;
  indexes: Array<{
    name: string;
    keyPath: string;
    unique?: boolean;
  }>;
} 