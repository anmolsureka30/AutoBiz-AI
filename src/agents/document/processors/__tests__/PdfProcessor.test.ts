import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { PdfProcessor } from '../PdfProcessor';
import { Logger } from '../../../../utils/logger';
import { DocumentMetadata } from '../../types';
import * as pdfjsLib from 'pdfjs-dist';

type MockLogger = {
  info: jest.Mock;
  error: jest.Mock;
};

describe('PdfProcessor', () => {
  let processor: PdfProcessor;
  let mockLogger: MockLogger;

  const testMetadata: DocumentMetadata = {
    filename: 'test.pdf',
    type: 'pdf',
    size: 1000,
    createdAt: new Date(),
    modifiedAt: new Date(),
    hash: 'test-hash'
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    processor = new PdfProcessor(mockLogger as Logger);
  });

  it('should extract text content from PDF', async () => {
    const mockPage = {
      getTextContent: jest.fn().mockResolvedValue({
        items: [
          { str: 'Hello' },
          { str: 'World' }
        ]
      }),
      getOperatorList: jest.fn().mockResolvedValue({
        fnArray: [],
        argsArray: []
      })
    };

    const mockDoc = {
      numPages: 1,
      getPage: jest.fn().mockResolvedValue(mockPage)
    };

    jest.spyOn(pdfjsLib, 'getDocument').mockReturnValue({
      promise: Promise.resolve(mockDoc)
    } as any);

    const result = await processor.extractContent(
      Buffer.from('test'),
      testMetadata
    );

    expect(result.text).toBe('Hello World');
    expect(result.metadata.pageCount).toBe(1);
  });

  it('should handle PDF extraction errors', async () => {
    jest.spyOn(pdfjsLib, 'getDocument').mockImplementation(() => {
      throw new Error('PDF load failed');
    });

    await expect(processor.extractContent(
      Buffer.from('test'),
      testMetadata
    )).rejects.toThrow('PDF load failed');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'PDF extraction failed'
      })
    );
  });

  it('should respect maxPages option', async () => {
    const mockPage = {
      getTextContent: jest.fn().mockResolvedValue({
        items: [{ str: 'Page content' }]
      }),
      getOperatorList: jest.fn().mockResolvedValue({
        fnArray: [],
        argsArray: []
      })
    };

    const mockDoc = {
      numPages: 3,
      getPage: jest.fn().mockResolvedValue(mockPage)
    };

    jest.spyOn(pdfjsLib, 'getDocument').mockReturnValue({
      promise: Promise.resolve(mockDoc)
    } as any);

    const result = await processor.extractContent(
      Buffer.from('test'),
      testMetadata,
      { maxPages: 2 }
    );

    expect(mockDoc.getPage).toHaveBeenCalledTimes(2);
    expect(result.metadata.pageCount).toBe(3);
  });
}); 