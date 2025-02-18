import { WorkflowTemplate, TemplateParameter } from './template-types';
import { Workflow, WorkflowStep } from './types';
import { Logger } from '../../utils/logger/Logger';

export class WorkflowTemplateFactory {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('WorkflowTemplateFactory');
  }

  async createWorkflow(
    template: WorkflowTemplate,
    parameters: Record<string, unknown>
  ): Promise<Workflow> {
    try {
      await this.validateParameters(template.parameters, parameters);

      const steps = this.createSteps(template, parameters);
      
      return {
        id: crypto.randomUUID(),
        name: template.name,
        description: template.description,
        steps,
        status: 'pending',
        metadata: {
          created: new Date(),
          owner: 'system', // This should be replaced with actual user
          version: template.version,
          tags: [...template.metadata.tags],
        },
        context: {
          input: parameters,
          output: {},
          stepResults: {},
          variables: {},
          errors: [],
        },
      };
    } catch (error) {
      this.logger.error('Failed to create workflow from template', {
        error,
        templateId: template.id,
      });
      throw error;
    }
  }

  private async validateParameters(
    templateParams: TemplateParameter[],
    providedParams: Record<string, unknown>
  ): Promise<void> {
    const errors: string[] = [];

    for (const param of templateParams) {
      const value = providedParams[param.id];

      if (param.required && value === undefined) {
        errors.push(`Missing required parameter: ${param.name}`);
        continue;
      }

      if (value !== undefined) {
        const validationError = this.validateParameter(param, value);
        if (validationError) {
          errors.push(validationError);
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Parameter validation failed:\n${errors.join('\n')}`);
    }
  }

  private validateParameter(param: TemplateParameter, value: unknown): string | null {
    if (!param.validation) return null;

    const { validation } = param;

    if (validation.pattern && typeof value === 'string') {
      if (!new RegExp(validation.pattern).test(value)) {
        return `${param.name} does not match pattern: ${validation.pattern}`;
      }
    }

    if (typeof value === 'number') {
      if (validation.minimum !== undefined && value < validation.minimum) {
        return `${param.name} is below minimum: ${validation.minimum}`;
      }
      if (validation.maximum !== undefined && value > validation.maximum) {
        return `${param.name} is above maximum: ${validation.maximum}`;
      }
    }

    if (typeof value === 'string') {
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        return `${param.name} is too short (min: ${validation.minLength})`;
      }
      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        return `${param.name} is too long (max: ${validation.maxLength})`;
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      return `${param.name} must be one of: ${validation.enum.join(', ')}`;
    }

    if (validation.custom && !validation.custom(value)) {
      return `${param.name} failed custom validation`;
    }

    return null;
  }

  private createSteps(
    template: WorkflowTemplate,
    parameters: Record<string, unknown>
  ): WorkflowStep[] {
    return template.steps.map(templateStep => ({
      id: crypto.randomUUID(),
      type: templateStep.type,
      name: templateStep.name,
      dependencies: templateStep.dependencies,
      config: this.resolveStepConfig(templateStep, parameters),
      retryPolicy: templateStep.retryPolicy,
      timeout: templateStep.timeout,
      condition: templateStep.condition,
    }));
  }

  private resolveStepConfig(
    step: WorkflowTemplateStep,
    parameters: Record<string, unknown>
  ): Record<string, unknown> {
    const config = { ...step.config };

    // Replace parameter references in config
    if (step.parameters) {
      for (const paramId of step.parameters) {
        if (parameters[paramId] !== undefined) {
          config[paramId] = parameters[paramId];
        }
      }
    }

    return config;
  }
} 