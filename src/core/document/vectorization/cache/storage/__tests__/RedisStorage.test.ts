import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RedisStorage } from '../RedisStorage';
import { CacheConfig, CacheEntry } from '../../types';
import { Redis } from 'ioredis';
import { BatchOperation } from '../BatchOperations';

// Mock ioredis
jest.mock('ioredis');

describe('RedisStorage', () => {
  let storage: RedisStorage;
  let mockRedis: jest.Mocked<Redis>;

  const defaultConfig: Required<CacheConfig> = {
    enabled: true,
    ttl: 3600,
    maxSize: 1000,
    storage: 'redis',
    path: './cache',
    prefix: 'test',
    compression: false,
  };

  const mockEntry: CacheEntry = {
    vector: [0.1, 0.2, 0.3],
    timestamp: Date.now(),
    metadata: { source: 'test' },
  };

  beforeEach(() => {
    mockRedis = {
      pipeline: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      get: jest.fn(),
      del: jest.fn().mockReturnThis(),
      exists: jest.fn(),
      keys: jest.fn(),
      info: jest.fn(),
      memory: jest.fn(),
      exec: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
      quit: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);
    storage = new RedisStorage(defaultConfig);
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('basic operations', () => {
    it('should store and retrieve entries', async () => {
      const key = 'test-key';
      const serialized = JSON.stringify(mockEntry);

      mockRedis.get.mockResolvedValue(serialized);
      mockRedis.set.mockResolvedValue('OK');

      await storage.set(key, mockEntry);
      const retrieved = await storage.get(key);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `${defaultConfig.prefix}:${key}`,
        serialized,
        'EX',
        defaultConfig.ttl
      );
      expect(retrieved).toEqual(mockEntry);
    });

    it('should handle missing entries', async () => {
      mockRedis.get.mockResolvedValue(null);
      const retrieved = await storage.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should delete entries', async () => {
      mockRedis.del.mockResolvedValue(1);
      await storage.delete('test-key');
      expect(mockRedis.del).toHaveBeenCalledWith(`${defaultConfig.prefix}:test-key`);
    });
  });

  describe('utility operations', () => {
    it('should check if key exists', async () => {
      mockRedis.exists.mockResolvedValueOnce(1);
      const exists = await storage.has('test-key');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      const exists = await storage.has('nonexistent');
      expect(exists).toBe(false);
    });

    it('should list all keys', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'test:key1',
        'test:key2',
        'test:key3',
      ]);

      const keys = await storage.keys();
      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return cache size', async () => {
      mockRedis.keys.mockResolvedValueOnce([
        'test:key1',
        'test:key2',
      ]);

      const size = await storage.size();
      expect(size).toBe(2);
    });
  });

  describe('compression', () => {
    beforeEach(() => {
      storage = new RedisStorage({ ...defaultConfig, compression: true });
    });

    it('should compress data before storing', async () => {
      const key = 'test-key';
      await storage.set(key, mockEntry);

      const setCall = mockRedis.set.mock.calls[0];
      expect(setCall[1]).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 format
    });

    it('should decompress data when retrieving', async () => {
      const key = 'test-key';
      await storage.set(key, mockEntry);
      
      const compressed = mockRedis.set.mock.calls[0][1];
      mockRedis.get.mockResolvedValueOnce(compressed);

      const retrieved = await storage.get(key);
      expect(retrieved).toEqual(mockEntry);
    });
  });

  describe('TTL handling', () => {
    it('should expire old entries', async () => {
      const key = 'test-key';
      const oldEntry: CacheEntry = {
        ...mockEntry,
        timestamp: Date.now() - (defaultConfig.ttl * 1000 + 1000),
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(oldEntry));
      const retrieved = await storage.get(key);

      expect(retrieved).toBeNull();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    beforeEach(() => {
      mockRedis.info.mockImplementation((section) => {
        if (section === 'stats') {
          return 'keyspace_hits:100\nkeyspace_misses:20\nevicted_keys:5';
        }
        return '';
      });
      mockRedis.keys.mockResolvedValue(['test:key1', 'test:key2']);
      mockRedis.pipeline.mockReturnValue({
        memory: jest.fn(),
        exec: jest.fn().mockResolvedValue([[null, 1000], [null, 2000]]),
      });
    });

    it('should return cache statistics', async () => {
      const stats = await storage.stats();

      expect(stats).toEqual({
        hits: 100,
        misses: 20,
        size: 2,
        bytesUsed: 3000,
        evictions: 5,
      });
    });

    it('should handle stats collection errors', async () => {
      mockRedis.info.mockRejectedValueOnce(new Error('Redis error'));
      
      const stats = await storage.stats();
      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        size: 0,
        bytesUsed: 0,
        evictions: 0,
      });
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors', () => {
      const errorCallback = mockRedis.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      expect(errorCallback).toBeDefined();
      errorCallback(new Error('Connection failed'));
      // Verify error is logged but doesn't crash
    });

    it('should handle Redis operation failures gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      const result = await storage.get('test-key');
      expect(result).toBeNull();
    });
  });

  describe('batch operations', () => {
    it('should execute batch operations successfully', async () => {
      const operations: BatchOperation[] = [
        { type: 'set', key: 'key1', entry: mockEntry },
        { type: 'set', key: 'key2', entry: mockEntry },
        { type: 'delete', key: 'key3' },
      ];

      mockRedis.exec.mockResolvedValueOnce([
        [null, 'OK'],
        [null, 'OK'],
        [null, 1],
      ]);

      const result = await storage.executeBatch(operations);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
    });

    it('should handle batch operation failures', async () => {
      const operations: BatchOperation[] = [
        { type: 'set', key: 'key1', entry: mockEntry },
        { type: 'set', key: 'key2', entry: mockEntry },
      ];

      mockRedis.exec.mockResolvedValueOnce([
        [new Error('Write failed'), null],
        [null, 'OK'],
      ]);

      const result = await storage.executeBatch(operations);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error.message).toBe('Write failed');
    });

    it('should optimize batch operations', async () => {
      const operations: BatchOperation[] = [
        { type: 'set', key: 'key1', entry: mockEntry },
        { type: 'delete', key: 'key1' },
        { type: 'set', key: 'key2', entry: mockEntry },
        { type: 'set', key: 'key2', entry: { ...mockEntry, timestamp: Date.now() + 1000 } },
      ];

      const optimized = storage.optimizeBatch(operations);

      expect(optimized).toHaveLength(2);
      expect(optimized[0].type).toBe('delete');
      expect(optimized[1].type).toBe('set');
    });

    it('should handle pipeline execution errors', async () => {
      const operations: BatchOperation[] = [
        { type: 'set', key: 'key1', entry: mockEntry },
      ];

      mockRedis.exec.mockRejectedValueOnce(new Error('Pipeline failed'));

      const result = await storage.executeBatch(operations);

      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors[0].error.message).toBe('Pipeline failed');
    });
  });
}); 