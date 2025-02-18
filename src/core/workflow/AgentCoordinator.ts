import { BaseAgent } from '../../agents/base/BaseAgent';
import { TaskManager } from '../task/TaskManager';
import { Task, TaskType } from '../task/types';
import { Workflow, WorkflowStep, WorkflowStatus, WorkflowError } from './types';
import { Logger } from '../../utils/logger/Logger';
import { EventEmitter } from '../../utils/events/EventEmitter';

export class AgentCoordinator {
  private readonly logger: Logger;
  private readonly events: EventEmitter;
  private readonly activeWorkflows: Map<string, Workflow>;
  private readonly stepExecutors: Map<string, Promise<void>>;

  constructor(
    private readonly taskManager: TaskManager,
    private readonly maxConcurrentWorkflows: number = 5
  ) {
    this.logger = new Logger('AgentCoordinator');
    this.events = new EventEmitter();
    this.activeWorkflows = new Map();
    this.stepExecutors = new Map();
  }

  async startWorkflow(workflow: Workflow): Promise<void> {
    try {
      if (this.activeWorkflows.size >= this.maxConcurrentWorkflows) {
        throw new Error('Maximum concurrent workflows reached');
      }

      await this.validateWorkflow(workflow);
      
      workflow.status = 'running';
      workflow.metadata.started = new Date();
      this.activeWorkflows.set(workflow.id, workflow);

      this.events.emit('workflowStarted', { workflowId: workflow.id });
      
      // Start executing independent steps (those without dependencies)
      const independentSteps = workflow.steps.filter(step => 
        step.dependencies.length === 0
      );

      await Promise.all(
        independentSteps.map(step => this.executeStep(workflow, step))
      );

    } catch (error) {
      this.logger.error('Failed to start workflow', { 
        error, 
        workflowId: workflow.id 
      });
      await this.handleWorkflowError(workflow, error as Error);
    }
  }

  private async validateWorkflow(workflow: Workflow): Promise<void> {
    if (!workflow.id || !workflow.steps.length) {
      throw new Error('Invalid workflow: missing required fields');
    }

    // Check for circular dependencies
    if (this.hasCircularDependencies(workflow.steps)) {
      throw new Error('Invalid workflow: circular dependencies detected');
    }

    // Validate step configurations
    for (const step of workflow.steps) {
      if (!this.taskManager.hasAgentForType(step.type)) {
        throw new Error(`No agent available for step type: ${step.type}`);
      }
    }
  }

  private hasCircularDependencies(steps: WorkflowStep[]): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (recursionStack.has(stepId)) return true;
      if (visited.has(stepId)) return false;

