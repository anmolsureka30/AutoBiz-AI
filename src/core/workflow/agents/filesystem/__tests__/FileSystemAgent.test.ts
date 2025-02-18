import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FileSystemAgent } from '../FileSystemAgent';
import { 
  FileOperation, 
  FileOperationType, 
  FileSystemAgentConfig,
  FileError 
} from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileSystemAgent', () => {
  let agent: FileSystemAgent;
  const testBasePath = '/test/base/path';
  
  beforeEach(() => {
    agent = new FileSystemAgent({
      basePath: testBasePath,
    });
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const defaultAgent = new FileSystemAgent();
      expect(defaultAgent).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const customConfig: FileSystemAgentConfig = {
        basePath: '/custom/path',
        timeout: 5000,
      };
      const customAgent = new FileSystemAgent(customConfig);
      expect(customAgent).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate valid operation config', async () => {
      const step = {
        id: 'test-step',
        config: {
          operation: {
            type: FileOperationType.Read,
            path: 'test.txt',
          },
        },
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.access.mockResolvedValue(undefined);

      const result = await agent.validate(step);
      expect(result).toBe(true);
    });

    it('should fail validation for missing operation', async () => {
      const step = {
        id: 'test-step',
        config: {},
      };

      const result = await agent.validate(step);
      expect(result).toBe(false);
    });

    it('should fail validation for invalid operation type', async () => {
      const step = {
        id: 'test-step',
        config: {
          operation: {
            type: 'invalid' as FileOperationType,
            path: 'test.txt',
          },
        },
      };

      const result = await agent.validate(step);
      expect(result).toBe(false);
    });

    it('should fail validation for path outside base directory', async () => {
      const step = {
        id: 'test-step',
        config: {
          operation: {
            type: FileOperationType.Read,
            path: '../outside.txt',
          },
        },
      };

      const result = await agent.validate(step);
      expect(result).toBe(false);
    });
  });

  describe('file operations', () => {
    describe('read operation', () => {
      it('should read file successfully', async () => {
        const operation = {
          type: FileOperationType.Read,
          path: 'test.txt',
        };

        const mockStats = {
          size: 100,
          birthtime: new Date(),
          mtime: new Date(),
          atime: new Date(),
          mode: 0o644,
        };

        mockFs.pathExists.mockResolvedValue(true);
        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.readFile.mockResolvedValue('test content');

        const result = await agent.execute(operation);

        expect(result.data).toBe('test content');
        expect(result.stats).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
      });

      it('should handle missing file', async () => {
        const operation = {
          type: FileOperationType.Read,
          path: 'missing.txt',
        };

        mockFs.pathExists.mockResolvedValue(false);

        await expect(agent.execute(operation)).rejects.toThrow(FileError);
      });
    });

    describe('write operation', () => {
      it('should write file successfully', async () => {
        const operation = {
          type: FileOperationType.Write,
          path: 'test.txt',
          content: 'test content',
        };

        const mockStats = {
          size: 100,
          birthtime: new Date(),
          mtime: new Date(),
          atime: new Date(),
          mode: 0o644,
        };

        mockFs.pathExists.mockResolvedValue(false);
        mockFs.stat.mockResolvedValue(mockStats as any);
        mockFs.writeFile.mockResolvedValue(undefined);

        const result = await agent.execute(operation);

        expect(result.stats).toBeDefined();
        expect(result.duration).toBeGreaterThan(0);
        expect(mockFs.writeFile).toHaveBeenCalled();
      });

      it('should create directories when needed', async () => {
        const operation = {
          type: FileOperationType.Write,
          path: 'nested/dir/test.txt',
          content: 'test content',
          options: {
            createDirectories: true,
          },
        };

        mockFs.pathExists.mockResolvedValue(false);
        mockFs.ensureDir.mockResolvedValue(undefined);

        await agent.execute(operation);

        expect(mockFs.ensureDir).toHaveBeenCalled();
      });
    });
  });
}); 