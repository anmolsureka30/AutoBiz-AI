import { z } from 'zod';

// Basic validation schemas
export const parameterValidationSchema = z.object({
  pattern: z.string().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  enum: z.array(z.unknown()).optional(),
});

export const stepValidationSchema = z.object({
  preconditions: z.array(z.string()).optional(),
  postconditions: z.array(z.string()).optional(),
  timeout: z.number().optional(),
  requiredResources: z.array(z.string()).optional(),
});

// Core type definitions with validation
export const workflowParameterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string(),
  required: z.boolean(),
  defaultValue: z.unknown().optional(),
  validation: parameterValidationSchema.optional(),
});

export const workflowStepSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  name: z.string(),
  type: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  parameters: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  validation: stepValidationSchema.optional(),
});

export const workflowMetadataSchema = z.object({
  created: z.string(),
  lastModified: z.string(),
  author: z.string(),
  category: z.array(z.string()),
  tags: z.array(z.string()),
  usageCount: z.number(),
  averageExecutionTime: z.number(),
  successRate: z.number(),
});

export const workflowTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  steps: z.array(workflowStepSchema),
  parameters: z.array(workflowParameterSchema),
  metadata: workflowMetadataSchema,
});

// Export types derived from schemas
export type ParameterValidation = z.infer<typeof parameterValidationSchema>;
export type StepValidation = z.infer<typeof stepValidationSchema>;
export type WorkflowParameter = z.infer<typeof workflowParameterSchema>;
export type WorkflowStep = z.infer<typeof workflowStepSchema>;
export type WorkflowMetadata = z.infer<typeof workflowMetadataSchema>;
export type WorkflowTemplate = z.infer<typeof workflowTemplateSchema>;

// Additional utility types
export interface TemplateValidationError {
  path: string[];
  message: string;
  code: string;
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: TemplateValidationError[];
}

export type TemplateValidationFunction = (template: WorkflowTemplate) => TemplateValidationResult; 