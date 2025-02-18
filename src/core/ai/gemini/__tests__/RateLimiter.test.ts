import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { RateLimiter } from '../RateLimiter';
import { Logger } from '../../../../utils/logger';

type MockLogger = {
  info: jest.Mock;
  debug: jest.Mock;
};

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let mockLogger: MockLogger;

  beforeEach(() => {
    jest.useFakeTimers();
    
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn()
    };

    rateLimiter = new RateLimiter({
      maxRequests: 2,
      interval: 1000, // 1 second
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000
    }, mockLogger as unknown as Logger);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within rate limit', async () => {
    await rateLimiter.waitForToken();
    await rateLimiter.waitForToken();

    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('should block requests when rate limit exceeded', async () => {
    await rateLimiter.waitForToken();
    await rateLimiter.waitForToken();

    const promise = rateLimiter.waitForToken();
    
    jest.advanceTimersByTime(1000);
    await promise;

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Waiting for rate limit reset'
      })
    );
  });

  it('should respect rate limit info from API', async () => {
    rateLimiter.updateLimits({
      remaining: 1,
      limit: 2,
      reset: new Date(Date.now() + 2000)
    });

    await rateLimiter.waitForToken();
    const promise = rateLimiter.waitForToken();

    jest.advanceTimersByTime(2000);
    await promise;

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Rate limit info updated'
      })
    );
  });

  it('should implement exponential backoff for retries', async () => {
    rateLimiter = new RateLimiter({
      maxRequests: 1,
      interval: 1000,
      maxRetries: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000
    }, mockLogger as unknown as Logger);

    // Use up the token
    await rateLimiter.waitForToken();

    // Start a request that will need to retry
    const promise = rateLimiter.waitForToken();

    // First retry
    jest.advanceTimersByTime(100);
    // Second retry
    jest.advanceTimersByTime(200);
    // Success after interval
    jest.advanceTimersByTime(1000);

    await promise;

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Rate limited, waiting before retry'
      })
    );
  });

  it('should handle multiple waiting requests', async () => {
    const promises = [
      rateLimiter.waitForToken(),
      rateLimiter.waitForToken(),
      rateLimiter.waitForToken(),
      rateLimiter.waitForToken()
    ];

    jest.advanceTimersByTime(1000);
    await Promise.all(promises);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Waiting for rate limit reset'
      })
    );
  });
}); 