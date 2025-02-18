import { Logger } from '../../utils/logger/Logger';

interface ImageSignature {
  format: string;
  signature: number[];
  offset?: number;
}

export class ImageFormatDetector {
  private readonly logger: Logger;
  private readonly signatures: ImageSignature[] = [
    { format: 'image/jpeg', signature: [0xFF, 0xD8, 0xFF] },
    { format: 'image/png', signature: [0x89, 0x50, 0x4E, 0x47] },
    { format: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38] },
    { format: 'image/webp', signature: [0x52, 0x49, 0x46, 0x46], offset: 8 },
    { format: 'image/tiff', signature: [0x49, 0x49, 0x2A, 0x00] },
    { format: 'image/bmp', signature: [0x42, 0x4D] },
  ];

  constructor() {
    this.logger = new Logger('ImageFormatDetector');
  }

  detectFormat(buffer: Buffer): string {
    try {
      for (const { format, signature, offset = 0 } of this.signatures) {
        if (this.matchesSignature(buffer, signature, offset)) {
          return format;
        }
      }

      return 'application/octet-stream';
    } catch (error) {
      this.logger.error('Image format detection failed', { error });
      return 'application/octet-stream';
    }
  }

  private matchesSignature(buffer: Buffer, signature: number[], offset: number): boolean {
    if (buffer.length < signature.length + offset) {
      return false;
    }

    return signature.every((byte, index) => buffer[index + offset] === byte);
  }
} 