import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Set up global test environment
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
}); 