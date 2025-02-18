import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { BaseAgent } from '../BaseAgent';
import { AgentConfig, AgentMessage, LearningFeedback, AgentState, TaskInfo } from '../types';
import { Logger } from '../../../utils/logger';
import { StateStore } from '../../../core/state/StatePersistence';
import EventEmitter = require('events');

type MockLogger = {
  info: Mock;
  error: Mock;
};

type MockStateStore = {
  saveState: Mock;
  loadState: Mock;
  clearState: Mock;
  getAllStates: Mock;
};

// Create mock state store with proper typing
const mockStateStore: MockStateStore = {
  saveState: jest.fn().mockResolvedValue(undefined),
  loadState: jest.fn().mockResolvedValue(null),
  clearState: jest.fn().mockResolvedValue(undefined),
  getAllStates: jest.fn().mockResolvedValue(new Map()),
};

// Create a concrete implementation for testing
class TestAgent extends BaseAgent {
  constructor(config: AgentConfig, stateStore: StateStore) {
    super(config, stateStore);
  }

  public async process(message: AgentMessage): Promise<AgentMessage> {
    const taskInfo: TaskInfo = {
      id: message.id,
      type: 'document_processing',
      status: 'processing',
      startTime: new Date(),
    };

    this.emit('task:start', taskInfo);
    await new Promise(resolve => setTimeout(resolve, 100));
    this.emit('task:complete', message.id);

    return {
      id: message.id,
      type: 'task_response',
      payload: { processed: true },
      timestamp: new Date(),
      priority: message.priority,
    };
  }

  protected async learn(feedback: LearningFeedback): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Expose protected method for testing
  public async testUpdateState(updates: Partial<AgentState>): Promise<void> {
    return this.updateState(updates);
  }

  // Expose emit for testing with proper typing
  public emitTestEvent(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn() as Mock,
      error: jest.fn() as Mock,
    };

    const config: AgentConfig = {
      id: 'test-agent',
      name: 'Test Agent',
      version: '1.0.0',
      logger: mockLogger as Logger,
    };

    agent = new TestAgent(config, mockStateStore as unknown as StateStore);
  });

  it('should initialize with correct state', () => {
    const state = agent.getState();
    expect(state.status).toBe('idle');
    expect(state.currentTasks).toHaveLength(0);
    expect(state.performance.totalTasks).toBe(0);
  });

  it('should process messages and update state', async () => {
    const message: AgentMessage = {
      id: '123',
      type: 'task_request',
      payload: { test: true },
      timestamp: new Date(),
      priority: 1,
    };

    const response = await agent.process(message);
    const state = agent.getState();

    expect(response.type).toBe('task_response');
    expect(state.performance.totalTasks).toBe(1);
    expect(state.performance.successfulTasks).toBe(1);
  });

  it('should handle learning updates', async () => {
    const feedback: LearningFeedback = {
      taskId: '123',
      expectedOutput: { expected: true },
      actualOutput: { actual: true },
      score: 0.95,
      metadata: {},
    };

    agent.emitTestEvent('learning:update', feedback);
    await new Promise(resolve => setTimeout(resolve, 200));

    const state = agent.getState();
    expect(state.performance.learningIterations).toBe(1);
  });

  it('should persist state changes', async () => {
    await agent.testUpdateState({ status: 'processing' });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agent state persisted',
      })
    );
    expect(mockStateStore.saveState).toHaveBeenCalled();
  });
}); 