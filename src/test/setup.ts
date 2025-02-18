import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Set up global test environment
global.beforeEach(() => {
  jest.useFakeTimers();
});

global.afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// Add custom matchers
expect.extend({
  toBeValidAgentState(received) {
    const pass = received 
      && typeof received.id === 'string'
      && ['idle', 'processing', 'learning', 'error'].includes(received.status)
      && Array.isArray(received.currentTasks)
      && typeof received.performance === 'object'
      && received.lastUpdated instanceof Date;

    return {
      pass,
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid agent state`
          : `Expected ${received} to be a valid agent state`,
    };
  },
}); 