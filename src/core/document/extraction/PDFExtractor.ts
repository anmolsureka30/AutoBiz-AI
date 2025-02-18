import { PDFDocument, PDFPage } from 'pdf-lib';
import { BaseExtractor } from './BaseExtractor';
import {
  ExtractedContent,
  ExtractedTable,
  ExtractedImage,
  ExtractedPage,
  PageLayout,
} from './types';
import * as pdfjs from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import { TableExtractor } from './TableExtractor';

export class PDFExtractor extends BaseExtractor {
  private readonly tableExtractor: TableExtractor;

  constructor(options = {}) {
    super(options);
    this.tableExtractor = new TableExtractor();
  }

  async extract(file: Buffer): Promise<ExtractedContent> {
    try {
      const startTime = Date.now();
      const pdfDoc = await PDFDocument.load(file);
      const pageCount = pdfDoc.getPageCount();

      // Determine pages to process
      const pageNumbers = this.options.pages.length > 0
        ? this.options.pages.filter(p => p <= pageCount)
        : Array.from({ length: pageCount }, (_, i) => i + 1);

      // Process pages
      const pages = await Promise.all(
        pageNumbers.map(pageNum => this.processPage(
          { pageNumber: pageNum } as ExtractedPage,
          pdfDoc.getPage(pageNum - 1)
        ))
      );

      // Combine results
      const content: ExtractedContent = {
        text: pages.map(p => p.text).join('\n\n'),
        metadata: await this.extractMetadata(pdfDoc),
        pages,
        tables: pages.flatMap(p => p.tables || []),
        images: pages.flatMap(p => p.images || []),
      };

      // Detect language
      content.language = await this.detectLanguage(content.text);

      // Calculate overall confidence
      content.confidence = this.calculateConfidence(
        pages.reduce((sum, p) => sum + (p.layout?.elements.reduce(
          (acc, el) => acc + (el.confidence || 0), 0
        ) || 0), 0) / pages.length
      );

      this.validateExtraction(content);

      this.logger.info('PDF extraction completed', {
        duration: Date.now() - startTime,
        pages: pages.length,
        tables: content.tables?.length,
        images: content.images?.length,
      });

      return content;
    } catch (error) {
      this.logger.error('PDF extraction failed', { error });
      throw error;
    }
  }

  protected async extractText(page: PDFPage): Promise<string> {
    // Use pdf.js for text extraction
    const textContent = await page.doc.getTextContent();
    return textContent.items
      .map(item => (item as any).str)
      .join(' ');
  }

  protected async extractTables(page: PDFPage): Promise<ExtractedTable[]> {
    return this.tableExtractor.extractTables(page);
  }

  protected async extractImages(page: PDFPage): Promise<ExtractedImage[]> {
    const images: ExtractedImage[] = [];
    const ops = await page.doc.getOperatorList();

    for (const op of ops.fnArray) {
      if (op === pdfjs.OPS.paintImageXObject) {
        const image = await this.extractImage(op);
        if (image) {
          images.push(image);
        }
      }
    }

    return images;
  }

  protected async extractLayout(page: PDFPage): Promise<PageLayout> {
    const { width, height } = page.getSize();
    const elements = [];

    // Extract text elements
    const textContent = await page.doc.getTextContent();
    for (const item of textContent.items) {
      elements.push({
        type: 'text',
        bounds: {
          x: (item as any).transform[4],
          y: height - (item as any).transform[5],
          width: (item as any).width,
          height: (item as any).height,
        },
        content: (item as any).str,
        confidence: 1,
      });
    }

    // Add tables and images to layout
    const tables = await this.extractTables(page);
    const images = await this.extractImages(page);

    elements.push(
      ...tables.map(table => ({
        type: 'table' as const,
        bounds: table.position!,
        confidence: table.confidence,
      })),
      ...images.map(image => ({
        type: 'image' as const,
        bounds: image.position!,
        confidence: image.confidence,
      }))
    );

    return { width, height, elements };
  }

  private async extractMetadata(doc: PDFDocument): Promise<Record<string, unknown>> {
    const info = await doc.getDocumentInfo();
    return {
      title: info.Title,
      author: info.Author,
      subject: info.Subject,
      keywords: info.Keywords?.split(',').map(k => k.trim()),
      creator: info.Creator,
      producer: info.Producer,
      creationDate: info.CreationDate,
      modificationDate: info.ModificationDate,
      trapped: info.Trapped,
    };
  }

  private async extractImage(op: any): Promise<ExtractedImage | null> {
    try {
      const imageData = await op.getImageData();
      if (!imageData) return null;

      return {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        data: Buffer.from(imageData.data),
        mimeType: `image/${imageData.format || 'png'}`,
        position: {
          x: op.transform[4],
          y: op.transform[5],
          width: imageData.width,
          height: imageData.height,
          rotation: Math.atan2(op.transform[1], op.transform[0]) * (180 / Math.PI),
          scale: Math.sqrt(op.transform[0] * op.transform[0] + op.transform[1] * op.transform[1]),
        },
        confidence: 1,
      };
    } catch (error) {
      this.logger.warn('Failed to extract image', { error });
      return null;
    }
  }
} 