import { Task, TaskPriority, TaskStatus, TaskFilter } from './types';
import { Logger } from '../../utils/logger';

export class TaskQueue {
  private readonly queues: Map<TaskPriority, Task[]>;
  private readonly taskMap: Map<string, Task>;

  constructor(private readonly logger: Logger) {
    this.queues = new Map();
    this.taskMap = new Map();
    
    // Initialize priority queues
    for (let priority = 1; priority <= 5; priority++) {
      this.queues.set(priority as TaskPriority, []);
    }
  }

  enqueue(task: Task): void {
    if (this.taskMap.has(task.id)) {
      throw new Error(`Task with ID ${task.id} already exists`);
    }

    const queue = this.queues.get(task.priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${task.priority}`);
    }

    queue.push(task);
    this.taskMap.set(task.id, task);

    this.logger.info({
      message: 'Task enqueued',
      taskId: task.id,
      priority: task.priority,
      type: task.type
    });
  }

  dequeue(): Task | undefined {
    // Try to get highest priority task first
    for (let priority = 1; priority <= 5; priority++) {
      const queue = this.queues.get(priority as TaskPriority);
      if (queue && queue.length > 0) {
        const task = queue.shift();
        if (task) {
          this.logger.info({
            message: 'Task dequeued',
            taskId: task.id,
            priority: task.priority
          });
          return task;
        }
      }
    }
    return undefined;
  }

  peek(): Task | undefined {
    for (let priority = 1; priority <= 5; priority++) {
      const queue = this.queues.get(priority as TaskPriority);
      if (queue && queue.length > 0) {
        return queue[0];
      }
    }
    return undefined;
  }

  getTask(taskId: string): Task | undefined {
    return this.taskMap.get(taskId);
  }

  updateTask(taskId: string, updates: Partial<Task>): void {
    const task = this.taskMap.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    Object.assign(task, updates);
    this.logger.info({
      message: 'Task updated',
      taskId,
      updates
    });
  }

  removeTask(taskId: string): void {
    const task = this.taskMap.get(taskId);
    if (!task) {
      return;
    }

    const queue = this.queues.get(task.priority);
    if (queue) {
      const index = queue.findIndex(t => t.id === taskId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }

    this.taskMap.delete(taskId);
    this.logger.info({
      message: 'Task removed',
      taskId
    });
  }

  getTasks(filter?: TaskFilter): Task[] {
    const tasks = Array.from(this.taskMap.values());
    if (!filter) {
      return tasks;
    }

    return tasks.filter(task => {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(task.status)) {
          return false;
        }
      }

      if (filter.priority) {
        const priorities = Array.isArray(filter.priority) ? filter.priority : [filter.priority];
        if (!priorities.includes(task.priority)) {
          return false;
        }
      }

      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        if (!types.includes(task.type)) {
          return false;
        }
      }

      if (filter.assignedTo && task.assignedTo !== filter.assignedTo) {
        return false;
      }

      if (filter.createdBefore && task.metadata.createdAt >= filter.createdBefore) {
        return false;
      }

      if (filter.createdAfter && task.metadata.createdAt <= filter.createdAfter) {
        return false;
      }

      return true;
    });
  }

  size(): number {
    return this.taskMap.size;
  }

  clear(): void {
    this.queues.forEach(queue => queue.length = 0);
    this.taskMap.clear();
    this.logger.info({
      message: 'Task queue cleared'
    });
  }
} 