import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DOCXExtractor } from '../DOCXExtractor';
import { Document, Paragraph, Table, Run, ImageRun } from 'docx';
import JSZip from 'jszip';

// Mock docx and jszip
jest.mock('docx');
jest.mock('jszip');

describe('DOCXExtractor', () => {
  let extractor: DOCXExtractor;
  let mockZip: jest.Mocked<JSZip>;
  let mockDocument: jest.Mocked<Document>;

  beforeEach(() => {
    extractor = new DOCXExtractor();
    mockDocument = {
      body: {
        children: [
          new Paragraph({
            children: [
              new Run({
                text: 'Sample Text',
              }),
            ],
          }),
        ],
      },
    } as unknown as jest.Mocked<Document>;

    mockZip = {
      loadAsync: jest.fn().mockResolvedValue({}),
      file: jest.fn().mockImplementation((path) => ({
        async: jest.fn().mockResolvedValue(
          path === 'word/document.xml' 
            ? '<?xml version="1.0"?><document>...</document>'
            : Buffer.from('dummy content')
        ),
      })),
      files: {
        'word/document.xml': {},
        'word/_rels/document.xml.rels': {},
        '[Content_Types].xml': {},
      },
    } as unknown as jest.Mocked<JSZip>;

    (JSZip as unknown as jest.Mock).mockImplementation(() => mockZip);
  });

  describe('basic extraction', () => {
    it('should extract text content from DOCX', async () => {
      const docxBuffer = Buffer.from('dummy DOCX content');
      const result = await extractor.extract(docxBuffer);

      expect(result.text).toBeTruthy();
      expect(result.pages).toBeDefined();
      expect(result.pages[0].text).toContain('Sample Text');
    });

    it('should handle empty DOCX', async () => {
      mockDocument.body.children = [];
      const docxBuffer = Buffer.from('empty DOCX');

      await expect(extractor.extract(docxBuffer)).rejects.toThrow('No content extracted');
    });
  });

  describe('table extraction', () => {
    beforeEach(() => {
      const mockTable = new Table({
        rows: [
          {
            cells: [{ content: 'Header 1' }, { content: 'Header 2' }],
            isHeader: true,
          },
          {
            cells: [{ content: 'Cell 1' }, { content: 'Cell 2' }],
          },
        ],
      });
      mockDocument.body.children.push(mockTable);
    });

    it('should extract tables', async () => {
      const docxBuffer = Buffer.from('DOCX with tables');
      const result = await extractor.extract(docxBuffer);

      expect(result.tables).toBeDefined();
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].headers).toEqual(['Header 1', 'Header 2']);
      expect(result.tables[0].rows).toHaveLength(1);
    });
  });

  describe('image extraction', () => {
    beforeEach(() => {
      mockZip.files['word/media/image1.png'] = {
        async: jest.fn().mockResolvedValue(Buffer.from('fake image data')),
      };
    });

    it('should extract images when enabled', async () => {
      const docxBuffer = Buffer.from('DOCX with images');
      const result = await extractor.extract(docxBuffer);

      expect(result.images).toBeDefined();
      expect(result.images).toHaveLength(1);
      expect(result.images[0].mimeType).toBe('image/png');
    });
  });

  describe('error handling', () => {
    it('should handle invalid DOCX files', async () => {
      mockZip.loadAsync.mockRejectedValue(new Error('Invalid DOCX'));
      const docxBuffer = Buffer.from('invalid DOCX content');

      await expect(extractor.extract(docxBuffer)).rejects.toThrow('Invalid DOCX');
    });

    it('should handle missing document.xml', async () => {
      mockZip.file.mockReturnValue(null);
      const docxBuffer = Buffer.from('DOCX without document.xml');

      await expect(extractor.extract(docxBuffer)).rejects.toThrow('missing document.xml');
    });
  });

  describe('performance', () => {
    it('should handle large DOCX files efficiently', async () => {
      // Create a large document with many paragraphs
      mockDocument.body.children = Array.from({ length: 1000 }, () => 
        new Paragraph({
          children: [new Run({ text: 'Sample paragraph content' })],
        })
      );

      const docxBuffer = Buffer.from('large DOCX content');
      const startTime = Date.now();
      const result = await extractor.extract(docxBuffer);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // Should process within 2 seconds
      expect(result.text.length).toBeGreaterThan(1000);
    });

    it('should maintain stable memory usage', async () => {
      mockDocument.body.children = Array.from({ length: 500 }, () => 
        new Paragraph({
          children: [new Run({ text: 'Sample paragraph content' })],
        })
      );

      const docxBuffer = Buffer.from('medium DOCX content');
      const initialMemory = process.memoryUsage().heapUsed;
      await extractor.extract(docxBuffer);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });
}); 