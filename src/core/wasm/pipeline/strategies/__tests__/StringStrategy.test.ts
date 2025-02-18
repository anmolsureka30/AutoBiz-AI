import { describe, it, expect } from '@jest/globals';
import { StringStrategy } from '../StringStrategy';

describe('StringStrategy', () => {
  const strategy = new StringStrategy();

  const createTestString = (length: number): string => {
    return Array.from(
      { length }, 
      (_, i) => String.fromCharCode(97 + (i % 26))
    ).join('');
  };

  describe('split', () => {
    it('should split string into chunks of specified size', () => {
      const data = createTestString(1000);
      const chunks = strategy.split(data, 256);

      expect(chunks).toHaveLength(4);
      chunks.forEach(chunk => {
        const { data } = (strategy as any).extractHeaderAndData(chunk);
        expect(Buffer.from(data, 'utf8').length).toBeLessThanOrEqual(256);
      });
    });

    it('should handle multi-byte characters correctly', () => {
      const data = '🌟'.repeat(100); // Each emoji is 4 bytes
      const chunks = strategy.split(data, 256);
      const merged = strategy.merge(chunks);
      expect(merged).toBe(data);
    });

    it('should preserve string encoding', () => {
      const strategy = new StringStrategy({ encoding: 'base64' });
      const data = Buffer.from('test data').toString('base64');
      const chunks = strategy.split(data, 10);
      const merged = strategy.merge(chunks);
      expect(merged).toBe(data);
    });
  });

  describe('merge', () => {
    it('should correctly merge chunks back into original string', () => {
      const original = createTestString(1000);
      const chunks = strategy.split(original, 256);
      const merged = strategy.merge(chunks);
      expect(merged).toBe(original);
    });

    it('should handle chunks in any order', () => {
      const original = createTestString(1000);
      const chunks = strategy.split(original, 256);
      const shuffled = [...chunks].sort(() => Math.random() - 0.5);
      const merged = strategy.merge(shuffled);
      expect(merged).toBe(original);
    });

    it('should detect and reject invalid checksums', () => {
      const original = createTestString(1000);
      const chunks = strategy.split(original, 256);
      
      // Corrupt one chunk
      const { header, data } = (strategy as any).extractHeaderAndData(chunks[0]);
      const corruptedData = data.replace('a', 'b');
      const corruptedChunk = `${JSON.stringify(header).length}:${JSON.stringify(header)}${corruptedData}`;
      chunks[0] = corruptedChunk;

      expect(() => strategy.merge(chunks)).toThrow();
    });
  });

  describe('validate', () => {
    it('should validate correct strings', () => {
      const data = createTestString(1000);
      expect(strategy.validate(data)).toBe(true);
    });

    it('should reject empty strings', () => {
      expect(strategy.validate('')).toBe(false);
    });

    it('should reject invalid encodings', () => {
      const strategy = new StringStrategy({ encoding: 'utf8' });
      const invalidUtf8 = Buffer.from([0xFF, 0xFE, 0xFD]).toString('binary');
      expect(strategy.validate(invalidUtf8)).toBe(false);
    });
  });
}); 