import { WorkflowAgent, WorkflowStep } from '../types';
import { Logger } from '../../../utils/logger/Logger';
import { AgentMonitoringService } from '../monitoring/AgentMonitoringService';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent implements WorkflowAgent {
  protected readonly logger: Logger;
  protected readonly agentId: string;
  private readonly monitoring?: AgentMonitoringService;

  constructor(agentType: string, monitoring?: AgentMonitoringService) {
    this.logger = new Logger(`Agent:${agentType}`);
    this.agentId = `${agentType}-${uuidv4()}`;
    this.monitoring = monitoring;

    if (monitoring) {
      monitoring.registerAgent(this.agentId, agentType);
    }
  }

  abstract execute(
    step: WorkflowStep,
    context: Record<string, unknown>
  ): Promise<unknown>;

  async validate(step: WorkflowStep): Promise<boolean> {
    try {
      // Basic validation that can be overridden by specific agents
      if (!step.config || typeof step.config !== 'object') {
        throw new Error('Step configuration must be an object');
      }
      return true;
    } catch (error) {
      this.logger.error('Step validation failed', { error, step });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    // Base cleanup method that can be overridden by specific agents
    this.logger.info('Cleanup completed');
  }

  protected validateRequiredConfig(
    config: Record<string, unknown>,
    requiredFields: string[]
  ): void {
    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing required configuration field: ${field}`);
      }
    }
  }

  protected async handleError(error: unknown, step: WorkflowStep): Promise<never> {
    this.logger.error('Step execution failed', {
      error,
      stepId: step.id,
      stepType: step.type,
    });
    throw error;
  }

  protected async monitoredExecute<T>(
    operation: () => Promise<T>,
    step: WorkflowStep
  ): Promise<T> {
    if (!this.monitoring) {
      return operation();
    }

    const startTime = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      this.monitoring.recordOperation(
        this.agentId,
        true,
        duration,
        {
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: process.cpuUsage().user / 1000000,
        }
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.monitoring.recordOperation(
        this.agentId,
        false,
        duration,
        {
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cpuUsage: process.cpuUsage().user / 1000000,
        },
        error instanceof Error ? error : new Error(String(error))
      );

      throw error;
    }
  }
} 