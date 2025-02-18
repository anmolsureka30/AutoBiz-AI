import { ValidationRule } from './types';

export const commonRules: Record<string, ValidationRule> = {
  nonEmpty: {
    id: 'common.nonEmpty',
    severity: 'error',
    message: 'Value cannot be empty',
    validate: (value: unknown) => ({
      valid: value !== '' && value !== null && value !== undefined,
    }),
  },

  positiveNumber: {
    id: 'common.positiveNumber',
    severity: 'error',
    message: 'Value must be a positive number',
    validate: (value: unknown) => ({
      valid: typeof value === 'number' && value > 0,
    }),
  },

  validUrl: {
    id: 'common.validUrl',
    severity: 'error',
    message: 'Value must be a valid URL',
    validate: (value: unknown) => {
      try {
        new URL(value as string);
        return { valid: true };
      } catch {
        return { valid: false };
      }
    },
  },

  validEmail: {
    id: 'common.validEmail',
    severity: 'error',
    message: 'Value must be a valid email address',
    validate: (value: unknown) => ({
      valid: typeof value === 'string' && 
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    }),
  },

  validIdentifier: {
    id: 'common.validIdentifier',
    severity: 'error',
    message: 'Value must be a valid identifier (letters, numbers, underscores)',
    validate: (value: unknown) => ({
      valid: typeof value === 'string' && 
        /^[a-zA-Z][a-zA-Z0-9_]*$/.test(value),
    }),
  },

  validVersion: {
    id: 'common.validVersion',
    severity: 'error',
    message: 'Value must be a valid semantic version',
    validate: (value: unknown) => ({
      valid: typeof value === 'string' && 
        /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+)?$/.test(value),
    }),
  },
}; 