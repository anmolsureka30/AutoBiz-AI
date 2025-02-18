import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TextChunker } from '../TextChunker';
import { TokenizerService } from '../TokenizerService';
import { VectorizationConfig } from '../types';

// Mock TokenizerService
jest.mock('../TokenizerService');

describe('TextChunker', () => {
  let chunker: TextChunker;
  let mockTokenizer: jest.Mocked<TokenizerService>;

  const defaultConfig: Required<VectorizationConfig> = {
    model: 'test-model',
    dimensions: 384,
    batchSize: 32,
    maxTokens: 100,
    overlap: 0,
    normalize: true,
    poolingStrategy: 'mean',
    preprocessors: [],
    cache: {
      enabled: false,
      ttl: 3600,
      maxSize: 10000,
      storage: 'memory',
    },
  };

  beforeEach(() => {
    mockTokenizer = new TokenizerService('test-model') as jest.Mocked<TokenizerService>;
    mockTokenizer.countTokens = jest.fn().mockImplementation(async (text: string) => {
      // Simple mock: 1 token per word
      return text.split(/\s+/).length;
    });

    chunker = new TextChunker(defaultConfig);
    (chunker as any).tokenizer = mockTokenizer;
  });

  describe('basic chunking', () => {
    it('should split text into sentences', async () => {
      const text = 'This is sentence one. This is sentence two! And this is three?';
      const chunks = await chunker.chunk(text);

      expect(chunks).toHaveLength(3);
      expect(chunks[0].text).toContain('sentence one');
      expect(chunks[1].text).toContain('sentence two');
      expect(chunks[2].text).toContain('three');
    });

    it('should handle empty text', async () => {
      const chunks = await chunker.chunk('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle text without sentence endings', async () => {
      const text = 'This is a single chunk of text without proper sentence endings';
      const chunks = await chunker.chunk(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
    });
  });

  describe('token limits', () => {
    it('should respect maxTokens limit', async () => {
      const text = Array(200).fill('word').join(' ') + '.';
      const chunks = await chunker.chunk(text);

      for (const chunk of chunks) {
        expect(chunk.tokens).toBeLessThanOrEqual(defaultConfig.maxTokens);
      }
    });

    it('should split long sentences', async () => {
      mockTokenizer.countTokens.mockImplementation(async (text: string) => text.length);
      const longSentence = 'x'.repeat(defaultConfig.maxTokens * 2) + '.';
      
      const chunks = await chunker.chunk(longSentence);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle single words exceeding maxTokens', async () => {
      mockTokenizer.countTokens.mockImplementation(async (text: string) => text.length);
      const longWord = 'x'.repeat(defaultConfig.maxTokens * 2);
      
      const chunks = await chunker.chunk(longWord);
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('overlap handling', () => {
    beforeEach(() => {
      chunker = new TextChunker({
        ...defaultConfig,
        overlap: 20, // 20% overlap
      });
      (chunker as any).tokenizer = mockTokenizer;
    });

    it('should add overlap between chunks', async () => {
      const text = 'Chunk one. Chunk two. Chunk three.';
      const chunks = await chunker.chunk(text);

      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];
        
        // Check if current chunk contains some text from previous chunk
        expect(currentChunk.text).toContain(
          prevChunk.text.split(/\s+/).slice(-1)[0]
        );
      }
    });

    it('should maintain correct indices with overlap', async () => {
      const text = 'First chunk text. Second chunk text. Third chunk text.';
      const chunks = await chunker.chunk(text);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        expect(text.substring(chunk.startIndex, chunk.endIndex))
          .toContain(chunk.text.trim());
      }
    });
  });

  describe('error handling', () => {
    it('should handle tokenizer failures gracefully', async () => {
      mockTokenizer.countTokens.mockRejectedValueOnce(new Error('Tokenizer error'));
      
      const text = 'Test sentence.';
      await expect(chunker.chunk(text)).rejects.toThrow('Tokenizer error');
    });
  });

  describe('performance', () => {
    it('should handle large texts efficiently', async () => {
      const sentences = Array(1000).fill('This is a test sentence.');
      const text = sentences.join(' ');

      const startTime = performance.now();
      const chunks = await chunker.chunk(text);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should process within 1 second
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should maintain stable memory usage', async () => {
      const sentences = Array(5000).fill('This is a test sentence.');
      const text = sentences.join(' ');

      const initialMemory = process.memoryUsage().heapUsed;
      await chunker.chunk(text);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });
}); 