import { CacheStorage, CacheStats, CacheEntry, CacheConfig } from '../types';
import { BatchOperation, BatchResult, BatchCapableStorage } from './BatchOperations';
import { Redis } from 'ioredis';
import { Logger } from '../../../../utils/logger/Logger';
import { gzip, ungzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const ungzipAsync = promisify(ungzip);

export class RedisStorage implements CacheStorage, BatchCapableStorage {
  private readonly redis: Redis;
  private readonly logger: Logger;
  private readonly config: Required<CacheConfig>;
  private readonly prefix: string;

  constructor(config: Required<CacheConfig>) {
    this.logger = new Logger('RedisStorage');
    this.config = config;
    this.prefix = config.prefix;

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableAutoPipelining: true, // Enable automatic pipelining for better performance
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', { error });
    });
  }

  async executeBatch(operations: BatchOperation[]): Promise<BatchResult> {
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Use Redis pipeline for better performance
      const pipeline = this.redis.pipeline();

      // Add operations to pipeline
      operations.forEach(op => {
        switch (op.type) {
          case 'set':
            if (!op.entry) {
              result.failed++;
              result.errors.push({
                operation: op,
                error: new Error('Missing entry for set operation'),
              });
              return;
            }
            this.addSetOperation(pipeline, op.key, op.entry);
            break;
          case 'delete':
            pipeline.del(this.getKey(op.key));
            break;
        }
      });

      // Execute pipeline
      const responses = await pipeline.exec();

      // Process results
      if (responses) {
        responses.forEach((res, index) => {
          const [error] = res;
          if (error) {
            result.failed++;
            result.errors.push({
              operation: operations[index],
              error: error as Error,
            });
          } else {
            result.successful++;
          }
        });
      }
    } catch (error) {
      this.logger.error('Batch operation failed', { error });
      result.failed = operations.length;
      operations.forEach(op => {
        result.errors.push({
          operation: op,
          error: error as Error,
        });
      });
    }

    return result;
  }

  optimizeBatch(operations: BatchOperation[]): BatchOperation[] {
    const keyOps = new Map<string, BatchOperation>();
    
    for (const op of operations) {
      const existing = keyOps.get(op.key);
      if (!existing) {
        keyOps.set(op.key, op);
        continue;
      }

      // If we have a delete after a set, keep only the delete
      if (existing.type === 'set' && op.type === 'delete') {
        keyOps.set(op.key, op);
      }
      // If we have a set after a delete, keep only the latest set
      else if (existing.type === 'delete' && op.type === 'set') {
        keyOps.set(op.key, op);
      }
      // For multiple sets, keep only the latest
      else if (existing.type === 'set' && op.type === 'set') {
        keyOps.set(op.key, op);
      }
    }

    return Array.from(keyOps.values());
  }

  private addSetOperation(pipeline: Redis.Pipeline, key: string, entry: CacheEntry): void {
    const redisKey = this.getKey(key);
    if (this.config.ttl) {
      pipeline.set(redisKey, JSON.stringify(entry), 'EX', this.config.ttl);
    } else {
      pipeline.set(redisKey, JSON.stringify(entry));
    }
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const data = await this.redis.get(this.getKey(key));
      if (!data) return null;

      const entry = await this.deserialize(data);
      if (!entry) return null;

      // Check TTL
      if (this.config.ttl) {
        const age = Date.now() - entry.timestamp;
        if (age > this.config.ttl * 1000) {
          await this.delete(key);
          return null;
        }
      }

      return entry;
    } catch (error) {
      this.logger.error('Redis get failed', { error, key });
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      const data = await this.serialize(entry);
      const redisKey = this.getKey(key);

      if (this.config.ttl) {
        await this.redis.set(redisKey, data, 'EX', this.config.ttl);
      } else {
        await this.redis.set(redisKey, data);
      }
    } catch (error) {
      this.logger.error('Redis set failed', { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.getKey(key));
    } catch (error) {
      this.logger.error('Redis delete failed', { error, key });
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.error('Redis clear failed', { error });
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return await this.redis.exists(this.getKey(key)) === 1;
    } catch (error) {
      this.logger.error('Redis exists check failed', { error, key });
      return false;
    }
  }

  async size(): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      return keys.length;
    } catch (error) {
      this.logger.error('Redis size check failed', { error });
      return 0;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const keys = await this.redis.keys(`${this.prefix}:*`);
      return keys.map(k => k.replace(`${this.prefix}:`, ''));
    } catch (error) {
      this.logger.error('Redis keys fetch failed', { error });
      return [];
    }
  }

  async stats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('stats');
      const keyspace = await this.redis.info('keyspace');
      
      const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || '0');
      const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || '0');
      const size = await this.size();

      // Estimate memory usage
      const pipeline = this.redis.pipeline();
      const keys = await this.keys();
      keys.forEach(key => pipeline.memory('usage', this.getKey(key)));
      const memorySizes = await pipeline.exec();
      const bytesUsed = memorySizes?.reduce((sum, [err, size]) => 
        err ? sum : sum + (size as number), 0) || 0;

      return {
        hits,
        misses,
        size,
        bytesUsed,
        evictions: parseInt(info.match(/evicted_keys:(\d+)/)?.[1] || '0'),
        lastEvictionTime: undefined, // Redis doesn't provide this information
      };
    } catch (error) {
      this.logger.error('Redis stats fetch failed', { error });
      return {
        hits: 0,
        misses: 0,
        size: 0,
        bytesUsed: 0,
        evictions: 0,
      };
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  private async serialize(entry: CacheEntry): Promise<string> {
    const data = JSON.stringify(entry);
    if (this.config.compression) {
      const compressed = await gzipAsync(Buffer.from(data));
      return compressed.toString('base64');
    }
    return data;
  }

  private async deserialize(data: string): Promise<CacheEntry | null> {
    try {
      if (this.config.compression) {
        const compressed = Buffer.from(data, 'base64');
        const decompressed = await ungzipAsync(compressed);
        return JSON.parse(decompressed.toString());
      }
      return JSON.parse(data);
    } catch (error) {
      this.logger.error('Deserialization failed', { error });
      return null;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
} 