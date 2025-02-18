import {
  ValidationRule,
  ValidationResult,
  ValidationContext,
  ConfigValidationSchema,
  PropertyValidation,
} from './types';
import { Logger } from '../../../utils/logger/Logger';

export class ConfigValidator {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('ConfigValidator');
  }

  validate(
    config: unknown,
    schema: ConfigValidationSchema,
    context: ValidationContext = { path: [], root: config }
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate required fields
    if (schema.required) {
      results.push(...this.validateRequired(config, schema.required, context));
    }

    // Validate against schema rules
    if (schema.rules) {
      results.push(...this.validateRules(config, schema.rules, context));
    }

    // Validate properties
    if (this.isRecord(config)) {
      results.push(...this.validateProperties(config, schema.properties, context));
    }

    return results;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private validateRequired(
    value: unknown,
    required: string[],
    context: ValidationContext
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    if (!this.isRecord(value)) {
      results.push({
        valid: false,
        message: 'Value must be an object',
        details: { path: context.path },
      });
      return results;
    }

    for (const field of required) {
      if (!(field in value)) {
        results.push({
          valid: false,
          message: `Missing required field: ${field}`,
          details: { path: [...context.path, field] },
        });
      }
    }

    return results;
  }

  private validateRules(
    value: unknown,
    rules: ValidationRule[],
    context: ValidationContext
  ): ValidationResult[] {
    return rules.map(rule => {
      try {
        const result = rule.validate(value, context);
        if (!result.valid) {
          return {
            ...result,
            message: rule.message,
            details: {
              ...result.details,
              ruleId: rule.id,
              severity: rule.severity,
              path: context.path,
            },
          };
        }
        return result;
      } catch (error) {
        this.logger.error('Rule validation failed', { error, rule, value });
        return {
          valid: false,
          message: `Rule validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            ruleId: rule.id,
            severity: rule.severity,
            path: context.path,
          },
        };
      }
    });
  }

  private validateProperties(
    value: Record<string, unknown>,
    properties: Record<string, PropertyValidation>,
    context: ValidationContext
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const [key, propertySchema] of Object.entries(properties)) {
      const propertyValue = value[key];
      const propertyContext: ValidationContext = {
        ...context,
        path: [...context.path, key],
        parent: value,
      };

      // Validate type
      if (!this.validateType(propertyValue, propertySchema.type)) {
        results.push({
          valid: false,
          message: `Invalid type for ${key}: expected ${propertySchema.type}`,
          details: { path: propertyContext.path },
        });
        continue;
      }

      // Validate property rules
      if (propertySchema.rules) {
        results.push(
          ...this.validateRules(propertyValue, propertySchema.rules, propertyContext)
        );
      }

      // Validate nested object properties
      if (propertySchema.type === 'object' && propertySchema.properties) {
        if (this.isRecord(propertyValue)) {
          results.push(
            ...this.validateProperties(
              propertyValue,
              propertySchema.properties,
              propertyContext
            )
          );
        }
      }

      // Validate array items
      if (propertySchema.type === 'array' && propertySchema.items) {
        const arrayValue = propertyValue as unknown[];
        arrayValue.forEach((item, index) => {
          const itemContext: ValidationContext = {
            ...propertyContext,
            path: [...propertyContext.path, index.toString()],
          };
          results.push(
            ...this.validate(item, {
              rules: [],
              properties: { item: propertySchema.items! },
            }, itemContext)
          );
        });
      }

      // Validate enum values
      if (propertySchema.enum && !propertySchema.enum.includes(propertyValue)) {
        results.push({
          valid: false,
          message: `Invalid value for ${key}: must be one of ${propertySchema.enum.join(', ')}`,
          details: { path: propertyContext.path },
        });
      }

      // Validate number constraints
      if (propertySchema.type === 'number') {
        if (
          propertySchema.minimum !== undefined &&
          (propertyValue as number) < propertySchema.minimum
        ) {
          results.push({
            valid: false,
            message: `Value for ${key} must be >= ${propertySchema.minimum}`,
            details: { path: propertyContext.path },
          });
        }
        if (
          propertySchema.maximum !== undefined &&
          (propertyValue as number) > propertySchema.maximum
        ) {
          results.push({
            valid: false,
            message: `Value for ${key} must be <= ${propertySchema.maximum}`,
            details: { path: propertyContext.path },
          });
        }
      }

      // Validate string constraints
      if (propertySchema.type === 'string') {
        const strValue = propertyValue as string;
        if (
          propertySchema.minLength !== undefined &&
          strValue.length < propertySchema.minLength
        ) {
          results.push({
            valid: false,
            message: `String length for ${key} must be >= ${propertySchema.minLength}`,
            details: { path: propertyContext.path },
          });
        }
        if (
          propertySchema.maxLength !== undefined &&
          strValue.length > propertySchema.maxLength
        ) {
          results.push({
            valid: false,
            message: `String length for ${key} must be <= ${propertySchema.maxLength}`,
            details: { path: propertyContext.path },
          });
        }
        if (propertySchema.pattern && !new RegExp(propertySchema.pattern).test(strValue)) {
          results.push({
            valid: false,
            message: `String must match pattern: ${propertySchema.pattern}`,
            details: { path: propertyContext.path },
          });
        }
      }
    }

    return results;
  }

  private validateType(value: unknown, type: PropertyValidation['type']): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }
} 