import { Stats } from 'fs-extra';

export enum FileOperationType {
  Read = 'read',
  Write = 'write',
  Delete = 'delete',
  List = 'list',
  Copy = 'copy',
  Move = 'move'
}

export interface BaseFileOperation {
  type: FileOperationType;
  path: string;
  options?: {
    createDirectories?: boolean;
    mode?: number;
  };
}

export interface ReadOperation extends BaseFileOperation {
  type: FileOperationType.Read;
  encoding?: BufferEncoding;
}

export interface WriteOperation extends BaseFileOperation {
  type: FileOperationType.Write;
  content: string | Buffer;
  encoding?: BufferEncoding;
  append?: boolean;
}

export interface DeleteOperation extends BaseFileOperation {
  type: FileOperationType.Delete;
  recursive?: boolean;
  force?: boolean;
}

export interface ListOperation extends BaseFileOperation {
  type: FileOperationType.List;
  pattern?: string;
  recursive?: boolean;
}

export interface CopyOperation extends BaseFileOperation {
  type: FileOperationType.Copy;
  destination: string;
  overwrite?: boolean;
}

export interface MoveOperation extends BaseFileOperation {
  type: FileOperationType.Move;
  destination: string;
}

export type FileOperation = 
  | ReadOperation 
  | WriteOperation 
  | DeleteOperation 
  | ListOperation 
  | CopyOperation 
  | MoveOperation;

export interface FileResult {
  data?: string | Buffer;
  stats?: {
    size: number;
    created: Date;
    modified: Date;
    accessed: Date;
    mode: number;
  };
  files?: string[];
  duration: number;
}

export interface FileError extends Error {
  code: string;
  path: string;
  type: FileOperationType;
  syscall?: string;
  errno?: number;
}

export interface FileSystemAgentConfig {
  basePath?: string;
  operation?: FileOperation;
  timeout?: number;
  maxRetries?: number;
} 