import { TemplateValidator } from '../validation/TemplateValidator';
import { WorkflowTemplateFactory } from '../WorkflowTemplateFactory';
import { AgentCoordinator } from '../AgentCoordinator';
import { Logger } from '../../../utils/logger/Logger';
import {
  TemplateTestCase,
  TemplateTestResult,
  TemplateTestSuite,
  TestSuiteResult,
} from './types';

export class TemplateTestRunner {
  private readonly logger: Logger;
  private readonly validator: TemplateValidator;
  private readonly factory: WorkflowTemplateFactory;
  private readonly coordinator: AgentCoordinator;

  constructor(coordinator: AgentCoordinator) {
    this.logger = new Logger('TemplateTestRunner');
    this.validator = new TemplateValidator();
    this.factory = new WorkflowTemplateFactory();
    this.coordinator = coordinator;
  }

  async runTestSuite(suite: TemplateTestSuite): Promise<TestSuiteResult> {
    this.logger.info(`Running test suite: ${suite.name}`);
    const startTime = Date.now();
    const results: TemplateTestResult[] = [];
    let skipped = 0;

    try {
      await suite.setup?.();

      for (const testCase of suite.tests) {
        try {
          const result = await this.runTest(testCase);
          results.push(result);
        } catch (error) {
          this.logger.error(`Test case failed: ${testCase.name}`, { error });
          skipped++;
        }
      }

      await suite.teardown?.();
    } catch (error) {
      this.logger.error(`Test suite failed: ${suite.name}`, { error });
      skipped = suite.tests.length - results.length;
    }

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.passed).length;

    return {
      suiteName: suite.name,
      results,
      summary: {
        total: suite.tests.length,
        passed,
        failed: results.length - passed,
        skipped,
        duration,
      },
    };
  }

  private async runTest(testCase: TemplateTestCase): Promise<TemplateTestResult> {
    this.logger.info(`Running test case: ${testCase.name}`);
    const startTime = Date.now();

    try {
      // Validate template
      const validation = this.validator.validateTemplate(testCase.template);
      if (!validation.isValid && !testCase.shouldFail) {
        return {
          testCase,
          passed: false,
          validation,
          error: new Error('Template validation failed'),
        };
      }

      // If the test is expected to fail validation, we're done
      if (testCase.shouldFail && !validation.isValid) {
        return {
          testCase,
          passed: true,
          validation,
        };
      }

      // Create and execute workflow
      const workflow = await this.factory.createWorkflow(
        testCase.template,
        testCase.input
      );

      const executionStartTime = Date.now();
      const result = await this.coordinator.startWorkflow(workflow);
      const executionDuration = Date.now() - executionStartTime;

      // Verify execution results
      const executedSteps = this.getExecutedSteps(result);
      const passed = this.verifyTestResults(testCase, result, executedSteps);

      return {
        testCase,
        passed,
        validation,
        executionResult: {
          output: result.context.output,
          executedSteps,
          duration: executionDuration,
          errors: result.context.errors,
        },
      };

    } catch (error) {
      this.logger.error(`Test execution failed: ${testCase.name}`, { error });
      return {
        testCase,
        passed: false,
        validation: { isValid: false, errors: [], warnings: [] },
        error: error as Error,
      };
    }
  }

  private getExecutedSteps(result: any): string[] {
    return Object.keys(result.context.stepResults);
  }

  private verifyTestResults(
    testCase: TemplateTestCase,
    result: any,
    executedSteps: string[]
  ): boolean {
    // Verify expected output if specified
    if (testCase.expectedOutput) {
      if (!this.compareOutputs(result.context.output, testCase.expectedOutput)) {
        return false;
      }
    }

    // Verify expected steps if specified
    if (testCase.expectedSteps) {
      if (!this.compareSteps(executedSteps, testCase.expectedSteps)) {
        return false;
      }
    }

    // Verify expected errors if specified
    if (testCase.expectedErrors) {
      if (!this.compareErrors(result.context.errors, testCase.expectedErrors)) {
        return false;
      }
    }

    return true;
  }

  private compareOutputs(
    actual: Record<string, unknown>,
    expected: Record<string, unknown>
  ): boolean {
    // Implement deep comparison logic based on your needs
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  private compareSteps(actual: string[], expected: string[]): boolean {
    if (actual.length !== expected.length) return false;
    return expected.every(step => actual.includes(step));
  }

  private compareErrors(actual: Error[], expected: string[]): boolean {
    if (actual.length !== expected.length) return false;
    return expected.every(expectedError =>
      actual.some(actualError =>
        actualError.message.includes(expectedError)
      )
    );
  }
} 