import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TokenizerService } from '../TokenizerService';
import { encode } from 'gpt-tokenizer';

// Mock gpt-tokenizer
jest.mock('gpt-tokenizer');

describe('TokenizerService', () => {
  let tokenizer: TokenizerService;

  beforeEach(() => {
    tokenizer = new TokenizerService('gpt-3.5-turbo');
    (encode as jest.Mock).mockImplementation((text: string) => {
      // Simple mock implementation
      return text.split(/\s+/).map((_, i) => i);
    });
  });

  describe('countTokens', () => {
    it('should count tokens correctly', async () => {
      const text = 'This is a test sentence';
      const count = await tokenizer.countTokens(text);
      expect(count).toBe(5); // 5 words
    });

    it('should handle empty text', async () => {
      const count = await tokenizer.countTokens('');
      expect(count).toBe(0);
    });

    it('should handle tokenizer failures', async () => {
      (encode as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Tokenizer error');
      });

      const text = 'Test text';
      const count = await tokenizer.countTokens(text);
      // Should fall back to length-based estimation
      expect(count).toBe(Math.ceil(text.length / 4));
    });
  });

  describe('encode', () => {
    it('should encode text to token ids', async () => {
      const text = 'Test sentence';
      const tokens = await tokenizer.encode(text);
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBe(2); // 2 words
    });

    it('should throw error on encoding failure', async () => {
      (encode as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Encoding error');
      });

      await expect(tokenizer.encode('Test')).rejects.toThrow('Encoding error');
    });
  });

  describe('decode', () => {
    it('should throw not implemented error', async () => {
      await expect(tokenizer.decode([1, 2, 3]))
        .rejects.toThrow('Not implemented');
    });
  });

  describe('performance', () => {
    it('should handle large texts efficiently', async () => {
      const longText = Array(1000).fill('word').join(' ');
      
      const startTime = performance.now();
      await tokenizer.countTokens(longText);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should process within 100ms
    });

    it('should maintain stable memory usage', async () => {
      const longText = Array(10000).fill('word').join(' ');

      const initialMemory = process.memoryUsage().heapUsed;
      await tokenizer.countTokens(longText);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      expect(memoryIncrease).toBeLessThan(10); // Less than 10MB increase
    });
  });
}); 