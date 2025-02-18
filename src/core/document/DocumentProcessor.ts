import { Logger } from '../utils/logger/Logger';
import { 
  DocumentFormat, 
  ProcessingOptions, 
  ProcessingResult,
  DocumentValidator,
  ContentExtractor 
} from './types';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';

export class DocumentProcessor {
  private readonly logger: Logger;
  private readonly validators: Map<DocumentFormat, DocumentValidator>;
  private readonly extractors: Map<DocumentFormat, ContentExtractor>;

  constructor() {
    this.logger = new Logger('DocumentProcessor');
    this.validators = new Map();
    this.extractors = new Map();
  }

  registerValidator(validator: DocumentValidator): void {
    this.validators.set(validator.getFormat(), validator);
  }

  registerExtractor(format: DocumentFormat, extractor: ContentExtractor): void {
    this.extractors.set(format, extractor);
  }

  async process(
    buffer: Buffer,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Validate input
      if (!buffer || buffer.length === 0) {
        throw new Error('Empty document buffer provided');
      }

      // Detect format and validate
      const format = await this.detectFormat(buffer);
      if (!format) {
        throw new Error('Unsupported document format');
      }

      // Get appropriate extractor
      const extractor = this.extractors.get(format);
      if (!extractor) {
        throw new Error(`No extractor available for format: ${format}`);
      }

      // Extract content
      const content = await extractor.extract(buffer, options);

      // Calculate processing metrics
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      return {
        content,
        processingTime: endTime - startTime,
        memoryUsed: endMemory - startMemory,
      };

    } catch (error) {
      this.logger.error('Document processing failed', { error });
      
      return {
        content: {
          text: '',
          metadata: {
            format: 'pdf', // Default format
            size: buffer.length,
            hash: this.calculateHash(buffer),
          },
        },
        error: error as Error,
        processingTime: performance.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory,
      };
    }
  }

  private async detectFormat(buffer: Buffer): Promise<DocumentFormat | null> {
    for (const [format, validator] of this.validators) {
      try {
        if (await validator.validate(buffer)) {
          return format;
        }
      } catch (error) {
        this.logger.debug(`Format validation failed for ${format}`, { error });
      }
    }
    return null;
  }

  private calculateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
} 