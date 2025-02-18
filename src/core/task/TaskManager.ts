import { EventEmitter } from 'events';
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskProgress, 
  TaskOptions,
  TaskStats,
  TaskFilter,
  TaskDependency
} from './types';
import { TaskQueue } from './TaskQueue';
import { Logger } from '../../utils/logger';
import { ResourceMonitor } from '../system/ResourceMonitor';

export class TaskManager extends EventEmitter {
  private readonly taskQueue: TaskQueue;
  private readonly runningTasks: Map<string, Task>;
  private readonly resourceMonitor: ResourceMonitor;
  private isProcessing: boolean = false;

  constructor(
    private readonly logger: Logger,
    private readonly config: {
      maxConcurrentTasks: number;
      defaultPriority: TaskPriority;
      defaultMaxAttempts: number;
      resourceThresholds: {
        maxCpuPercent: number;
        maxMemoryPercent: number;
      };
    }
  ) {
    super();
    this.taskQueue = new TaskQueue(logger);
    this.runningTasks = new Map();
    this.resourceMonitor = new ResourceMonitor(logger);
  }

  async submitTask<TInput, TOutput>(
    type: string,
    input: TInput,
    options: TaskOptions = {}
  ): Promise<Task<TInput, TOutput>> {
    const task: Task<TInput, TOutput> = {
      id: crypto.randomUUID(),
      type,
      status: 'pending',
      priority: options.priority || this.config.defaultPriority,
      input,
      metadata: {
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: options.maxAttempts || this.config.defaultMaxAttempts
      },
      dependencies: options.dependencies,
      cancelToken: new AbortController()
    };

    this.taskQueue.enqueue(task);
    this.emit('task:submitted', { taskId: task.id, type, priority: task.priority });

    if (!this.isProcessing) {
      this.processTasks();
    }

    return task;
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = this.taskQueue.getTask(taskId) || this.runningTasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.cancelToken?.abort();
    task.status = 'cancelled';

    if (this.runningTasks.has(taskId)) {
      this.runningTasks.delete(taskId);
    } else {
      this.taskQueue.removeTask(taskId);
    }

    // Cancel subtasks if any
    if (task.subtasks) {
      await Promise.all(task.subtasks.map(subtaskId => this.cancelTask(subtaskId)));
    }

    this.emit('task:cancelled', { taskId });
  }

  private async processTasks(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        const task = this.taskQueue.dequeue();
        if (!task) {
          break;
        }

        // Check resource availability
        const resources = await this.resourceMonitor.getResourceUsage();
        if (
          resources.cpu > this.config.resourceThresholds.maxCpuPercent ||
          resources.memory > this.config.resourceThresholds.maxMemoryPercent
        ) {
          this.taskQueue.enqueue(task); // Re-queue the task
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        // Check dependencies
        if (task.dependencies && !this.areDependenciesMet(task.dependencies)) {
          this.taskQueue.enqueue(task); // Re-queue the task
          continue;
        }

        this.runningTasks.set(task.id, task);
        this.processTask(task).catch(error => {
          this.logger.error({
            message: 'Task processing failed',
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error)
          });
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(task: Task): Promise<void> {
    try {
      task.status = 'running';
      task.metadata.startedAt = new Date();
      this.emit('task:started', { taskId: task.id });

      // Decompose task if needed
      if (this.shouldDecomposeTask(task)) {
        await this.decomposeAndProcessTask(task);
        return;
      }

      // Process the task
      const startTime = process.hrtime();
      const result = await this.executeTask(task);
      const [seconds, nanoseconds] = process.hrtime(startTime);

      task.status = 'completed';
      task.output = result;
      task.metadata.completedAt = new Date();
      task.metadata.resourceUsage = {
        duration: seconds + nanoseconds / 1e9
      };

      this.emit('task:completed', { 
        taskId: task.id,
        duration: task.metadata.resourceUsage.duration
      });

    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error : new Error(String(error));
      task.metadata.attempts++;

      if (task.metadata.attempts < task.metadata.maxAttempts) {
        this.taskQueue.enqueue(task); // Retry the task
      } else {
        this.emit('task:failed', {
          taskId: task.id,
          error: task.error,
          attempts: task.metadata.attempts
        });
      }
    } finally {
      this.runningTasks.delete(task.id);
      if (this.taskQueue.size() > 0 && !this.isProcessing) {
        this.processTasks();
      }
    }
  }

  private shouldDecomposeTask(task: Task): boolean {
    // Implement task decomposition logic
    // For example, based on input size, complexity, etc.
    return false;
  }

  private async decomposeAndProcessTask(task: Task): Promise<void> {
    // Implement task decomposition logic
    const subtasks = await this.decomposeTask(task);
    task.subtasks = subtasks.map(t => t.id);

    // Submit subtasks
    for (const subtask of subtasks) {
      this.taskQueue.enqueue(subtask);
    }
  }

  private async decomposeTask(task: Task): Promise<Task[]> {
    // Implement task decomposition strategy
    return [];
  }

  private async executeTask(task: Task): Promise<unknown> {
    // Implement task execution logic
    throw new Error('Task execution not implemented');
  }

  private areDependenciesMet(dependencies: TaskDependency[]): boolean {
    return dependencies.every(dep => {
      const depTask = this.taskQueue.getTask(dep.taskId);
      if (!depTask) return false;
      
      if (dep.type === 'hard') {
        return depTask.status === 'completed';
      } else {
        // For soft dependencies, consider them met if completed or failed
        return ['completed', 'failed'].includes(depTask.status);
      }
    });
  }

  getTaskStats(): TaskStats {
    const tasks = this.taskQueue.getTasks();
    const stats: TaskStats = {
      total: tasks.length,
      byStatus: {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      },
      byPriority: {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0
      },
      byType: {},
      averageCompletionTime: 0,
      failureRate: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0
      }
    };

    let totalCompletionTime = 0;
    let completedTasks = 0;

    for (const task of tasks) {
      // Update status counts
      stats.byStatus[task.status]++;
      
      // Update priority counts
      stats.byPriority[task.priority]++;
      
      // Update type counts
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;

      // Calculate completion time for completed tasks
      if (task.status === 'completed' && task.metadata.completedAt && task.metadata.startedAt) {
        totalCompletionTime += task.metadata.completedAt.getTime() - task.metadata.startedAt.getTime();
        completedTasks++;
      }
    }

    // Calculate averages
    if (completedTasks > 0) {
      stats.averageCompletionTime = totalCompletionTime / completedTasks;
    }

    stats.failureRate = stats.byStatus.failed / stats.total;

    return stats;
  }
} 