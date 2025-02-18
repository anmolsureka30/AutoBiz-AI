import { WorkflowTemplate, WorkflowTemplateStep, TemplateParameter } from '../../template-types';

export type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface TemplateDiff {
  fromVersion: string;
  toVersion: string;
  steps: StepDiff[];
  parameters: ParameterDiff[];
  metadata: MetadataDiff;
  summary: DiffSummary;
}

export interface StepDiff {
  type: DiffType;
  stepId: string;
  name: string;
  changes?: {
    dependencies?: DependencyChange[];
    config?: ConfigChange[];
    other?: OtherChange[];
  };
}

export interface ParameterDiff {
  type: DiffType;
  parameterId: string;
  name: string;
  changes?: {
    type?: string;
    required?: boolean;
    defaultValue?: unknown;
    validation?: unknown;
  };
}

export interface MetadataDiff {
  category: ArrayDiff<string>;
  tags: ArrayDiff<string>;
  modelVersion?: ValueDiff<string>;
  [key: string]: unknown;
}

export interface DependencyChange {
  type: 'added' | 'removed';
  dependencyId: string;
}

export interface ConfigChange {
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface OtherChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ArrayDiff<T> {
  added: T[];
  removed: T[];
  unchanged: T[];
}

export interface ValueDiff<T> {
  oldValue: T;
  newValue: T;
  changed: boolean;
}

export interface DiffSummary {
  stepsAdded: number;
  stepsRemoved: number;
  stepsModified: number;
  parametersAdded: number;
  parametersRemoved: number;
  parametersModified: number;
  totalChanges: number;
} 