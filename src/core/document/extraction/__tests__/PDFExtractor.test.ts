import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFExtractor } from '../PDFExtractor';
import { PDFDocument, PDFPage, PDFTextContent } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { ExtractedContent } from '../types';

// Mock pdf-lib
jest.mock('pdf-lib');
jest.mock('pdfjs-dist');

describe('PDFExtractor', () => {
  let extractor: PDFExtractor;
  let mockPDFDocument: jest.Mocked<PDFDocument>;
  let mockPDFPage: jest.Mocked<PDFPage>;

  beforeEach(() => {
    extractor = new PDFExtractor();
    mockPDFPage = {
      getSize: jest.fn().mockReturnValue({ width: 612, height: 792 }),
      getTextContent: jest.fn().mockResolvedValue({
        items: [
          { str: 'Sample', transform: [1, 0, 0, 1, 50, 750] },
          { str: 'Text', transform: [1, 0, 0, 1, 100, 750] },
        ],
      } as PDFTextContent),
      doc: {
        getOperatorList: jest.fn().mockResolvedValue({
          fnArray: [],
          argsArray: [],
        }),
      },
    } as unknown as jest.Mocked<PDFPage>;

    mockPDFDocument = {
      getPageCount: jest.fn().mockReturnValue(1),
      getPage: jest.fn().mockReturnValue(mockPDFPage),
      getDocumentInfo: jest.fn().mockResolvedValue({
        Title: 'Test PDF',
        Author: 'Test Author',
        Subject: 'Test Subject',
        Keywords: 'test, pdf, document',
        Creator: 'Test Creator',
        Producer: 'Test Producer',
        CreationDate: new Date(),
        ModificationDate: new Date(),
      }),
    } as unknown as jest.Mocked<PDFDocument>;

    (PDFDocument.load as jest.Mock).mockResolvedValue(mockPDFDocument);
  });

  describe('basic extraction', () => {
    it('should extract text content from PDF', async () => {
      const pdfBuffer = Buffer.from('dummy PDF content');
      const result = await extractor.extract(pdfBuffer);

      expect(result.text).toBeTruthy();
      expect(result.pages?.[0].text).toContain('Sample Text');
    });

    it('should handle empty PDF', async () => {
      mockPDFDocument.getPageCount.mockReturnValue(0);
      const pdfBuffer = Buffer.from('empty PDF');

      await expect(extractor.extract(pdfBuffer)).rejects.toThrow('No content extracted');
    });

    it('should extract metadata', async () => {
      const pdfBuffer = Buffer.from('dummy PDF content');
      const result = await extractor.extract(pdfBuffer);

      expect(result.metadata).toMatchObject({
        title: 'Test PDF',
        author: 'Test Author',
        subject: 'Test Subject',
        keywords: ['test', 'pdf', 'document'],
      });
    });
  });

  describe('table extraction', () => {
    beforeEach(() => {
      mockPDFPage.doc.getOperatorList.mockResolvedValue({
        fnArray: [
          pdfjs.OPS.beginMarkedContent,
          pdfjs.OPS.setFont,
          pdfjs.OPS.showText,
          pdfjs.OPS.endMarkedContent,
        ],
        argsArray: [
          ['Table'],
          ['Helvetica', 12],
          ['Cell Content'],
          [],
        ],
      });
    });

    it('should detect and extract tables', async () => {
      const pdfBuffer = Buffer.from('PDF with tables');
      const result = await extractor.extract(pdfBuffer);

      expect(result.tables).toBeDefined();
      // Add more specific table extraction tests based on your implementation
    });
  });

  describe('image extraction', () => {
    beforeEach(() => {
      mockPDFPage.doc.getOperatorList.mockResolvedValue({
        fnArray: [pdfjs.OPS.paintImageXObject],
        argsArray: [['Im1']],
      });
    });

    it('should extract images when enabled', async () => {
      const pdfBuffer = Buffer.from('PDF with images');
      const result = await extractor.extract(pdfBuffer);

      expect(result.images).toBeDefined();
      // Add more specific image extraction tests
    });

    it('should skip image extraction when disabled', async () => {
      extractor = new PDFExtractor({ includeImages: false });
      const pdfBuffer = Buffer.from('PDF with images');
      const result = await extractor.extract(pdfBuffer);

      expect(result.images).toHaveLength(0);
    });
  });

  describe('layout extraction', () => {
    it('should extract layout information when enabled', async () => {
      extractor = new PDFExtractor({ includeLayout: true });
      const pdfBuffer = Buffer.from('PDF with layout');
      const result = await extractor.extract(pdfBuffer);

      expect(result.pages[0].layout).toBeDefined();
      expect(result.pages[0].layout?.width).toBe(612);
      expect(result.pages[0].layout?.height).toBe(792);
      expect(result.pages[0].layout?.elements).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle PDF parsing errors', async () => {
      (PDFDocument.load as jest.Mock).mockRejectedValue(new Error('Invalid PDF'));
      const pdfBuffer = Buffer.from('invalid PDF content');

      await expect(extractor.extract(pdfBuffer)).rejects.toThrow('Invalid PDF');
    });

    it('should handle text extraction errors', async () => {
      mockPDFPage.getTextContent.mockRejectedValue(new Error('Text extraction failed'));
      const pdfBuffer = Buffer.from('PDF with bad text');

      await expect(extractor.extract(pdfBuffer)).rejects.toThrow('Text extraction failed');
    });
  });

  describe('performance', () => {
    it('should handle large PDFs efficiently', async () => {
      mockPDFDocument.getPageCount.mockReturnValue(100);
      const pdfBuffer = Buffer.from('large PDF content');

      const startTime = Date.now();
      const result = await extractor.extract(pdfBuffer);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should process within 5 seconds
      expect(result.pages).toHaveLength(100);
    });

    it('should maintain stable memory usage', async () => {
      mockPDFDocument.getPageCount.mockReturnValue(50);
      const pdfBuffer = Buffer.from('medium PDF content');

      const initialMemory = process.memoryUsage().heapUsed;
      await extractor.extract(pdfBuffer);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase
    });
  });
}); 