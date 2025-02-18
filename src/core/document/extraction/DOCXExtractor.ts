import { BaseExtractor } from './BaseExtractor';
import {
  ExtractedContent,
  ExtractedTable,
  ExtractedImage,
  ExtractedPage,
  PageLayout,
} from './types';
import { Document, Paragraph, Table, Run, ImageRun } from 'docx';
import JSZip from 'jszip';
import { TableExtractor } from './TableExtractor';
import { v4 as uuidv4 } from 'uuid';

export class DOCXExtractor extends BaseExtractor {
  private readonly tableExtractor: TableExtractor;

  constructor(options = {}) {
    super(options);
    this.tableExtractor = new TableExtractor();
  }

  async extract(file: Buffer): Promise<ExtractedContent> {
    try {
      const startTime = Date.now();
      const zip = new JSZip();
      await zip.loadAsync(file);

      // Load document.xml
      const documentXml = await zip.file('word/document.xml')?.async('text');
      if (!documentXml) {
        throw new Error('Invalid DOCX file: missing document.xml');
      }

      // Parse document
      const document = await this.parseDocumentXml(documentXml);
      const content = await this.processDocument(document, zip);

      this.validateExtraction(content);

      this.logger.info('DOCX extraction completed', {
        duration: Date.now() - startTime,
        pages: content.pages?.length,
        tables: content.tables?.length,
        images: content.images?.length,
      });

      return content;
    } catch (error) {
      this.logger.error('DOCX extraction failed', { error });
      throw error;
    }
  }

  private async parseDocumentXml(xml: string): Promise<Document> {
    // Implement XML parsing to Document object
    return {} as Document;
  }

  private async processDocument(
    document: Document,
    zip: JSZip
  ): Promise<ExtractedContent> {
    const pages: ExtractedPage[] = [];
    const tables: ExtractedTable[] = [];
    const images: ExtractedImage[] = [];
    let currentPage: ExtractedPage = this.createNewPage(1);

    for (const element of document.body.children) {
      if (this.isPageBreak(element)) {
        pages.push(currentPage);
        currentPage = this.createNewPage(pages.length + 1);
        continue;
      }

      if (element instanceof Paragraph) {
        currentPage.text += await this.processParagraph(element) + '\n';
      } else if (element instanceof Table) {
        const extractedTables = await this.tableExtractor.extractTables(element);
        tables.push(...extractedTables);
        currentPage.tables = currentPage.tables || [];
        currentPage.tables.push(...extractedTables);
      }
    }

    // Add last page
    pages.push(currentPage);

    // Extract images
    if (this.options.includeImages) {
      const mediaFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('word/media/')
      );

      for (const mediaFile of mediaFiles) {
        const image = await this.extractImage(zip, mediaFile);
        if (image) {
          images.push(image);
        }
      }
    }

    return {
      text: pages.map(p => p.text).join('\n\n'),
      metadata: await this.extractMetadata(zip),
      pages,
      tables,
      images,
      language: await this.detectLanguage(pages[0].text),
      confidence: 1,
    };
  }

  private createNewPage(pageNumber: number): ExtractedPage {
    return {
      pageNumber,
      text: '',
      tables: [],
      images: [],
    };
  }

  private isPageBreak(element: any): boolean {
    return element.type === 'page-break';
  }

  private async processParagraph(paragraph: Paragraph): Promise<string> {
    let text = '';
    for (const run of paragraph.children) {
      if (run instanceof Run) {
        text += run.text;
      } else if (run instanceof ImageRun) {
        // Handle inline images if needed
      }
    }
    return text;
  }

  private async extractImage(
    zip: JSZip,
    path: string
  ): Promise<ExtractedImage | null> {
    try {
      const file = zip.file(path);
      if (!file) return null;

      const data = await file.async('nodebuffer');
      const mimeType = this.getMimeTypeFromPath(path);

      return {
        id: uuidv4(),
        data,
        mimeType,
        confidence: 1,
      };
    } catch (error) {
      this.logger.warn('Failed to extract image', { path, error });
      return null;
    }
  }

  private async extractMetadata(zip: JSZip): Promise<Record<string, unknown>> {
    try {
      const coreProps = await zip.file('docProps/core.xml')?.async('text');
      if (!coreProps) return {};

      // Parse XML and extract metadata
      // Implementation needed

      return {};
    } catch (error) {
      this.logger.warn('Failed to extract metadata', { error });
      return {};
    }
  }

  private getMimeTypeFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'wmf': 'image/wmf',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
} 