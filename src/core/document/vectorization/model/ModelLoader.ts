import { Logger } from '../../../utils/logger/Logger';
import { EmbeddingModel, ModelConfig, ModelMetrics } from './types';
import { performance } from 'perf_hooks';
import { LRUCache } from 'lru-cache';

export class ModelLoader {
  private readonly logger: Logger;
  private readonly config: Required<ModelConfig>;
  private model: EmbeddingModel | null = null;
  private cache: LRUCache<string, number[]> | null = null;
  private metrics: ModelMetrics = this.initializeMetrics();

  constructor(config: ModelConfig) {
    this.logger = new Logger('ModelLoader');
    this.config = this.normalizeConfig(config);

    if (this.config.cacheSize > 0) {
      this.cache = new LRUCache({
        max: this.config.cacheSize,
        maxSize: 100 * 1024 * 1024, // 100MB max cache size
        sizeCalculation: (value) => {
          // Estimate size in bytes: float32 array
          return value.length * 4;
        },
      });
    }
  }

  async initialize(): Promise<void> {
    try {
      this.model = await this.loadModel();
      this.logger.info('Model loaded successfully', {
        name: this.config.name,
        dimensions: this.model.dimensions,
        device: this.config.device,
      });
    } catch (error) {
      this.logger.error('Failed to load model', { error });
      throw error;
    }
  }

  async encode(texts: string[]): Promise<number[][]> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const startTime = performance.now();
    try {
      const batchSize = this.config.batchSize;
      const results: number[][] = [];

      // Process in batches
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchVectors = await this.processBatch(batch);
        results.push(...batchVectors);
      }

      // Update metrics
      this.updateMetrics({
        requests: 1,
        tokens: await this.countTotalTokens(texts),
        latency: performance.now() - startTime,
        batches: Math.ceil(texts.length / batchSize),
      });

      return results;
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = error as Error;
      this.logger.error('Encoding failed', { error, texts: texts.length });
      throw error;
    }
  }

  getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  private async processBatch(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // Check cache first
    if (this.cache) {
      texts.forEach((text, index) => {
        const cached = this.cache!.get(text);
        if (cached) {
          vectors[index] = cached;
        } else {
          uncachedTexts.push(text);
          uncachedIndices.push(index);
        }
      });
    } else {
      uncachedTexts.push(...texts);
      uncachedIndices.push(...texts.map((_, i) => i));
    }

    // Process uncached texts
    if (uncachedTexts.length > 0) {
      const newVectors = await this.model!.encode(uncachedTexts);

      // Update cache and results
      uncachedIndices.forEach((originalIndex, vectorIndex) => {
        const vector = newVectors[vectorIndex];
        vectors[originalIndex] = vector;
        if (this.cache) {
          this.cache.set(texts[originalIndex], vector);
        }
      });
    }

    return vectors;
  }

  private async loadModel(): Promise<EmbeddingModel> {
    // This is a placeholder - implement actual model loading based on your needs
    // You might want to use ONNX Runtime, TensorFlow.js, or other libraries
    throw new Error('Model loading not implemented');
  }

  private async countTotalTokens(texts: string[]): Promise<number> {
    if (!this.model) return 0;
    
    const counts = await Promise.all(
      texts.map(text => this.model!.getTokenCount(text))
    );
    return counts.reduce((sum, count) => sum + count, 0);
  }

  private updateMetrics(update: {
    requests: number;
    tokens: number;
    latency: number;
    batches: number;
  }): void {
    this.metrics.totalRequests += update.requests;
    this.metrics.totalTokens += update.tokens;
    this.metrics.batchesProcessed += update.batches;

    // Update average latency using weighted average
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageLatency = (
      (this.metrics.averageLatency * (totalRequests - 1) + update.latency) /
      totalRequests
    );
  }

  private initializeMetrics(): ModelMetrics {
    return {
      totalRequests: 0,
      totalTokens: 0,
      averageLatency: 0,
      batchesProcessed: 0,
      errors: 0,
    };
  }

  private normalizeConfig(config: ModelConfig): Required<ModelConfig> {
    return {
      name: config.name,
      path: config.path ?? '',
      device: config.device ?? 'cpu',
      quantization: config.quantization ?? 'float32',
      cacheSize: config.cacheSize ?? 10000,
      batchSize: config.batchSize ?? 32,
      threads: config.threads ?? navigator.hardwareConcurrency ?? 4,
    };
  }
} 