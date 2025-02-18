import { Logger } from '../../utils/logger/Logger';
import {
  VectorizationConfig,
  VectorizationResult,
  TextChunk,
  VectorizationError,
  TextPreprocessor,
} from './types';
import { TextChunker } from './TextChunker';
import { ModelLoader } from './ModelLoader';
import { VectorCache } from './VectorCache';
import { performance } from 'perf_hooks';

export class VectorizationPipeline {
  private readonly logger: Logger;
  private readonly config: Required<VectorizationConfig>;
  private readonly chunker: TextChunker;
  private readonly model: ModelLoader;
  private readonly cache?: VectorCache;
  private readonly preprocessors: TextPreprocessor[];

  constructor(config: VectorizationConfig) {
    this.logger = new Logger('VectorizationPipeline');
    this.config = this.normalizeConfig(config);
    this.chunker = new TextChunker(this.config);
    this.model = new ModelLoader(this.config.model);
    this.preprocessors = this.config.preprocessors || [];

    if (this.config.cache?.enabled) {
      this.cache = new VectorCache(this.config.cache);
    }
  }

  async vectorize(text: string): Promise<VectorizationResult> {
    const startTime = performance.now();
    try {
      // Preprocess text
      const processedText = await this.preprocess(text);

      // Split into chunks
      const chunks = await this.chunker.chunk(processedText);

      // Try to get vectors from cache
      let vectors: number[][] = [];
      if (this.cache) {
        vectors = await this.getFromCache(chunks);
      }

      // Vectorize remaining chunks
      const remainingChunks = chunks.filter((_, i) => !vectors[i]);
      if (remainingChunks.length > 0) {
        const newVectors = await this.vectorizeChunks(remainingChunks);
        vectors = this.mergeVectors(vectors, newVectors, chunks);

        // Update cache
        if (this.cache) {
          await this.updateCache(remainingChunks, newVectors);
        }
      }

      // Normalize if required
      if (this.config.normalize) {
        vectors = this.normalizeVectors(vectors);
      }

      // Calculate metadata
      const metadata = {
        model: this.config.model,
        dimensions: this.config.dimensions,
        totalChunks: chunks.length,
        averageChunkSize: this.calculateAverageChunkSize(chunks),
        processingTime: performance.now() - startTime,
        tokenCount: this.calculateTotalTokens(chunks),
        originalTextLength: text.length,
      };

      return { vectors, metadata, chunks };
    } catch (error) {
      this.logger.error('Vectorization failed', { error });
      throw this.wrapError(error);
    }
  }

  private async preprocess(text: string): Promise<string> {
    let processedText = text;
    for (const preprocessor of this.preprocessors) {
      try {
        processedText = await preprocessor.process(processedText);
      } catch (error) {
        this.logger.warn(`Preprocessor ${preprocessor.name} failed`, { error });
      }
    }
    return processedText;
  }

  private async vectorizeChunks(chunks: TextChunk[]): Promise<number[][]> {
    const batchSize = this.config.batchSize;
    const vectors: number[][] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchVectors = await this.model.encode(
        batch.map(chunk => chunk.text)
      );
      vectors.push(...batchVectors);

      this.logger.debug('Batch processed', {
        batch: i / batchSize + 1,
        chunks: batch.length,
      });
    }

    return vectors;
  }

  private async getFromCache(chunks: TextChunk[]): Promise<number[][]> {
    if (!this.cache) return new Array(chunks.length);

    const vectors: number[][] = new Array(chunks.length);
    const promises = chunks.map(async (chunk, index) => {
      const cached = await this.cache!.get(chunk.text);
      if (cached) vectors[index] = cached;
    });

    await Promise.all(promises);
    return vectors;
  }

  private async updateCache(
    chunks: TextChunk[],
    vectors: number[][]
  ): Promise<void> {
    if (!this.cache) return;

    const promises = chunks.map((chunk, index) =>
      this.cache!.set(chunk.text, vectors[index])
    );

    await Promise.all(promises);
  }

  private normalizeVectors(vectors: number[][]): number[][] {
    return vectors.map(vector => {
      const magnitude = Math.sqrt(
        vector.reduce((sum, val) => sum + val * val, 0)
      );
      return vector.map(val => val / magnitude);
    });
  }

  private mergeVectors(
    cached: number[][],
    new_: number[][],
    chunks: TextChunk[]
  ): number[][] {
    const merged = new Array(chunks.length);
    let newIndex = 0;

    for (let i = 0; i < chunks.length; i++) {
      merged[i] = cached[i] || new_[newIndex++];
    }

    return merged;
  }

  private calculateAverageChunkSize(chunks: TextChunk[]): number {
    const total = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
    return total / chunks.length;
  }

  private calculateTotalTokens(chunks: TextChunk[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  }

  private normalizeConfig(config: VectorizationConfig): Required<VectorizationConfig> {
    return {
      model: config.model,
      dimensions: config.dimensions,
      batchSize: config.batchSize || 32,
      maxTokens: config.maxTokens,
      overlap: config.overlap || 0,
      normalize: config.normalize ?? true,
      poolingStrategy: config.poolingStrategy || 'mean',
      preprocessors: config.preprocessors || [],
      cache: {
        enabled: config.cache?.enabled ?? false,
        ttl: config.cache?.ttl ?? 3600,
        maxSize: config.cache?.maxSize ?? 10000,
        storage: config.cache?.storage ?? 'memory',
        path: config.cache?.path,
      },
    };
  }

  private wrapError(error: unknown): VectorizationError {
    const wrapped = error as VectorizationError;
    wrapped.code = wrapped.code || 'VECTORIZATION_ERROR';
    return wrapped;
  }
} 