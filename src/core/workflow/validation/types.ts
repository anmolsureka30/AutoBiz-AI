export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationRule<T = unknown> {
  id: string;
  severity: ValidationSeverity;
  validate: (value: T, context?: ValidationContext) => ValidationResult;
  message: string;
  fix?: (value: T) => T;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ValidationContext {
  path: string[];
  root: unknown;
  parent?: unknown;
}

export interface ConfigValidationSchema {
  rules: ValidationRule[];
  required?: string[];
  properties: Record<string, PropertyValidation>;
}

export interface PropertyValidation {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  rules?: ValidationRule[];
  items?: PropertyValidation; // For arrays
  properties?: Record<string, PropertyValidation>; // For objects
  required?: string[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
} 