import { WorkflowTemplate, WorkflowTemplateStep, TemplateParameter } from '../template-types';

export interface VersionedTemplate extends WorkflowTemplate {
  version: string;
  previousVersions: string[];
  migrationPath?: MigrationPath;
}

export interface MigrationPath {
  fromVersion: string;
  toVersion: string;
  steps: MigrationStep[];
}

export interface MigrationStep {
  type: MigrationType;
  field: string;
  action: MigrationAction;
  value?: unknown;
  condition?: MigrationCondition;
}

export type MigrationType = 
  | 'parameter'
  | 'step'
  | 'config'
  | 'metadata';

export type MigrationAction =
  | 'add'
  | 'remove'
  | 'rename'
  | 'modify'
  | 'merge'
  | 'split';

export interface MigrationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'exists' | 'notExists';
  value?: unknown;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  changes: MigrationChange[];
  errors: MigrationError[];
}

export interface MigrationChange {
  type: MigrationType;
  field: string;
  action: MigrationAction;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface MigrationError {
  step: MigrationStep;
  message: string;
  details?: unknown;
} 