import { Logger } from '../../../utils/logger/Logger';
import { 
  AgentMetrics, 
  AgentError, 
  MetricsSnapshot, 
  MonitoringConfig,
  MonitoringService,
  MonitoringEventType,
  MonitoringEventMap
} from './types';
import EventEmitter from 'events';
import { MonitoringStorageService } from '../../storage/MonitoringStorageService';

export class AgentMonitoringService implements MonitoringService {
  private readonly logger: Logger;
  private readonly emitter: EventEmitter;
  private readonly config: Required<MonitoringConfig>;
  private readonly storage: MonitoringStorageService;
  private metrics: AgentMetrics;
  private snapshots: MetricsSnapshot[];
  private lastSnapshotTime: Date;

  constructor(config: MonitoringConfig = {}) {
    this.logger = new Logger('AgentMonitoringService');
    this.emitter = new EventEmitter();
    this.storage = new MonitoringStorageService();
    this.config = {
      snapshotInterval: 60000, // 1 minute
      retentionPeriod: 86400000, // 24 hours
      maxSnapshots: 1440, // 1 per minute for 24 hours
      alertThresholds: {
        cpuUsage: 0.8, // 80%
        memoryUsage: 0.8, // 80%
        errorRate: 0.1, // 10%
        responseTime: 5000, // 5 seconds
      },
      ...config,
    };
    this.metrics = this.getInitialMetrics();
    this.snapshots = [];
    this.lastSnapshotTime = new Date();
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing agent monitoring service');
      await this.storage.initialize();
      
      // Load existing snapshots
      const storedSnapshots = await this.storage.getSnapshots({
        startTime: new Date(Date.now() - this.config.retentionPeriod)
      });
      this.snapshots = storedSnapshots;
      
      // Set up periodic snapshots
      setInterval(() => this.takeSnapshot(), this.config.snapshotInterval);
      
      // Set up periodic cleanup
      setInterval(
        () => this.storage.clearOldSnapshots(this.config.retentionPeriod),
        this.config.retentionPeriod / 2
      );
    } catch (error) {
      this.logger.error('Failed to initialize monitoring service', { error });
      throw error;
    }
  }

  private getInitialMetrics(): AgentMetrics {
    return {
      activeAgents: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageResponseTime: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      errors: [],
      lastUpdated: new Date(),
    };
  }

  updateMetrics(update: Partial<AgentMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...update,
      lastUpdated: new Date(),
    };

    this.emitter.emit('metricsUpdated', this.metrics);
  }

  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  reportError(error: AgentError): void {
    this.metrics.errors.push(error);
    this.emitter.emit('error', error);
    this.logger.error('Agent error reported', { error });
  }

  private async takeSnapshot(): Promise<void> {
    const snapshot: MetricsSnapshot = {
      timestamp: new Date(),
      metrics: { ...this.metrics },
    };

    this.snapshots.push(snapshot);
    this.lastSnapshotTime = snapshot.timestamp;

    // Persist snapshot
    try {
      await this.storage.saveSnapshot(snapshot);
    } catch (error) {
      this.logger.error('Failed to persist snapshot', { error });
    }

    // Clean up old snapshots from memory
    this.cleanupSnapshots();
    
    this.emitter.emit('snapshot', snapshot);
  }

  private cleanupSnapshots(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);
    
    // Remove snapshots older than retention period
    this.snapshots = this.snapshots.filter(snapshot => 
      snapshot.timestamp >= cutoffTime
    );

    // If we still have too many snapshots, remove oldest ones
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.config.maxSnapshots);
    }
  }

  async getSnapshots(options?: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<MetricsSnapshot[]> {
    try {
      return this.storage.getSnapshots(options);
    } catch (error) {
      this.logger.error('Failed to get snapshots', { error });
      return this.filterSnapshots(options);  // Fallback to in-memory snapshots
    }
  }

  private filterSnapshots(options?: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): MetricsSnapshot[] {
    let filtered = [...this.snapshots];

    if (options?.startTime) {
      filtered = filtered.filter(snapshot => 
        snapshot.timestamp >= options.startTime!
      );
    }

    if (options?.endTime) {
      filtered = filtered.filter(snapshot => 
        snapshot.timestamp <= options.endTime!
      );
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  on<T extends MonitoringEventType>(
    event: T,
    listener: (data: MonitoringEventMap[T]) => void
  ): void {
    this.emitter.on(event, listener);
  }

  off<T extends MonitoringEventType>(
    event: T,
    listener: (data: MonitoringEventMap[T]) => void
  ): void {
    this.emitter.off(event, listener);
  }

  private checkAlerts(metrics: AgentMetrics): void {
    const { alertThresholds } = this.config;
    if (!alertThresholds) return;

    const errorRate = metrics.failedTasks / (metrics.completedTasks + metrics.failedTasks);

    if (alertThresholds.cpuUsage && metrics.cpuUsage > alertThresholds.cpuUsage) {
      this.logger.warn('High CPU usage detected', {
        current: metrics.cpuUsage,
        threshold: alertThresholds.cpuUsage,
      });
    }

    if (alertThresholds.memoryUsage && metrics.memoryUsage > alertThresholds.memoryUsage) {
      this.logger.warn('High memory usage detected', {
        current: metrics.memoryUsage,
        threshold: alertThresholds.memoryUsage,
      });
    }

    if (alertThresholds.errorRate && errorRate > alertThresholds.errorRate) {
      this.logger.warn('High error rate detected', {
        current: errorRate,
        threshold: alertThresholds.errorRate,
      });
    }

    if (alertThresholds.responseTime && metrics.averageResponseTime > alertThresholds.responseTime) {
      this.logger.warn('High response time detected', {
        current: metrics.averageResponseTime,
        threshold: alertThresholds.responseTime,
      });
    }
  }
} 