import { EventEmitter } from '../../../utils/events/EventEmitter';
import { Workflow, WorkflowStatus } from '../types';
import { WorkflowGraph } from '../visualization/types';
import { Logger } from '../../../utils/logger/Logger';

export class WorkflowMonitor {
  private readonly logger: Logger;
  private readonly events: EventEmitter;
  private readonly activeWorkflows: Map<string, {
    workflow: Workflow;
    graph: WorkflowGraph;
    startTime: Date;
    lastUpdate: Date;
  }>;

  constructor() {
    this.logger = new Logger('WorkflowMonitor');
    this.events = new EventEmitter();
    this.activeWorkflows = new Map();
  }

  startMonitoring(workflow: Workflow, graph: WorkflowGraph): void {
    this.activeWorkflows.set(workflow.id, {
      workflow,
      graph,
      startTime: new Date(),
      lastUpdate: new Date(),
    });

    this.events.emit('monitoringStarted', {
      workflowId: workflow.id,
      timestamp: new Date(),
    });
  }

  updateWorkflowStatus(workflowId: string, status: WorkflowStatus): void {
    const workflowData = this.activeWorkflows.get(workflowId);
    if (!workflowData) return;

    workflowData.workflow.status = status;
    workflowData.lastUpdate = new Date();

    this.events.emit('statusUpdated', {
      workflowId,
      status,
      timestamp: new Date(),
      duration: this.calculateDuration(workflowData.startTime),
    });

    if (this.isTerminalStatus(status)) {
      this.stopMonitoring(workflowId);
    }
  }

  private isTerminalStatus(status: WorkflowStatus): boolean {
    return status === 'completed' || status === 'failed';
  }

  private calculateDuration(startTime: Date): number {
    return Date.now() - startTime.getTime();
  }

  stopMonitoring(workflowId: string): void {
    const workflowData = this.activeWorkflows.get(workflowId);
    if (!workflowData) return;

    this.activeWorkflows.delete(workflowId);
    this.events.emit('monitoringStopped', {
      workflowId,
      timestamp: new Date(),
      duration: this.calculateDuration(workflowData.startTime),
      finalStatus: workflowData.workflow.status,
    });
  }

  getWorkflowMetrics(workflowId: string): WorkflowMetrics | null {
    const workflowData = this.activeWorkflows.get(workflowId);
    if (!workflowData) return null;

    return {
      duration: this.calculateDuration(workflowData.startTime),
      status: workflowData.workflow.status,
      completedSteps: Object.keys(workflowData.workflow.context.stepResults).length,
      totalSteps: workflowData.workflow.steps.length,
      errorCount: workflowData.workflow.context.errors.length,
      lastUpdate: workflowData.lastUpdate,
    };
  }

  onStatusUpdate(handler: (event: StatusUpdateEvent) => void): void {
    this.events.on('statusUpdated', handler);
  }

  onMonitoringStarted(handler: (event: MonitoringEvent) => void): void {
    this.events.on('monitoringStarted', handler);
  }

  onMonitoringStopped(handler: (event: MonitoringStopEvent) => void): void {
    this.events.on('monitoringStopped', handler);
  }
}

interface WorkflowMetrics {
  duration: number;
  status: WorkflowStatus;
  completedSteps: number;
  totalSteps: number;
  errorCount: number;
  lastUpdate: Date;
}

interface StatusUpdateEvent {
  workflowId: string;
  status: WorkflowStatus;
  timestamp: Date;
  duration: number;
}

interface MonitoringEvent {
  workflowId: string;
  timestamp: Date;
}

interface MonitoringStopEvent extends MonitoringEvent {
  duration: number;
  finalStatus: WorkflowStatus;
} 