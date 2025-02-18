import { Readable } from 'stream';

export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  tokenPath?: string;
  chunkSize?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface DriveToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  scope: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: Date;
  modifiedTime: Date;
  version: string;
  md5Checksum?: string;
  parents: string[];
  shared: boolean;
  capabilities: {
    canEdit: boolean;
    canShare: boolean;
    canDelete: boolean;
  };
  metadata: Record<string, string>;
}

export interface UploadOptions {
  parents?: string[];
  mimeType?: string;
  metadata?: Record<string, string>;
  chunkSize?: number;
  onProgress?: (progress: number) => void;
}

export interface DownloadOptions {
  revision?: string;
  range?: {
    start: number;
    end: number;
  };
  onProgress?: (progress: number) => void;
}

export interface FileChange {
  type: 'created' | 'modified' | 'deleted';
  fileId: string;
  time: Date;
  details: {
    oldVersion?: string;
    newVersion?: string;
    modifiedBy?: string;
  };
}

export interface ChangeTracker {
  startPageToken: string;
  changes: FileChange[];
  newStartPageToken: string;
}

export interface DriveError extends Error {
  code: string;
  status?: number;
  details?: unknown;
}

export type FileContent = Buffer | Readable | string;

export interface BatchOperation<T> {
  id: string;
  operation: () => Promise<T>;
  retryCount: number;
}

export interface DriveMetadata {
  customProperties: Record<string, string>;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  appProperties?: Record<string, string>;
  contentHints?: {
    indexableText?: string;
    thumbnail?: {
      image: string;
      mimeType: string;
    };
  };
} 