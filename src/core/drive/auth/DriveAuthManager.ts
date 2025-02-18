import { OAuth2Client, Credentials } from 'google-auth-library';
import { DriveConfig, DriveToken, DriveError } from '../types';
import { Logger } from '../../../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export class DriveAuthManager {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;
  private currentToken: DriveToken | null = null;

  constructor(
    private readonly config: DriveConfig,
    private readonly logger: Logger
  ) {
    this.oauth2Client = new OAuth2Client(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.tokenPath = config.tokenPath || path.join(process.cwd(), '.drive-token');
  }

  async initialize(): Promise<void> {
    try {
      await this.loadToken();
    } catch (error) {
      this.logger.warn({
        message: 'Failed to load saved token, new authentication required',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async getAuthUrl(): Promise<string> {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.config.scopes,
      prompt: 'consent'
    });
  }

  async handleAuthCode(code: string): Promise<DriveToken> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      const driveToken = this.transformToken(tokens);
      await this.saveToken(driveToken);
      this.currentToken = driveToken;
      return driveToken;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAccessToken(): Promise<string> {
    if (!this.currentToken) {
      throw new Error('Not authenticated');
    }

    if (this.isTokenExpired()) {
      await this.refreshToken();
    }

    return this.currentToken.accessToken;
  }

  private async loadToken(): Promise<void> {
    try {
      const data = await fs.readFile(this.tokenPath, 'utf-8');
      this.currentToken = JSON.parse(data);
      this.oauth2Client.setCredentials({
        access_token: this.currentToken.accessToken,
        refresh_token: this.currentToken.refreshToken,
        expiry_date: this.currentToken.expiresAt
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async saveToken(token: DriveToken): Promise<void> {
    try {
      await fs.writeFile(this.tokenPath, JSON.stringify(token, null, 2));
    } catch (error) {
      this.logger.error({
        message: 'Failed to save token',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async refreshToken(): Promise<void> {
    if (!this.currentToken?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const { credentials } = await this.oauth2Client.refreshToken(
        this.currentToken.refreshToken
      );
      
      const newToken = this.transformToken(credentials);
      await this.saveToken(newToken);
      this.currentToken = newToken;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private transformToken(credentials: Credentials): DriveToken {
    if (!credentials.access_token || !credentials.refresh_token) {
      throw new Error('Invalid token response');
    }

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token,
      expiresAt: credentials.expiry_date || Date.now() + 3600 * 1000,
      tokenType: credentials.token_type || 'Bearer',
      scope: Array.isArray(credentials.scope) 
        ? credentials.scope.join(' ')
        : credentials.scope || ''
    };
  }

  private isTokenExpired(): boolean {
    if (!this.currentToken) return true;
    // Add 5 minute buffer
    return Date.now() >= (this.currentToken.expiresAt - 5 * 60 * 1000);
  }

  private handleError(error: unknown): DriveError {
    const driveError = new Error(
      error instanceof Error ? error.message : String(error)
    ) as DriveError;
    
    driveError.code = 'AUTH_ERROR';
    if (error instanceof Error) {
      driveError.details = error;
    }

    this.logger.error({
      message: 'Authentication error',
      error: driveError
    });

    return driveError;
  }
} 