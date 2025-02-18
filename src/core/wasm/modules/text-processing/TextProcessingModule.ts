import { WasmModule } from '../../WasmModule';
import {
  TextProcessingConfig,
  TextProcessingResult,
  TextChunk,
  NLPResult,
  TextProcessingError,
} from './types';

interface TextProcessingExports extends WebAssembly.Exports {
  memory: WebAssembly.Memory;
  allocate: (size: number) => number;
  deallocate: (ptr: number, size: number) => void;
  processText: (textPtr: number) => number;
  chunkText: (textPtr: number, configPtr: number) => number;
  tokenizeText: (textPtr: number) => number;
  detectLanguage: (textPtr: number) => number;
  extractEntities: (textPtr: number) => number;
  cleanup: () => void;
}

export class TextProcessingModule extends WasmModule {
  private readonly defaultConfig: Required<NonNullable<TextProcessingConfig['options']>> = {
    chunkSize: 1024,
    overlap: 200,
    preserveWhitespace: false,
    preserveNewlines: true,
    trimChunks: true,
    language: 'en',
    encoding: 'utf-8',
  };

  constructor(config: TextProcessingConfig) {
    super({
      ...config,
      exports: [
        'allocate',
        'deallocate',
        'processText',
        'chunkText',
        'tokenizeText',
        'detectLanguage',
        'extractEntities',
        'cleanup',
      ],
    });
  }

  protected get exports(): TextProcessingExports {
    if (!this.instance) {
      throw new Error('WASM module not initialized');
    }
    return this.instance.exports as TextProcessingExports;
  }

  async processText(text: string): Promise<TextProcessingResult> {
    try {
      const startTime = performance.now();
      const textPtr = this.allocateString(text);

      // Call WASM function
      const resultPtr = this.exports.processText(textPtr);
      const result = this.parseResult(resultPtr);

      // Calculate stats
      const endTime = performance.now();
      const stats = {
        inputLength: text.length,
        chunkCount: result.chunks.length,
        averageChunkSize: result.chunks.reduce((acc, chunk) => acc + chunk.text.length, 0) / result.chunks.length,
        processingTime: endTime - startTime,
        memoryUsed: this.getMemoryStats().usedPages * 64 * 1024,
      };

      return {
        ...result,
        stats,
      };
    } catch (error) {
      this.handleError(error);
    } finally {
      this.cleanup();
    }
  }

  async chunkText(text: string, options?: Partial<TextProcessingConfig['options']>): Promise<TextChunk[]> {
    try {
      const config = {
        ...this.defaultConfig,
        ...options,
      };

      const textPtr = this.allocateString(text);
      const configPtr = this.allocateConfig(config);

      // Call WASM function
      const resultPtr = this.exports.chunkText(textPtr, configPtr);
      return this.parseChunks(resultPtr);
    } catch (error) {
      this.handleError(error);
    } finally {
      this.cleanup();
    }
  }

