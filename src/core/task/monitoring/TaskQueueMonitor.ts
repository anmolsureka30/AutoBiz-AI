import { Logger } from '../../../utils/logger/Logger';
import { 
  TaskQueueMetrics, 
  TaskQueueAlert, 
  TaskQueueAlertType, 
  TaskQueueMonitor 
} from './types';
import { Task } from '../types';
import { TaskPerformanceTracker } from './TaskPerformanceTracker';

export class DefaultTaskQueueMonitor implements TaskQueueMonitor {
  private readonly logger: Logger;
  private metrics: TaskQueueMetrics;
  private alerts: TaskQueueAlert[];
  private readonly performanceTracker: TaskPerformanceTracker;
  private readonly alertThresholds = {
    errorRate: 0.1, // 10%
    queueSize: 1000,
    stallTime: 300000, // 5 minutes
    minThroughput: 10, // tasks per minute
    maxWaitTime: 300000, // 5 minutes
    maxProcessingTime: 600000, // 10 minutes
  };

  constructor(timeWindow: number = 300000) {
    this.logger = new Logger('TaskQueueMonitor');
    this.alerts = [];
    this.metrics = this.getInitialMetrics();
    this.performanceTracker = new TaskPerformanceTracker(timeWindow);
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing task queue monitor');
    // Reset metrics and alerts
    this.metrics = this.getInitialMetrics();
    this.alerts = [];
  }

  updateMetrics(update: Partial<TaskQueueMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...update,
      lastUpdated: new Date(),
    };

    this.checkAlerts();
  }

  getMetrics(): TaskQueueMetrics {
    return { ...this.metrics };
  }

  addAlert(alert: TaskQueueAlert): void {
    this.alerts.push(alert);
    this.logger.warn('New task queue alert', { alert });
  }

  getAlerts(options?: { 
    severity?: TaskQueueAlert['severity'][];
    type?: TaskQueueAlertType[];
    since?: Date;
  }): TaskQueueAlert[] {
    let filtered = [...this.alerts];

    if (options?.severity) {
      filtered = filtered.filter(alert => 
        options.severity!.includes(alert.severity)
      );
    }

    if (options?.type) {
      filtered = filtered.filter(alert => 
        options.type!.includes(alert.type)
      );
    }

    if (options?.since) {
      filtered = filtered.filter(alert => 
        alert.timestamp >= options.since!
      );
    }

    return filtered;
  }

  clearAlerts(before?: Date): void {
    if (before) {
      this.alerts = this.alerts.filter(alert => 
        alert.timestamp >= before
      );
    } else {
      this.alerts = [];
    }
  }

  private getInitialMetrics(): TaskQueueMetrics {
    return {
      totalTasks: 0,
      pendingTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
      throughput: 0,
      errorRate: 0,
      retryRate: 0,
      successRate: 100,
      priorityDistribution: {
        high: 0,
        normal: 0,
        low: 0,
      },
      lastUpdated: new Date(),
      timeWindow: 300000, // 5 minutes
    };
  }

  private checkAlerts(): void {
    // Check error rate
    if (this.metrics.errorRate > this.alertThresholds.errorRate) {
      this.addAlert({
        id: `error-rate-${Date.now()}`,
        type: TaskQueueAlertType.HighErrorRate,
        message: `High error rate detected: ${(this.metrics.errorRate * 100).toFixed(1)}%`,
        severity: 'error',
        timestamp: new Date(),
        metadata: {
          errorRate: this.metrics.errorRate,
          threshold: this.alertThresholds.errorRate,
        },
      });
    }

    // Check queue size
    if (this.metrics.pendingTasks > this.alertThresholds.queueSize) {
      this.addAlert({
        id: `queue-full-${Date.now()}`,
        type: TaskQueueAlertType.QueueFull,
        message: `Queue size exceeded threshold: ${this.metrics.pendingTasks} tasks`,
        severity: 'warning',
        timestamp: new Date(),
        metadata: {
          queueSize: this.metrics.pendingTasks,
          threshold: this.alertThresholds.queueSize,
        },
      });
    }

    // Check throughput
    if (this.metrics.throughput < this.alertThresholds.minThroughput) {
      this.addAlert({
        id: `throughput-${Date.now()}`,
        type: TaskQueueAlertType.LowThroughput,
        message: `Low throughput detected: ${this.metrics.throughput.toFixed(1)} tasks/min`,
        severity: 'warning',
        timestamp: new Date(),
        metadata: {
          throughput: this.metrics.throughput,
          threshold: this.alertThresholds.minThroughput,
        },
      });
    }
  }

  trackTask(task: Task): void {
    this.performanceTracker.trackTask(task);
    this.updatePerformanceMetrics();
  }

  private updatePerformanceMetrics(): void {
    const performance = this.performanceTracker.getPerformanceMetrics();
    
    this.metrics = {
      ...this.metrics,
      ...performance,
      lastUpdated: new Date(),
    };

    this.checkPerformanceAlerts(performance);
  }

  private checkPerformanceAlerts(performance: {
    averageWaitTime: number;
    averageProcessingTime: number;
    throughput: number;
    retryRate: number;
  }): void {
    // Check wait time
    if (performance.averageWaitTime > this.alertThresholds.maxWaitTime) {
      this.addAlert({
        id: `wait-time-${Date.now()}`,
        type: TaskQueueAlertType.TaskStalled,
        message: `High average wait time: ${(performance.averageWaitTime / 1000).toFixed(1)}s`,
        severity: 'warning',
        timestamp: new Date(),
        metadata: {
          waitTime: performance.averageWaitTime,
          threshold: this.alertThresholds.maxWaitTime,
        },
      });
    }

    // Check processing time
    if (performance.averageProcessingTime > this.alertThresholds.maxProcessingTime) {
      this.addAlert({
        id: `processing-time-${Date.now()}`,
        type: TaskQueueAlertType.ResourceExhausted,
        message: `High average processing time: ${(performance.averageProcessingTime / 1000).toFixed(1)}s`,
        severity: 'warning',
        timestamp: new Date(),
        metadata: {
          processingTime: performance.averageProcessingTime,
          threshold: this.alertThresholds.maxProcessingTime,
        },
      });
    }

    // Existing alert checks...
  }
} 