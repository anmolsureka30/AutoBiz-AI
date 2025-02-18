import { describe, it, expect } from '@jest/globals';
import { JsonStrategy } from '../JsonStrategy';

describe('JsonStrategy', () => {
  const strategy = new JsonStrategy();

  const createLargeObject = (depth: number, width: number): Record<string, unknown> => {
    if (depth === 0) {
      return { value: 'x'.repeat(width) };
    }
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < width; i++) {
      obj[`key${i}`] = createLargeObject(depth - 1, width);
    }
    return obj;
  };

  const createLargeArray = (size: number, itemSize: number): unknown[] => {
    return Array.from({ length: size }, (_, i) => ({
      id: i,
      data: 'x'.repeat(itemSize),
    }));
  };

  describe('split', () => {
    it('should split large objects into chunks', () => {
      const data = createLargeObject(2, 3);
      const chunks = strategy.split(data, 100);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        const { header, data } = (strategy as any).extractHeaderAndData(chunk);
        expect(JSON.stringify(data).length).toBeLessThanOrEqual(100);
        expect(header.metadata.size).toBeLessThanOrEqual(100);
      });
    });

    it('should split large arrays into chunks', () => {
      const data = createLargeArray(10, 50);
      const chunks = strategy.split(data, 100);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        const { data } = (strategy as any).extractHeaderAndData(chunk);
        if (Array.isArray(data)) {
          expect(JSON.stringify(data).length).toBeLessThanOrEqual(100);
        }
      });
    });

    it('should handle nested structures', () => {
      const data = {
        array: createLargeArray(5, 20),
        object: createLargeObject(1, 2),
      };
      const chunks = strategy.split(data, 100);

      expect(chunks.length).toBeGreaterThan(1);
      const paths = new Set(chunks.map((chunk: any) => chunk.path.join('.')));
      expect(paths.size).toBe(chunks.length);
    });

    it('should respect maximum depth', () => {
      const strategy = new JsonStrategy({ maxDepth: 2 });
      const deepObject = createLargeObject(3, 2);

      expect(() => strategy.split(deepObject, 100)).toThrow(/Maximum object depth exceeded/);
    });
  });

  describe('merge', () => {
    it('should correctly merge object chunks', () => {
      const original = createLargeObject(2, 2);
      const chunks = strategy.split(original, 100);
      const merged = strategy.merge(chunks);

      expect(merged).toEqual(original);
    });

    it('should correctly merge array chunks', () => {
      const original = createLargeArray(10, 30);
      const chunks = strategy.split(original, 100);
      const merged = strategy.merge(chunks);

      expect(merged).toEqual(original);
    });

    it('should handle chunks in any order', () => {
      const original = createLargeObject(2, 2);
      const chunks = strategy.split(original, 100);
      const shuffled = [...chunks].sort(() => Math.random() - 0.5);
      const merged = strategy.merge(shuffled);

      expect(merged).toEqual(original);
    });

    it('should detect and reject invalid checksums', () => {
      const original = createLargeObject(1, 2);
      const chunks = strategy.split(original, 100);
      
      // Corrupt one chunk
      const chunk = chunks[0] as any;
      chunk.data.value = 'corrupted';

      expect(() => strategy.merge(chunks)).toThrow(/Checksum mismatch/);
    });

    it('should detect duplicate paths', () => {
      const original = createLargeObject(1, 2);
      const chunks = strategy.split(original, 100);
      
      // Duplicate a chunk
      chunks.push(chunks[0]);

      expect(() => strategy.merge(chunks)).toThrow(/Duplicate paths detected/);
    });
  });

  describe('validate', () => {
    it('should validate valid JSON structures', () => {
      const data = createLargeObject(2, 2);
      expect(strategy.validate(data)).toBe(true);
    });

    it('should reject circular references', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(strategy.validate(circular)).toBe(false);
    });

    it('should reject objects exceeding max depth', () => {
      const strategy = new JsonStrategy({ maxDepth: 2 });
      const deepObject = createLargeObject(3, 1);
      expect(strategy.validate(deepObject)).toBe(false);
    });

    it('should handle primitive values', () => {
      expect(strategy.validate('string')).toBe(true);
      expect(strategy.validate(123)).toBe(true);
      expect(strategy.validate(null)).toBe(true);
      expect(strategy.validate(undefined)).toBe(false);
    });

    it('should validate complex nested structures', () => {
      const data = {
        array: createLargeArray(5, 10),
        object: createLargeObject(1, 2),
        mixed: [
          { a: 1 },
          [1, 2, 3],
          'string',
          null,
        ],
      };
      expect(strategy.validate(data)).toBe(true);
    });
  });

  describe('performance', () => {
    it('should handle large objects efficiently', () => {
      const start = Date.now();
      const largeObject = createLargeObject(3, 5);
      const chunks = strategy.split(largeObject, 1024);
      const merged = strategy.merge(chunks);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(merged).toEqual(largeObject);
    });

    it('should maintain reasonable memory usage', () => {
      const largeArray = createLargeArray(1000, 100);
      const initialMemory = process.memoryUsage().heapUsed;
      
      strategy.split(largeArray, 1024);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });
}); 