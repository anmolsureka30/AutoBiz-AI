import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { MonitoringStorageService } from '../MonitoringStorageService';
import { MockIndexedDBService } from '../__mocks__/IndexedDBService';
import { MetricsSnapshot } from '../../workflow/monitoring/types';

// Mock IndexedDBService
jest.mock('../IndexedDBService', () => ({
  IndexedDBService: MockIndexedDBService,
}));

describe('MonitoringStorageService', () => {
  let service: MonitoringStorageService;
  let mockDate: Date;

  beforeEach(async () => {
    mockDate = new Date('2023-01-01T00:00:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as string);
    
    service = new MonitoringStorageService();
    await service.initialize();
  });

  const createSnapshot = (timestamp: Date): MetricsSnapshot => ({
    timestamp,
    metrics: {
      activeAgents: 5,
      completedTasks: 100,
      failedTasks: 10,
      averageResponseTime: 250,
      cpuUsage: 0.6,
      memoryUsage: 0.7,
      errors: [],
      lastUpdated: timestamp,
    },
  });

  describe('saveSnapshot', () => {
    it('should successfully save a snapshot', async () => {
      const snapshot = createSnapshot(mockDate);
      await service.saveSnapshot(snapshot);

      const snapshots = await service.getSnapshots();
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toEqual({
        id: `snapshot-${mockDate.getTime()}`,
        ...snapshot,
      });
    });

    it('should handle save errors', async () => {
      const mockError = new Error('Save failed');
      jest.spyOn(MockIndexedDBService.prototype, 'put')
        .mockRejectedValueOnce(mockError);

      await expect(service.saveSnapshot(createSnapshot(mockDate)))
        .rejects.toThrow(mockError);
    });
  });

  describe('getSnapshots', () => {
    beforeEach(async () => {
      // Create test snapshots
      for (let i = 0; i < 3; i++) {
        const timestamp = new Date(mockDate.getTime() + i * 60000); // 1 minute apart
        await service.saveSnapshot(createSnapshot(timestamp));
      }
    });

    it('should get all snapshots when no options provided', async () => {
      const snapshots = await service.getSnapshots();
      expect(snapshots).toHaveLength(3);
    });

    it('should filter snapshots by time range', async () => {
      const startTime = new Date(mockDate.getTime() + 30000);
      const endTime = new Date(mockDate.getTime() + 90000);

      const snapshots = await service.getSnapshots({ startTime, endTime });
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].timestamp).toEqual(new Date(mockDate.getTime() + 60000));
    });

    it('should limit number of returned snapshots', async () => {
      const snapshots = await service.getSnapshots({ limit: 2 });
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].timestamp).toEqual(new Date(mockDate.getTime() + 60000));
      expect(snapshots[1].timestamp).toEqual(new Date(mockDate.getTime() + 120000));
    });
  });

  describe('clearOldSnapshots', () => {
    beforeEach(async () => {
      // Create test snapshots
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date(mockDate.getTime() - i * 3600000); // 1 hour apart
        await service.saveSnapshot(createSnapshot(timestamp));
      }
    });

    it('should clear snapshots older than retention period', async () => {
      const retentionPeriod = 2 * 3600000; // 2 hours
      await service.clearOldSnapshots(retentionPeriod);

      const snapshots = await service.getSnapshots();
      expect(snapshots).toHaveLength(2);
      snapshots.forEach(snapshot => {
        expect(snapshot.timestamp.getTime()).toBeGreaterThan(mockDate.getTime() - retentionPeriod);
      });
    });
  });
}); 