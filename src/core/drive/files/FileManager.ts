import { Readable } from 'stream';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  DriveFile, 
  FileContent, 
  UploadOptions, 
  DownloadOptions,
  DriveError 
} from '../types';
import { DriveAuthManager } from '../auth/DriveAuthManager';
import { Logger } from '../../../utils/logger';
import { createReadStream, createWriteStream } from 'fs';
import { basename } from 'path';
import { pipeline } from 'stream/promises';
import * as fs from 'fs/promises';
import { Stats } from 'fs';
import { FormData } from 'form-data';

export class FileManager {
  private readonly client: AxiosInstance;
  private readonly uploadChunkSize: number;

  constructor(
    private readonly authManager: DriveAuthManager,
    private readonly logger: Logger,
    private readonly config: { chunkSize?: number }
  ) {
    this.uploadChunkSize = config.chunkSize || 5 * 1024 * 1024; // 5MB default
    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/drive/v3',
      maxBodyLength: Infinity
    });

    this.setupRequestInterceptor();
  }

  async uploadFile(
    content: FileContent,
    options: UploadOptions = {}
  ): Promise<DriveFile> {
    try {
      const fileSize = await this.getContentSize(content);
      
      if (fileSize <= this.uploadChunkSize) {
        return this.simpleUpload(content, options);
      } else {
        return this.resumableUpload(content, fileSize, options);
      }
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async downloadFile(
    fileId: string,
    destination: string,
    options: DownloadOptions = {}
  ): Promise<void> {
    try {
      const file = await this.getFile(fileId);
      const writer = createWriteStream(destination);

      const config: AxiosRequestConfig = {
        responseType: 'stream',
        headers: {}
      };

      if (options.range) {
        config.headers['Range'] = `bytes=${options.range.start}-${options.range.end}`;
      }

      if (options.revision) {
        config.params = { revision: options.revision };
      }

      const response = await this.client.get(
        `/files/${fileId}?alt=media`,
        config
      );

      let downloadedBytes = 0;
      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        options.onProgress?.(downloadedBytes / file.size * 100);
      });

      await pipeline(response.data, writer);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getFile(fileId: string): Promise<DriveFile> {
    try {
      const response = await this.client.get(`/files/${fileId}`, {
        params: {
          fields: '*'
        }
      });

      return this.transformFileResponse(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async simpleUpload(
    content: FileContent,
    options: UploadOptions
  ): Promise<DriveFile> {
    const metadata = this.createFileMetadata(content, options);
    const form = new FormData();
    form.append('metadata', JSON.stringify(metadata), {
      contentType: 'application/json'
    });
    form.append('file', await this.contentToBlob(content));

    const response = await this.client.post('/files', form, {
      params: { uploadType: 'multipart' },
      headers: form.getHeaders()
    });

    return this.transformFileResponse(response.data);
  }

  private async resumableUpload(
    content: FileContent,
    fileSize: number,
    options: UploadOptions
  ): Promise<DriveFile> {
    // Initialize resumable upload
    const metadata = this.createFileMetadata(content, options);
    const initResponse = await this.client.post('/files', metadata, {
      params: { uploadType: 'resumable' },
      headers: {
        'X-Upload-Content-Type': metadata.mimeType,
        'X-Upload-Content-Length': fileSize
      }
    });

    const uploadUrl = initResponse.headers['location'];
    const chunks = this.createUploadChunks(content, fileSize);
    let uploadedBytes = 0;

    for await (const { chunk, start, end } of chunks) {
      const headers = {
        'Content-Length': end - start,
        'Content-Range': `bytes ${start}-${end - 1}/${fileSize}`
      };

      try {
        const response = await this.client.put(uploadUrl, chunk, { headers });
        uploadedBytes = end;
        options.onProgress?.(uploadedBytes / fileSize * 100);

        if (response.status === 200 || response.status === 201) {
          return this.transformFileResponse(response.data);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 308) {
          // Resume from last successful byte
          uploadedBytes = parseInt(
            error.response.headers['range']?.split('-')[1] || '0'
          ) + 1;
        } else {
          throw error;
        }
      }
    }

    throw new Error('Upload failed to complete');
  }

  private async *createUploadChunks(
    content: FileContent,
    fileSize: number
  ): AsyncGenerator<{
    chunk: Buffer;
    start: number;
    end: number;
  }> {
    let start = 0;
    const stream = this.contentToStream(content);

    while (start < fileSize) {
      const end = Math.min(start + this.uploadChunkSize, fileSize);
      const chunk = await this.readChunk(stream, end - start);

      yield {
        chunk,
        start,
        end
      };

      start = end;
    }
  }

  private async readChunk(stream: Readable, size: number): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let bytesRead = 0;

    while (bytesRead < size) {
      const chunk = await new Promise<Buffer | null>((resolve) => {
        stream.once('data', resolve);
        stream.once('end', () => resolve(null));
      });

      if (!chunk) break;

      chunks.push(chunk);
      bytesRead += chunk.length;
    }

    return Buffer.concat(chunks);
  }

  private async getContentSize(content: FileContent): Promise<number> {
    if (Buffer.isBuffer(content)) {
      return content.length;
    } else if (typeof content === 'string') {
      return Buffer.from(content).length;
    } else {
      const stats = await fs.stat(content.path);
      return stats.size;
    }
  }

  private contentToStream(content: FileContent): Readable {
    if (Buffer.isBuffer(content)) {
      return Readable.from(content);
    } else if (typeof content === 'string') {
      return Readable.from(Buffer.from(content));
    } else {
      return content;
    }
  }

  private async contentToBlob(content: FileContent): Promise<Blob> {
    if (Buffer.isBuffer(content)) {
      return new Blob([content]);
    } else if (typeof content === 'string') {
      return new Blob([content]);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of content) {
        chunks.push(chunk);
      }
      return new Blob(chunks);
    }
  }

  private createFileMetadata(
    content: FileContent,
    options: UploadOptions
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      name: typeof content === 'string' ? basename(content) : 'untitled',
      mimeType: options.mimeType || 'application/octet-stream'
    };

    if (options.parents?.length) {
      metadata.parents = options.parents;
    }

    if (options.metadata) {
      metadata.properties = options.metadata;
    }

    return metadata;
  }

  private transformFileResponse(data: any): DriveFile {
    return {
      id: data.id,
      name: data.name,
      mimeType: data.mimeType,
      size: parseInt(data.size) || 0,
      createdTime: new Date(data.createdTime),
      modifiedTime: new Date(data.modifiedTime),
      version: data.version,
      md5Checksum: data.md5Checksum,
      parents: data.parents || [],
      shared: !!data.shared,
      capabilities: {
        canEdit: data.capabilities?.canEdit || false,
        canShare: data.capabilities?.canShare || false,
        canDelete: data.capabilities?.canDelete || false
      },
      metadata: data.properties || {}
    };
  }

  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(async (config) => {
      const token = await this.authManager.getAccessToken();
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    });
  }

  private handleError(error: unknown): DriveError {
    const driveError = new Error(
      error instanceof Error ? error.message : String(error)
    ) as DriveError;

    if (axios.isAxiosError(error)) {
      driveError.code = error.response?.status?.toString() || 'NETWORK_ERROR';
      driveError.status = error.response?.status;
      driveError.details = error.response?.data;
    } else {
      driveError.code = 'UNKNOWN_ERROR';
    }

    this.logger.error({
      message: 'File operation failed',
      error: driveError
    });

    return driveError;
  }
} 