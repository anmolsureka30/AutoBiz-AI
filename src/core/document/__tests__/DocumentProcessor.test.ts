import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DocumentProcessor } from '../DocumentProcessor';
import { 
  DocumentValidator, 
  ContentExtractor,
  ProcessingOptions,
  ExtractedContent 
} from '../types';

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor;
  let mockValidator: jest.Mocked<DocumentValidator>;
  let mockExtractor: jest.Mocked<ContentExtractor>;

  const mockBuffer = Buffer.from('test document content');
  const mockOptions: ProcessingOptions = {};

  beforeEach(() => {
    processor = new DocumentProcessor();

    // Setup mock validator
    mockValidator = {
      validate: jest.fn().mockResolvedValue(true),
      getFormat: jest.fn().mockReturnValue('pdf'),
    };

    // Setup mock extractor
    mockExtractor = {
      extract: jest.fn().mockResolvedValue({
        text: 'Extracted text',
        metadata: {
          format: 'pdf',
          size: mockBuffer.length,
          hash: expect.any(String),
        },
      }),
      supports: jest.fn().mockReturnValue(true),
    };

    processor.registerValidator(mockValidator);
    processor.registerExtractor('pdf', mockExtractor);
  });

  describe('process', () => {
    it('should process document successfully', async () => {
      const result = await processor.process(mockBuffer, mockOptions);

      expect(result.content).toBeDefined();
      expect(result.content.text).toBe('Extracted text');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.memoryUsed).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle empty buffer', async () => {
      const result = await processor.process(Buffer.alloc(0));

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Empty document buffer provided');
    });

    it('should handle unsupported format', async () => {
      mockValidator.validate.mockResolvedValue(false);

      const result = await processor.process(mockBuffer);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Unsupported document format');
    });

    it('should handle extractor errors', async () => {
      mockExtractor.extract.mockRejectedValue(new Error('Extraction failed'));

      const result = await processor.process(mockBuffer);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Extraction failed');
    });
  });
}); 