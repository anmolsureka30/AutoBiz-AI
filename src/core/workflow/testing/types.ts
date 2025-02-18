import { WorkflowTemplate } from '../template-types';
import { ValidationResult } from '../validation/TemplateValidator';

export interface TemplateTestCase {
  name: string;
  template: WorkflowTemplate;
  input: Record<string, unknown>;
  expectedOutput?: Record<string, unknown>;
  expectedSteps?: string[];
  shouldFail?: boolean;
  expectedErrors?: string[];
}

export interface TemplateTestResult {
  testCase: TemplateTestCase;
  passed: boolean;
  validation: ValidationResult;
  executionResult?: {
    output: Record<string, unknown>;
    executedSteps: string[];
    duration: number;
    errors: Error[];
  };
  error?: Error;
}

export interface TemplateTestSuite {
  name: string;
  description?: string;
  tests: TemplateTestCase[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface TestSuiteResult {
  suiteName: string;
  results: TemplateTestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
} 