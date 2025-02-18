import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { InMemoryStateStore } from '../InMemoryStateStore';
import { AgentState } from '../../../agents/base/types';
import { Logger } from '../../../utils/logger';

type MockLogger = {
  info: Mock;
  error: Mock;
};

describe('InMemoryStateStore', () => {
  let stateStore: InMemoryStateStore;
  let mockLogger: MockLogger;

  const testState: AgentState = {
    id: 'test-agent',
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

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    stateStore = new InMemoryStateStore(mockLogger as Logger);
  });

  it('should save and load state correctly', async () => {
    await stateStore.saveState('test-agent', testState);
    const loadedState = await stateStore.loadState('test-agent');
    
    expect(loadedState).toEqual(testState);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agent state saved to memory',
        agentId: 'test-agent',
      })
    );
  });

  it('should return null when loading non-existent state', async () => {
    const loadedState = await stateStore.loadState('non-existent');
    expect(loadedState).toBeNull();
  });

  it('should clear state correctly', async () => {
    await stateStore.saveState('test-agent', testState);
    await stateStore.clearState('test-agent');
    
    const loadedState = await stateStore.loadState('test-agent');
    expect(loadedState).toBeNull();
  });

  it('should get all states correctly', async () => {
    await stateStore.saveState('agent1', testState);
    await stateStore.saveState('agent2', { ...testState, id: 'agent2' });

    const allStates = await stateStore.getAllStates();
    expect(allStates.size).toBe(2);
    expect(allStates.get('agent1')).toEqual(testState);
    expect(allStates.get('agent2')).toEqual({ ...testState, id: 'agent2' });
  });
}); 