import { ContentExtractor, DocumentFormat, ProcessingOptions, ExtractedContent } from '../types';
import { Logger } from '../../utils/logger/Logger';
import { PDFDocument, PDFPage } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { createHash } from 'crypto';
import { TableExtractor } from './utils/TableExtractor';
import { LanguageDetector } from '../utils/LanguageDetector';
import { ImageFormatDetector } from '../utils/ImageFormatDetector';

export class PDFExtractor implements ContentExtractor {
  private readonly logger: Logger;
  private readonly tableExtractor: TableExtractor;
  private readonly languageDetector: LanguageDetector;
  private readonly imageFormatDetector: ImageFormatDetector;

  constructor() {
    this.logger = new Logger('PDFExtractor');
    this.tableExtractor = new TableExtractor();
    this.languageDetector = new LanguageDetector();
    this.imageFormatDetector = new ImageFormatDetector();
    // Initialize PDF.js
    pdfjs.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.js');
  }

  async extract(buffer: Buffer, options: ProcessingOptions): Promise<ExtractedContent> {
    try {
      // Load document with pdf-lib for metadata
      const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false });
      const metadata = await this.extractMetadata(pdfDoc);

      // Load document with PDF.js for text extraction
      const data = new Uint8Array(buffer);
      const doc = await pdfjs.getDocument({ data }).promise;

      // Extract text content
      const pages = await this.extractPages(doc, options);
      const text = pages.map(page => page.text).join('\n\n');

      // Extract tables if requested
      const tables = options.extractTables ? 
        await this.extractTables(doc) : undefined;

      return {
        text,
        metadata,
        pages,
        tables,
        language: await this.detectLanguage(text, options),
        confidence: 1.0,
      };
    } catch (error) {
      this.logger.error('PDF extraction failed', { error });
      throw error;
    }
  }

  supports(format: DocumentFormat): boolean {
    return format === 'pdf';
  }

  private async extractMetadata(pdfDoc: PDFDocument): Promise<ExtractedContent['metadata']> {
    const info = await pdfDoc.getDocumentInfo();
    
    return {
      format: 'pdf',
      size: pdfDoc.save().byteLength,
      hash: this.calculateHash(await pdfDoc.save()),
      pageCount: pdfDoc.getPageCount(),
      title: info.Title || undefined,
      author: info.Author || undefined,
      createdAt: info.CreationDate,
      modifiedAt: info.ModificationDate,
    };
  }

  private async extractPages(doc: any, options: ProcessingOptions) {
    const pages: ExtractedContent['pages'] = [];
    
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      const pageData = {
        number: i,
        text,
      };

      // Extract images if requested
      if (options.extractImages) {
        const images = await this.extractImages(page);
        if (images.length > 0) {
          pageData.images = images;
        }
      }

      pages.push(pageData);
    }

    return pages;
  }

  private async extractImages(page: any) {
    const images: ExtractedContent['pages'][0]['images'] = [];
    const ops = await page.getOperatorList();
    
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] === pdfjs.OPS.paintImageXObject) {
        const imageData = await this.extractImageData(page, ops.argsArray[i][0]);
        if (imageData) {
          images.push(imageData);
        }
      }
    }

    return images;
  }

  private async extractImageData(page: any, imageRef: string) {
    try {
      const img = await page.objs.get(imageRef);
      if (!img) return null;

      const imageBuffer = Buffer.from(img.data.buffer);
      const format = this.imageFormatDetector.detectFormat(imageBuffer);

      return {
        data: imageBuffer,
        format,
        location: {
          x: 0, // Would need transformation matrix to determine actual position
          y: 0,
          width: img.width,
          height: img.height,
        },
      };
    } catch (error) {
      this.logger.warn('Failed to extract image', { error, imageRef });
      return null;
    }
  }

  private async extractTables(doc: any): Promise<Array<{
    headers: string[];
    rows: string[][];
    pageNumber?: number;
  }>> {
    const tables: Array<{
      headers: string[];
      rows: string[][];
      pageNumber: number;
    }> = [];

    for (let i = 1; i <= doc.numPages; i++) {
      try {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageTables = this.tableExtractor.extractTables(textContent.items);
        pageTables.forEach(table => {
          tables.push({
            ...table,
            pageNumber: i,
          });
        });
      } catch (error) {
        this.logger.warn(`Failed to extract tables from page ${i}`, { error });
      }
    }

    return tables;
  }

  private async detectLanguage(text: string, options: ProcessingOptions): Promise<string | undefined> {
    if (!options.detectLanguage || !text) {
      return undefined;
    }

    const result = this.languageDetector.detect(text);
    return result?.language;
  }

  private calculateHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
} 