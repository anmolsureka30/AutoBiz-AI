import { BaseAgent } from '../BaseAgent';
import { WorkflowStep } from '../../types';
import {
  FileOperation,
  FileOperationType,
  FileResult,
  FileError,
  FileSystemAgentConfig,
  ReadOperation,
  WriteOperation,
  DeleteOperation,
  ListOperation,
  CopyOperation,
  MoveOperation
} from './types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';

export class FileSystemAgent extends BaseAgent {
  private readonly defaultConfig: Required<FileSystemAgentConfig> = {
    basePath: process.cwd(),
    operation: {
      type: FileOperationType.List,
      path: '.',
    },
    timeout: 30000,
    maxRetries: 3,
  };

  constructor(config: FileSystemAgentConfig = {}) {
    super('FileSystemAgent');
    this.config = {
      ...this.defaultConfig,
      ...config,
    };
  }

  async execute(operation: FileOperation): Promise<FileResult> {
    const startTime = Date.now();

    try {
      let result: Partial<FileResult>;

      switch (operation.type) {
        case FileOperationType.Read:
          result = await this.readFile(operation as ReadOperation);
          break;
        case FileOperationType.Write:
          result = await this.writeFile(operation as WriteOperation);
          break;
        case FileOperationType.Delete:
          result = await this.deleteFile(operation as DeleteOperation);
          break;
        case FileOperationType.List:
          result = await this.listFiles(operation as ListOperation);
          break;
        case FileOperationType.Copy:
          result = await this.copyFile(operation as CopyOperation);
          break;
        case FileOperationType.Move:
          result = await this.moveFile(operation as MoveOperation);
          break;
        default:
          throw new Error(`Unsupported operation type: ${operation.type}`);
      }

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      throw this.handleFileError(error, operation);
    }
  }

  async validate(step: WorkflowStep): Promise<boolean> {
    try {
      const operation = step.config?.operation as FileOperation;
      if (!operation) {
        throw new Error('Operation configuration is required');
      }

      // Validate basic operation structure
      await this.validateOperation(operation);

      // Validate paths and permissions
      await this.validatePaths(operation);

      // Validate operation-specific requirements
      await this.validateOperationRequirements(operation);

      return true;
    } catch (error) {
      this.logger.error('Validation failed', {
        error,
        step: step.id,
        operation: step.config?.operation,
      });
      return false;
    }
  }

  private prepareConfig(step: WorkflowStep): FileSystemAgentConfig {
    const config = { ...this.defaultConfig, ...step.config } as FileSystemAgentConfig;
    if (config.basePath) {
      config.operation.path = path.join(config.basePath, config.operation.path);
      if ('destination' in config.operation) {
        config.operation.destination = path.join(config.basePath, config.operation.destination);
      }
    }
    return config;
  }

  private async executeOperation(operation: FileOperation): Promise<Partial<FileResult>> {
    switch (operation.type) {
      case FileOperationType.Read:
        return this.readFile(operation as ReadOperation);
      case FileOperationType.Write:
        return this.writeFile(operation as WriteOperation);
      case FileOperationType.Delete:
        return this.deleteFile(operation as DeleteOperation);
      case FileOperationType.List:
        const files = await this.listFiles(operation as ListOperation);
        return {
          data: files.map(filePath => ({
            path: filePath,
            stats: fs.statSync(filePath),
          })),
        };
      case FileOperationType.Copy:
        return this.copyFile(operation as CopyOperation);
      case FileOperationType.Move:
        return this.moveFile(operation as MoveOperation);
      default:
        throw new Error(`Unsupported operation type: ${(operation as any).type}`);
    }
  }

