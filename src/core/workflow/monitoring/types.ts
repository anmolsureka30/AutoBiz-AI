export interface AgentMetrics {
  // Basic metrics
  activeAgents: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  
  // Resource metrics
  cpuUsage: number;
  memoryUsage: number;
  
  // Error tracking
  errors: AgentError[];
  
  // Metadata
  lastUpdated: Date;
}

export interface AgentError {
  timestamp: Date;
  message: string;
  code?: string;
  agentId?: string;
  taskId?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export interface MetricsSnapshot {
  timestamp: Date;
  metrics: AgentMetrics;
}

export interface MonitoringConfig {
  snapshotInterval?: number;  // milliseconds
  retentionPeriod?: number;  // milliseconds
  maxSnapshots?: number;
  alertThresholds?: {
    cpuUsage?: number;  // percentage (0-1)
    memoryUsage?: number;  // percentage (0-1)
    errorRate?: number;  // percentage (0-1)
    responseTime?: number;  // milliseconds
  };
}

export type MonitoringEventType = 'metricsUpdated' | 'error' | 'snapshot';

export interface MonitoringEventMap {
  metricsUpdated: AgentMetrics;
  error: AgentError;
  snapshot: MetricsSnapshot;
}

export interface MonitoringService {
  initialize(): Promise<void>;
  updateMetrics(metrics: Partial<AgentMetrics>): void;
  getMetrics(): AgentMetrics;
  reportError(error: AgentError): void;
  getSnapshots(options?: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<MetricsSnapshot[]>;
  on<T extends MonitoringEventType>(
    event: T,
    listener: (data: MonitoringEventMap[T]) => void
  ): void;
  off<T extends MonitoringEventType>(
    event: T,
    listener: (data: MonitoringEventMap[T]) => void
  ): void;
} 