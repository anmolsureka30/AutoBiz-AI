import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PDFValidator } from '../PDFValidator';
import { PDFDocument } from 'pdf-lib';

jest.mock('pdf-lib');

describe('PDFValidator', () => {
  let validator: PDFValidator;
  let mockPDFDocument: jest.Mocked<typeof PDFDocument>;

  beforeEach(() => {
    validator = new PDFValidator();
    mockPDFDocument = PDFDocument as jest.Mocked<typeof PDFDocument>;
  });

  it('should validate valid PDF', async () => {
    const mockDoc = {
      getPageCount: jest.fn().mockReturnValue(1),
      getVersion: jest.fn().mockReturnValue([1, 7]),
    };

    mockPDFDocument.load.mockResolvedValue(mockDoc as any);

    const result = await validator.validate(Buffer.from('mock pdf content'));
    expect(result).toBe(true);
  });

  it('should reject empty PDF', async () => {
    const mockDoc = {
      getPageCount: jest.fn().mockReturnValue(0),
      getVersion: jest.fn().mockReturnValue([1, 7]),
    };

    mockPDFDocument.load.mockResolvedValue(mockDoc as any);

    const result = await validator.validate(Buffer.from('mock pdf content'));
    expect(result).toBe(false);
  });

  it('should reject invalid PDF version', async () => {
    const mockDoc = {
      getPageCount: jest.fn().mockReturnValue(1),
      getVersion: jest.fn().mockReturnValue([0, 9]),
    };

    mockPDFDocument.load.mockResolvedValue(mockDoc as any);

    const result = await validator.validate(Buffer.from('mock pdf content'));
    expect(result).toBe(false);
  });

  it('should handle parsing errors', async () => {
    mockPDFDocument.load.mockRejectedValue(new Error('Invalid PDF'));

    const result = await validator.validate(Buffer.from('invalid content'));
    expect(result).toBe(false);
  });
}); 