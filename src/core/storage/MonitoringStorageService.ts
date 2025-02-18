import { IndexedDBService } from './IndexedDBService';
import { MetricsSnapshot } from '../workflow/monitoring/types';
import { Logger } from '../../utils/logger/Logger';

export class MonitoringStorageService {
  private readonly db: IndexedDBService;
  private readonly logger: Logger;
  private readonly STORE_NAME = 'monitoring';
  private readonly SNAPSHOT_INDEX = 'timestamp';

  constructor() {
    this.db = new IndexedDBService('monitoring', 1);
    this.logger = new Logger('MonitoringStorageService');
  }

  async initialize(): Promise<void> {
    try {
      await this.db.initialize([{
        name: this.STORE_NAME,
        keyPath: 'id',
        indexes: [{
          name: this.SNAPSHOT_INDEX,
          keyPath: 'timestamp',
          options: { unique: false }
        }]
      }]);
    } catch (error) {
      this.logger.error('Failed to initialize monitoring storage', { error });
      throw error;
    }
  }

  async saveSnapshot(snapshot: MetricsSnapshot): Promise<void> {
    try {
      const id = `snapshot-${snapshot.timestamp.getTime()}`;
      await this.db.put(this.STORE_NAME, {
        id,
        ...snapshot,
      });
    } catch (error) {
      this.logger.error('Failed to save snapshot', { error });
      throw error;
    }
  }

  async getSnapshots(options?: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<MetricsSnapshot[]> {
    try {
      let snapshots: MetricsSnapshot[] = [];

      if (options?.startTime && options?.endTime) {
        const range = IDBKeyRange.bound(
          options.startTime.getTime(),
          options.endTime.getTime()
        );
        snapshots = await this.db.getByIndex(
          this.STORE_NAME,
          this.SNAPSHOT_INDEX,
          range
        );
      } else {
        snapshots = await this.db.getAll(this.STORE_NAME);
      }

      // Sort by timestamp
      snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Apply limit if specified
      if (options?.limit && snapshots.length > options.limit) {
        snapshots = snapshots.slice(-options.limit);
      }

      return snapshots;
    } catch (error) {
      this.logger.error('Failed to get snapshots', { error });
      throw error;
    }
  }

  async clearOldSnapshots(retentionPeriod: number): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - retentionPeriod);
      const range = IDBKeyRange.upperBound(cutoffTime.getTime());
      
      const oldSnapshots = await this.db.getByIndex(
        this.STORE_NAME,
        this.SNAPSHOT_INDEX,
        range
      );

      for (const snapshot of oldSnapshots) {
        await this.db.delete(this.STORE_NAME, snapshot.id);
      }

      this.logger.info('Cleared old snapshots', {
        count: oldSnapshots.length,
        cutoffTime,
      });
    } catch (error) {
      this.logger.error('Failed to clear old snapshots', { error });
      throw error;
    }
  }
} 