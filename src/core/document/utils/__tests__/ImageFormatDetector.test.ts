import { describe, it, expect, beforeEach } from '@jest/globals';
import { ImageFormatDetector } from '../ImageFormatDetector';

describe('ImageFormatDetector', () => {
  let detector: ImageFormatDetector;

  beforeEach(() => {
    detector = new ImageFormatDetector();
  });

  it('should detect JPEG format', () => {
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    expect(detector.detectFormat(buffer)).toBe('image/jpeg');
  });

  it('should detect PNG format', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A]);
    expect(detector.detectFormat(buffer)).toBe('image/png');
  });

  it('should handle unknown format', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00]);
    expect(detector.detectFormat(buffer)).toBe('application/octet-stream');
  });

  it('should handle empty buffer', () => {
    const buffer = Buffer.alloc(0);
    expect(detector.detectFormat(buffer)).toBe('application/octet-stream');
  });
}); 