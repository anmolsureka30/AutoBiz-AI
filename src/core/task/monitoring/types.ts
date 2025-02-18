import { Task } from '../types';

export interface TaskQueueMetrics {
  // Queue size metrics
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
  
  // Performance metrics
  averageWaitTime: number;  // milliseconds
  averageProcessingTime: number;  // milliseconds
  throughput: number;  // tasks per minute
  
  // Health metrics
  errorRate: number;  // percentage
  retryRate: number;  // percentage
  successRate: number;  // percentage
  
  // Priority distribution
  priorityDistribution: {
    high: number;
    normal: number;
    low: number;
  };
  
  // Time-based metrics
  lastUpdated: Date;
  timeWindow: number;  // milliseconds
}

export interface TaskQueueAlert {
  id: string;
  type: TaskQueueAlertType;
  message: string;
  severity: 'info' | 'warning' | 'error';
  timestamp: Date;
  metadata: Record<string, any>;
}

export enum TaskQueueAlertType {
  QueueFull = 'QUEUE_FULL',
  HighErrorRate = 'HIGH_ERROR_RATE',
  LowThroughput = 'LOW_THROUGHPUT',
  TaskStalled = 'TASK_STALLED',
  ResourceExhausted = 'RESOURCE_EXHAUSTED',
}

export interface TaskQueueMonitor {
  initialize(): Promise<void>;
  updateMetrics(metrics: Partial<TaskQueueMetrics>): void;
  getMetrics(): TaskQueueMetrics;
  addAlert(alert: TaskQueueAlert): void;
  getAlerts(options?: { 
    severity?: TaskQueueAlert['severity'][];
    type?: TaskQueueAlertType[];
    since?: Date;
  }): TaskQueueAlert[];
  clearAlerts(before?: Date): void;
  trackTask(task: Task): void;
} 