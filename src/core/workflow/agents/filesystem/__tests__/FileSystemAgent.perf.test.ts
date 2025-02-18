import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { FileSystemAgent } from '../FileSystemAgent';
import { FileOperationType } from '../types';
import * as fs from 'fs-extra';
import { performance } from 'perf_hooks';

jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileSystemAgent Performance', () => {
  let agent: FileSystemAgent;
  const testBasePath = '/test/base/path';

  beforeEach(() => {
    agent = new FileSystemAgent({
      basePath: testBasePath,
    });
    jest.clearAllMocks();
  });

  const generateLargeContent = (size: number): string => {
    return 'x'.repeat(size);
  };

  const measureExecutionTime = async (fn: () => Promise<void>): Promise<number> => {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  };

  describe('large file operations', () => {
    it('should handle large file writes efficiently', async () => {
      const content = generateLargeContent(10 * 1024 * 1024); // 10MB
      const operation = {
        type: FileOperationType.Write,
        path: 'large.txt',
        content,
      };

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        size: content.length,
        birthtime: new Date(),
        mtime: new Date(),
        atime: new Date(),
        mode: 0o644,
      } as any);

      const executionTime = await measureExecutionTime(async () => {
        await agent.execute(operation);
      });

      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockFs.writeFile).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent operations efficiently', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: FileOperationType.Write,
        path: `file${i}.txt`,
        content: `content${i}`,
      }));

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        size: 100,
        birthtime: new Date(),
        mtime: new Date(),
        atime: new Date(),
        mode: 0o644,
      } as any);

      const executionTime = await measureExecutionTime(async () => {
        await Promise.all(operations.map(op => agent.execute(op)));
      });

      const averageTime = executionTime / operations.length;
      expect(averageTime).toBeLessThan(10); // Average time per operation < 10ms
    });

    it('should maintain stable memory usage', async () => {
      const iterations = 1000;
      const measurements: number[] = [];

      const operation = {
        type: FileOperationType.Write,
        path: 'test.txt',
        content: generateLargeContent(1024 * 1024), // 1MB
      };

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        size: operation.content.length,
        birthtime: new Date(),
        mtime: new Date(),
        atime: new Date(),
        mode: 0o644,
      } as any);

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        await agent.execute(operation);
        if (i % 100 === 0) {
          measurements.push(process.memoryUsage().heapUsed);
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Memory increase should be less than 50MB
      expect(memoryIncrease).toBeLessThan(50);

      // Check for memory leaks
      const memoryVariation = Math.max(...measurements) - Math.min(...measurements);
      const averageVariation = memoryVariation / 1024 / 1024; // MB
      expect(averageVariation).toBeLessThan(100);
    });
  });

  describe('validation performance', () => {
    it('should validate operations quickly', async () => {
      const operations = Array.from({ length: 1000 }, (_, i) => ({
        id: `step-${i}`,
        config: {
          operation: {
            type: FileOperationType.Write,
            path: `file${i}.txt`,
            content: 'test',
          },
        },
      }));

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.access.mockResolvedValue(undefined);

      const executionTime = await measureExecutionTime(async () => {
        await Promise.all(operations.map(op => agent.validate(op)));
      });

      const averageTime = executionTime / operations.length;
      expect(averageTime).toBeLessThan(1); // Average validation time < 1ms
    });
  });
}); 