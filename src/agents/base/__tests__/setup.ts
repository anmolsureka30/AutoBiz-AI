import '@testing-library/jest-dom';
import { jest, expect } from '@jest/globals';
import { AgentState } from '../types';

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidAgentState(): R;
    }
  }
}

// Extend Jest matchers
expect.extend({
  toBeValidAgentState(received: unknown): jest.CustomMatcherResult {
    const isValid = received 
      && typeof (received as AgentState).id === 'string'
      && ['idle', 'processing', 'learning', 'error'].includes((received as AgentState).status)
      && Array.isArray((received as AgentState).currentTasks)
      && typeof (received as AgentState).performance === 'object'
      && (received as AgentState).lastUpdated instanceof Date;

    return {
      message: () => `expected ${received} to be a valid agent state`,
      pass: isValid,
    };
  },
});

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
}); 