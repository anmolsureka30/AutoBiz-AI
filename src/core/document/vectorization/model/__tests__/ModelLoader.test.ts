import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ModelLoader } from '../ModelLoader';
import { EmbeddingModel, ModelConfig } from '../types';

describe('ModelLoader', () => {
  let loader: ModelLoader;
  const mockModel: jest.Mocked<EmbeddingModel> = {
    name: 'test-model',
    dimensions: 384,
    maxTokens: 512,
    encode: jest.fn(),
    tokenize: jest.fn(),
    getTokenCount: jest.fn(),
  };

  const defaultConfig: ModelConfig = {
    name: 'test-model',
    device: 'cpu',
    batchSize: 32,
    cacheSize: 1000,
  };

  beforeEach(() => {
    loader = new ModelLoader(defaultConfig);
    // Mock the private loadModel method
    (loader as any).loadModel = jest.fn().mockResolvedValue(mockModel);
  });

  describe('initialization', () => {
    it('should load model successfully', async () => {
      await loader.initialize();
      expect((loader as any).model).toBe(mockModel);
    });

    it('should handle initialization errors', async () => {
      (loader as any).loadModel = jest.fn().mockRejectedValue(new Error('Load failed'));
      await expect(loader.initialize()).rejects.toThrow('Load failed');
    });
  });

  describe('encoding', () => {
    beforeEach(async () => {
      await loader.initialize();
    });

    it('should encode text in batches', async () => {
      const texts = Array(100).fill('test text');
      const mockVector = Array(384).fill(0.1);
      mockModel.encode.mockResolvedValue([mockVector]);
      mockModel.getTokenCount.mockResolvedValue(2);

      const vectors = await loader.encode(texts);
      expect(vectors).toHaveLength(100);
      expect(mockModel.encode).toHaveBeenCalledTimes(4); // 100/32 = 4 batches
    });

    it('should use cache when available', async () => {
      const text = 'test text';
      const mockVector = Array(384).fill(0.1);
      mockModel.encode.mockResolvedValue([mockVector]);

      // First call should use model
      await loader.encode([text]);
      // Second call should use cache
      await loader.encode([text]);

      expect(mockModel.encode).toHaveBeenCalledTimes(1);
    });

    it('should handle encoding errors', async () => {
      mockModel.encode.mockRejectedValue(new Error('Encoding failed'));
      await expect(loader.encode(['test'])).rejects.toThrow('Encoding failed');

      const metrics = loader.getMetrics();
      expect(metrics.errors).toBe(1);
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      await loader.initialize();
    });

    it('should track encoding metrics', async () => {
      const texts = Array(50).fill('test text');
      mockModel.encode.mockResolvedValue([Array(384).fill(0.1)]);
      mockModel.getTokenCount.mockResolvedValue(2);

      await loader.encode(texts);
      const metrics = loader.getMetrics();

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalTokens).toBe(100); // 50 texts * 2 tokens
      expect(metrics.batchesProcessed).toBe(2); // 50/32 = 2 batches
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await loader.initialize();
    });

    it('should handle large batches efficiently', async () => {
      const texts = Array(1000).fill('test text');
      mockModel.encode.mockResolvedValue([Array(384).fill(0.1)]);
      mockModel.getTokenCount.mockResolvedValue(2);

      const startTime = performance.now();
      await loader.encode(texts);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should process within 1 second
    });

    it('should maintain stable memory usage', async () => {
      const texts = Array(500).fill('test text');
      mockModel.encode.mockResolvedValue([Array(384).fill(0.1)]);
      mockModel.getTokenCount.mockResolvedValue(2);

      const initialMemory = process.memoryUsage().heapUsed;
      await loader.encode(texts);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });
}); 