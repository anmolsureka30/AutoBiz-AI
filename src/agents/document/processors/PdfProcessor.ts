import { Buffer } from 'buffer';
import * as pdfjsLib from 'pdfjs-dist';
import { ProcessingOptions, DocumentContent, DocumentMetadata } from '../types';
import { Logger } from '../../../utils/logger';

export class PdfProcessor {
  constructor(private readonly logger: Logger) {}

  async extractContent(
    content: Buffer | string,
    metadata: DocumentMetadata,
    options?: ProcessingOptions
  ): Promise<DocumentContent> {
    try {
      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      const data = new Uint8Array(buffer);
      
      // Load PDF document
      const doc = await pdfjsLib.getDocument({ data }).promise;
      const numPages = doc.numPages;
      
      // Extract text content
      let extractedText = '';
      const images: DocumentContent['images'] = [];
      const tables: DocumentContent['tables'] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        if (options?.maxPages && pageNum > options.maxPages) {
          break;
        }

        const page = await doc.getPage(pageNum);
        const content = await page.getTextContent();
        const pageText = content.items
          .map(item => 'str' in item ? item.str : '')
          .join(' ');

        extractedText += pageText + '\n';

        if (options?.extractImages) {
          const imageData = await this.extractPageImages(page);
          images.push(...imageData.map(img => ({
            ...img,
            metadata: {
              ...img.metadata,
              location: { page: pageNum, bbox: img.metadata.bbox }
            }
          })));
        }

        if (options?.extractTables) {
          const tableData = await this.extractPageTables(page);
          tables.push(...tableData.map(table => ({
            ...table,
            metadata: {
              ...table.metadata,
              location: { page: pageNum, bbox: table.metadata.bbox }
            }
          })));
        }
      }

      return {
        text: extractedText.trim(),
        images: images.length > 0 ? images : undefined,
        tables: tables.length > 0 ? tables : undefined,
        metadata: {
          ...metadata,
          pageCount: numPages
        }
      };
    } catch (error) {
      this.logger.error({
        message: 'PDF extraction failed',
        documentId: metadata.filename,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async extractPageImages(page: pdfjsLib.PDFPageProxy): Promise<DocumentContent['images']> {
    const operatorList = await page.getOperatorList();
    const images: DocumentContent['images'] = [];

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
        const imgData = operatorList.argsArray[i][0];
        const img = await page.objs.get(imgData);

        if (img) {
          images.push({
            data: Buffer.from(img.data.buffer),
            metadata: {
              format: 'image/jpeg', // Default format, could be determined from image data
              width: img.width,
              height: img.height,
              location: {
                page: page.pageNumber,
                bbox: img.bbox || []
              }
            }
          });
        }
      }
    }

    return images;
  }

  private async extractPageTables(page: pdfjsLib.PDFPageProxy): Promise<DocumentContent['tables']> {
    // Table extraction requires more complex analysis
    // This is a simplified implementation
    const content = await page.getTextContent();
    const tables: DocumentContent['tables'] = [];

    // Implement table detection and extraction logic
    // This could involve:
    // 1. Analyzing text positioning and alignment
    // 2. Looking for grid-like structures
    // 3. Using machine learning for table detection

    return tables;
  }
} 