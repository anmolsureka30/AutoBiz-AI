import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FileSystemStorage } from '../FileSystemStorage';
import { CacheConfig, CacheEntry } from '../../types';
import { promises as fs } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';
import { BatchOperation, BatchResult, BatchCapableStorage } from './BatchOperations';

// Mock fs promises and crypto
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    rm: jest.fn(),
    access: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));

jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mockhash'),
  })),
}));

describe('FileSystemStorage', () => {
  let storage: FileSystemStorage;
  const mockFs = fs as jest.Mocked<typeof fs>;

  const defaultConfig: Required<CacheConfig> = {
    enabled: true,
    ttl: 3600,
    maxSize: 1000,
    storage: 'filesystem',
    path: './test-cache',
    prefix: 'test',
    compression: false,
  };

  const mockEntry: CacheEntry = {
    vector: [0.1, 0.2, 0.3],
    timestamp: Date.now(),
    metadata: { source: 'test' },
  };

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue('{}');
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue(['00', '01']);
    mockFs.stat.mockResolvedValue({
      isDirectory: () => true,
      size: 1000,
      mtime: new Date(),
    } as any);

    storage = new FileSystemStorage(defaultConfig);
    await storage.initialize();
  });

  describe('initialization', () => {
    it('should create cache directory on initialization', async () => {
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('vector-cache'),
        expect.any(Object)
      );
    });

    it('should handle initialization errors', async () => {
      mockFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(storage.initialize()).rejects.toThrow('Permission denied');
    });
  });

  describe('basic operations', () => {
    it('should store and retrieve entries', async () => {
      const key = 'test-key';
      const filePath = expect.stringContaining('mockhash.cache');

      await storage.set(key, mockEntry);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockEntry));
      
      const retrieved = await storage.get(key);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        filePath,
        expect.any(String),
        'utf-8'
      );
      expect(retrieved).toEqual(mockEntry);
    });

    it('should handle missing entries', async () => {
      mockFs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
      const retrieved = await storage.get('nonexistent');
      expect(retrieved).toBeNull();
    });

    it('should delete entries', async () => {
      await storage.delete('test-key');
      expect(mockFs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('mockhash.cache')
      );
    });
  });

  describe('compression', () => {
    beforeEach(() => {
      storage = new FileSystemStorage({ ...defaultConfig, compression: true });
    });

    it('should compress data before storing', async () => {
      const key = 'test-key';
      await storage.set(key, mockEntry);

      const writeCall = mockFs.writeFile.mock.calls[0];
      expect(writeCall[1]).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 format
    });

    it('should decompress data when retrieving', async () => {
      const key = 'test-key';
      await storage.set(key, mockEntry);
      
      const compressed = mockFs.writeFile.mock.calls[0][1];
      mockFs.readFile.mockResolvedValueOnce(compressed);

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

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(oldEntry));
      const retrieved = await storage.get(key);

      expect(retrieved).toBeNull();
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should cleanup expired entries on initialization', async () => {
      mockFs.readdir.mockResolvedValueOnce(['old-file.cache']);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify({
        ...mockEntry,
        timestamp: 0,
      }));

      await storage.initialize();
      expect(mockFs.unlink).toHaveBeenCalled();
    });
  });

  describe('size management', () => {
    it('should enforce max size limit', async () => {
      // Mock a full cache
      mockFs.readdir.mockResolvedValueOnce(
        Array(defaultConfig.maxSize + 1).fill('file.cache')
      );
      
      await storage.set('new-key', mockEntry);

      // Should have attempted to remove oldest files
      expect(mockFs.unlink).toHaveBeenCalled();
    });

    it('should calculate disk usage correctly', async () => {
      mockFs.readdir.mockResolvedValueOnce(['file1.cache', 'file2.cache']);
      mockFs.stat.mockResolvedValueOnce({ size: 1000 } as any);
      mockFs.stat.mockResolvedValueOnce({ size: 2000 } as any);

      const stats = await storage.stats();
      expect(stats.bytesUsed).toBe(3000);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write failed'));
      
      // Should not throw
      await storage.set('test-key', mockEntry);
    });

    it('should handle corrupted cache files', async () => {
      mockFs.readFile.mockResolvedValueOnce('invalid json');
      
      const retrieved = await storage.get('test-key');
      expect(retrieved).toBeNull();
    });
  });

  describe('performance', () => {
    it('should handle large number of files efficiently', async () => {
      const files = Array(1000).fill('file.cache');
      mockFs.readdir.mockResolvedValueOnce(files);

      const startTime = performance.now();
      await storage.size();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle concurrent operations', async () => {
      const operations = Array(10).fill(null).map((_, i) => 
        storage.set(`key${i}`, mockEntry)
      );

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  describe('batch operations', () => {
    it('should execute batch operations successfully', async () => {
      const operations: BatchOperation[] = [
        { type: 'set', key: 'key1', entry: mockEntry },
        { type: 'set', key: 'key2', entry: mockEntry },
        { type: 'delete', key: 'key3' },
      ];

      const result = await storage.executeBatch(operations);

      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);
      expect(mockFs.unlink).toHaveBeenCalledTimes(1);
    });

    it('should handle batch operation failures gracefully', async () => {
      mockFs.writeFile.mockRejectedValueOnce(new Error('Write failed'));

      const operations: BatchOperation[] = [
        { type: 'set', key: 'key1', entry: mockEntry },
        { type: 'set', key: 'key2', entry: mockEntry },
      ];

      const result = await storage.executeBatch(operations);

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
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

    it('should process operations in parallel for better performance', async () => {
      const operations = Array(100).fill(null).map((_, i) => ({
        type: 'set' as const,
        key: `key${i}`,
        entry: mockEntry,
      }));

      const startTime = performance.now();
      await storage.executeBatch(operations);
      const duration = performance.now() - startTime;

      // Should be significantly faster than sequential processing
      expect(duration).toBeLessThan(100);
    });
  });
}); 