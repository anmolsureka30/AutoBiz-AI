import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AgentMonitoringService } from '../AgentMonitoringService';
import { MonitoringStorageService } from '../../../storage/MonitoringStorageService';
import { AgentMetrics, AgentError } from '../types';

// Mock MonitoringStorageService
jest.mock('../../../storage/MonitoringStorageService');

describe('AgentMonitoringService', () => {
  let service: AgentMonitoringService;
  let mockDate: Date;
  let mockStorage: jest.Mocked<MonitoringStorageService>;

  beforeEach(() => {
    mockDate = new Date('2023-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as string);

    // Reset mock storage
    mockStorage = new MonitoringStorageService() as jest.Mocked<MonitoringStorageService>;
    (MonitoringStorageService as jest.Mock).mockImplementation(() => mockStorage);

    service = new AgentMonitoringService({
      snapshotInterval: 1000, // 1 second for testing
      retentionPeriod: 5000, // 5 seconds for testing
      maxSnapshots: 5,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize storage and load existing snapshots', async () => {
      const mockSnapshots = [
        { timestamp: new Date(mockDate.getTime() - 2000), metrics: {} },
        { timestamp: new Date(mockDate.getTime() - 1000), metrics: {} },
      ];

      mockStorage.initialize.mockResolvedValue();
      mockStorage.getSnapshots.mockResolvedValue(mockSnapshots);

      await service.initialize();

      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockStorage.getSnapshots).toHaveBeenCalledWith({
        startTime: expect.any(Date),
      });
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      mockStorage.initialize.mockRejectedValue(error);

      await expect(service.initialize()).rejects.toThrow(error);
    });
  });

  describe('metrics updates', () => {
    beforeEach(async () => {
      mockStorage.initialize.mockResolvedValue();
      mockStorage.getSnapshots.mockResolvedValue([]);
      await service.initialize();
    });

    it('should update metrics and emit event', (done) => {
      const update: Partial<AgentMetrics> = {
        activeAgents: 5,
        completedTasks: 10,
      };

      service.on('metricsUpdated', (metrics) => {
        expect(metrics.activeAgents).toBe(5);
        expect(metrics.completedTasks).toBe(10);
        expect(metrics.lastUpdated).toEqual(mockDate);
        done();
      });

      service.updateMetrics(update);
    });

    it('should preserve existing metrics when updating partially', () => {
      service.updateMetrics({ activeAgents: 5 });
      service.updateMetrics({ completedTasks: 10 });

      const metrics = service.getMetrics();
      expect(metrics.activeAgents).toBe(5);
      expect(metrics.completedTasks).toBe(10);
    });
  });

  describe('error reporting', () => {
    it('should add error and emit event', (done) => {
      const error: AgentError = {
        timestamp: mockDate,
        message: 'Test error',
        code: 'TEST_ERROR',
      };

      service.on('error', (reportedError) => {
        expect(reportedError).toEqual(error);
        expect(service.getMetrics().errors).toContainEqual(error);
        done();
      });

      service.reportError(error);
    });
  });

  describe('snapshots', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      mockStorage.initialize.mockResolvedValue();
      mockStorage.getSnapshots.mockResolvedValue([]);
      await service.initialize();
    });

    it('should take snapshots at configured interval', async () => {
      service.updateMetrics({ activeAgents: 5 });

      // Advance time by snapshot interval
      mockDate = new Date(mockDate.getTime() + 1000);
      jest.advanceTimersByTime(1000);

      expect(mockStorage.saveSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: mockDate,
          metrics: expect.objectContaining({ activeAgents: 5 }),
        })
      );
    });

    it('should handle snapshot storage errors', async () => {
      const error = new Error('Storage failed');
      mockStorage.saveSnapshot.mockRejectedValueOnce(error);

      service.updateMetrics({ activeAgents: 5 });
      mockDate = new Date(mockDate.getTime() + 1000);
      jest.advanceTimersByTime(1000);

      // Should not throw error but log it
      expect(mockStorage.saveSnapshot).toHaveBeenCalled();
    });

    it('should clean up old snapshots', async () => {
      // Create snapshots at different times
      for (let i = 0; i < 6; i++) {
        service.updateMetrics({ activeAgents: i });
        mockDate = new Date(mockDate.getTime() + 1000);
        jest.advanceTimersByTime(1000);
      }

      expect(mockStorage.clearOldSnapshots).toHaveBeenCalledWith(5000);
    });
  });

  describe('alerts', () => {
    it('should emit alerts when thresholds are exceeded', () => {
      const mockLogger = {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      };

      // @ts-ignore - Replace logger
      service['logger'] = mockLogger;

      service.updateMetrics({
        cpuUsage: 0.9, // Above 0.8 threshold
        memoryUsage: 0.85,
        failedTasks: 50,
        completedTasks: 100, // 33% error rate
        averageResponseTime: 6000, // Above 5000ms threshold
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High CPU usage detected',
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High memory usage detected',
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High error rate detected',
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'High response time detected',
        expect.any(Object)
      );
    });
  });
}); 