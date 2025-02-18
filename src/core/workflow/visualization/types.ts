import { WorkflowStatus, WorkflowStep } from '../types';
import { WorkflowTemplate } from '../template-types';

export interface Position {
  x: number;
  y: number;
}

export interface NodeMetrics {
  executionTime?: number;
  retryCount?: number;
  errorRate?: number;
  resourceUsage?: {
    cpu?: number;
    memory?: number;
  };
}

export interface WorkflowNode {
  id: string;
  label: string;
  type: string;
  status: WorkflowStatus;
  position: Position;
  metrics?: NodeMetrics;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  animated?: boolean;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionStep {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: ExecutionStatus;
  error?: Error;
}

export type ExecutionStatus = 'completed' | 'failed' | 'processing' | 'pending';

export interface WorkflowExecution {
  id: string;
  templateId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  status: ExecutionStatus;
  result: {
    stepResults: Record<string, ExecutionStep>;
  };
}

export interface WorkflowExecutionResult {
  execution: WorkflowExecution;
  template: WorkflowTemplate;
}

export interface LayoutOptions {
  direction: 'LR' | 'TB';
  nodeSpacing: number;
  rankSpacing: number;
  marginX: number;
  marginY: number;
}

export interface NodeLevel {
  level: number;
  nodes: WorkflowNode[];
} 