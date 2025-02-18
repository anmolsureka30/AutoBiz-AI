import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DriveAuthManager } from '../DriveAuthManager';
import { Logger } from '../../../../utils/logger';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';

jest.mock('google-auth-library');
jest.mock('fs/promises');

describe('DriveAuthManager', () => {
  let authManager: DriveAuthManager;
  let mockLogger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  const testConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/oauth/callback',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    tokenPath: '/test/path/.drive-token'
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    authManager = new DriveAuthManager(
      testConfig,
      mockLogger as unknown as Logger
    );
  });

  describe('initialization', () => {
    it('should load saved token on initialize', async () => {
      const mockToken = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600 * 1000,
        tokenType: 'Bearer',
        scope: 'https://www.googleapis.com/auth/drive.file'
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockToken)
      );

      await authManager.initialize();
      expect(fs.readFile).toHaveBeenCalledWith(
        testConfig.tokenPath,
        'utf-8'
      );
    });

    it('should handle missing token file', async () => {
      (fs.readFile as jest.Mock).mockRejectedValueOnce({
        code: 'ENOENT'
      });

      await authManager.initialize();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to load saved token, new authentication required'
        })
      );
    });
  });

  describe('authentication', () => {
    it('should generate auth url', async () => {
      const mockUrl = 'https://accounts.google.com/oauth2/auth?...';
      (OAuth2Client.prototype.generateAuthUrl as jest.Mock).mockReturnValueOnce(mockUrl);

      const url = await authManager.getAuthUrl();
      expect(url).toBe(mockUrl);
      expect(OAuth2Client.prototype.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: testConfig.scopes,
        prompt: 'consent'
      });
    });

    it('should handle auth code and save token', async () => {
      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expiry_date: Date.now() + 3600 * 1000,
        token_type: 'Bearer',
        scope: testConfig.scopes[0]
      };

      (OAuth2Client.prototype.getToken as jest.Mock).mockResolvedValueOnce({
        tokens: mockTokens
      });

      const token = await authManager.handleAuthCode('test-code');
      
      expect(token.accessToken).toBe(mockTokens.access_token);
      expect(token.refreshToken).toBe(mockTokens.refresh_token);
      expect(fs.writeFile).toHaveBeenCalledWith(
        testConfig.tokenPath,
        expect.any(String)
      );
    });
  });

  describe('token management', () => {
    it('should refresh expired token', async () => {
      const expiredToken = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
        scope: testConfig.scopes[0]
      };

      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600 * 1000
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(expiredToken)
      );

      (OAuth2Client.prototype.refreshToken as jest.Mock).mockResolvedValueOnce({
        credentials: newTokens
      });

      await authManager.initialize();
      const accessToken = await authManager.getAccessToken();

      expect(accessToken).toBe(newTokens.access_token);
      expect(OAuth2Client.prototype.refreshToken).toHaveBeenCalledWith(
        expiredToken.refreshToken
      );
    });

    it('should handle refresh token errors', async () => {
      const expiredToken = {
        accessToken: 'old-access-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: Date.now() - 1000,
        tokenType: 'Bearer',
        scope: testConfig.scopes[0]
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(expiredToken)
      );

      (OAuth2Client.prototype.refreshToken as jest.Mock).mockRejectedValueOnce(
        new Error('Invalid refresh token')
      );

      await authManager.initialize();
      await expect(authManager.getAccessToken()).rejects.toThrow('Invalid refresh token');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication error'
        })
      );
    });
  });
}); 