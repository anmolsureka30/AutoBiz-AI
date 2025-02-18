import type { jest } from '@jest/globals';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AgentMonitoringService } from '../AgentMonitoringService';
import { MonitoringStorageService } from '../../../storage/MonitoringStorageService';
import { AgentMetrics } from '../types';
import './setup';

jest.mock('../../../storage/MonitoringStorageService');

describe('AgentMonitoringService Performance', () => {
  let service: AgentMonitoringService;
  let mockStorage: jest.Mocked<MonitoringStorageService>;
  let mockDate: Date;

  beforeEach(async () => {
    mockDate = new Date('2023-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as string);

    mockStorage = new MonitoringStorageService() as jest.Mocked<MonitoringStorageService>;
    (MonitoringStorageService as jest.Mock).mockImplementation(() => mockStorage);
    mockStorage.initialize.mockResolvedValue();
    mockStorage.getSnapshots.mockResolvedValue([]);

    service = new AgentMonitoringService({
      snapshotInterval: 1000,
      retentionPeriod: 3600000, // 1 hour
      maxSnapshots: 3600, // 1 hour of snapshots
    });

    await service.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const createMetricsUpdate = (index: number): Partial<AgentMetrics> => ({
    activeAgents: Math.floor(Math.random() * 100),
    completedTasks: index * 10,
    failedTasks: Math.floor(Math.random() * 10),
    cpuUsage: Math.random(),
    memoryUsage: Math.random(),
    averageResponseTime: Math.random() * 1000,
  });

  const measureTime = (startTime: HRTime): number => {
    const [seconds, nanoseconds] = process.hrtime(startTime as [number, number]);
    return (seconds * 1000) + (nanoseconds / 1000000);
  };

  describe('metrics update performance', () => {
    it('should handle rapid metrics updates efficiently', () => {
      const iterations = 10000;
      const startTime = process.hrtime();

      for (let i = 0; i < iterations; i++) {
        service.updateMetrics(createMetricsUpdate(i));
      }

      const totalMs = measureTime(startTime);
      const operationsPerSecond = iterations / (totalMs / 1000);

      // Performance assertions
      expect(totalMs).toBeLessThan(1000); // Should complete in less than 1 second
      expect(operationsPerSecond).toBeGreaterThan(5000); // At least 5000 ops/sec
    });

    it('should maintain consistent performance with growing error list', () => {
      const measurements: number[] = [];
      const batchSize = 1000;
      const batches = 5;

      for (let batch = 0; batch < batches; batch++) {
        const startTime = process.hrtime();

        for (let i = 0; i < batchSize; i++) {
          service.reportError({
            timestamp: new Date(),
            message: `Error ${batch * batchSize + i}`,
            code: 'TEST_ERROR',
          });
        }

        const totalMs = measureTime(startTime);
        measurements.push(totalMs);
      }

      // Calculate performance degradation
      const firstBatch = measurements[0];
      const lastBatch = measurements[measurements.length - 1];
      const degradation = (lastBatch - firstBatch) / firstBatch;

      // Performance should not degrade more than 50%
      expect(degradation).toBeLessThan(0.5);
    });
  });

  describe('snapshot performance', () => {
    it('should efficiently handle large numbers of snapshots', async () => {
      jest.useFakeTimers();
      const snapshotCount = 1000;
      const measurements: number[] = [];

      for (let i = 0; i < snapshotCount; i++) {
        service.updateMetrics(createMetricsUpdate(i));
        mockDate = new Date(mockDate.getTime() + 1000);

        const startTime = process.hrtime();
        await service['takeSnapshot']();
        const totalMs = measureTime(startTime);
        measurements.push(totalMs);

        if (i % 100 === 0) {
          // Simulate periodic cleanup
          await service['cleanupSnapshots']();
        }
      }

      const averageTime = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxTime = Math.max(...measurements);

      // Performance assertions
      expect(averageTime).toBeLessThan(5); // Average < 5ms per snapshot
      expect(maxTime).toBeLessThan(20); // Max < 20ms per snapshot
    });

    it('should maintain query performance with increasing data', async () => {
      const queryMeasurements: number[] = [];
      const batchSize = 100;
      const batches = 10;

      for (let batch = 0; batch < batches; batch++) {
        // Add batch of snapshots
        for (let i = 0; i < batchSize; i++) {
          mockDate = new Date(mockDate.getTime() + 1000);
          await service['takeSnapshot']();
        }

        // Measure query performance
        const startTime = process.hrtime();
        await service.getSnapshots({
          startTime: new Date(mockDate.getTime() - 300000), // Last 5 minutes
          endTime: mockDate,
        });
        const totalMs = measureTime(startTime);
        queryMeasurements.push(totalMs);
      }

      // Calculate query performance degradation
      const firstQuery = queryMeasurements[0];
      const lastQuery = queryMeasurements[queryMeasurements.length - 1];
      const queryDegradation = (lastQuery - firstQuery) / firstQuery;

      // Query performance should not degrade more than 100%
      expect(queryDegradation).toBeLessThan(1.0);
    });
  });

  describe('memory usage', () => {
    it('should maintain stable memory usage during continuous operation', () => {
      const getMemoryUsage = () => {
        const usage = process.memoryUsage();
        return usage.heapUsed / 1024 / 1024; // Convert to MB
      };

      const initialMemory = getMemoryUsage();
      const measurements: number[] = [];

      // Simulate heavy usage
      for (let i = 0; i < 10000; i++) {
        service.updateMetrics(createMetricsUpdate(i));
        if (i % 100 === 0) {
          measurements.push(getMemoryUsage());
        }
      }

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;

      // Memory usage should not increase by more than 50MB
      expect(memoryIncrease).toBeLessThan(50);

      // Check for memory leaks
      const memoryVariation = Math.max(...measurements) - Math.min(...measurements);
      expect(memoryVariation).toBeLessThan(100); // Less than 100MB variation
    });
  });
}); 