import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ChangeTracker } from '../ChangeTracker';
import { DriveAuthManager } from '../../auth/DriveAuthManager';
import { Logger } from '../../../../utils/logger';
import axios from 'axios';

jest.mock('axios');
jest.mock('../../auth/DriveAuthManager');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChangeTracker', () => {
  let changeTracker: ChangeTracker;
  let mockAuthManager: jest.Mocked<DriveAuthManager>;
  let mockLogger: {
    info: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();

    mockAuthManager = {
      getAccessToken: jest.fn().mockResolvedValue('test-token')
    } as unknown as jest.Mocked<DriveAuthManager>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    };

    mockedAxios.create.mockReturnValue(mockedAxios as any);

    changeTracker = new ChangeTracker(
      mockAuthManager,
      mockLogger as unknown as Logger,
      {
        pollInterval: 1000,
        maxRetries: 3,
        retryDelay: 100
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    changeTracker.stop();
  });

  describe('initialization', () => {
    it('should get start page token on start', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { startPageToken: 'test-token-1' }
      });

      await changeTracker.start();

      expect(mockedAxios.get).toHaveBeenCalledWith('/changes/startPageToken');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Change tracker initialized',
          startPageToken: 'test-token-1'
        })
      );
    });

    it('should handle initialization errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Init failed'));

      await expect(changeTracker.start()).rejects.toThrow('Init failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to start change tracker'
        })
      );
    });
  });

  describe('change polling', () => {
    it('should poll for changes periodically', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { startPageToken: 'token-1' } })
        .mockResolvedValueOnce({
          data: {
            changes: [
              {
                type: 'file',
                changeType: 'modified',
                time: '2024-01-01T00:00:00Z',
                fileId: 'file-1',
                file: {
                  id: 'file-1',
                  name: 'test.txt',
                  version: '2'
                }
              }
            ],
            newStartPageToken: 'token-2'
          }
        });

      const changeHandler = jest.fn();
      changeTracker.on('changes', changeHandler);

      await changeTracker.start();
      jest.advanceTimersByTime(1000);

      expect(changeHandler).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'modified',
          fileId: 'file-1'
        })
      ]);
    });

    it('should handle polling errors and retry', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { startPageToken: 'token-1' } })
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({
          data: {
            changes: [],
            newStartPageToken: 'token-2'
          }
        });

      await changeTracker.start();
      jest.advanceTimersByTime(1000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error polling changes'
        })
      );
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('change processing', () => {
    it('should filter and transform changes correctly', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { startPageToken: 'token-1' } })
        .mockResolvedValueOnce({
          data: {
            changes: [
              {
                type: 'file',
                changeType: 'created',
                time: '2024-01-01T00:00:00Z',
                fileId: 'file-1',
                file: {
                  id: 'file-1',
                  name: 'new.txt',
                  version: '1'
                }
              },
              {
                type: 'drive',
                changeType: 'modified',
                time: '2024-01-01T00:00:00Z',
                driveId: 'drive-1'
              }
            ],
            newStartPageToken: 'token-2'
          }
        });

      const changeHandler = jest.fn();
      changeTracker.on('changes', changeHandler);

      await changeTracker.start();
      jest.advanceTimersByTime(1000);

      expect(changeHandler).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'created',
          fileId: 'file-1',
          details: expect.objectContaining({
            newVersion: '1'
          })
        })
      ]);
    });
  });
}); 