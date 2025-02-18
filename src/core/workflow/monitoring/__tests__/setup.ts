import { jest } from '@jest/globals';

// Mock performance hooks
jest.mock('node:perf_hooks', () => ({
  performance: {
    now: () => Date.now(),
  },
  // Add other performance hooks if needed
}));

// Set up global mocks
global.Date = jest.fn(() => new Date('2023-01-01T00:00:00Z')) as any;
global.Date.now = jest.fn(() => new Date('2023-01-01T00:00:00Z').getTime());

// Mock process.hrtime
process.hrtime = jest.fn((time?: [number, number]) => {
  const now = Date.now();
  if (time) {
    const diff = now - (time[0] * 1000 + time[1] / 1e6);
    return [Math.floor(diff / 1000), (diff % 1000) * 1e6];
  }
  return [Math.floor(now / 1000), (now % 1000) * 1e6];
});

// Mock process.memoryUsage
process.memoryUsage = jest.fn(() => ({
  heapUsed: 50 * 1024 * 1024, // 50MB
  heapTotal: 100 * 1024 * 1024,
  external: 0,
  rss: 150 * 1024 * 1024,
})); 