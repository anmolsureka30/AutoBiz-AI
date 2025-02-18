import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { 
  ChangeListOptions, 
  ChangeList, 
  DriveChange,
  ChangeTrackerConfig,
  ChangeTrackerState 
} from './types';
import { DriveAuthManager } from '../auth/DriveAuthManager';
import { Logger } from '../../../utils/logger';
import { FileChange } from '../types';

export class ChangeTracker extends EventEmitter {
  private readonly client: AxiosInstance;
  private readonly pollInterval: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly batchSize: number;

  private startPageToken?: string;
  private pollTimeout?: NodeJS.Timeout;
  private isPolling: boolean = false;

  constructor(
    private readonly authManager: DriveAuthManager,
    private readonly logger: Logger,
    config: ChangeTrackerConfig = {}
  ) {
    super();
    
    this.pollInterval = config.pollInterval || 60000; // 1 minute
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.batchSize = config.batchSize || 100;

    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/drive/v3',
      timeout: 10000
    });

    this.setupRequestInterceptor();
  }

  async start(): Promise<void> {
    if (this.isPolling) {
      this.logger.warn('Change tracker is already running');
      return;
    }

    try {
      await this.initialize();
      this.startPolling();
    } catch (error) {
      this.logger.error({
        message: 'Failed to start change tracker',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  stop(): void {
    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = undefined;
    }
    this.isPolling = false;
  }

  async getStartPageToken(): Promise<string> {
    try {
      const response = await this.client.get('/changes/startPageToken');
      return response.data.startPageToken;
    } catch (error) {
      this.logger.error({
        message: 'Failed to get start page token',
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    this.startPageToken = await this.getStartPageToken();
    this.logger.info({
      message: 'Change tracker initialized',
      startPageToken: this.startPageToken
    });
  }

  private startPolling(): void {
    this.isPolling = true;
    this.pollChanges();
  }

  private async pollChanges(): Promise<void> {
    if (!this.isPolling || !this.startPageToken) return;

    try {
      const changes = await this.listChanges(this.startPageToken);
      
      if (changes.changes.length > 0) {
        const fileChanges = this.processChanges(changes.changes);
        this.emit('changes', fileChanges);
      }

      if (changes.newStartPageToken) {
        this.startPageToken = changes.newStartPageToken;
      }

      this.logger.debug({
        message: 'Change polling completed',
        changesFound: changes.changes.length,
        newStartPageToken: changes.newStartPageToken
      });
    } catch (error) {
      this.logger.error({
        message: 'Error polling changes',
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      // Schedule next poll
      this.pollTimeout = setTimeout(
        () => this.pollChanges(),
        this.pollInterval
      );
    }
  }

  private async listChanges(
    pageToken: string,
    options: ChangeListOptions = {}
  ): Promise<ChangeList> {
    const params = {
      pageToken,
      pageSize: this.batchSize,
      includeRemoved: true,
      ...options
    };

    try {
      const response = await this.client.get('/changes', { params });
      return response.data;
    } catch (error) {
      if (this.shouldRetry(error)) {
        return this.retryListChanges(pageToken, options);
      }
      throw error;
    }
  }

  private async retryListChanges(
    pageToken: string,
    options: ChangeListOptions,
    retryCount = 0
  ): Promise<ChangeList> {
    if (retryCount >= this.maxRetries) {
      throw new Error('Max retry attempts exceeded');
    }

    await new Promise(resolve => 
      setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount))
    );

    try {
      return await this.listChanges(pageToken, options);
    } catch (error) {
      if (this.shouldRetry(error)) {
        return this.retryListChanges(pageToken, options, retryCount + 1);
      }
      throw error;
    }
  }

  private processChanges(changes: DriveChange[]): FileChange[] {
    return changes
      .filter(change => change.type === 'file' && change.file)
      .map(change => ({
        type: change.changeType,
        fileId: change.fileId,
        time: new Date(change.time),
        details: {
          oldVersion: undefined, // Could be tracked if needed
          newVersion: change.file?.version,
          modifiedBy: undefined // Could be added if needed
        }
      }));
  }

  private shouldRetry(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      // Retry on rate limits, server errors, or network issues
      return status === 429 || status >= 500 || !status;
    }
    return false;
  }

  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(async (config) => {
      const token = await this.authManager.getAccessToken();
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    });
  }
} 