import { WorkflowStep, WorkflowAgent } from './types';
import { Logger } from '../../utils/logger/Logger';

export class TaskManager {
  private readonly logger: Logger;
  private readonly agents: Map<string, WorkflowAgent>;

  constructor() {
    this.logger = new Logger('TaskManager');
    this.agents = new Map();
  }

  registerAgent(type: string, agent: WorkflowAgent): void {
    if (this.agents.has(type)) {
      this.logger.warn(`Overwriting existing agent for type: ${type}`);
    }
    this.agents.set(type, agent);
    this.logger.info(`Registered agent for type: ${type}`);
  }

  hasAgentForType(type: string): boolean {
    return this.agents.has(type);
  }

  async executeStep(step: WorkflowStep, context: Record<string, unknown>): Promise<unknown> {
    const agent = this.agents.get(step.type);
    if (!agent) {
      throw new Error(`No agent available for step type: ${step.type}`);
    }

    try {
      this.logger.info(`Executing step: ${step.id}`, { type: step.type });
      const result = await agent.execute(step, context);
      this.logger.info(`Step completed: ${step.id}`, { type: step.type });
      return result;
    } catch (error) {
      this.logger.error(`Step failed: ${step.id}`, { error, type: step.type });
      throw error;
    }
  }

  getRegisteredAgentTypes(): string[] {
    return Array.from(this.agents.keys());
  }

  getAgent(type: string): WorkflowAgent | undefined {
    return this.agents.get(type);
  }

  clearAgents(): void {
    this.agents.clear();
    this.logger.info('Cleared all registered agents');
  }
} 