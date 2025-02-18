import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { WasmPipeline } from '../WasmPipeline';
import { WasmWorkerPool } from '../../workers/WasmWorkerPool';
import { ArrayBufferStrategy } from '../strategies/ArrayBufferStrategy';
import { JsonStrategy } from '../strategies/JsonStrategy';
import { PipelineStats, PipelineHooks } from '../types';

// Mock WasmWorkerPool
jest.mock('../../workers/WasmWorkerPool');

describe('WasmPipeline', () => {
  let workerPool: jest.Mocked<WasmWorkerPool>;
  let arrayBufferStrategy: ArrayBufferStrategy;
  let jsonStrategy: JsonStrategy;

  beforeEach(() => {
    workerPool = new WasmWorkerPool('test.js') as jest.Mocked<WasmWorkerPool>;
    arrayBufferStrategy = new ArrayBufferStrategy();
    jsonStrategy = new JsonStrategy();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ArrayBuffer processing', () => {
    let pipeline: WasmPipeline<ArrayBuffer, ArrayBuffer>;
    let hooks: jest.Mocked<PipelineHooks<ArrayBuffer, ArrayBuffer>>;

    beforeEach(() => {
      hooks = {
        onTaskStart: jest.fn(),
        onTaskComplete: jest.fn(),
        onTaskError: jest.fn(),
        onChunkProcessed: jest.fn(),
        onPipelineComplete: jest.fn(),
      };

      pipeline = new WasmPipeline(
        workerPool,
        arrayBufferStrategy,
        {
          chunkSize: 1024,
          maxConcurrency: 2,
          retryAttempts: 1,
        },
        hooks
      );
    });

    it('should process ArrayBuffer data correctly', async () => {
      const input = new ArrayBuffer(2048);
      const view = new Uint8Array(input);
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256;
      }

      workerPool.execute.mockImplementation(async (_, [chunk]) => chunk);

      const result = await pipeline.process(input, 'processChunk');

      expect(result.byteLength).toBe(input.byteLength);
      expect(new Uint8Array(result)).toEqual(view);
      expect(workerPool.execute).toHaveBeenCalledTimes(2);
    });

    it('should handle worker errors and retry', async () => {
      const input = new ArrayBuffer(1024);
      let attempts = 0;

      workerPool.execute.mockImplementation(async () => {
        if (attempts++ === 0) {
          throw new Error('Worker error');
        }
        return input;
      });

      const result = await pipeline.process(input, 'processChunk');

      expect(result).toBeDefined();
      expect(workerPool.execute).toHaveBeenCalledTimes(2);
      expect(hooks.onTaskError).toHaveBeenCalledTimes(1);
    });

    it('should respect concurrency limits', async () => {
      const input = new ArrayBuffer(4096); // Will create 4 chunks
      const executionTimes: number[] = [];

      workerPool.execute.mockImplementation(async () => {
        executionTimes.push(Date.now());
        await new Promise(resolve => setTimeout(resolve, 100));
        return new ArrayBuffer(1024);
      });

      await pipeline.process(input, 'processChunk');

      // Check that no more than 2 tasks were running simultaneously
      let maxConcurrent = 0;
      for (let i = 0; i < executionTimes.length; i++) {
        const concurrent = executionTimes.filter(
          time => time - executionTimes[i] < 50
        ).length;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
      }

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should call hooks in correct order', async () => {
      const input = new ArrayBuffer(2048);
      workerPool.execute.mockResolvedValue(new ArrayBuffer(1024));

      await pipeline.process(input, 'processChunk');

      expect(hooks.onTaskStart).toHaveBeenCalledTimes(2);
      expect(hooks.onTaskComplete).toHaveBeenCalledTimes(2);
      expect(hooks.onChunkProcessed).toHaveBeenCalledTimes(2);
      expect(hooks.onPipelineComplete).toHaveBeenCalledTimes(1);

      // Verify hook order
      const startCalls = hooks.onTaskStart.mock.invocationCallOrder;
      const completeCalls = hooks.onTaskComplete.mock.invocationCallOrder;
      const processedCalls = hooks.onChunkProcessed.mock.invocationCallOrder;
      const pipelineCalls = hooks.onPipelineComplete.mock.invocationCallOrder;

      expect(Math.min(...startCalls)).toBeLessThan(Math.min(...completeCalls));
      expect(Math.max(...completeCalls)).toBeLessThan(Math.min(...pipelineCalls));
    });
  });

  describe('JSON processing', () => {
    let pipeline: WasmPipeline<unknown, unknown>;

    beforeEach(() => {
      pipeline = new WasmPipeline(
        workerPool,
        jsonStrategy,
        {
          chunkSize: 100,
          validateResults: true,
        }
      );
    });

    it('should process nested JSON structures', async () => {
      const input = {
        array: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(50),
        })),
        nested: {
          object: {
            value: 'x'.repeat(200),
          },
        },
      };

      workerPool.execute.mockImplementation(async (_, [chunk]) => chunk);

      const result = await pipeline.process(input, 'processChunk');

      expect(result).toEqual(input);
    });

    it('should handle validation failures', async () => {
      const input = { data: 'test' };

      workerPool.execute.mockImplementation(async () => {
        return { invalid: 'response' };
      });

      await expect(pipeline.process(input, 'processChunk'))
        .rejects.toThrow('Pipeline output validation failed');
    });
  });

  describe('Pipeline statistics', () => {
    let pipeline: WasmPipeline<ArrayBuffer, ArrayBuffer>;

    beforeEach(() => {
      pipeline = new WasmPipeline(
        workerPool,
        arrayBufferStrategy,
        { chunkSize: 1024 }
      );
    });

    it('should track pipeline statistics', async () => {
      const input = new ArrayBuffer(3072); // Will create 3 chunks
      let errorCount = 0;

      workerPool.execute.mockImplementation(async () => {
        if (errorCount++ === 1) {
          throw new Error('Simulated error');
        }
        return new ArrayBuffer(1024);
      });

      await pipeline.process(input, 'processChunk');

      const stats = pipeline.getStats();
      expect(stats.totalTasks).toBe(3);
      expect(stats.failedTasks).toBe(1);
      expect(stats.retryRate).toBeGreaterThan(0);
      expect(stats.successRate).toBe(1); // All tasks eventually succeeded
      expect(stats.errorTypes).toHaveProperty('Error');
    });

    it('should measure processing time accurately', async () => {
      const input = new ArrayBuffer(2048);

      workerPool.execute.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return new ArrayBuffer(1024);
      });

      await pipeline.process(input, 'processChunk');

      const stats = pipeline.getStats();
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(100);
      expect(stats.averageProcessingTime).toBeLessThanOrEqual(200);
    });
  });
}); 