import EventEmitter = require('events');
import { 
  AgentConfig, 
  AgentState, 
  AgentMessage, 
  TaskInfo,
  LearningFeedback,
  PerformanceMetrics,
  TaskStatus
} from './types';
import { Logger } from '../utils/logger';
import { StateStore } from '../state/StatePersistence';

export abstract class BaseAgent extends EventEmitter {
  protected state: AgentState;
  protected readonly config: AgentConfig;
  protected readonly logger: Logger;
  protected readonly stateStore: StateStore;

  constructor(config: AgentConfig, stateStore: StateStore) {
    super();
    this.config = config;
    this.logger = config.logger;
    this.stateStore = stateStore;
    
    this.state = this.initializeState();
    this.setupEventListeners();
  }

  protected initializeState(): AgentState {
    return {
      id: this.config.id,
      status: 'idle',
      currentTasks: [],
      performance: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageProcessingTime: 0,
        learningIterations: 0,
        lastLearningUpdate: new Date(),
      },
      lastUpdated: new Date(),
    };
  }

  private setupEventListeners(): void {
    this.on('task:start', this.handleTaskStart.bind(this));
    this.on('task:complete', this.handleTaskComplete.bind(this));
    this.on('task:error', this.handleTaskError.bind(this));
    this.on('learning:update', this.handleLearningUpdate.bind(this));
  }

  public getState(): AgentState {
    return { ...this.state };
  }

  protected async updateState(updates: Partial<AgentState>): Promise<void> {
    this.state = {
      ...this.state,
      ...updates,
      lastUpdated: new Date(),
    };

    this.emit('state:update', this.state);
    await this.persistState();
  }

  protected async persistState(): Promise<void> {
    try {
      await this.stateStore.saveState(this.config.id, this.state);
      this.logger.info({
        message: 'Agent state persisted',
        agentId: this.config.id,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to persist agent state',
        agentId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  protected updatePerformanceMetrics(updates: Partial<PerformanceMetrics>): void {
    this.state.performance = {
      ...this.state.performance,
      ...updates,
    };
  }

  private handleTaskStart(task: TaskInfo): void {
    this.state.currentTasks.push(task);
    this.updateState({ status: 'processing' });
  }

  private handleTaskComplete(taskId: string): void {
    this.updateTaskStatus(taskId, 'completed');
    this.updatePerformanceMetrics({
      totalTasks: this.state.performance.totalTasks + 1,
      successfulTasks: this.state.performance.successfulTasks + 1,
    });

    if (this.state.currentTasks.length === 0) {
      this.updateState({ status: 'idle' });
    }
  }

  private handleTaskError(taskId: string, error: Error): void {
    this.updateTaskStatus(taskId, 'failed', error);
    this.updatePerformanceMetrics({
      totalTasks: this.state.performance.totalTasks + 1,
      failedTasks: this.state.performance.failedTasks + 1,
    });

    if (this.state.currentTasks.length === 0) {
      this.updateState({ status: 'idle' });
    }
  }

  private updateTaskStatus(
    taskId: string, 
    status: TaskStatus, 
    error?: Error
  ): void {
    const taskIndex = this.state.currentTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.state.currentTasks[taskIndex];
    task.status = status;
    task.endTime = new Date();
    if (error) task.error = error;

    this.state.currentTasks.splice(taskIndex, 1);
  }

  private async handleLearningUpdate(feedback: LearningFeedback): Promise<void> {
    try {
      await this.updateState({ status: 'learning' });
      await this.learn(feedback);
      
      this.updatePerformanceMetrics({
        learningIterations: this.state.performance.learningIterations + 1,
        lastLearningUpdate: new Date(),
      });

      await this.updateState({ status: 'idle' });
    } catch (error) {
      this.logger.error({
        message: 'Learning update failed',
        agentId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.updateState({ status: 'error' });
    }
  }

  public abstract process(message: AgentMessage): Promise<AgentMessage>;
  protected abstract learn(feedback: LearningFeedback): Promise<void>;

  // Add emit method to fix TypeScript error
  protected emit(event: string | symbol, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
} 