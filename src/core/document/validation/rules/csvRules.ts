import { ValidationRule } from '../../types';
import { parse } from 'csv-parse/sync';

export const csvValidationRules: ValidationRule[] = [
  {
    id: 'csv-structure',
    name: 'CSV Structure Validation',
    description: 'Validates CSV structure and format',
    severity: 'error',
    category: 'format',
    validate: async (file, metadata) => {
      try {
        const content = file.toString('utf-8');
        const records = parse(content, {
          skip_empty_lines: true,
          relax_column_count: false,
        });

        const isValid = records.length > 0 && validateColumnConsistency(records);

        return {
          valid: isValid,
          rule: 'csv-structure',
          details: isValid ? undefined : 'Invalid CSV structure or inconsistent columns',
        };
      } catch (error) {
        return {
          valid: false,
          rule: 'csv-structure',
          details: 'Failed to parse CSV document',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'csv-encoding',
    name: 'CSV Encoding Check',
    description: 'Validates CSV file encoding',
    severity: 'warning',
    category: 'format',
    validate: async (file, metadata) => {
      try {
        const encoding = detectEncoding(file);
        const isUtf8 = encoding === 'utf-8';

        return {
          valid: isUtf8,
          rule: 'csv-encoding',
          details: isUtf8 ? undefined : `Non-UTF-8 encoding detected: ${encoding}`,
        };
      } catch (error) {
        return {
          valid: true,
          rule: 'csv-encoding',
          details: 'Failed to detect encoding',
          error: error as Error,
        };
      }
    },
  },
  {
    id: 'csv-data-validation',
    name: 'CSV Data Validation',
    description: 'Validates CSV data types and content',
    severity: 'warning',
    category: 'content',
    validate: async (file, metadata) => {
      try {
        const content = file.toString('utf-8');
        const records = parse(content, {
          skip_empty_lines: true,
          columns: true,
        });

        const validationResult = validateDataTypes(records);

        return {
          valid: validationResult.valid,
          rule: 'csv-data-validation',
          details: validationResult.valid ? undefined : validationResult.details,
        };
      } catch (error) {
        return {
          valid: true,
          rule: 'csv-data-validation',
          details: 'Failed to validate data types',
          error: error as Error,
        };
      }
    },
  },
];

function validateColumnConsistency(records: any[][]): boolean {
  if (records.length === 0) return false;
  
  const columnCount = records[0].length;
  return records.every(row => row.length === columnCount);
}

function detectEncoding(file: Buffer): string {
  // Check for BOM markers
  if (file.length >= 3) {
    if (file[0] === 0xEF && file[1] === 0xBB && file[2] === 0xBF) {
      return 'utf-8';
    }
    if (file[0] === 0xFE && file[1] === 0xFF) {
      return 'utf-16be';
    }
    if (file[0] === 0xFF && file[1] === 0xFE) {
      return 'utf-16le';
    }
  }

  // Simple heuristic for UTF-8
  try {
    const text = file.toString('utf-8');
    Buffer.from(text, 'utf-8');
    return 'utf-8';
  } catch {
    return 'unknown';
  }
}

interface DataValidationResult {
  valid: boolean;
  details?: string;
  columnTypes?: Map<string, Set<string>>;
}

function validateDataTypes(records: any[]): DataValidationResult {
  if (records.length === 0) {
    return { valid: false, details: 'Empty CSV file' };
  }

  const columnTypes = new Map<string, Set<string>>();
  const issues: string[] = [];

  // Analyze each column's data types
  for (const record of records) {
    for (const [column, value] of Object.entries(record)) {
      if (!columnTypes.has(column)) {
        columnTypes.set(column, new Set());
      }
      columnTypes.get(column)!.add(getValueType(value));
    }
  }

  // Check for inconsistent data types
  for (const [column, types] of columnTypes.entries()) {
    if (types.size > 1) {
      issues.push(`Column "${column}" has mixed data types: ${Array.from(types).join(', ')}`);
    }
  }

  return {
    valid: issues.length === 0,
    details: issues.length > 0 ? issues.join('; ') : undefined,
    columnTypes,
  };
}

function getValueType(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'empty';
  }
  if (!isNaN(value) && !isNaN(parseFloat(value))) {
    return Number.isInteger(parseFloat(value)) ? 'integer' : 'float';
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return 'date';
  }
  if (/^(true|false)$/i.test(value)) {
    return 'boolean';
  }
  return 'string';
} 