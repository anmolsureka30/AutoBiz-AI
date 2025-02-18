import { RateLimitInfo } from './types';
import { Logger } from '../../../utils/logger';

export interface RateLimiterConfig {
  maxRequests: number;
  interval: number; // in milliseconds
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private waitQueue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private rateLimitInfo?: RateLimitInfo;

  constructor(
    private readonly config: RateLimiterConfig,
    private readonly logger?: Logger
  ) {
    this.tokens = config.maxRequests;
    this.lastRefill = Date.now();
  }

  async waitForToken(retryCount = 0): Promise<void> {
    // Check if we need to refill tokens
    this.refillTokens();

    // If we have tokens available, consume one and proceed
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // If we're rate limited and have retry attempts left
    if (retryCount < (this.config.maxRetries || 3)) {
      const delayMs = this.calculateBackoff(retryCount);
      this.logger?.info({
        message: 'Rate limited, waiting before retry',
        retryCount,
        delayMs
      });

      await this.delay(delayMs);
      return this.waitForToken(retryCount + 1);
    }

    // If we're out of tokens and retries, wait for next token
    return new Promise((resolve, reject) => {
      const timeToNextToken = this.getTimeToNextToken();
      
      if (timeToNextToken === null) {
        reject(new Error('Rate limit exceeded'));
        return;
      }

      this.logger?.info({
        message: 'Waiting for rate limit reset',
        timeToNextToken
      });

      this.waitQueue.push({ resolve, reject });
      setTimeout(() => this.processQueue(), timeToNextToken);
    });
  }

  updateLimits(info: RateLimitInfo): void {
    this.rateLimitInfo = info;
    this.tokens = info.remaining;
    
    this.logger?.info({
      message: 'Rate limit info updated',
      remaining: info.remaining,
      limit: info.limit,
      reset: info.reset
    });
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed >= this.config.interval) {
      const intervals = Math.floor(timePassed / this.config.interval);
      this.tokens = Math.min(
        this.config.maxRequests,
        this.tokens + (intervals * this.config.maxRequests)
      );
      this.lastRefill = now;

      this.logger?.debug({
        message: 'Tokens refilled',
        newTokenCount: this.tokens,
        timePassed
      });
    }
  }

  private processQueue(): void {
    this.refillTokens();

    while (this.tokens > 0 && this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      if (waiter) {
        this.tokens--;
        waiter.resolve();
      }
    }
  }

  private getTimeToNextToken(): number | null {
    if (this.rateLimitInfo) {
      const now = Date.now();
      const resetTime = this.rateLimitInfo.reset.getTime();
      if (resetTime > now) {
        return resetTime - now;
      }
    }

    // If no rate limit info, use configured interval
    return this.config.interval;
  }

  private calculateBackoff(retryCount: number): number {
    const initialDelay = this.config.initialDelayMs || 1000;
    const maxDelay = this.config.maxDelayMs || 30000;
    
    // Exponential backoff with jitter
    const exponentialDelay = initialDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 