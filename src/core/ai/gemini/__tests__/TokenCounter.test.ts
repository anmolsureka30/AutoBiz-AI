import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { TokenCounter } from '../TokenCounter';
import { Logger } from '../../../../utils/logger';
import { GeminiModel } from '../types';

type MockLogger = {
  error: jest.Mock;
};

describe('TokenCounter', () => {
  let counter: TokenCounter;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn()
    };
  });

  describe('gemini-pro model', () => {
    beforeEach(() => {
      counter = new TokenCounter('gemini-pro', mockLogger as unknown as Logger);
    });

    it('should count empty string as 0 tokens', async () => {
      const result = await counter.countTokens('');
      expect(result.totalTokens).toBe(0);
    });

    it('should count simple ASCII text', async () => {
      const result = await counter.countTokens('Hello, World!');
      expect(result.totalTokens).toBe(10); // Approximate
    });

    it('should handle special tokens', async () => {
      const result = await counter.countTokens('https://www.example.com\n');
      expect(result.totalTokens).toBe(5); // URL tokens + newline
    });

    it('should handle Unicode characters', async () => {
      const result = await counter.countTokens('Hello 世界');
      expect(result.totalTokens).toBe(7); // ASCII + CJK characters
    });

    it('should handle emoji', async () => {
      const result = await counter.countTokens('Hello 👋');
      expect(result.totalTokens).toBe(5); // Text + surrogate pair
    });

    it('should handle whitespace efficiently', async () => {
      const result = await counter.countTokens('Hello    World');
      expect(result.totalTokens).toBe(8); // Compressed whitespace
    });

    it('should handle numbers', async () => {
      const result = await counter.countTokens('123.456');
      expect(result.totalTokens).toBe(4); // Efficient number encoding
    });
  });

  describe('gemini-pro-vision model', () => {
    beforeEach(() => {
      counter = new TokenCounter('gemini-pro-vision', mockLogger as unknown as Logger);
    });

    it('should use vision-specific tokenization', async () => {
      const result = await counter.countTokens('Describe this image:');
      expect(result.totalTokens).toBe(12); // Vision prompt tokens
    });
  });

  describe('error handling', () => {
    it('should handle invalid input', async () => {
      counter = new TokenCounter('gemini-pro', mockLogger as unknown as Logger);
      const result = await counter.countTokens(null as unknown as string);
      expect(result.totalTokens).toBe(0);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should throw for unsupported models', () => {
      expect(() => {
        new TokenCounter('invalid-model' as GeminiModel);
      }).toThrow('Unsupported model');
    });
  });

  describe('token limits', () => {
    it('should respect model token limits', async () => {
      const counter = new TokenCounter('gemini-pro', mockLogger as unknown as Logger);
      const longText = 'a'.repeat(100000);
      const result = await counter.countTokens(longText);
      expect(result.totalTokens).toBeLessThanOrEqual(32768);
    });
  });

  describe('special cases', () => {
    it('should handle mixed content efficiently', async () => {
      const counter = new TokenCounter('gemini-pro', mockLogger as unknown as Logger);
      const mixedText = 'Hello 世界! Check https://example.com\nPrice: $123.45 👍';
      const result = await counter.countTokens(mixedText);
      expect(result.totalTokens).toBe(25); // Approximate
      expect(result.promptTokens).toBe(25);
      expect(result.completionTokens).toBe(0);
    });

    it('should handle repeated special tokens', async () => {
      const counter = new TokenCounter('gemini-pro', mockLogger as unknown as Logger);
      const text = 'http://example.com\nhttp://example.com\n';
      const result = await counter.countTokens(text);
      expect(result.totalTokens).toBe(8); // URL tokens + newlines
    });
  });
}); 