      visited.add(stepId);
      recursionStack.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step) {
        for (const depId of step.dependencies) {
          if (hasCycle(depId)) return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    return steps.some(step => hasCycle(step.id));
  }

  private async executeStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    const executor = this.createStepExecutor(workflow, step);
    this.stepExecutors.set(step.id, executor);

    try {
      await executor;
      await this.handleStepCompletion(workflow, step);
    } catch (error) {
      await this.handleStepError(workflow, step, error as Error);
    } finally {
      this.stepExecutors.delete(step.id);
    }
  }

  private async createStepExecutor(
    workflow: Workflow, 
    step: WorkflowStep
  ): Promise<void> {
    const task: Task = {
      id: `${workflow.id}-${step.id}`,
      type: step.type,
      priority: TaskPriority.Normal,
      status: TaskStatus.Pending,
      input: this.prepareStepInput(workflow, step),
      subtasks: [],
      dependencies: [],
      metadata: {
        created: new Date(),
        requesterId: workflow.metadata.owner,
        retryCount: 0,
        maxRetries: step.retryPolicy?.maxAttempts || 3,
        agentIds: [],
      },
    };

    const result = await this.taskManager.submitTask(task);
    workflow.context.stepResults[step.id] = result;
  }

  private prepareStepInput(workflow: Workflow, step: WorkflowStep): unknown {
    // Combine workflow input, previous step results, and step config
    return {
      ...workflow.context.input,
      ...workflow.context.variables,
      stepConfig: step.config,
      previousResults: this.getPreviousStepResults(workflow, step),
    };
  }

  private getPreviousStepResults(workflow: Workflow, step: WorkflowStep): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    for (const depId of step.dependencies) {
      results[depId] = workflow.context.stepResults[depId];
    }
    return results;
  }

  private async handleStepCompletion(workflow: Workflow, completedStep: WorkflowStep): Promise<void> {
    this.events.emit('stepCompleted', { 
      workflowId: workflow.id, 
      stepId: completedStep.id 
    });

    // Find and execute next steps whose dependencies are met
    const nextSteps = workflow.steps.filter(step =>
      step.dependencies.includes(completedStep.id) &&
      this.areStepDependenciesMet(workflow, step)
    );

    await Promise.all(
      nextSteps.map(step => this.executeStep(workflow, step))
    );

    // Check if workflow is complete
    if (this.isWorkflowComplete(workflow)) {
      await this.completeWorkflow(workflow);
    }
  }

  private areStepDependenciesMet(workflow: Workflow, step: WorkflowStep): boolean {
    return step.dependencies.every(depId => 
      workflow.context.stepResults[depId] !== undefined
    );
  }

  private isWorkflowComplete(workflow: Workflow): boolean {
    return workflow.steps.every(step => 
      workflow.context.stepResults[step.id] !== undefined
    );
  }

  private async completeWorkflow(workflow: Workflow): Promise<void> {
    workflow.status = 'completed';
    workflow.metadata.completed = new Date();
    
    // Aggregate results
    workflow.context.output = this.aggregateWorkflowResults(workflow);
    
    this.activeWorkflows.delete(workflow.id);
    this.events.emit('workflowCompleted', { 
      workflowId: workflow.id,
      output: workflow.context.output,
    });
  }

  private aggregateWorkflowResults(workflow: Workflow): Record<string, unknown> {
    // Implement result aggregation logic based on your needs
    return workflow.context.stepResults;
  }

  private async handleStepError(
    workflow: Workflow, 
    step: WorkflowStep, 
    error: Error
  ): Promise<void> {
    const workflowError: WorkflowError = {
      stepId: step.id,
      error,
      timestamp: new Date(),
      attempt: (workflow.context.errors.filter(e => e.stepId === step.id).length + 1),
    };

    workflow.context.errors.push(workflowError);
    this.events.emit('stepFailed', { 
      workflowId: workflow.id, 
      stepId: step.id, 
      error 
    });

    if (await this.shouldRetryStep(workflow, step, workflowError)) {
      await this.retryStep(workflow, step);
    } else {
      await this.handleWorkflowError(workflow, error);
    }
  }

  private async shouldRetryStep(
    workflow: Workflow, 
    step: WorkflowStep, 
    error: WorkflowError
  ): Promise<boolean> {
    if (!step.retryPolicy) return false;
    
    const attempts = workflow.context.errors.filter(e => 
      e.stepId === step.id
    ).length;

    return attempts < step.retryPolicy.maxAttempts;
  }

  private async retryStep(workflow: Workflow, step: WorkflowStep): Promise<void> {
    const retryDelay = this.calculateRetryDelay(workflow, step);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    await this.executeStep(workflow, step);
  }

  private calculateRetryDelay(workflow: Workflow, step: WorkflowStep): number {
    if (!step.retryPolicy) return 0;

    const attempts = workflow.context.errors.filter(e => 
      e.stepId === step.id
    ).length;

    const delay = step.retryPolicy.initialDelay * 
      Math.pow(step.retryPolicy.backoffMultiplier, attempts - 1);

    return Math.min(delay, step.retryPolicy.maxDelay);
  }

  private async handleWorkflowError(workflow: Workflow, error: Error): Promise<void> {
    workflow.status = 'failed';
    this.activeWorkflows.delete(workflow.id);
    
    this.events.emit('workflowFailed', { 
      workflowId: workflow.id, 
      error 
    });
  }

  getWorkflowStatus(workflowId: string): WorkflowStatus {
    const workflow = this.activeWorkflows.get(workflowId);
    return workflow?.status || 'completed';
  }

  onWorkflowCompleted(handler: (event: { workflowId: string; output: unknown }) => void): void {
    this.events.on('workflowCompleted', handler);
  }

  onWorkflowFailed(handler: (event: { workflowId: string; error: Error }) => void): void {
    this.events.on('workflowFailed', handler);
  }
} 