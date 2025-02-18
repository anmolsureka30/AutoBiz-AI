import { Task, TaskStatus } from '../types';

interface TaskExecution {
  taskId: string;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: TaskStatus;
  retryCount: number;
}

export class TaskPerformanceTracker {
  private readonly executionWindow: number; // milliseconds
  private readonly executions: Map<string, TaskExecution>;
  private lastCleanup: Date;

  constructor(executionWindow: number = 300000) { // 5 minutes default
    this.executionWindow = executionWindow;
    this.executions = new Map();
    this.lastCleanup = new Date();
  }

  trackTask(task: Task): void {
    const execution = this.executions.get(task.id) || {
      taskId: task.id,
      queuedAt: task.metadata.created,
      status: task.status,
      retryCount: task.metadata.attempts,
    };

    if (task.status === TaskStatus.Processing && !execution.startedAt) {
      execution.startedAt = new Date();
    }

    if (
      (task.status === TaskStatus.Completed || task.status === TaskStatus.Failed) &&
      !execution.completedAt
    ) {
      execution.completedAt = new Date();
    }

    execution.status = task.status;
    execution.retryCount = task.metadata.attempts;

    this.executions.set(task.id, execution);
    this.cleanup();
  }

  getPerformanceMetrics(): {
    averageWaitTime: number;
    averageProcessingTime: number;
    throughput: number;
    retryRate: number;
  } {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.executionWindow);
    
    let totalWaitTime = 0;
    let totalProcessingTime = 0;
    let completedTasks = 0;
    let totalRetries = 0;
    let totalTasks = 0;

    for (const execution of this.executions.values()) {
      if (execution.completedAt && execution.completedAt >= windowStart) {
        totalTasks++;
        totalRetries += execution.retryCount;

        if (execution.startedAt) {
          // Calculate wait time (time from queued to started)
          totalWaitTime += execution.startedAt.getTime() - execution.queuedAt.getTime();

          // Calculate processing time (time from started to completed)
          totalProcessingTime += execution.completedAt.getTime() - execution.startedAt.getTime();
          completedTasks++;
        }
      }
    }

    const minutesInWindow = this.executionWindow / (1000 * 60);
    
    return {
      averageWaitTime: completedTasks > 0 ? totalWaitTime / completedTasks : 0,
      averageProcessingTime: completedTasks > 0 ? totalProcessingTime / completedTasks : 0,
      throughput: completedTasks / minutesInWindow,
      retryRate: totalTasks > 0 ? totalRetries / totalTasks : 0,
    };
  }

  private cleanup(): void {
    const now = new Date();
    
    // Only cleanup every minute to avoid excessive processing
    if (now.getTime() - this.lastCleanup.getTime() < 60000) {
      return;
    }

    const cutoff = new Date(now.getTime() - this.executionWindow);
    
    for (const [taskId, execution] of this.executions.entries()) {
      if (execution.completedAt && execution.completedAt < cutoff) {
        this.executions.delete(taskId);
      }
    }

    this.lastCleanup = now;
  }
} 