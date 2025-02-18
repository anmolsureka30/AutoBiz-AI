import { ChunkingStrategy } from '../types';
import { ChunkHeader, ValidatorConfig } from './types';
import { createHash } from 'crypto';

export class StringStrategy implements ChunkingStrategy<string> {
  private readonly validator: ValidatorConfig;
  private readonly encoding: BufferEncoding;

  constructor(config: ValidatorConfig & { encoding?: BufferEncoding } = {}) {
    this.validator = {
      validateChecksum: config.validateChecksum ?? true,
      validateOrder: config.validateOrder ?? true,
      validateCompleteness: config.validateCompleteness ?? true,
      validateSize: config.validateSize ?? true,
    };
    this.encoding = config.encoding ?? 'utf8';
  }

  split(data: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const buffer = Buffer.from(data, this.encoding);
    const totalChunks = Math.ceil(buffer.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, buffer.length);
      const chunkData = buffer.slice(start, end);

      const header: ChunkHeader = {
        metadata: {
          index: i,
          total: totalChunks,
          offset: start,
          size: end - start,
          hash: this.calculateHash(chunkData),
        },
        checksum: this.calculateChecksum(chunkData),
        encoding: this.encoding,
      };

      const headerStr = JSON.stringify(header);
      const chunk = `${headerStr.length}:${headerStr}${chunkData.toString(this.encoding)}`;
      chunks.push(chunk);
    }

    return chunks;
  }

  merge(chunks: string[]): string {
    if (this.validator.validateOrder) {
      chunks = this.validateAndSortChunks(chunks);
    }

    const validChunks: { data: string; header: ChunkHeader }[] = [];

    // Extract headers and validate chunks
    for (const chunk of chunks) {
      const { header, data } = this.extractHeaderAndData(chunk);
      
      if (this.validator.validateChecksum) {
        const checksum = this.calculateChecksum(Buffer.from(data, this.encoding));
        if (checksum !== header.checksum) {
          throw new Error(`Checksum mismatch for chunk ${header.metadata.index}`);
        }
      }

      validChunks.push({ data, header });
    }

    // Merge validated chunks
    return validChunks.map(chunk => chunk.data).join('');
  }

  validate(data: string): boolean {
    try {
      if (data.length === 0) {
        return false;
      }

      // Validate string encoding
      const buffer = Buffer.from(data, this.encoding);
      if (buffer.toString(this.encoding) !== data) {
        return false;
      }

      // Validate checksum
      const checksum = this.calculateChecksum(buffer);
      if (!checksum) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private calculateHash(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private calculateChecksum(data: Buffer): string {
    return createHash('md5').update(data).digest('hex');
  }

  private extractHeaderAndData(chunk: string): { 
    header: ChunkHeader; 
    data: string;
  } {
    const colonIndex = chunk.indexOf(':');
    const headerLength = parseInt(chunk.slice(0, colonIndex), 10);
    const headerJson = chunk.slice(colonIndex + 1, colonIndex + 1 + headerLength);
    const header = JSON.parse(headerJson) as ChunkHeader;
    const data = chunk.slice(colonIndex + 1 + headerLength);

    return { header, data };
  }

  private validateAndSortChunks(chunks: string[]): string[] {
    const sorted = chunks
      .map(chunk => {
        const { header, data } = this.extractHeaderAndData(chunk);
        return { chunk, header, data };
      })
      .sort((a, b) => a.header.metadata.index - b.header.metadata.index);

    if (this.validator.validateCompleteness) {
      const total = sorted[0].header.metadata.total;
      if (sorted.length !== total) {
        throw new Error(`Missing chunks: expected ${total}, got ${sorted.length}`);
      }

      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].header.metadata.index !== i) {
          throw new Error(`Missing chunk ${i}`);
        }
      }
    }

    return sorted.map(s => s.chunk);
  }
} 