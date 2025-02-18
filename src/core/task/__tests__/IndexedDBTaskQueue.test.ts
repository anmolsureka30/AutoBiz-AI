import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { IndexedDBTaskQueue } from '../IndexedDBTaskQueue';
import { TaskStatus, TaskPriority, Task } from '../types';
import { MockIndexedDBService } from '../../storage/__mocks__/IndexedDBService';

// Mock the IndexedDBService
jest.mock('../../storage/IndexedDBService', () => ({
  IndexedDBService: MockIndexedDBService,
}));

describe('IndexedDBTaskQueue', () => {
  let queue: IndexedDBTaskQueue;

  beforeEach(async () => {
    queue = new IndexedDBTaskQueue();
    await queue.initialize();
  });

  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task-${Date.now()}`,
    type: 'TEST_TASK',
    status: TaskStatus.Pending,
    priority: TaskPriority.Normal,
    data: { test: true },
    metadata: {
      created: new Date(),
      lastUpdated: new Date(),
      attempts: 0,
    },
    ...overrides,
  });

  describe('enqueue', () => {
    it('should successfully enqueue a task', async () => {
      const task = createTask();
      await queue.enqueue(task);
      const peeked = await queue.peek();
      expect(peeked).toEqual(task);
    });

    it('should not allow duplicate task IDs', async () => {
      const task = createTask();
      await queue.enqueue(task);
      await expect(queue.enqueue(task)).rejects.toThrow();
    });
  });

  describe('dequeue', () => {
    it('should return null when queue is empty', async () => {
      const task = await queue.dequeue();
      expect(task).toBeNull();
    });

    it('should return and remove the next pending task', async () => {
      const task = createTask();
      await queue.enqueue(task);
      const dequeued = await queue.dequeue();
      expect(dequeued).toEqual(task);
      
      const empty = await queue.dequeue();
      expect(empty).toBeNull();
    });

    it('should prioritize tasks by priority', async () => {
      const lowPriorityTask = createTask({ priority: TaskPriority.Low });
      const highPriorityTask = createTask({ priority: TaskPriority.High });
      
      await queue.enqueue(lowPriorityTask);
      await queue.enqueue(highPriorityTask);
      
      const first = await queue.dequeue();
      expect(first).toEqual(highPriorityTask);
      
      const second = await queue.dequeue();
      expect(second).toEqual(lowPriorityTask);
    });
  });

  describe('getTasks', () => {
    it('should filter tasks by status', async () => {
      const pendingTask = createTask();
      const completedTask = createTask({ status: TaskStatus.Completed });
      
      await queue.enqueue(pendingTask);
      await queue.enqueue(completedTask);
      
      const pendingTasks = await queue.getTasks({ status: [TaskStatus.Pending] });
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0]).toEqual(pendingTask);
    });

    it('should filter tasks by priority', async () => {
      const normalTask = createTask();
      const highPriorityTask = createTask({ priority: TaskPriority.High });
      
      await queue.enqueue(normalTask);
      await queue.enqueue(highPriorityTask);
      
      const highPriorityTasks = await queue.getTasks({ priority: [TaskPriority.High] });
      expect(highPriorityTasks).toHaveLength(1);
      expect(highPriorityTasks[0]).toEqual(highPriorityTask);
    });

    it('should filter tasks by date range', async () => {
      const oldTask = createTask({
        metadata: {
          created: new Date('2023-01-01'),
          lastUpdated: new Date('2023-01-01'),
          attempts: 0,
        },
      });
      
      const newTask = createTask({
        metadata: {
          created: new Date('2023-12-01'),
          lastUpdated: new Date('2023-12-01'),
          attempts: 0,
        },
      });
      
      await queue.enqueue(oldTask);
      await queue.enqueue(newTask);
      
      const filteredTasks = await queue.getTasks({
        dateRange: {
          start: new Date('2023-06-01'),
          end: new Date('2023-12-31'),
        },
      });
      
      expect(filteredTasks).toHaveLength(1);
      expect(filteredTasks[0]).toEqual(newTask);
    });
  });

  describe('update', () => {
    it('should update an existing task', async () => {
      const task = createTask();
      await queue.enqueue(task);
      
      const updatedTask = {
        ...task,
        status: TaskStatus.Completed,
      };
      
      await queue.update(updatedTask);
      const tasks = await queue.getTasks({ status: [TaskStatus.Completed] });
      
      expect(tasks).toHaveLength(1);
      expect(tasks[0]).toEqual(updatedTask);
    });
  });

  describe('size', () => {
    it('should return the correct queue size', async () => {
      expect(await queue.size()).toBe(0);
      
      await queue.enqueue(createTask());
      expect(await queue.size()).toBe(1);
      
      await queue.enqueue(createTask());
      expect(await queue.size()).toBe(2);
      
      await queue.dequeue();
      expect(await queue.size()).toBe(1);
    });
  });

  it('should add a task with correct defaults', async () => {
    const taskData = {
      type: 'TEST_TASK',
      data: { test: true },
      priority: TaskPriority.Normal,
    };

    const task = await queue.addTask(taskData);

    expect(task).toMatchObject({
      ...taskData,
      status: TaskStatus.Pending,
      id: expect.any(String),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });
}); 