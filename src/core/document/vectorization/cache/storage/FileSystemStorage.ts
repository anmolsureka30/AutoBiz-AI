import { CacheStorage, CacheStats, CacheEntry, CacheConfig } from '../types';
import { Logger } from '../../../../utils/logger/Logger';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { gzip, ungzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createHash } from 'crypto';
import { BatchOperation, BatchResult, BatchCapableStorage } from './BatchOperations';

const gzipAsync = promisify(gzip);
const ungzipAsync = promisify(ungzip);

export class FileSystemStorage implements CacheStorage, BatchCapableStorage {
  private readonly logger: Logger;
  private readonly config: Required<CacheConfig>;
  private readonly basePath: string;
  private readonly statsPath: string;
  private stats: CacheStats;

  constructor(config: Required<CacheConfig>) {
    this.logger = new Logger('FileSystemStorage');
    this.config = config;
    this.basePath = join(config.path, 'vector-cache');
    this.statsPath = join(this.basePath, 'stats.json');
    this.stats = this.initializeStats();
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await this.loadStats();
      await this.cleanup();
    } catch (error) {
      this.logger.error('Failed to initialize file system storage', { error });
      throw error;
    }
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath, 'utf-8');
      const entry = await this.deserialize(data);

      if (!entry) return null;

      // Check TTL
      if (this.config.ttl) {
        const age = Date.now() - entry.timestamp;
        if (age > this.config.ttl * 1000) {
          await this.delete(key);
          this.stats.misses++;
          await this.saveStats();
          return null;
        }
      }

      this.stats.hits++;
      await this.saveStats();
      return entry;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Failed to read cache entry', { error, key });
      }
      this.stats.misses++;
      await this.saveStats();
      return null;
    }
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.mkdir(dirname(filePath), { recursive: true });
      const data = await this.serialize(entry);
      await fs.writeFile(filePath, data, 'utf-8');
      await this.enforceMaxSize();
    } catch (error) {
      this.logger.error('Failed to write cache entry', { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error('Failed to delete cache entry', { error, key });
      }
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
      await fs.mkdir(this.basePath, { recursive: true });
      this.stats = this.initializeStats();
      await this.saveStats();
    } catch (error) {
      this.logger.error('Failed to clear cache', { error });
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async size(): Promise<number> {
    try {
      const files = await this.listCacheFiles();
      return files.length;
    } catch (error) {
      this.logger.error('Failed to get cache size', { error });
      return 0;
    }
  }

  async keys(): Promise<string[]> {
    try {
      const files = await this.listCacheFiles();
      return files.map(file => this.fileToKey(file));
    } catch (error) {
      this.logger.error('Failed to list cache keys', { error });
      return [];
    }
  }

  async stats(): Promise<CacheStats> {
    try {
      const size = await this.size();
      const bytesUsed = await this.calculateDiskUsage();
      return {
        ...this.stats,
        size,
        bytesUsed,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      return this.stats;
    }
  }

  async executeBatch(operations: BatchOperation[]): Promise<BatchResult> {
    const result: BatchResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Group operations by subdirectory to minimize directory creation
    const groupedOps = this.groupOperationsBySubdir(operations);
    
    // Process each group in parallel
    await Promise.all(
      Object.entries(groupedOps).map(async ([subdir, ops]) => {
        try {
          // Ensure subdirectory exists
          const dirPath = join(this.basePath, subdir);
          await fs.mkdir(dirPath, { recursive: true });

          // Process operations in this group
          const results = await Promise.allSettled(
            ops.map(op => this.executeSingleOperation(op))
          );

          // Collect results
          results.forEach((res, index) => {
            if (res.status === 'fulfilled') {
              result.successful++;
            } else {
              result.failed++;
              result.errors.push({
                operation: ops[index],
                error: res.reason,
              });
            }
          });
        } catch (error) {
          // If directory creation fails, all operations in this group fail
          result.failed += ops.length;
          ops.forEach(op => {
            result.errors.push({
              operation: op,
              error: error as Error,
            });
          });
        }
      })
    );

    // Update stats after batch completion
    await this.saveStats();
    return result;
  }

  optimizeBatch(operations: BatchOperation[]): BatchOperation[] {
    // Remove redundant operations
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
      // For multiple deletes, keep only one
    }

    return Array.from(keyOps.values());
  }

  private async executeSingleOperation(op: BatchOperation): Promise<void> {
    switch (op.type) {
      case 'set':
        if (!op.entry) throw new Error('Missing entry for set operation');
        await this.set(op.key, op.entry);
        break;
      case 'delete':
        await this.delete(op.key);
        break;
      default:
        throw new Error(`Unknown operation type: ${(op as any).type}`);
    }
  }

  private groupOperationsBySubdir(operations: BatchOperation[]): Record<string, BatchOperation[]> {
    const groups: Record<string, BatchOperation[]> = {};
    
    for (const op of operations) {
      const hash = createHash('sha256').update(op.key).digest('hex');
      const subdir = hash.substring(0, 2);
      
      if (!groups[subdir]) {
        groups[subdir] = [];
      }
      groups[subdir].push(op);
    }

    return groups;
  }

  private getFilePath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex');
    const subDir = hash.substring(0, 2);
    return join(this.basePath, subDir, `${hash}.cache`);
  }

  private fileToKey(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace('.cache', '');
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
      this.logger.error('Failed to deserialize cache entry', { error });
      return null;
    }
  }

  private async listCacheFiles(): Promise<string[]> {
    const subDirs = await fs.readdir(this.basePath);
    const filePromises = subDirs.map(async (dir) => {
      try {
        const dirPath = join(this.basePath, dir);
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) return [];

        const files = await fs.readdir(dirPath);
        return files
          .filter(file => file.endsWith('.cache'))
          .map(file => join(dir, file));
      } catch {
        return [];
      }
    });

    const fileArrays = await Promise.all(filePromises);
    return fileArrays.flat();
  }

  private async calculateDiskUsage(): Promise<number> {
    try {
      const files = await this.listCacheFiles();
      const sizePromises = files.map(async (file) => {
        try {
          const stat = await fs.stat(join(this.basePath, file));
          return stat.size;
        } catch {
          return 0;
        }
      });

      const sizes = await Promise.all(sizePromises);
      return sizes.reduce((total, size) => total + size, 0);
    } catch (error) {
      this.logger.error('Failed to calculate disk usage', { error });
      return 0;
    }
  }

  private async enforceMaxSize(): Promise<void> {
    if (!this.config.maxSize) return;

    try {
      const files = await this.listCacheFiles();
      if (files.length <= this.config.maxSize) return;

      const entriesToRemove = files.length - this.config.maxSize;
      const oldestFiles = await this.getOldestFiles(entriesToRemove);

      for (const file of oldestFiles) {
        await fs.unlink(join(this.basePath, file));
        this.stats.evictions++;
      }

      this.stats.lastEvictionTime = new Date();
      await this.saveStats();
    } catch (error) {
      this.logger.error('Failed to enforce max size', { error });
    }
  }

  private async getOldestFiles(count: number): Promise<string[]> {
    try {
      const files = await this.listCacheFiles();
      const fileStats = await Promise.all(
        files.map(async (file) => {
          try {
            const stat = await fs.stat(join(this.basePath, file));
            return { file, mtime: stat.mtime };
          } catch {
            return { file, mtime: new Date(0) };
          }
        })
      );

      return fileStats
        .sort((a, b) => a.mtime.getTime() - b.mtime.getTime())
        .slice(0, count)
        .map(stat => stat.file);
    } catch (error) {
      this.logger.error('Failed to get oldest files', { error });
      return [];
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

  private async loadStats(): Promise<void> {
    try {
      const data = await fs.readFile(this.statsPath, 'utf-8');
      this.stats = JSON.parse(data);
    } catch {
      this.stats = this.initializeStats();
      await this.saveStats();
    }
  }

  private async saveStats(): Promise<void> {
    try {
      await fs.writeFile(this.statsPath, JSON.stringify(this.stats), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to save cache stats', { error });
    }
  }

  private async cleanup(): Promise<void> {
    if (!this.config.ttl) return;

    try {
      const files = await this.listCacheFiles();
      const now = Date.now();

      for (const file of files) {
        try {
          const filePath = join(this.basePath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const entry = await this.deserialize(data);

          if (entry && now - entry.timestamp > this.config.ttl * 1000) {
            await fs.unlink(filePath);
            this.stats.evictions++;
          }
        } catch {
          // Skip files that can't be read or parsed
          continue;
        }
      }

      if (this.stats.evictions > 0) {
        this.stats.lastEvictionTime = new Date();
        await this.saveStats();
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired entries', { error });
    }
  }

  private async ensureDirectory(filePath: string): Promise<void> {
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }
} 