  async analyzeText(text: string): Promise<NLPResult> {
    if (!this.instance) {
      throw new Error('WASM module not initialized');
    }

    try {
      const startTime = performance.now();
      const textPtr = this.allocateString(text);

      // Call WASM functions
      const tokensPtr = this.exports.tokenizeText(textPtr);
      const tokens = this.parseStringArray(tokensPtr);

      const languagePtr = this.exports.detectLanguage(textPtr);
      const language = this.parseString(languagePtr);

      const entitiesPtr = this.exports.extractEntities(textPtr);
      const entities = this.parseEntities(entitiesPtr);

      const endTime = performance.now();

      return {
        tokens,
        sentences: this.getSentences(tokens),
        paragraphs: this.getParagraphs(text),
        entities,
        metadata: {
          language,
          confidence: 0.95, // TODO: Get from WASM
          processingTime: endTime - startTime,
        },
      };
    } catch (error) {
      this.handleError(error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  private allocateString(text: string): number {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    const ptr = this.exports.allocate(bytes.length + 1);
    
    const memory = new Uint8Array(this.exports.memory.buffer);
    memory.set(bytes, ptr);
    memory[ptr + bytes.length] = 0; // Null terminator

    return ptr;
  }

  private allocateConfig(config: Required<NonNullable<TextProcessingConfig['options']>>): number {
    const configData = new Int32Array([
      config.chunkSize,
      config.overlap,
      config.preserveWhitespace ? 1 : 0,
      config.preserveNewlines ? 1 : 0,
      config.trimChunks ? 1 : 0,
    ]);

    const ptr = this.exports.allocate(configData.byteLength);
    new Int32Array(this.exports.memory.buffer).set(configData, ptr / 4);

    return ptr;
  }

  private parseResult(ptr: number): Omit<TextProcessingResult, 'stats'> {
    const view = new DataView(this.exports.memory.buffer);
    const chunkCount = view.getInt32(ptr, true);
    const metadataPtr = view.getInt32(ptr + 4, true);
    const chunksPtr = view.getInt32(ptr + 8, true);

    const chunks = this.parseChunks(chunksPtr, chunkCount);
    const metadata = this.parseMetadata(metadataPtr);

    // Deallocate memory
    this.exports.deallocate(ptr, 12);
    this.exports.deallocate(chunksPtr, chunkCount * 24); // Assuming 24 bytes per chunk
    this.exports.deallocate(metadataPtr, 16); // Assuming 16 bytes for metadata

    return {
      chunks,
      metadata,
    };
  }

  private parseChunks(ptr: number, count: number = 0): TextChunk[] {
    const view = new DataView(this.exports.memory.buffer);
    const chunks: TextChunk[] = [];

    for (let i = 0; i < count; i++) {
      const offset = ptr + i * 24; // 24 bytes per chunk
      const id = crypto.randomUUID();
      const textPtr = view.getInt32(offset, true);
      const start = view.getInt32(offset + 4, true);
      const end = view.getInt32(offset + 8, true);
      const metadataPtr = view.getInt32(offset + 12, true);

      chunks.push({
        id,
        text: this.parseString(textPtr),
        start,
        end,
        metadata: this.parseMetadata(metadataPtr),
      });

      // Deallocate chunk memory
      this.exports.deallocate(textPtr, end - start);
      this.exports.deallocate(metadataPtr, 16);
    }

    return chunks;
  }

  private parseMetadata(ptr: number): Record<string, unknown> {
    const view = new DataView(this.exports.memory.buffer);
    return {
      language: this.parseString(view.getInt32(ptr, true)),
      confidence: view.getFloat64(ptr + 8, true),
    };
  }

  private parseString(ptr: number): string {
    const memory = new Uint8Array(this.exports.memory.buffer);
    let length = 0;
    while (memory[ptr + length] !== 0) length++;
    
    const bytes = memory.slice(ptr, ptr + length);
    const text = new TextDecoder().decode(bytes);

    // Deallocate string memory
    this.exports.deallocate(ptr, length + 1);

    return text;
  }

  private parseStringArray(ptr: number): string[] {
    // Implementation depends on WASM module's memory structure
    // This is a placeholder
    return [];
  }

  private parseEntities(ptr: number): NLPResult['entities'] {
    // Implementation depends on WASM module's memory structure
    // This is a placeholder
    return [];
  }

  private getSentences(tokens: string[]): string[] {
    // Basic sentence detection
    const sentences: string[] = [];
    let currentSentence: string[] = [];

    for (const token of tokens) {
      currentSentence.push(token);
      if (/[.!?]$/.test(token)) {
        sentences.push(currentSentence.join(' '));
        currentSentence = [];
      }
    }

    if (currentSentence.length > 0) {
      sentences.push(currentSentence.join(' '));
    }

    return sentences;
  }

  private getParagraphs(text: string): string[] {
    return text.split(/\n\s*\n/).filter(Boolean);
  }

  private cleanup(): void {
    if (this.exports.cleanup) {
      this.exports.cleanup();
    }
  }

  private handleError(error: unknown): never {
    const textError: TextProcessingError = {
      code: 'TEXT_PROCESSING_ERROR',
      message: error instanceof Error ? error.message : String(error),
      details: error instanceof Error ? { cause: error.stack } : undefined,
    };
    throw textError;
  }
} 