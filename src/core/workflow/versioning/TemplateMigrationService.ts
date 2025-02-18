import { Logger } from '../../../utils/logger/Logger';
import { TemplateValidator } from '../validation/TemplateValidator';
import {
  VersionedTemplate,
  MigrationPath,
  MigrationResult,
  MigrationStep,
  MigrationChange,
  MigrationError,
} from './types';

export class TemplateMigrationService {
  private readonly logger: Logger;
  private readonly validator: TemplateValidator;

  constructor() {
    this.logger = new Logger('TemplateMigrationService');
    this.validator = new TemplateValidator();
  }

  async migrateTemplate(
    template: VersionedTemplate,
    targetVersion: string
  ): Promise<MigrationResult> {
    const changes: MigrationChange[] = [];
    const errors: MigrationError[] = [];

    try {
      // Validate current template
      const validation = await this.validator.validateTemplate(template);
      if (!validation.isValid) {
        throw new Error('Cannot migrate invalid template');
      }

      // Find migration path
      const migrationPath = this.findMigrationPath(template, targetVersion);
      if (!migrationPath) {
        throw new Error(`No migration path found from ${template.version} to ${targetVersion}`);
      }

      // Create working copy of template
      let workingTemplate = this.cloneTemplate(template);

      // Apply migration steps
      for (const step of migrationPath.steps) {
        try {
          const change = await this.applyMigrationStep(workingTemplate, step);
          if (change) {
            changes.push(change);
            this.logger.info('Applied migration step', { 
              templateId: template.id,
              step: step.type,
              field: step.field,
              action: step.action 
            });
          }
        } catch (error) {
          this.logger.error('Migration step failed', { error, step });
          errors.push({
            step,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Update version information
      workingTemplate.version = targetVersion;
      workingTemplate.previousVersions = [...template.previousVersions, template.version];

      // Validate migrated template
      const finalValidation = await this.validator.validateTemplate(workingTemplate);
      if (!finalValidation.isValid) {
        throw new Error('Migration resulted in invalid template');
      }

      return {
        success: errors.length === 0,
        fromVersion: template.version,
        toVersion: targetVersion,
        changes,
        errors,
      };

    } catch (error) {
      this.logger.error('Template migration failed', { 
        error, 
        templateId: template.id,
        fromVersion: template.version,
        toVersion: targetVersion
      });
      return {
        success: false,
        fromVersion: template.version,
        toVersion: targetVersion,
        changes,
        errors: [
          {
            step: { type: 'metadata', field: 'version', action: 'modify' },
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  private findMigrationPath(
    template: VersionedTemplate,
    targetVersion: string
  ): MigrationPath | null {
    if (!template.migrationPath) {
      return null;
    }

    // Direct migration path
    if (
      template.migrationPath.fromVersion === template.version &&
      template.migrationPath.toVersion === targetVersion
    ) {
      return template.migrationPath;
    }

    // TODO: Implement multi-step migration path finding
    // For now, we only support direct migrations
    return null;
  }

  private async applyMigrationStep(
    template: VersionedTemplate,
    step: MigrationStep
  ): Promise<MigrationChange | null> {
    // Check condition if present
    if (step.condition && !this.evaluateCondition(template, step.condition)) {
      return null;
    }

    const oldValue = this.getFieldValue(template, step.field);
    let newValue: unknown;

    try {
      switch (step.action) {
        case 'add':
          newValue = step.value;
          await this.validateStepValue(step);
          this.setFieldValue(template, step.field, step.value);
          break;

        case 'remove':
          await this.validateRemoval(template, step);
          this.removeField(template, step.field);
          break;

        case 'rename':
          newValue = oldValue;
          this.removeField(template, step.field);
          this.setFieldValue(template, step.value as string, oldValue);
          break;

        case 'modify':
          newValue = step.value;
          await this.validateStepValue(step);
          this.setFieldValue(template, step.field, step.value);
          break;

        case 'merge':
          newValue = await this.handleMergeAction(template, step, oldValue);
          this.setFieldValue(template, step.field, newValue);
          break;

        case 'split':
          await this.handleSplitAction(template, step, oldValue);
          break;

        default:
          throw new Error(`Unsupported migration action: ${step.action}`);
      }

      return {
        type: step.type,
        field: step.field,
        action: step.action,
        oldValue,
        newValue,
      };

    } catch (error) {
      this.logger.error('Failed to apply migration step', { 
        error,
        step,
        templateId: template.id
      });
      throw error;
    }
  }

  private async validateStepValue(step: MigrationStep): Promise<void> {
    switch (step.type) {
      case 'parameter':
        // Validate parameter structure
        if (!this.isValidParameter(step.value)) {
          throw new Error(`Invalid parameter structure for field: ${step.field}`);
        }
        break;

      case 'step':
        // Validate workflow step structure
        if (!this.isValidWorkflowStep(step.value)) {
          throw new Error(`Invalid workflow step structure for field: ${step.field}`);
        }
        break;

      case 'config':
        // Validate configuration object
        if (typeof step.value !== 'object' || step.value === null) {
          throw new Error(`Invalid configuration value for field: ${step.field}`);
        }
        break;
    }
  }

  private async validateRemoval(
    template: VersionedTemplate,
    step: MigrationStep
  ): Promise<void> {
    const value = this.getFieldValue(template, step.field);
    if (value === undefined) {
      throw new Error(`Field does not exist: ${step.field}`);
    }

    // Check for dependencies before removal
    if (step.type === 'step') {
      const dependencies = this.findDependencies(template, step.field);
      if (dependencies.length > 0) {
        throw new Error(
          `Cannot remove step ${step.field}, it has dependencies: ${dependencies.join(', ')}`
        );
      }
    }
  }

  private findDependencies(template: VersionedTemplate, stepId: string): string[] {
    return template.steps
      .filter(step => step.dependencies.includes(stepId))
      .map(step => step.templateId);
  }

  private async handleMergeAction(
    template: VersionedTemplate,
    step: MigrationStep,
    oldValue: unknown
  ): Promise<unknown> {
    if (!step.value || typeof step.value !== 'object') {
      throw new Error('Merge action requires a valid object value');
    }

    if (typeof oldValue !== 'object' || oldValue === null) {
      throw new Error('Cannot merge with non-object value');
    }

    return {
      ...oldValue,
      ...step.value,
    };
  }

  private async handleSplitAction(
    template: VersionedTemplate,
    step: MigrationStep,
    oldValue: unknown
  ): Promise<void> {
    if (!Array.isArray(step.value)) {
      throw new Error('Split action requires an array of target fields');
    }

    const targets = step.value as { field: string; value: unknown }[];
    for (const target of targets) {
      this.setFieldValue(template, target.field, target.value);
    }

    // Remove original field after split
    this.removeField(template, step.field);
  }

  private evaluateCondition(template: VersionedTemplate, condition: any): boolean {
    const value = this.getFieldValue(template, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return Array.isArray(value) && value.includes(condition.value);
      case 'exists':
        return value !== undefined;
      case 'notExists':
        return value === undefined;
      default:
        return false;
    }
  }

  private getFieldValue(obj: any, path: string): unknown {
    return path.split('.').reduce((o, key) => o?.[key], obj);
  }

  private setFieldValue(obj: any, path: string, value: unknown): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((o, key) => (o[key] = o[key] || {}), obj);
    target[last] = value;
  }

  private removeField(obj: any, path: string): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((o, key) => o?.[key], obj);
    if (target) {
      delete target[last];
    }
  }

  private cloneTemplate(template: VersionedTemplate): VersionedTemplate {
    return JSON.parse(JSON.stringify(template));
  }

  private isValidParameter(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const param = value as any;
    return (
      typeof param.id === 'string' &&
      typeof param.name === 'string' &&
      typeof param.type === 'string' &&
      typeof param.required === 'boolean'
    );
  }

  private isValidWorkflowStep(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const step = value as any;
    return (
      typeof step.templateId === 'string' &&
      typeof step.name === 'string' &&
      typeof step.type === 'string' &&
      Array.isArray(step.dependencies)
    );
  }
} 