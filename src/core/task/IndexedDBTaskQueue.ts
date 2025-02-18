import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  TaskFilter, 
  TaskQueueStats, 
  TaskQueueConfig,
  TaskQueue,
  StoreConfig
} from './types';
import { IndexedDBService } from '../storage/IndexedDBService';
import { Logger } from '../../utils/logger/Logger';
import { TaskQueueMonitor } from './monitoring/types';
import { DefaultTaskQueueMonitor } from './monitoring/TaskQueueMonitor';

export class IndexedDBTaskQueue implements TaskQueue {
  private readonly logger: Logger;
  private readonly db: IndexedDBService;
  private readonly monitor: TaskQueueMonitor;
  private readonly config: Required<TaskQueueConfig>;
  private readonly STORE_NAME = 'tasks';

  constructor(monitor?: TaskQueueMonitor, config: TaskQueueConfig = {}) {
    this.logger = new Logger('IndexedDBTaskQueue');
    this.db = new IndexedDBService('taskQueue', 1);
    this.monitor = monitor || new DefaultTaskQueueMonitor();
    this.config = {
      maxConcurrent: 5,
      maxRetries: 3,
      retryDelay: 1000,
      priorityLevels: {
        [TaskPriority.High]: 3,
        [TaskPriority.Normal]: 2,
        [TaskPriority.Low]: 1,
      },
      ...config,
    };
  }

