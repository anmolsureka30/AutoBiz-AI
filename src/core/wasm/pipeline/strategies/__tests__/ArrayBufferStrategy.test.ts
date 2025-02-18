import { describe, it, expect } from '@jest/globals';
import { ArrayBufferStrategy } from '../ArrayBufferStrategy';

describe('ArrayBufferStrategy', () => {
  const strategy = new ArrayBufferStrategy();

  const createTestData = (size: number): ArrayBuffer => {
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    return data.buffer;
  };

  describe('split', () => {
    it('should split data into chunks of specified size', () => {
      const data = createTestData(1000);
      const chunks = strategy.split(data, 256);

      expect(chunks).toHaveLength(4);
      chunks.forEach(chunk => {
        expect(chunk.byteLength).toBeLessThanOrEqual(256);
      });
    });

    it('should include valid headers in chunks', () => {
      const data = createTestData(500);
      const chunks = strategy.split(data, 100);

      chunks.forEach((chunk, index) => {
        const { header } = (strategy as any).extractHeaderAndData(chunk);
        expect(header.metadata.index).toBe(index);
        expect(header.metadata.total).toBe(chunks.length);
        expect(header.checksum).toBeTruthy();
      });
    });
  });

  describe('merge', () => {
    it('should correctly merge chunks back into original data', () => {
      const original = createTestData(1000);
      const chunks = strategy.split(original, 256);
      const merged = strategy.merge(chunks);

      expect(new Uint8Array(merged)).toEqual(new Uint8Array(original));
    });

    it('should handle chunks in any order', () => {
      const original = createTestData(1000);
      const chunks = strategy.split(original, 256);
      const shuffled = [...chunks].sort(() => Math.random() - 0.5);
      const merged = strategy.merge(shuffled);

      expect(new Uint8Array(merged)).toEqual(new Uint8Array(original));
    });

    it('should detect and reject invalid checksums', () => {
      const original = createTestData(1000);
      const chunks = strategy.split(original, 256);
      
      // Corrupt one chunk
      const corrupted = new Uint8Array(chunks[0]);
      corrupted[corrupted.length - 1] ^= 0xFF;
      chunks[0] = corrupted.buffer;

      expect(() => strategy.merge(chunks)).toThrow();
    });
  });

  describe('validate', () => {
    it('should validate correct data', () => {
      const data = createTestData(1000);
      expect(strategy.validate(data)).toBe(true);
    });

    it('should reject empty data', () => {
      expect(strategy.validate(new ArrayBuffer(0))).toBe(false);
    });

    it('should reject corrupted data', () => {
      const data = createTestData(1000);
      const view = new Uint8Array(data);
      view[500] ^= 0xFF;
      expect(strategy.validate(data)).toBe(false);
    });
  });
}); 