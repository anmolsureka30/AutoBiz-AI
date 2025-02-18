import { ChunkingStrategy } from '../types';
import { ChunkHeader, ValidatorConfig } from './types';
import { createHash } from 'crypto';

export class ArrayBufferStrategy implements ChunkingStrategy<ArrayBuffer> {
  private readonly validator: ValidatorConfig;

  constructor(config: ValidatorConfig = {}) {
    this.validator = {
      validateChecksum: config.validateChecksum ?? true,
      validateOrder: config.validateOrder ?? true,
      validateCompleteness: config.validateCompleteness ?? true,
      validateSize: config.validateSize ?? true,
    };
  }

  split(data: ArrayBuffer, chunkSize: number): ArrayBuffer[] {
    const chunks: ArrayBuffer[] = [];
    const view = new Uint8Array(data);
    const totalChunks = Math.ceil(data.byteLength / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.byteLength);
      const chunkData = view.slice(start, end);

      const header: ChunkHeader = {
        metadata: {
          index: i,
          total: totalChunks,
          offset: start,
          size: end - start,
          hash: this.calculateHash(chunkData),
        },
        checksum: this.calculateChecksum(chunkData),
      };

      const headerBuffer = this.serializeHeader(header);
      const chunk = new Uint8Array(headerBuffer.byteLength + chunkData.byteLength);
      chunk.set(new Uint8Array(headerBuffer), 0);
      chunk.set(chunkData, headerBuffer.byteLength);

      chunks.push(chunk.buffer);
    }

    return chunks;
  }

  merge(chunks: ArrayBuffer[]): ArrayBuffer {
    if (this.validator.validateOrder) {
      chunks = this.validateAndSortChunks(chunks);
    }

    let totalSize = 0;
    const validChunks: { data: Uint8Array; header: ChunkHeader }[] = [];

    // Extract headers and validate chunks
    for (const chunk of chunks) {
      const { header, data } = this.extractHeaderAndData(chunk);
      
      if (this.validator.validateChecksum) {
        const checksum = this.calculateChecksum(data);
        if (checksum !== header.checksum) {
          throw new Error(`Checksum mismatch for chunk ${header.metadata.index}`);
        }
      }

      totalSize += data.byteLength;
      validChunks.push({ data, header });
    }

    // Merge validated chunks
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const { data, header } of validChunks) {
      result.set(data, offset);
      offset += data.byteLength;
    }

    return result.buffer;
  }

  validate(data: ArrayBuffer): boolean {
    try {
      const view = new Uint8Array(data);
      
      // Basic validation
      if (view.byteLength === 0) {
        return false;
      }

      // Validate data integrity
      const checksum = this.calculateChecksum(view);
      if (!checksum) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private calculateHash(data: Uint8Array): string {
    return createHash('sha256')
      .update(new Uint8Array(data))
      .digest('hex');
  }

  private calculateChecksum(data: Uint8Array): string {
    return createHash('md5')
      .update(new Uint8Array(data))
      .digest('hex');
  }

  private serializeHeader(header: ChunkHeader): ArrayBuffer {
    return new TextEncoder().encode(
      JSON.stringify(header)
    ).buffer;
  }

  private deserializeHeader(buffer: ArrayBuffer): ChunkHeader {
    const text = new TextDecoder().decode(buffer);
    return JSON.parse(text);
  }

  private extractHeaderAndData(chunk: ArrayBuffer): { 
    header: ChunkHeader; 
    data: Uint8Array;
  } {
    const view = new Uint8Array(chunk);
    const headerSize = new DataView(chunk, 0, 4).getUint32(0);
    const headerBuffer = chunk.slice(4, 4 + headerSize);
    const header = this.deserializeHeader(headerBuffer);
    const data = new Uint8Array(chunk, 4 + headerSize);

    return { header, data };
  }

  private validateAndSortChunks(chunks: ArrayBuffer[]): ArrayBuffer[] {
    const sorted = chunks
      .map(chunk => {
        const { header, data } = this.extractHeaderAndData(chunk);
        return { chunk, header, data };
      })
      .sort((a, b) => a.header.metadata.index - b.header.metadata.index);

    // Validate completeness
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