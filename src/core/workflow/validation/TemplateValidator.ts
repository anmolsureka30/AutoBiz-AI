import { WorkflowTemplate, WorkflowTemplateStep, TemplateParameter } from '../template-types';
import { Logger } from '../../../utils/logger/Logger';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'critical' | 'error';
  message: string;
  details?: string;
}

export interface ValidationWarning {
  type: 'design' | 'documentation' | 'validation' | 'metadata';
  message: string;
  details?: string;
}

export class TemplateValidator {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('TemplateValidator');
  }

  validateTemplate(template: WorkflowTemplate): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate basic template properties
      this.validateBasicProperties(template, errors);

      // Validate steps
      this.validateSteps(template, errors, warnings);

      // Validate parameters
      this.validateParameters(template, errors, warnings);

      // Validate dependencies
      this.validateDependencies(template, errors);

      // Validate metadata
      this.validateMetadata(template, warnings);

    } catch (error) {
      this.logger.error('Template validation failed', { error, templateId: template.id });
      errors.push({
        type: 'critical',
        message: 'Template validation failed unexpectedly',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateBasicProperties(template: WorkflowTemplate, errors: ValidationError[]): void {
    if (!template.id) {
      errors.push({ type: 'critical', message: 'Template ID is required' });
    }
    if (!template.name) {
      errors.push({ type: 'critical', message: 'Template name is required' });
    }
    if (!template.version) {
      errors.push({ type: 'critical', message: 'Template version is required' });
    }
    if (!template.steps || template.steps.length === 0) {
      errors.push({ type: 'critical', message: 'Template must have at least one step' });
    }
  }

  private validateSteps(
    template: WorkflowTemplate,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const stepIds = new Set<string>();
    const templateParams = template.parameters || [];

    template.steps.forEach((step, index) => {
      // Check for duplicate step IDs
      if (stepIds.has(step.templateId)) {
        errors.push({
          type: 'critical',
          message: `Duplicate step ID: ${step.templateId}`,
          details: `Step at index ${index}`,
        });
      }
      stepIds.add(step.templateId);

      // Validate step parameters
      this.validateStepParameters(step, templateParams, errors);

      // Check for empty dependencies array
      if (!Array.isArray(step.dependencies)) {
        errors.push({
          type: 'error',
          message: `Invalid dependencies for step: ${step.templateId}`,
          details: 'Dependencies must be an array',
        });
      }

      // Validate step configuration
      if (step.config && typeof step.config !== 'object') {
        errors.push({
          type: 'error',
          message: `Invalid configuration for step: ${step.templateId}`,
          details: 'Configuration must be an object',
        });
      }
    });
  }

  private validateStepParameters(
    step: WorkflowTemplateStep,
    templateParams: TemplateParameter[],
    errors: ValidationError[]
  ): void {
    const parameterIds = new Set(templateParams.map(p => p.id));

    step.parameters?.forEach(paramId => {
      if (!parameterIds.has(paramId)) {
        errors.push({
          type: 'error',
          message: `Invalid parameter reference in step: ${step.templateId}`,
          details: `Parameter ID not found: ${paramId}`,
        });
      }
    });
  }

  private validateParameters(
    template: WorkflowTemplate,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const parameterIds = new Set<string>();

    template.parameters.forEach(param => {
      if (parameterIds.has(param.id)) {
        errors.push({
          type: 'critical',
          message: `Duplicate parameter ID: ${param.id}`,
        });
      }
      parameterIds.add(param.id);

      // Validate parameter type
      if (!param.type) {
        errors.push({
          type: 'error',
          message: `Missing type for parameter: ${param.id}`,
        });
      }

      // Validate required parameters have no default value
      if (param.required && param.defaultValue !== undefined) {
        warnings.push({
          type: 'validation',
          message: `Required parameter should not have default value: ${param.id}`,
        });
      }

      // Validate parameter validation rules
      if (param.validation && typeof param.validation !== 'object') {
        errors.push({
          type: 'error',
          message: `Invalid validation rules for parameter: ${param.id}`,
        });
      }
    });
  }

  private validateDependencies(template: WorkflowTemplate, errors: ValidationError[]): void {
    const stepIds = new Set(template.steps.map(s => s.templateId));

    // Check for circular dependencies
    if (this.hasCircularDependencies(template.steps)) {
      errors.push({
        type: 'critical',
        message: 'Template contains circular dependencies',
      });
    }

    // Validate dependency references
    template.steps.forEach(step => {
      step.dependencies.forEach(depId => {
        if (!stepIds.has(depId)) {
          errors.push({
            type: 'error',
            message: `Invalid dependency reference in step: ${step.templateId}`,
            details: `Dependency ID not found: ${depId}`,
          });
        }
      });
    });
  }

  private hasCircularDependencies(steps: WorkflowTemplateStep[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find(s => s.templateId === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    return steps.some(step => hasCycle(step.templateId));
  }

  private validateMetadata(template: WorkflowTemplate, warnings: ValidationWarning[]): void {
    const { metadata } = template;

    if (!metadata.category || metadata.category.length === 0) {
      warnings.push({
        type: 'documentation',
        message: 'Template is missing categories',
      });
    }

    if (!metadata.tags || metadata.tags.length === 0) {
      warnings.push({
        type: 'documentation',
        message: 'Template is missing tags',
      });
    }

    if (metadata.created > metadata.lastModified) {
      warnings.push({
        type: 'metadata',
        message: 'Creation date is more recent than last modification date',
      });
    }
  }
} 