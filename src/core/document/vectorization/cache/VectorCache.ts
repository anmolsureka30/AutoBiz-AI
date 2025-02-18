import { Logger } from '../../../utils/logger/Logger';
import { CacheConfig, CacheStats, CacheEntry, CacheStorage } from './types';
import { MemoryStorage } from './storage/MemoryStorage';
import { RedisStorage } from './storage/RedisStorage';
import { FileSystemStorage } from './storage/FileSystemStorage';
import { createHash } from 'crypto';

export class VectorCache {
  private readonly logger: Logger;
  private readonly config: Required<CacheConfig>;
  private readonly storage: CacheStorage;
  private stats: CacheStats = this.initializeStats();

  constructor(config: CacheConfig) {
    this.logger = new Logger('VectorCache');
    this.config = this.normalizeConfig(config);
    this.storage = this.initializeStorage();
  }

  async get(text: string): Promise<number[] | null> {
    try {
      const key = this.generateKey(text);
      const entry = await this.storage.get(key);

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      if (this.isExpired(entry)) {
        await this.storage.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry.vector;
    } catch (error) {
      this.logger.error('Cache get failed', { error });
      return null;
    }
  }

  async set(text: string, vector: number[]): Promise<void> {
    try {
      const key = this.generateKey(text);
      const entry: CacheEntry = {
        vector,
        timestamp: Date.now(),
      };

      await this.storage.set(key, entry);
      await this.enforceMaxSize();
    } catch (error) {
      this.logger.error('Cache set failed', { error });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.clear();
      this.stats = this.initializeStats();
      this.logger.info('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear failed', { error });
      throw error;
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const storageStats = await this.storage.stats();
      return {
        ...this.stats,
        ...storageStats,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      return this.stats;
    }
  }

  private initializeStorage(): CacheStorage {
    switch (this.config.storage) {
      case 'redis':
        return new RedisStorage(this.config);
      case 'filesystem':
        return new FileSystemStorage(this.config);
      case 'memory':
      default:
        return new MemoryStorage(this.config);
    }
  }

  private generateKey(text: string): string {
    const hash = createHash('sha256')
      .update(text)
      .digest('hex');
    return `${this.config.prefix}:${hash}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    if (!this.config.ttl) return false;
    const age = Date.now() - entry.timestamp;
    return age > this.config.ttl * 1000;
  }

  private async enforceMaxSize(): Promise<void> {
    if (!this.config.maxSize) return;

    try {
      const currentSize = await this.storage.size();
      if (currentSize <= this.config.maxSize) return;

      const keys = await this.storage.keys();
      const entriesToRemove = currentSize - this.config.maxSize;

      // Sort keys by timestamp and remove oldest entries
      const entries = await Promise.all(
        keys.map(async key => {
          const entry = await this.storage.get(key);
          return { key, entry };
        })
      );

      entries
        .filter(e => e.entry)
        .sort((a, b) => a.entry!.timestamp - b.entry!.timestamp)
        .slice(0, entriesToRemove)
        .forEach(async ({ key }) => {
          await this.storage.delete(key);
          this.stats.evictions++;
        });

      this.stats.lastEvictionTime = new Date();
      this.logger.debug('Cache size enforced', {
        removed: entriesToRemove,
        newSize: await this.storage.size(),
      });
    } catch (error) {
      this.logger.error('Failed to enforce cache size', { error });
    }
  }

  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      size: 0,
      bytesUsed: 0,
      evictions: 0,
    };
  }

  private normalizeConfig(config: CacheConfig): Required<CacheConfig> {
    return {
      enabled: config.enabled,
      ttl: config.ttl ?? 3600,
      maxSize: config.maxSize ?? 10000,
      storage: config.storage ?? 'memory',
      path: config.path ?? './cache',
      prefix: config.prefix ?? 'vector',
      compression: config.compression ?? false,
    };
  }
} 