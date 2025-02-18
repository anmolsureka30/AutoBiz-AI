import { Logger } from '../../utils/logger/Logger';
import {
  ExtractedContent,
  ExtractionOptions,
  ExtractedPage,
  ExtractedTable,
  ExtractedImage,
} from './types';

export abstract class BaseExtractor {
  protected readonly logger: Logger;
  protected readonly options: Required<ExtractionOptions>;

  constructor(options: ExtractionOptions = {}) {
    this.logger = new Logger(this.constructor.name);
    this.options = {
      pages: options.pages ?? [],
      includeTables: options.includeTables ?? true,
      includeImages: options.includeImages ?? true,
      includeLayout: options.includeLayout ?? false,
      ocrConfig: options.ocrConfig ?? {
        enabled: false,
        mode: 'accurate',
        languages: ['eng'],
        dpi: 300,
        preprocessing: {
          grayscale: true,
          denoise: true,
          deskew: true,
          threshold: 128,
        },
      },
      language: options.language ?? ['eng'],
    };
  }

  abstract extract(file: Buffer): Promise<ExtractedContent>;

  protected async processPage(
    page: ExtractedPage,
    rawPage: unknown
  ): Promise<ExtractedPage> {
    const startTime = Date.now();
    try {
      // Extract text content
      page.text = await this.extractText(rawPage);

      // Extract tables if enabled
      if (this.options.includeTables) {
        page.tables = await this.extractTables(rawPage);
      }

      // Extract images if enabled
      if (this.options.includeImages) {
        page.images = await this.extractImages(rawPage);
      }

      // Extract layout if enabled
      if (this.options.includeLayout) {
        page.layout = await this.extractLayout(rawPage);
      }

      this.logger.debug('Page processing completed', {
        pageNumber: page.pageNumber,
        duration: Date.now() - startTime,
        textLength: page.text.length,
        tables: page.tables?.length,
        images: page.images?.length,
      });

      return page;
    } catch (error) {
      this.logger.error('Page processing failed', {
        pageNumber: page.pageNumber,
        error,
      });
      throw error;
    }
  }

  protected abstract extractText(page: unknown): Promise<string>;
  protected abstract extractTables(page: unknown): Promise<ExtractedTable[]>;
  protected abstract extractImages(page: unknown): Promise<ExtractedImage[]>;
  protected abstract extractLayout(page: unknown): Promise<ExtractedPage['layout']>;

  protected async detectLanguage(text: string): Promise<string> {
    // Implement language detection using a library like franc or langdetect
    return 'eng';
  }

  protected calculateConfidence(
    textConfidence: number,
    tableConfidence?: number,
    imageConfidence?: number
  ): number {
    const weights = {
      text: 0.6,
      tables: 0.2,
      images: 0.2,
    };

    let totalWeight = weights.text;
    let weightedSum = textConfidence * weights.text;

    if (tableConfidence !== undefined) {
      totalWeight += weights.tables;
      weightedSum += tableConfidence * weights.tables;
    }

    if (imageConfidence !== undefined) {
      totalWeight += weights.images;
      weightedSum += imageConfidence * weights.images;
    }

    return weightedSum / totalWeight;
  }

  protected async preprocessImage(
    image: Buffer
  ): Promise<Buffer> {
    // Implement image preprocessing using Sharp or similar library
    return image;
  }

  protected validateExtraction(content: ExtractedContent): void {
    if (!content.text && !content.pages?.length) {
      throw new Error('No content extracted');
    }

    if (content.pages) {
      for (const page of content.pages) {
        if (!page.text && !page.images?.length && !page.tables?.length) {
          this.logger.warn('Empty page detected', { pageNumber: page.pageNumber });
        }
      }
    }

    if (content.tables) {
      for (const table of content.tables) {
        if (!table.rows.length) {
          this.logger.warn('Empty table detected', { tableId: table.id });
        }
      }
    }
  }
} 