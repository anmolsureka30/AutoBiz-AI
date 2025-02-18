import { DocumentValidator, DocumentFormat } from '../types';
import { Logger } from '../../utils/logger/Logger';
import { PDFDocument } from 'pdf-lib';

export class PDFValidator implements DocumentValidator {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('PDFValidator');
  }

  async validate(buffer: Buffer): Promise<boolean> {
    try {
      // Attempt to load and parse the PDF
      const pdfDoc = await PDFDocument.load(buffer, {
        updateMetadata: false,
        ignoreEncryption: true,
      });

      // Basic validation checks
      const pageCount = pdfDoc.getPageCount();
      if (pageCount === 0) {
        this.logger.warn('PDF document contains no pages');
        return false;
      }

      // Check for basic PDF structure
      const [major, minor] = pdfDoc.getVersion();
      if (major < 1 || (major === 1 && minor < 0)) {
        this.logger.warn('Invalid PDF version', { version: `${major}.${minor}` });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.debug('PDF validation failed', { error });
      return false;
    }
  }

  getFormat(): DocumentFormat {
    return 'pdf';
  }
} 