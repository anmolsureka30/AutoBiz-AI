import { CacheStorage, CacheStats, CacheEntry, CacheConfig } from '../types';
import { LRUCache } from 'lru-cache';

export class MemoryStorage implements CacheStorage {
  private cache: LRUCache<string, CacheEntry>;
  private bytesUsed: number = 0;

  constructor(config: Required<CacheConfig>) {
    this.cache = new LRUCache({
      max: config.maxSize,
      ttl: config.ttl * 1000,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      sizeCalculation: (entry) => {
        // Estimate size in bytes:
        // - vector: float32 array (4 bytes per number)
        // - timestamp: 8 bytes
        // - metadata: rough estimate
        return entry.vector.length * 4 + 8 + 
          (entry.metadata ? JSON.stringify(entry.metadata).length * 2 : 0);
      },
      dispose: (value, key) => {
        this.bytesUsed -= this.calculateSize(value);
      },
    });
  }

  async get(key: string): Promise<CacheEntry | null> {
    return this.cache.get(key) || null;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    const size = this.calculateSize(entry);
    this.bytesUsed += size;
    this.cache.set(key, entry);
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.bytesUsed = 0;
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async stats(): Promise<CacheStats> {
    return {
      hits: this.cache.hits,
      misses: this.cache.misses,
      size: this.cache.size,
      bytesUsed: this.bytesUsed,
      evictions: this.cache.evictedCount,
      lastEvictionTime: this.cache.evictedTimeStamp 
        ? new Date(this.cache.evictedTimeStamp)
        : undefined,
    };
  }

  private calculateSize(entry: CacheEntry): number {
    return entry.vector.length * 4 + 8 + 
      (entry.metadata ? JSON.stringify(entry.metadata).length * 2 : 0);
  }
} 