  private async getCursor(
    index: IDBIndex,
    key: IDBValidKey | IDBKeyRange | undefined
  ): Promise<IDBCursorWithValue | null> {
    return new Promise((resolve, reject) => {
      const request = index.openCursor(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getFilterCursor(
    store: IDBObjectStore,
    filter: TaskFilter
  ): Promise<IDBCursorWithValue | null> {
    if (filter.status?.length === 1) {
      return this.getCursor(store.index('status'), filter.status[0]);
    }
    if (filter.priority?.length === 1) {
      // Convert number to string for IDB key
      return this.getCursor(store.index('priority'), filter.priority[0].toString());
    }
    // Use IDBKeyRange for created index
    return this.getCursor(store.index('created'), IDBKeyRange.lowerBound(0));
  }

  async initialize(): Promise<void> {
    try {
      const storeConfig: StoreConfig = {
        name: this.STORE_NAME,
        keyPath: 'id',
        indexes: [
          { name: 'status', keyPath: 'status' },
          { name: 'priority', keyPath: 'priority' },
          { name: 'type', keyPath: 'type' },
          { name: 'createdAt', keyPath: 'createdAt' },
          { name: 'updatedAt', keyPath: 'updatedAt' },
        ],
      };

      await this.db.initialize([storeConfig]);
    } catch (error) {
      this.logger.error('Failed to initialize task queue', { error });
      throw error;
    }
  }

  async enqueue(task: Task): Promise<void> {
    try {
      // Ensure task has required metadata
      task.metadata = {
        created: new Date(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        agentIds: [],
        ...task.metadata,
      };

      // Set initial task status
      task.status = TaskStatus.Pending;
      task.createdAt = new Date();
      task.updatedAt = new Date();

      await this.db.add(this.STORE_NAME, task);
      await this.updateMetrics();

      this.logger.info('Task enqueued', {
        taskId: task.id,
        type: task.type,
        priority: task.priority,
      });

      // Notify monitor
      this.monitor.trackTask(task);
    } catch (error) {
      this.logger.error('Failed to enqueue task', { error, task });
      throw error;
    }
  }

  async dequeue(): Promise<Task | null> {
    try {
      // Get highest priority pending task
      const pendingTasks = await this.filter({
        status: [TaskStatus.Pending],
      });

      if (pendingTasks.length === 0) {
        return null;
      }

      // Sort by priority and creation time
      const task = pendingTasks.sort((a, b) => {
        const priorityDiff = 
          this.config.priorityLevels[b.priority] - 
          this.config.priorityLevels[a.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })[0];

      // Update task status
      task.status = TaskStatus.Running;
      task.startedAt = new Date();
      task.updatedAt = new Date();

      await this.update(task);
      await this.updateMetrics();

      this.logger.info('Task dequeued', {
        taskId: task.id,
        type: task.type,
        priority: task.priority,
      });

      return task;
    } catch (error) {
      this.logger.error('Failed to dequeue task', { error });
      throw error;
    }
  }

  async peek(): Promise<Task | null> {
    try {
      const pendingTasks = await this.filter({
        status: [TaskStatus.Pending],
      });

      if (pendingTasks.length === 0) {
        return null;
      }

      // Sort by priority and creation time
      return pendingTasks.sort((a, b) => {
        const priorityDiff = 
          this.config.priorityLevels[b.priority] - 
          this.config.priorityLevels[a.priority];
        
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })[0];
    } catch (error) {
      this.logger.error('Failed to peek task', { error });
      throw error;
    }
  }

  async size(): Promise<number> {
    try {
      return await this.db.count(this.STORE_NAME);
    } catch (error) {
      this.logger.error('Failed to get queue size', { error });
      throw error;
    }
  }

  async remove(taskId: string): Promise<void> {
    try {
      await this.db.transaction('tasks', 'readwrite', async (store) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.delete(taskId);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
    } catch (error) {
      this.logger.error('Failed to remove task', { error, taskId });
      throw error;
    }
  }

  async update(task: Task): Promise<void> {
    try {
      await this.db.transaction('tasks', 'readwrite', async (store) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.put(task);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });
      
      // Track task performance after update
      this.monitor.trackTask(task);
      await this.updateMetrics();
    } catch (error) {
      this.logger.error('Failed to update task', { error, taskId: task.id });
      throw error;
    }
  }

  async getTasks(filter: TaskFilter): Promise<Task[]> {
    try {
      return await this.db.transaction('tasks', 'readonly', async (store) => {
        const tasks: Task[] = [];
        let cursor = await this.getFilterCursor(store, filter);

        while (cursor) {
          const task = cursor.value as Task;
          if (this.matchesFilter(task, filter)) {
            tasks.push(task);
          }
          cursor = await this.getCursor(cursor.source as IDBIndex, cursor.key);
        }

        return tasks;
      });
    } catch (error) {
      this.logger.error('Failed to get tasks', { error, filter });
      throw error;
    }
  }

  private matchesFilter(task: Task, filter: TaskFilter): boolean {
    if (filter.status && !filter.status.includes(task.status)) {
      return false;
    }
    if (filter.priority && !filter.priority.includes(task.priority)) {
      return false;
    }
    if (filter.type && !filter.type.includes(task.type)) {
      return false;
    }
    if (filter.dateRange && task.metadata?.created) {
      const created = task.metadata.created.getTime();
      if (
        created < filter.dateRange.start.getTime() ||
        created > filter.dateRange.end.getTime()
      ) {
        return false;
      }
    }
    return true;
  }

  private async updateMetrics(): Promise<void> {
    const [
      pendingTasks,
      completedTasks,
      failedTasks,
      highPriorityTasks,
      normalPriorityTasks,
      lowPriorityTasks,
    ] = await Promise.all([
      this.getTasks({ status: [TaskStatus.Pending] }),
      this.getTasks({ status: [TaskStatus.Completed] }),
      this.getTasks({ status: [TaskStatus.Failed] }),
      this.getTasks({ priority: [TaskPriority.High] }),
      this.getTasks({ priority: [TaskPriority.Normal] }),
      this.getTasks({ priority: [TaskPriority.Low] }),
    ]);

    const totalTasks = pendingTasks.length + completedTasks.length + failedTasks.length;
    const errorRate = totalTasks > 0 ? failedTasks.length / totalTasks : 0;
    const successRate = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

    this.monitor.updateMetrics({
      totalTasks,
      pendingTasks: pendingTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      errorRate,
      successRate,
      priorityDistribution: {
        high: highPriorityTasks.length,
        normal: normalPriorityTasks.length,
        low: lowPriorityTasks.length,
      },
    });
  }
} 