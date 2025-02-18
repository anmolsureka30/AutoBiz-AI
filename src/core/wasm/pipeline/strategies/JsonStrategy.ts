import { ChunkingStrategy } from '../types';
import { ChunkHeader, ValidatorConfig } from './types';
import { createHash } from 'crypto';

interface JsonChunkMetadata {
  path: string[];
  type: 'object' | 'array' | 'value';
  size: number;
}

export class JsonStrategy implements ChunkingStrategy<unknown> {
  private readonly validator: ValidatorConfig;
  private readonly maxDepth: number;

  constructor(config: ValidatorConfig & { maxDepth?: number } = {}) {
    this.validator = {
      validateChecksum: config.validateChecksum ?? true,
      validateOrder: config.validateOrder ?? true,
      validateCompleteness: config.validateCompleteness ?? true,
      validateSize: config.validateSize ?? true,
    };
    this.maxDepth = config.maxDepth ?? 100;
  }

  split(data: unknown, chunkSize: number): unknown[] {
    const chunks: unknown[] = [];
    this.splitRecursive(data, [], chunkSize, chunks);
    return chunks;
  }

  merge(chunks: unknown[]): unknown {
    if (this.validator.validateOrder) {
      chunks = this.validateAndSortChunks(chunks);
    }

    const root: any = {};
    
    for (const chunk of chunks) {
      const { header, data } = this.extractHeaderAndData(chunk);
      
      if (this.validator.validateChecksum) {
        const checksum = this.calculateChecksum(JSON.stringify(data));
        if (checksum !== header.checksum) {
          throw new Error(`Checksum mismatch for chunk at path ${header.metadata.path.join('.')}`);
        }
      }

      this.mergePath(root, header.metadata.path, data);
    }

    return root;
  }

  validate(data: unknown): boolean {
    try {
      // Validate JSON structure
      JSON.stringify(data);

      // Validate depth
      if (this.getObjectDepth(data) > this.maxDepth) {
        return false;
      }

      // Validate checksum
      const checksum = this.calculateChecksum(JSON.stringify(data));
      if (!checksum) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private splitRecursive(
    data: unknown,
    path: string[],
    chunkSize: number,
    chunks: unknown[]
  ): void {
    if (path.length > this.maxDepth) {
      throw new Error(`Maximum object depth exceeded: ${this.maxDepth}`);
    }

    const serialized = JSON.stringify(data);
    if (serialized.length <= chunkSize) {
      this.addChunk(data, path, chunks);
      return;
    }

    if (Array.isArray(data)) {
      this.splitArray(data, path, chunkSize, chunks);
    } else if (typeof data === 'object' && data !== null) {
      this.splitObject(data as Record<string, unknown>, path, chunkSize, chunks);
    } else {
      this.addChunk(data, path, chunks);
    }
  }

  private splitArray(
    arr: unknown[],
    path: string[],
    chunkSize: number,
    chunks: unknown[]
  ): void {
    let currentChunk: unknown[] = [];
    let currentSize = 0;

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const itemSize = JSON.stringify(item).length;

      if (itemSize > chunkSize) {
        // Process accumulated items
        if (currentChunk.length > 0) {
          this.addChunk(currentChunk, [...path, 'items'], chunks);
          currentChunk = [];
          currentSize = 0;
        }
        // Process large item recursively
        this.splitRecursive(item, [...path, i.toString()], chunkSize, chunks);
      } else if (currentSize + itemSize > chunkSize) {
        // Current chunk is full
        this.addChunk(currentChunk, [...path, 'items'], chunks);
        currentChunk = [item];
        currentSize = itemSize;
      } else {
        // Add to current chunk
        currentChunk.push(item);
        currentSize += itemSize;
      }
    }

    if (currentChunk.length > 0) {
      this.addChunk(currentChunk, [...path, 'items'], chunks);
    }
  }

  private splitObject(
    obj: Record<string, unknown>,
    path: string[],
    chunkSize: number,
    chunks: unknown[]
  ): void {
    let currentChunk: Record<string, unknown> = {};
    let currentSize = 0;

    for (const [key, value] of Object.entries(obj)) {
      const valueSize = JSON.stringify(value).length;

      if (valueSize > chunkSize) {
        // Process accumulated properties
        if (Object.keys(currentChunk).length > 0) {
          this.addChunk(currentChunk, path, chunks);
          currentChunk = {};
          currentSize = 0;
        }
        // Process large value recursively
        this.splitRecursive(value, [...path, key], chunkSize, chunks);
      } else if (currentSize + valueSize > chunkSize) {
        // Current chunk is full
        this.addChunk(currentChunk, path, chunks);
        currentChunk = { [key]: value };
        currentSize = valueSize;
      } else {
        // Add to current chunk
        currentChunk[key] = value;
        currentSize += valueSize;
      }
    }

    if (Object.keys(currentChunk).length > 0) {
      this.addChunk(currentChunk, path, chunks);
    }
  }

  private addChunk(data: unknown, path: string[], chunks: unknown[]): void {
    const header: ChunkHeader = {
      metadata: {
        index: chunks.length,
        total: 0, // Will be updated after all chunks are created
        offset: 0,
        size: JSON.stringify(data).length,
        hash: this.calculateHash(JSON.stringify(data)),
      },
      checksum: this.calculateChecksum(JSON.stringify(data)),
    };

    chunks.push({
      header,
      data,
      path,
      type: Array.isArray(data) ? 'array' : typeof data === 'object' ? 'object' : 'value',
    });
  }

  private calculateHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private calculateChecksum(data: string): string {
    return createHash('md5').update(data).digest('hex');
  }

  private extractHeaderAndData(chunk: unknown): {
    header: ChunkHeader;
    data: unknown;
    path: string[];
    type: 'object' | 'array' | 'value';
  } {
    const { header, data, path, type } = chunk as any;
    return { header, data, path, type };
  }

  private validateAndSortChunks(chunks: unknown[]): unknown[] {
    const sorted = [...chunks].sort((a: any, b: any) => 
      a.header.metadata.index - b.header.metadata.index
    );

    if (this.validator.validateCompleteness) {
      const paths = new Set(sorted.map((chunk: any) => chunk.path.join('.')));
      if (paths.size !== sorted.length) {
        throw new Error('Duplicate paths detected in chunks');
      }
    }

    return sorted;
  }

  private mergePath(root: any, path: string[], value: unknown): void {
    if (path.length === 0) {
      Object.assign(root, value);
      return;
    }

    let current = root;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = key === 'items' ? [] : {};
      }
      current = current[key];
    }

    const lastKey = path[path.length - 1];
    if (lastKey === 'items' && Array.isArray(current) && Array.isArray(value)) {
      current.push(...value);
    } else {
      current[lastKey] = value;
    }
  }

  private getObjectDepth(obj: unknown, depth = 0): number {
    if (depth > this.maxDepth) return depth;
    if (typeof obj !== 'object' || obj === null) return depth;

    let maxDepth = depth;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        maxDepth = Math.max(maxDepth, this.getObjectDepth(item, depth + 1));
      }
    } else {
      for (const value of Object.values(obj)) {
        maxDepth = Math.max(maxDepth, this.getObjectDepth(value, depth + 1));
      }
    }

    return maxDepth;
  }
} 