import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { WasmPipeline } from '../WasmPipeline';
import { WasmWorkerPool } from '../../workers/WasmWorkerPool';
import { ArrayBufferStrategy } from '../strategies/ArrayBufferStrategy';
import { performance } from 'perf_hooks';

jest.mock('../../workers/WasmWorkerPool');

describe('WasmPipeline Performance', () => {
  let workerPool: jest.Mocked<WasmWorkerPool>;
  let pipeline: WasmPipeline<ArrayBuffer, ArrayBuffer>;

  beforeEach(() => {
    workerPool = new WasmWorkerPool('test.js') as jest.Mocked<WasmWorkerPool>;
    pipeline = new WasmPipeline(
      workerPool,
      new ArrayBufferStrategy(),
      {
        chunkSize: 1024 * 1024, // 1MB chunks
        maxConcurrency: 4,
        retryAttempts: 1,
      }
    );
  });

  const createLargeBuffer = (size: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(size);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < view.length; i++) {
      view[i] = i % 256;
    }
    return buffer;
  };

  it('should process large data efficiently', async () => {
    const input = createLargeBuffer(100 * 1024 * 1024); // 100MB
    workerPool.execute.mockImplementation(async (_, [chunk]) => chunk);

    const start = performance.now();
    await pipeline.process(input, 'processChunk');
    const duration = performance.now() - start;

    const throughput = (input.byteLength / 1024 / 1024) / (duration / 1000);
    expect(throughput).toBeGreaterThan(50); // Expect >50MB/s
  });

  it('should maintain stable memory usage', async () => {
    const input = createLargeBuffer(50 * 1024 * 1024); // 50MB
    workerPool.execute.mockImplementation(async (_, [chunk]) => chunk);

    const initialMemory = process.memoryUsage().heapUsed;
    await pipeline.process(input, 'processChunk');
    const finalMemory = process.memoryUsage().heapUsed;

    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
    expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
  });

  it('should handle concurrent pipelines', async () => {
    const input = createLargeBuffer(10 * 1024 * 1024); // 10MB
    workerPool.execute.mockImplementation(async (_, [chunk]) => chunk);

    const pipelines = Array(5).fill(0).map(() => 
      pipeline.process(input, 'processChunk')
    );

    const start = performance.now();
    await Promise.all(pipelines);
    const duration = performance.now() - start;

    const totalData = input.byteLength * pipelines.length;
    const throughput = (totalData / 1024 / 1024) / (duration / 1000);
    expect(throughput).toBeGreaterThan(100); // Expect >100MB/s total
  });

  it('should scale with chunk size', async () => {
    const input = createLargeBuffer(20 * 1024 * 1024); // 20MB
    workerPool.execute.mockImplementation(async (_, [chunk]) => chunk);

    const chunkSizes = [256 * 1024, 512 * 1024, 1024 * 1024, 2048 * 1024];
    const results: Record<number, number> = {};

    for (const chunkSize of chunkSizes) {
      pipeline = new WasmPipeline(
        workerPool,
        new ArrayBufferStrategy(),
        { chunkSize, maxConcurrency: 4 }
      );

      const start = performance.now();
      await pipeline.process(input, 'processChunk');
      results[chunkSize] = performance.now() - start;
    }

    // Verify that larger chunks generally perform better
    const times = Object.values(results);
    expect(Math.min(...times)).toBe(results[Math.max(...chunkSizes)]);
  });
}); 