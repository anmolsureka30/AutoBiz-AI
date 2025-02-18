import { Task } from '../types';

interface MockCursor {
  value: Task;
  key: IDBValidKey | IDBKeyRange;
  source: IDBIndex | null;
  continue: () => void;
}

interface MockCursorRequest extends IDBRequest {
  result: MockCursor | null;
  onsuccess: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
}

export class MockIndexedDBService {
  private store: Map<string, Task> = new Map();
  private indexes: Map<string, Map<string | number, Task[]>> = new Map();

  async initialize(): Promise<void> {
    // Reset store and indexes
    this.store.clear();
    this.indexes.clear();
    
    // Initialize indexes
    this.indexes.set('status', new Map());
    this.indexes.set('priority', new Map());
    this.indexes.set('created', new Map());
  }

  async transaction<T>(
    _storeName: string,
    _mode: 'readonly' | 'readwrite',
    callback: (store: IDBObjectStore) => Promise<T>
  ): Promise<T> {
    const mockStore = {
      add: (task: Task) => this.addTask(task),
      put: (task: Task) => this.updateTask(task),
      delete: (taskId: string) => this.deleteTask(taskId),
      count: () => this.store.size,
      index: (indexName: string) => this.getIndex(indexName),
    } as unknown as IDBObjectStore;

    return callback(mockStore);
  }

  private addTask(task: Task): IDBRequest {
    if (this.store.has(task.id)) {
      return this.createErrorRequest('Task already exists');
    }

    this.store.set(task.id, task);
    this.updateIndexes(task);
    return this.createSuccessRequest(undefined);
  }

  private updateTask(task: Task): IDBRequest {
    this.store.set(task.id, task);
    this.updateIndexes(task);
    return this.createSuccessRequest(undefined);
  }

  private deleteTask(taskId: string): IDBRequest {
    const task = this.store.get(taskId);
    if (task) {
      this.store.delete(taskId);
      this.removeFromIndexes(task);
    }
    return this.createSuccessRequest(undefined);
  }

  private getIndex(indexName: string): IDBIndex {
    const index = this.indexes.get(indexName);
    if (!index) {
      throw new Error(`Index ${indexName} not found`);
    }

    return {
      openCursor: (key?: IDBValidKey | IDBKeyRange) => {
        return this.createCursorRequest(index, key);
      },
    } as unknown as IDBIndex;
  }

  private updateIndexes(task: Task): void {
    // Status index
    this.updateIndex('status', task.status, task);
    
    // Priority index
    this.updateIndex('priority', task.priority.toString(), task);
    
    // Created index
    this.updateIndex('created', task.metadata.created.getTime(), task);
  }

  private updateIndex(indexName: string, key: string | number, task: Task): void {
    const index = this.indexes.get(indexName)!;
    let tasks = index.get(key);
    if (!tasks) {
      tasks = [];
      index.set(key);
    }
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
  }

  private removeFromIndexes(task: Task): void {
    this.removeFromIndex('status', task.status, task.id);
    this.removeFromIndex('priority', task.priority.toString(), task.id);
    this.removeFromIndex('created', task.metadata.created.getTime(), task.id);
  }

  private removeFromIndex(indexName: string, key: string | number, taskId: string): void {
    const index = this.indexes.get(indexName)!;
    const tasks = index.get(key);
    if (tasks) {
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        tasks.splice(taskIndex, 1);
      }
      if (tasks.length === 0) {
        index.delete(key);
      }
    }
  }

  private createSuccessRequest(result: any): IDBRequest {
    return {
      result,
      error: null,
      onsuccess: null,
      onerror: null,
    } as IDBRequest;
  }

  private createErrorRequest(message: string): IDBRequest {
    return {
      result: null,
      error: new Error(message),
      onsuccess: null,
      onerror: null,
    } as IDBRequest;
  }

  private createCursorRequest(
    index: Map<string | number, Task[]>,
    key?: IDBValidKey | IDBKeyRange
  ): MockCursorRequest {
    let tasks: Task[] = [];
    
    if (key instanceof IDBKeyRange) {
      // Handle range queries
      for (const [indexKey, indexTasks] of index.entries()) {
        const keyNum = Number(indexKey);
        if (
          (!key.lower || keyNum >= key.lower) &&
          (!key.upper || keyNum <= key.upper)
        ) {
          tasks = tasks.concat(indexTasks);
        }
      }
    } else if (key !== undefined) {
      // Handle exact key match
      const keyStr = key instanceof Date ? key.getTime().toString() : key.toString();
      tasks = index.get(keyStr) || [];
    } else {
      // Handle no key (get all)
      tasks = Array.from(index.values()).flat();
    }

    let currentIndex = 0;
    let request: MockCursorRequest;

    request = {
      result: tasks[currentIndex] ? {
        value: tasks[currentIndex],
        key: key,
        source: null,
        continue: () => {
          currentIndex++;
          if (request.onsuccess && currentIndex < tasks.length) {
            request.onsuccess(new Event('success'));
          }
        },
      } : null,
      onsuccess: null,
      onerror: null,
    } as MockCursorRequest;

    return request;
  }
} 