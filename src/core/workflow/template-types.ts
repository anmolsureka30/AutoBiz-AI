import { WorkflowStep } from './types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  steps: WorkflowStep[];
  parameters: WorkflowParameter[];
  metadata: WorkflowMetadata;
}

export interface WorkflowStep {
  templateId: string;
  name: string;
  type: string;
  description: string;
  dependencies: string[];
  config?: Record<string, any>;
}

export interface WorkflowParameter {
  id: string;
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: any[];
    custom?: string;
  };
}

export interface WorkflowMetadata {
  created: string;
  lastModified: string;
  author: string;
  category: string[];
  tags: string[];
  usageCount: number;
  averageExecutionTime: number;
  successRate: number;
}

export interface WorkflowTemplateStep extends Omit<WorkflowStep, 'id'> {
  templateId: string;
  description?: string;
  parameters?: string[]; // References to template parameters
  validation?: StepValidation;
}

export interface TemplateMetadata {
  created: Date;
  lastModified: Date;
  author: string;
  category: string[];
  tags: string[];
  usageCount: number;
  averageExecutionTime?: number;
  successRate?: number;
}

export interface TemplateParameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  validation?: ParameterValidation;
}

export interface ParameterValidation {
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
}

export interface StepValidation {
  preconditions?: string[];
  postconditions?: string[];
  timeout?: number;
  requiredResources?: string[];
} 