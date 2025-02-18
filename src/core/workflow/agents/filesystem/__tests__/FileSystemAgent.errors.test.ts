import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { FileSystemAgent } from '../FileSystemAgent';
import { FileOperationType, FileError } from '../types';
import * as fs from 'fs-extra';

jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileSystemAgent Error Handling', () => {
  let agent: FileSystemAgent;

  beforeEach(() => {
    agent = new FileSystemAgent({
      basePath: '/test/base/path',
    });
    jest.clearAllMocks();
  });

  it('should handle permission errors', async () => {
    const operation = {
      type: FileOperationType.Read,
      path: 'test.txt',
    };

    const mockError = new Error('EACCES: permission denied');
    (mockError as any).code = 'EACCES';
    mockFs.pathExists.mockRejectedValue(mockError);

    try {
      await agent.execute(operation);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(FileError);
      expect(error.code).toBe('EACCES');
    }
  });

  it('should handle disk full errors', async () => {
    const operation = {
      type: FileOperationType.Write,
      path: 'test.txt',
      content: 'test',
    };

    const mockError = new Error('ENOSPC: no space left on device');
    (mockError as any).code = 'ENOSPC';
    mockFs.writeFile.mockRejectedValue(mockError);

    try {
      await agent.execute(operation);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(FileError);
      expect(error.code).toBe('ENOSPC');
    }
  });

  it('should handle file not found errors', async () => {
    const operation = {
      type: FileOperationType.Read,
      path: 'missing.txt',
    };

    const mockError = new Error('ENOENT: no such file or directory');
    (mockError as any).code = 'ENOENT';
    mockFs.pathExists.mockRejectedValue(mockError);

    try {
      await agent.execute(operation);
      fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(FileError);
      expect(error.code).toBe('ENOENT');
    }
  });
}); 