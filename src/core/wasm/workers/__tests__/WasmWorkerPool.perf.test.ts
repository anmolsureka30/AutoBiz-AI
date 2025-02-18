import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WasmWorkerPool } from '../WasmWorkerPool';
import { performance } from 'perf_hooks';

describe('WasmWorkerPool Performance', () => {
  let pool: WasmWorkerPool;

  beforeEach(async () => {
    pool = new WasmWorkerPool('/test-worker.js', {
      minWorkers: 4,
      maxWorkers: 8,
    });
    await pool.initialize({
      modulePath: '/test-module.wasm',
      moduleType: 'test',
    });
  });

  afterEach(async () => {
    await pool.terminate();
  });

  const measureExecutionTime = async (fn: () => Promise<void>): Promise<number> => {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  };

  it('should handle high concurrency efficiently', async () => {
    const taskCount = 1000;
    const tasks = Array(taskCount).fill(0).map((_, i) => 
      pool.execute('testFunction', [`arg${i}`])
    );

    const executionTime = await measureExecutionTime(async () => {
      await Promise.all(tasks);
    });

    const averageTaskTime = executionTime / taskCount;
    expect(averageTaskTime).toBeLessThan(10); // Less than 10ms per task
  });

  it('should maintain stable memory usage under load', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const tasks = Array(10).fill(0).map(() => 
        pool.execute('testFunction', ['arg'])
      );
      await Promise.all(tasks);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

    expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
  });

  it('should scale workers effectively', async () => {
    const tasks = Array(16).fill(0).map(() => 
      pool.execute('testFunction', ['arg'])
    );

    const startWorkers = (pool as any).workers.size;
    await Promise.all(tasks);
    const peakWorkers = (pool as any).workers.size;

    expect(peakWorkers).toBeGreaterThan(startWorkers);
    expect(peakWorkers).toBeLessThanOrEqual(8); // maxWorkers
  });
}); 