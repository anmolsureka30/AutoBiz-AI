import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WasmWorkerPool } from '../WasmWorkerPool';
import { WasmWorkerMessageType, InitializeMessage } from '../types';

// Mock Worker
class MockWorker implements Worker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  constructor(public scriptURL: string) {}

  addEventListener(): void {}
  removeEventListener(): void {}
  terminate(): void {}
  postMessage(message: any): void {
    // Simulate successful initialization
    if (message.type === WasmWorkerMessageType.Initialize) {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', {
          data: {
            id: message.id,
            type: WasmWorkerMessageType.Initialize,
            success: true,
          },
        }));
      }, 0);
    }
    // Simulate successful execution
    if (message.type === WasmWorkerMessageType.Execute) {
      setTimeout(() => {
        this.onmessage?.(new MessageEvent('message', {
          data: {
            id: message.id,
            type: WasmWorkerMessageType.Execute,
            success: true,
            data: 'test result',
          },
        }));
      }, 0);
    }
  }
}

// Mock global Worker
global.Worker = MockWorker as any;

describe('WasmWorkerPool', () => {
  let pool: WasmWorkerPool;
  const workerScript = '/test-worker.js';
  const moduleConfig: InitializeMessage = {
    modulePath: '/test-module.wasm',
    moduleType: 'test',
  };

  beforeEach(() => {
    pool = new WasmWorkerPool(workerScript, {
      minWorkers: 2,
      maxWorkers: 4,
      taskTimeout: 1000,
    });
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await pool.terminate();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should create minimum number of workers', async () => {
      await pool.initialize(moduleConfig);
      expect((pool as any).workers.size).toBe(2);
    });

    it('should fail initialization if worker creation fails', async () => {
      const error = new Error('Worker creation failed');
      jest.spyOn(global, 'Worker').mockImplementationOnce(() => {
        throw error;
      });

      await expect(pool.initialize(moduleConfig)).rejects.toThrow();
    });

    it('should prevent double initialization', async () => {
      await pool.initialize(moduleConfig);
      await expect(pool.initialize(moduleConfig)).rejects.toThrow();
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await pool.initialize(moduleConfig);
    });

    it('should execute task successfully', async () => {
      const result = await pool.execute('testFunction', ['arg1', 'arg2']);
      expect(result).toBe('test result');
    });

    it('should handle concurrent tasks', async () => {
      const tasks = Array(5).fill(0).map(() => 
        pool.execute('testFunction', ['arg'])
      );
      const results = await Promise.all(tasks);
      expect(results).toHaveLength(5);
    });

    it('should respect maxWorkers limit', async () => {
      const tasks = Array(6).fill(0).map(() => 
        pool.execute('testFunction', ['arg'])
      );
      await Promise.all(tasks);
      expect((pool as any).workers.size).toBeLessThanOrEqual(4);
    });

    it('should handle task timeouts', async () => {
      // Mock slow worker
      jest.spyOn(MockWorker.prototype, 'postMessage').mockImplementationOnce(() => {
        // Don't respond, simulating timeout
      });

      const promise = pool.execute('testFunction', ['arg']);
      jest.advanceTimersByTime(1100);
      await expect(promise).rejects.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await pool.initialize(moduleConfig);
    });

    it('should handle worker errors', async () => {
      const worker = Array.from((pool as any).workers.values())[0];
      const error = new ErrorEvent('error', {
        error: new Error('Worker error'),
        message: 'Worker error',
      });

      worker.worker.onerror?.(error);

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Should have replaced the worker
      expect((pool as any).workers.size).toBe(2);
    });

    it('should handle failed task execution', async () => {
      // Mock failed execution
      jest.spyOn(MockWorker.prototype, 'postMessage').mockImplementationOnce(() => {
        setTimeout(() => {
          this.onmessage?.(new MessageEvent('message', {
            data: {
              id: 'test',
              type: WasmWorkerMessageType.Execute,
              success: false,
              error: { message: 'Execution failed' },
            },
          }));
        }, 0);
      });

      await expect(pool.execute('testFunction', ['arg']))
        .rejects.toThrow('Execution failed');
    });
  });

  describe('maintenance', () => {
    beforeEach(async () => {
      await pool.initialize(moduleConfig);
    });

    it('should remove idle workers', async () => {
      // Create extra workers
      await Promise.all([
        pool.execute('testFunction', ['arg1']),
        pool.execute('testFunction', ['arg2']),
        pool.execute('testFunction', ['arg3']),
      ]);

      expect((pool as any).workers.size).toBeGreaterThan(2);

      // Advance time to trigger maintenance
      jest.advanceTimersByTime(61000);

      // Should have removed idle workers
      expect((pool as any).workers.size).toBe(2);
    });

    it('should maintain minimum workers', async () => {
      jest.advanceTimersByTime(61000);
      expect((pool as any).workers.size).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should terminate all workers', async () => {
      await pool.initialize(moduleConfig);
      await pool.terminate();
      expect((pool as any).workers.size).toBe(0);
      expect((pool as any).initialized).toBe(false);
    });

    it('should handle termination of busy workers', async () => {
      await pool.initialize(moduleConfig);
      
      // Start a task
      const task = pool.execute('testFunction', ['arg']);
      
      // Terminate while task is running
      await pool.terminate();
      
      // Task should fail
      await expect(task).rejects.toThrow();
    });
  });
}); 