import { TaskType } from '../task/types';

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

export interface WorkflowStep {
  id: string;
  type: TaskType;
  name: string;
  dependencies: string[];  // IDs of steps that must complete before this one
  config?: Record<string, unknown>;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  condition?: StepCondition;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  metadata: WorkflowMetadata;
  context: WorkflowContext;
}

export interface WorkflowMetadata {
  created: Date;
  started?: Date;
  completed?: Date;
  owner: string;
  version: string;
  tags: string[];
}

export interface WorkflowContext {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  stepResults: Record<string, unknown>;
  variables: Record<string, unknown>;
  errors: WorkflowError[];
}

export interface WorkflowError {
  stepId: string;
  error: Error;
  timestamp: Date;
  attempt: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface StepCondition {
  type: 'expression' | 'script';
  value: string;
}

export interface WorkflowAgent {
  execute(step: WorkflowStep, context: Record<string, unknown>): Promise<unknown>;
  validate?(step: WorkflowStep): Promise<boolean>;
  cleanup?(): Promise<void>;
} 