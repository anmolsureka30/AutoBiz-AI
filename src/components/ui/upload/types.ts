export interface FileUploadConfig {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
  maxFiles?: number;
  chunkSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  fileName: string;
  fileSize: number;
  error?: string;
}

export interface FileUploadState {
  files: Map<string, UploadProgress>;
  totalProgress: number;
  isUploading: boolean;
}

export interface FileValidationError {
  file: File;
  error: 'size' | 'type' | 'count';
  message: string;
} 