  private async readFile(operation: ReadOperation): Promise<Partial<FileResult>> {
    const filePath = path.resolve(this.config.basePath, operation.path);
    
    // Ensure file exists
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${operation.path}`);
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Read file content
    const data = await fs.readFile(filePath, {
      encoding: operation.encoding,
    });

    return {
      data,
      stats: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode,
      },
    };
  }

  private async writeFile(operation: WriteOperation): Promise<Partial<FileResult>> {
    const filePath = path.resolve(this.config.basePath, operation.path);
    
    // Create directories if needed
    if (operation.options?.createDirectories) {
      await fs.ensureDir(path.dirname(filePath));
    }

    // Write file
    if (operation.append) {
      await fs.appendFile(filePath, operation.content, {
        encoding: operation.encoding,
        mode: operation.options?.mode,
      });
    } else {
      await fs.writeFile(filePath, operation.content, {
        encoding: operation.encoding,
        mode: operation.options?.mode,
      });
    }

    // Get updated stats
    const stats = await fs.stat(filePath);
    
    return {
      stats: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode,
      },
    };
  }

  private async deleteFile(operation: DeleteOperation): Promise<Partial<FileResult>> {
    const filePath = path.resolve(this.config.basePath, operation.path);
    
    // Get stats before deletion
    const stats = await fs.stat(filePath);
    
    // Delete file or directory
    if (operation.recursive) {
      await fs.remove(filePath);
    } else {
      await fs.unlink(filePath);
    }

    return {
      stats: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode,
      },
    };
  }

  private async listFiles(operation: ListOperation): Promise<Partial<FileResult>> {
    const basePath = path.resolve(this.config.basePath, operation.path);
    
    // Use glob pattern if provided, otherwise list directory
    const files = operation.pattern 
      ? await glob(operation.pattern, {
          cwd: basePath,
          dot: true,
          recursive: operation.recursive,
        })
      : await fs.readdir(basePath, {
          recursive: operation.recursive,
        });

    return {
      files: files.map(file => path.relative(this.config.basePath, 
        path.resolve(basePath, file))),
    };
  }

  private async copyFile(operation: CopyOperation): Promise<Partial<FileResult>> {
    const sourcePath = path.resolve(this.config.basePath, operation.path);
    const destPath = path.resolve(this.config.basePath, operation.destination);
    
    // Create destination directory if needed
    if (operation.options?.createDirectories) {
      await fs.ensureDir(path.dirname(destPath));
    }

    // Copy file
    await fs.copy(sourcePath, destPath, {
      overwrite: operation.overwrite,
    });

    // Get stats of copied file
    const stats = await fs.stat(destPath);
    
    return {
      stats: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode,
      },
    };
  }

  private async moveFile(operation: MoveOperation): Promise<Partial<FileResult>> {
    const sourcePath = path.resolve(this.config.basePath, operation.path);
    const destPath = path.resolve(this.config.basePath, operation.destination);
    
    // Create destination directory if needed
    if (operation.options?.createDirectories) {
      await fs.ensureDir(path.dirname(destPath));
    }

    // Move file
    await fs.move(sourcePath, destPath, {
      overwrite: true,
    });

    // Get stats of moved file
    const stats = await fs.stat(destPath);
    
    return {
      stats: {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode,
      },
    };
  }

  private formatStats(stats: fs.Stats): FileResult['stats'] {
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
    };
  }

  private async validateOperation(operation: FileOperation): Promise<void> {
    if (!operation.type) {
      throw new Error('Operation type is required');
    }

    if (!operation.path) {
      throw new Error('File path is required');
    }

    if (!Object.values(FileOperationType).includes(operation.type)) {
      throw new Error(`Invalid operation type: ${operation.type}`);
    }
  }

  private async validatePaths(operation: FileOperation): Promise<void> {
    const basePath = this.config.basePath;
    const fullPath = path.resolve(basePath, operation.path);

    // Ensure path is within basePath
    if (!fullPath.startsWith(basePath)) {
      throw new Error('Path must be within the base directory');
    }

    // Check path existence requirements
    switch (operation.type) {
      case FileOperationType.Read:
      case FileOperationType.Delete:
        if (!await fs.pathExists(fullPath)) {
          throw new Error(`Path does not exist: ${operation.path}`);
        }
        break;

      case FileOperationType.Write:
        const writeOp = operation as WriteOperation;
        if (!writeOp.append && await fs.pathExists(fullPath)) {
          if (!writeOp.options?.createDirectories) {
            throw new Error(`File already exists: ${operation.path}`);
          }
        }
        break;

      case FileOperationType.Copy:
      case FileOperationType.Move:
        const destOp = operation as (CopyOperation | MoveOperation);
        const destPath = path.resolve(basePath, destOp.destination);
        
        if (!await fs.pathExists(fullPath)) {
          throw new Error(`Source path does not exist: ${operation.path}`);
        }
        
        if (await fs.pathExists(destPath) && !destOp.overwrite) {
          throw new Error(`Destination already exists: ${destOp.destination}`);
        }
        
        if (!destPath.startsWith(basePath)) {
          throw new Error('Destination must be within the base directory');
        }
        break;
    }

    // Check directory permissions
    try {
      await this.validateDirectoryPermissions(operation);
    } catch (error) {
      throw new Error(`Permission error: ${error.message}`);
    }
  }

  private async validateDirectoryPermissions(operation: FileOperation): Promise<void> {
    const basePath = this.config.basePath;
    const dirPath = path.dirname(path.resolve(basePath, operation.path));

    try {
      // Check if directory exists
      const dirExists = await fs.pathExists(dirPath);
      if (!dirExists && !operation.options?.createDirectories) {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }

      // Check write permissions for write operations
      if (
        operation.type === FileOperationType.Write ||
        operation.type === FileOperationType.Copy ||
        operation.type === FileOperationType.Move
      ) {
        await fs.access(dirPath, fs.constants.W_OK);
      }

      // Check read permissions for read operations
      if (
        operation.type === FileOperationType.Read ||
        operation.type === FileOperationType.List
      ) {
        await fs.access(dirPath, fs.constants.R_OK);
      }
    } catch (error) {
      throw new Error(`Permission denied: ${error.message}`);
    }
  }

  private async validateOperationRequirements(operation: FileOperation): Promise<void> {
    switch (operation.type) {
      case FileOperationType.Write:
        const writeOp = operation as WriteOperation;
        if (writeOp.content === undefined || writeOp.content === null) {
          throw new Error('Content is required for write operation');
        }
        break;

      case FileOperationType.List:
        const listOp = operation as ListOperation;
        if (listOp.pattern) {
          try {
            new RegExp(listOp.pattern);
          } catch (error) {
            throw new Error(`Invalid glob pattern: ${listOp.pattern}`);
          }
        }
        break;

      case FileOperationType.Delete:
        const deleteOp = operation as DeleteOperation;
        const stats = await fs.stat(path.resolve(this.config.basePath, deleteOp.path));
        if (stats.isDirectory() && !deleteOp.recursive) {
          throw new Error('Cannot delete directory without recursive option');
        }
        break;
    }
  }

  private handleFileError(error: unknown, operation: FileOperation): FileError {
    const fileError: FileError = {
      name: 'FileError',
      message: error instanceof Error ? error.message : String(error),
      code: 'UNKNOWN_ERROR',
      path: operation.path,
      type: operation.type,
    };
    
    // Extract file system specific error information
    if (error instanceof Error) {
      if ('code' in error) fileError.code = (error as any).code;
      if ('syscall' in error) fileError.syscall = (error as any).syscall;
      if ('errno' in error) fileError.errno = (error as any).errno;
    }

    return fileError;
  }
} 