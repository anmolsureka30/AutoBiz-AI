import { jest } from '@jest/globals';

// Mock performance hooks
jest.mock('perf_hooks', () => ({
  performance: {
    now: () => Date.now(),
  },
}));

// Mock process.memoryUsage
const mockMemoryUsage = {
  heapUsed: 50 * 1024 * 1024, // 50MB
  heapTotal: 100 * 1024 * 1024,
  external: 0,
  rss: 150 * 1024 * 1024,
};

process.memoryUsage = jest.fn(() => mockMemoryUsage);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
}); 