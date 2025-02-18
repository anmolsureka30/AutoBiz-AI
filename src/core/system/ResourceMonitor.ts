import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import os from 'os';

export interface ResourceUsage {
  cpu: number; // percentage (0-100)
  memory: number; // percentage (0-100)
  loadAverage: number[];
  networkIO?: {
    bytesIn: number;
    bytesOut: number;
  };
  diskIO?: {
    bytesRead: number;
    bytesWritten: number;
  };
}

export interface ResourceThresholds {
  cpu: number;
  memory: number;
  loadAverage?: number;
}

export class ResourceMonitor extends EventEmitter {
  private lastCpuUsage: { idle: number; total: number } | null = null;
  private lastNetworkStats: { bytesIn: number; bytesOut: number } | null = null;
  private readonly updateInterval: number;
  private intervalId?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  constructor(
    private readonly logger: Logger,
    private readonly config: {
      updateInterval?: number; // milliseconds
      thresholds?: ResourceThresholds;
    } = {}
  ) {
    super();
    this.updateInterval = config.updateInterval || 1000;
  }

  async start(): Promise<void> {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    try {
      // Get initial measurements
      this.lastCpuUsage = await this.getCpuUsage();
      this.lastNetworkStats = await this.getNetworkStats();

      // Start periodic monitoring
      this.intervalId = setInterval(async () => {
        try {
          const usage = await this.getResourceUsage();
          this.checkThresholds(usage);
          this.emit('usage', usage);
        } catch (error) {
          this.logger.error({
            message: 'Error monitoring resources',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }, this.updateInterval);

      this.logger.info({
        message: 'Resource monitoring started',
        interval: this.updateInterval
      });
    } catch (error) {
      this.isMonitoring = false;
      throw error;
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isMonitoring = false;
    this.logger.info({
      message: 'Resource monitoring stopped'
    });
  }

  async getResourceUsage(): Promise<ResourceUsage> {
    const [cpuUsage, memoryUsage, loadAverage, networkIO, diskIO] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryUsage(),
      this.getLoadAverage(),
      this.getNetworkStats(),
      this.getDiskStats()
    ]);

    return {
      cpu: cpuUsage.percentage,
      memory: memoryUsage,
      loadAverage,
      networkIO,
      diskIO
    };
  }

  private async getCpuUsage(): Promise<{ idle: number; total: number; percentage: number }> {
    const cpus = os.cpus();
    const idle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const total = cpus.reduce((acc, cpu) => 
      acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0), 
    0);

    if (!this.lastCpuUsage) {
      this.lastCpuUsage = { idle, total };
      return { idle, total, percentage: 0 };
    }

    const idleDiff = idle - this.lastCpuUsage.idle;
    const totalDiff = total - this.lastCpuUsage.total;
    const percentage = 100 - Math.round(100 * idleDiff / totalDiff);

    this.lastCpuUsage = { idle, total };
    return { idle, total, percentage };
  }

  private getMemoryUsage(): number {
    const { total, free } = os.freemem();
    return Math.round(100 * (1 - free / total));
  }

  private getLoadAverage(): number[] {
    return os.loadavg();
  }

  private async getNetworkStats(): Promise<ResourceUsage['networkIO']> {
    // Implementation depends on OS and requirements
    // This is a placeholder
    return {
      bytesIn: 0,
      bytesOut: 0
    };
  }

  private async getDiskStats(): Promise<ResourceUsage['diskIO']> {
    // Implementation depends on OS and requirements
    // This is a placeholder
    return {
      bytesRead: 0,
      bytesWritten: 0
    };
  }

  private checkThresholds(usage: ResourceUsage): void {
    if (!this.config.thresholds) return;

    const { thresholds } = this.config;

    if (usage.cpu > thresholds.cpu) {
      this.emit('threshold:exceeded', {
        resource: 'cpu',
        current: usage.cpu,
        threshold: thresholds.cpu
      });
    }

    if (usage.memory > thresholds.memory) {
      this.emit('threshold:exceeded', {
        resource: 'memory',
        current: usage.memory,
        threshold: thresholds.memory
      });
    }

    if (thresholds.loadAverage && usage.loadAverage[0] > thresholds.loadAverage) {
      this.emit('threshold:exceeded', {
        resource: 'loadAverage',
        current: usage.loadAverage[0],
        threshold: thresholds.loadAverage
      });
    }
  }
} 