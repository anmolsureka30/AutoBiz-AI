import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AgentMonitoringService } from '../AgentMonitoringService';
import { MonitoringStorageService } from '../../../storage/MonitoringStorageService';
import { IndexedDBService } from '../../../storage/IndexedDBService';
import { AgentMetrics, MetricsSnapshot } from '../types';

describe('Agent Monitoring Integration', () => {
  let monitoringService: AgentMonitoringService;
  let storageService: MonitoringStorageService;
  let mockDate: Date;

  beforeEach(async () => {
    // Use real implementations
    mockDate = new Date('2023-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as string);

    // Initialize services
    storageService = new MonitoringStorageService();
    await storageService.initialize();

    monitoringService = new AgentMonitoringService({
      snapshotInterval: 1000,
      retentionPeriod: 5000,
      maxSnapshots: 5,
    });
    await monitoringService.initialize();
  });

  afterEach(async () => {
    // Clean up
    const db = new IndexedDBService('monitoring', 1);
    await db.initialize([]);
    await db.clear();
    jest.clearAllMocks();
  });

  describe('end-to-end workflow', () => {
    it('should handle complete monitoring workflow', async () => {
      const metrics: AgentMetrics[] = [];
      const snapshots: MetricsSnapshot[] = [];

      // Subscribe to events
      monitoringService.on('metricsUpdated', (updatedMetrics) => {
        metrics.push(updatedMetrics);
      });

      monitoringService.on('snapshot', (snapshot) => {
        snapshots.push(snapshot);
      });

      // Simulate agent activity
      for (let i = 0; i < 5; i++) {
        monitoringService.updateMetrics({
          activeAgents: 5 + i,
          completedTasks: 10 * i,
          failedTasks: i,
          cpuUsage: 0.5 + (i * 0.1),
          memoryUsage: 0.4 + (i * 0.1),
          averageResponseTime: 100 + (i * 50),
        });

        // Simulate time passing
        mockDate = new Date(mockDate.getTime() + 1000);
        jest.advanceTimersByTime(1000);
        await new Promise(resolve => setTimeout(resolve, 0)); // Let async operations complete
      }

      // Verify metrics were tracked
      expect(metrics).toHaveLength(5);
      expect(metrics[4].activeAgents).toBe(9);
      expect(metrics[4].completedTasks).toBe(40);

      // Verify snapshots were taken and stored
      const storedSnapshots = await storageService.getSnapshots();
      expect(storedSnapshots).toHaveLength(5);
      expect(storedSnapshots[4].metrics.activeAgents).toBe(9);

      // Verify cleanup works
      mockDate = new Date(mockDate.getTime() + 5000);
      await storageService.clearOldSnapshots(5000);
      const remainingSnapshots = await storageService.getSnapshots();
      expect(remainingSnapshots.length).toBeLessThan(5);
    });

    it('should handle error reporting and alerts', async () => {
      const errors: Error[] = [];
      const alerts: string[] = [];

      monitoringService.on('error', (error) => {
        errors.push(error);
      });

      // Mock logger to capture alerts
      const mockLogger = {
        warn: (message: string) => alerts.push(message),
        error: jest.fn(),
        info: jest.fn(),
      };
      // @ts-ignore - Replace logger
      monitoringService['logger'] = mockLogger;

      // Simulate error conditions
      monitoringService.updateMetrics({
        activeAgents: 10,
        completedTasks: 80,
        failedTasks: 20,
        cpuUsage: 0.9,
        memoryUsage: 0.85,
        averageResponseTime: 6000,
      });

      monitoringService.reportError({
        timestamp: mockDate,
        message: 'Test error',
        code: 'TEST_ERROR',
      });

      // Verify error handling
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Test error');

      // Verify alerts
      expect(alerts).toContain('High CPU usage detected');
      expect(alerts).toContain('High memory usage detected');
      expect(alerts).toContain('High error rate detected');
      expect(alerts).toContain('High response time detected');

      // Verify error persistence
      const metrics = monitoringService.getMetrics();
      expect(metrics.errors).toHaveLength(1);
      expect(metrics.errors[0].code).toBe('TEST_ERROR');
    });
  });
}); 