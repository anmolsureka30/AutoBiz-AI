import { Logger } from '../../../utils/logger/Logger';
import {
  WorkflowTemplate,
  workflowTemplateSchema,
  TemplateValidationError,
  TemplateValidationResult,
  TemplateValidationFunction,
} from './types';

export class TemplateValidator {
  private readonly logger: Logger;
  private readonly customValidations: TemplateValidationFunction[];

  constructor(customValidations: TemplateValidationFunction[] = []) {
    this.logger = new Logger('TemplateValidator');
    this.customValidations = customValidations;
  }

  validate(template: WorkflowTemplate): TemplateValidationResult {
    try {
      // First, validate against schema
      const schemaResult = this.validateSchema(template);
      if (!schemaResult.isValid) {
        return schemaResult;
      }

      // Then run custom validations
      const customResults = this.runCustomValidations(template);
      if (customResults.length > 0) {
        return {
          isValid: false,
          errors: customResults,
        };
      }

      // Finally, validate template integrity
      const integrityResults = this.validateTemplateIntegrity(template);
      if (integrityResults.length > 0) {
        return {
          isValid: false,
          errors: integrityResults,
        };
      }

      return { isValid: true, errors: [] };
    } catch (error) {
      this.logger.error('Template validation failed', { error, templateId: template.id });
      return {
        isValid: false,
        errors: [{
          path: [],
          message: `Validation failed: ${error.message}`,
          code: 'VALIDATION_ERROR',
        }],
      };
    }
  }

  private validateSchema(template: WorkflowTemplate): TemplateValidationResult {
    const result = workflowTemplateSchema.safeParse(template);
    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(error => ({
          path: error.path,
          message: error.message,
          code: 'SCHEMA_ERROR',
        })),
      };
    }
    return { isValid: true, errors: [] };
  }

  private runCustomValidations(template: WorkflowTemplate): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];
    
    for (const validation of this.customValidations) {
      const result = validation(template);
      if (!result.isValid) {
        errors.push(...result.errors);
      }
    }

    return errors;
  }

  private validateTemplateIntegrity(template: WorkflowTemplate): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];
    const stepIds = new Set(template.steps.map(step => step.id));

    // Validate step dependencies
    template.steps.forEach(step => {
      step.dependencies.forEach(depId => {
        if (!stepIds.has(depId)) {
          errors.push({
            path: ['steps', step.id, 'dependencies'],
            message: `Step dependency '${depId}' not found`,
            code: 'INVALID_DEPENDENCY',
          });
        }
      });
    });

    // Validate parameter references
    const paramIds = new Set(template.parameters.map(param => param.id));
    template.steps.forEach(step => {
      step.parameters?.forEach(paramId => {
        if (!paramIds.has(paramId)) {
          errors.push({
            path: ['steps', step.id, 'parameters'],
            message: `Parameter '${paramId}' not found`,
            code: 'INVALID_PARAMETER',
          });
        }
      });
    });

    // Check for circular dependencies
    const circularDeps = this.findCircularDependencies(template);
    if (circularDeps.length > 0) {
      errors.push({
        path: ['steps'],
        message: `Circular dependencies detected: ${circularDeps.join(' -> ')}`,
        code: 'CIRCULAR_DEPENDENCY',
      });
    }

    return errors;
  }

  private findCircularDependencies(template: WorkflowTemplate): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularDeps: string[] = [];

    const dfs = (stepId: string, path: string[] = []): void => {
      if (recursionStack.has(stepId)) {
        circularDeps.push(...path.slice(path.indexOf(stepId)), stepId);
        return;
      }

      if (visited.has(stepId)) return;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = template.steps.find(s => s.id === stepId);
      if (step) {
        step.dependencies.forEach(depId => {
          dfs(depId, [...path, stepId]);
        });
      }

      recursionStack.delete(stepId);
    };

    template.steps.forEach(step => {
      if (!visited.has(step.id)) {
        dfs(step.id);
      }
    });

    return circularDeps;
  }
} 