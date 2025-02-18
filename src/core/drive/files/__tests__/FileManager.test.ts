import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { FileManager } from '../FileManager';
import { DriveAuthManager } from '../../auth/DriveAuthManager';
import { Logger } from '../../../../utils/logger';
import { Readable } from 'stream';
import axios from 'axios';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';

jest.mock('axios');
jest.mock('fs/promises');
jest.mock('stream/promises');
jest.mock('../../auth/DriveAuthManager');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FileManager', () => {
  let fileManager: FileManager;
  let mockAuthManager: jest.Mocked<DriveAuthManager>;
  let mockLogger: {
    info: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    mockAuthManager = {
      getAccessToken: jest.fn().mockResolvedValue('test-token'),
    } as unknown as jest.Mocked<DriveAuthManager>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    // Mock axios create
    mockedAxios.create.mockReturnValue(mockedAxios as any);

    fileManager = new FileManager(
      mockAuthManager,
      mockLogger as unknown as Logger,
      { chunkSize: 5 * 1024 * 1024 }
    );
  });

  describe('uploadFile', () => {
    it('should handle simple upload for small files', async () => {
      const content = Buffer.from('test content');
      const mockResponse = {
        data: {
          id: 'test-file-id',
          name: 'test.txt',
          mimeType: 'text/plain',
          size: '12',
          createdTime: '2024-01-01T00:00:00.000Z',
          modifiedTime: '2024-01-01T00:00:00.000Z',
          version: '1',
          parents: ['parent-folder-id']
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await fileManager.uploadFile(content, {
        mimeType: 'text/plain',
        parents: ['parent-folder-id']
      });

      expect(result.id).toBe('test-file-id');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/files',
        expect.any(FormData),
        expect.objectContaining({
          params: { uploadType: 'multipart' }
        })
      );
    });

    it('should handle resumable upload for large files', async () => {
      const content = Readable.from(Buffer.alloc(10 * 1024 * 1024)); // 10MB
      const initResponse = {
        headers: {
          location: 'https://upload-url'
        }
      };

      const finalResponse = {
        data: {
          id: 'test-file-id',
          name: 'large-file.dat',
          size: '10485760'
        }
      };

      mockedAxios.post.mockResolvedValueOnce(initResponse);
      mockedAxios.put.mockResolvedValueOnce({
        status: 200,
        ...finalResponse
      });

      const onProgress = jest.fn();
      const result = await fileManager.uploadFile(content, {
        onProgress
      });

      expect(result.id).toBe('test-file-id');
      expect(onProgress).toHaveBeenCalled();
      expect(mockedAxios.put).toHaveBeenCalledWith(
        'https://upload-url',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Range': expect.stringContaining('bytes')
          })
        })
      );
    });

    it('should handle upload errors', async () => {
      const content = Buffer.from('test');
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 403,
          data: { error: 'Insufficient permissions' }
        }
      });

      await expect(fileManager.uploadFile(content)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'File operation failed'
        })
      );
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const mockFile = {
        data: {
          id: 'test-file-id',
          name: 'test.txt',
          size: '1000'
        }
      };

      const mockStream = new Readable();
      mockStream.push('test content');
      mockStream.push(null);

      mockedAxios.get
        .mockResolvedValueOnce(mockFile) // getFile call
        .mockResolvedValueOnce({ data: mockStream }); // download call

      (pipeline as jest.Mock).mockResolvedValueOnce(undefined);

      const onProgress = jest.fn();
      await fileManager.downloadFile('test-file-id', 'test.txt', {
        onProgress
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/files/test-file-id?alt=media',
        expect.any(Object)
      );
      expect(pipeline).toHaveBeenCalled();
    });

    it('should handle download errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { error: 'File not found' }
        }
      });

      await expect(
        fileManager.downloadFile('invalid-id', 'test.txt')
      ).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'File operation failed'
        })
      );
    });

    it('should support range requests', async () => {
      const mockFile = {
        data: {
          id: 'test-file-id',
          size: '1000'
        }
      };

      mockedAxios.get
        .mockResolvedValueOnce(mockFile)
        .mockResolvedValueOnce({
          data: Readable.from(Buffer.alloc(100))
        });

      await fileManager.downloadFile('test-file-id', 'test.txt', {
        range: { start: 0, end: 99 }
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Range: 'bytes=0-99'
          }
        })
      );
    });
  });

  describe('getFile', () => {
    it('should retrieve file metadata', async () => {
      const mockResponse = {
        data: {
          id: 'test-file-id',
          name: 'test.txt',
          mimeType: 'text/plain',
          size: '100',
          createdTime: '2024-01-01T00:00:00.000Z',
          modifiedTime: '2024-01-01T00:00:00.000Z',
          version: '1',
          capabilities: {
            canEdit: true,
            canShare: true
          }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const file = await fileManager.getFile('test-file-id');

      expect(file.id).toBe('test-file-id');
      expect(file.capabilities.canEdit).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/files/test-file-id',
        expect.objectContaining({
          params: { fields: '*' }
        })
      );
    });

    it('should handle missing capabilities', async () => {
      const mockResponse = {
        data: {
          id: 'test-file-id',
          name: 'test.txt'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const file = await fileManager.getFile('test-file-id');

      expect(file.capabilities.canEdit).toBe(false);
      expect(file.capabilities.canShare).toBe(false);
      expect(file.capabilities.canDelete).toBe(false);
    });
  });
}); 