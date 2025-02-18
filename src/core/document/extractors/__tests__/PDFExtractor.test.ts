import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFExtractor } from '../PDFExtractor';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';
import { ProcessingOptions } from '../../types';

// Mock dependencies
jest.mock('pdf-lib');
jest.mock('pdfjs-dist');
jest.mock('crypto');

describe('PDFExtractor', () => {
  let extractor: PDFExtractor;
  let mockPDFDocument: jest.Mocked<typeof PDFDocument>;
  let mockPDFJS: jest.Mocked<typeof pdfjs>;

  const mockBuffer = Buffer.from('test pdf content');
  const defaultOptions: ProcessingOptions = {
    extractImages: true,
    extractTables: true,
    detectLanguage: true,
  };

  beforeEach(() => {
    extractor = new PDFExtractor();
    mockPDFDocument = PDFDocument as jest.Mocked<typeof PDFDocument>;
    mockPDFJS = pdfjs as jest.Mocked<typeof pdfjs>;

    // Setup PDF.js mocks
    const mockPage = {
      getTextContent: jest.fn().mockResolvedValue({
        items: [
          { str: 'Hello' },
          { str: 'World' },
        ],
      }),
      getOperatorList: jest.fn().mockResolvedValue({
        fnArray: [pdfjs.OPS.paintImageXObject],
        argsArray: [['img1']],
      }),
      objs: {
        get: jest.fn().mockResolvedValue({
          data: {
            buffer: new ArrayBuffer(8),
          },
          width: 100,
          height: 100,
        }),
      },
    };

    const mockDoc = {
      numPages: 2,
      getPage: jest.fn().mockResolvedValue(mockPage),
    };

    mockPDFJS.getDocument.mockReturnValue({
      promise: Promise.resolve(mockDoc),
    } as any);

    // Setup pdf-lib mocks
    const mockPDFLibDoc = {
      getDocumentInfo: jest.fn().mockResolvedValue({
        Title: 'Test Document',
        Author: 'Test Author',
        CreationDate: new Date(),
        ModificationDate: new Date(),
      }),
      getPageCount: jest.fn().mockReturnValue(2),
      save: jest.fn().mockResolvedValue(new Uint8Array(8)),
    };

    mockPDFDocument.load.mockResolvedValue(mockPDFLibDoc as any);
  });

  describe('basic extraction', () => {
    it('should extract text content from PDF', async () => {
      const result = await extractor.extract(mockBuffer, defaultOptions);

      expect(result.text).toBe('Hello World\n\nHello World');
      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].text).toBe('Hello World');
    });

    it('should extract metadata', async () => {
      const result = await extractor.extract(mockBuffer, defaultOptions);

      expect(result.metadata).toMatchObject({
        format: 'pdf',
        title: 'Test Document',
        author: 'Test Author',
        pageCount: 2,
      });
    });

    it('should handle extraction errors gracefully', async () => {
      mockPDFDocument.load.mockRejectedValue(new Error('PDF load failed'));

      await expect(extractor.extract(mockBuffer, defaultOptions))
        .rejects.toThrow('PDF load failed');
    });
  });

  describe('image extraction', () => {
    it('should extract images when requested', async () => {
      const result = await extractor.extract(mockBuffer, { ...defaultOptions, extractImages: true });

      expect(result.pages[0].images).toBeDefined();
      expect(result.pages[0].images).toHaveLength(1);
      expect(result.pages[0].images[0]).toMatchObject({
        format: 'image/jpeg',
        location: {
          width: 100,
          height: 100,
        },
      });
    });

    it('should skip image extraction when not requested', async () => {
      const result = await extractor.extract(mockBuffer, { ...defaultOptions, extractImages: false });

      expect(result.pages[0].images).toBeUndefined();
    });

    it('should handle image extraction errors', async () => {
      const mockPage = {
        getTextContent: jest.fn().mockResolvedValue({ items: [] }),
        getOperatorList: jest.fn().mockResolvedValue({
          fnArray: [pdfjs.OPS.paintImageXObject],
          argsArray: [['img1']],
        }),
        objs: {
          get: jest.fn().mockRejectedValue(new Error('Image extraction failed')),
        },
      };

      mockPDFJS.getDocument.mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: jest.fn().mockResolvedValue(mockPage),
        }),
      } as any);

      const result = await extractor.extract(mockBuffer, defaultOptions);
      expect(result.pages[0].images).toHaveLength(0);
    });
  });

  describe('table extraction', () => {
    it('should attempt table extraction when requested', async () => {
      const result = await extractor.extract(mockBuffer, { ...defaultOptions, extractTables: true });

      expect(result.tables).toBeDefined();
      expect(Array.isArray(result.tables)).toBe(true);
    });

    it('should skip table extraction when not requested', async () => {
      const result = await extractor.extract(mockBuffer, { ...defaultOptions, extractTables: false });

      expect(result.tables).toBeUndefined();
    });
  });

  describe('language detection', () => {
    it('should attempt language detection when requested', async () => {
      const result = await extractor.extract(mockBuffer, { ...defaultOptions, detectLanguage: true });

      // Currently returns undefined as it's not implemented
      expect(result.language).toBeUndefined();
    });

    it('should skip language detection when not requested', async () => {
      const result = await extractor.extract(mockBuffer, { ...defaultOptions, detectLanguage: false });

      expect(result.language).toBeUndefined();
    });
  });

  describe('format support', () => {
    it('should support PDF format', () => {
      expect(extractor.supports('pdf')).toBe(true);
    });

    it('should not support other formats', () => {
      expect(extractor.supports('docx')).toBe(false);
      expect(extractor.supports('csv')).toBe(false);
      expect(extractor.supports('image')).toBe(false);
    });
  });
}); 