import { describe, it, expect, beforeEach } from '@jest/globals';
import { CSVExtractor } from '../CSVExtractor';
import { ExtractedContent } from '../types';

describe('CSVExtractor', () => {
  let extractor: CSVExtractor;

  beforeEach(() => {
    extractor = new CSVExtractor();
  });

  const createCSVBuffer = (content: string): Buffer => {
    return Buffer.from(content, 'utf-8');
  };

  describe('basic extraction', () => {
    it('should extract simple CSV content', async () => {
      const csv = createCSVBuffer(
        'name,age,city\nJohn,30,New York\nJane,25,London'
      );

      const result = await extractor.extract(csv);

      expect(result.text).toBeTruthy();
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].headers).toEqual(['name', 'age', 'city']);
      expect(result.tables[0].rows).toHaveLength(2);
    });

    it('should handle empty CSV', async () => {
      const csv = createCSVBuffer('');
      await expect(extractor.extract(csv)).rejects.toThrow('Empty CSV file');
    });

    it('should handle CSV with only headers', async () => {
      const csv = createCSVBuffer('name,age,city');
      const result = await extractor.extract(csv);

      expect(result.tables[0].headers).toEqual(['name', 'age', 'city']);
      expect(result.tables[0].rows).toHaveLength(0);
    });
  });

  describe('encoding detection', () => {
    it('should detect and handle UTF-8 encoding', async () => {
      const csv = createCSVBuffer('name,age\nJöhn,30\nMariá,25');
      const result = await extractor.extract(csv);

      expect(result.metadata.encoding).toBe('utf-8');
      expect(result.text).toContain('Jöhn');
      expect(result.text).toContain('Mariá');
    });

    it('should handle different delimiters', async () => {
      const csv = createCSVBuffer('name;age;city\nJohn;30;New York');
      const result = await extractor.extract(csv);

      expect(result.tables[0].headers).toEqual(['name', 'age', 'city']);
      expect(result.metadata.delimiter).toBe(';');
    });
  });

  describe('data validation', () => {
    it('should handle quoted values', async () => {
      const csv = createCSVBuffer(
        'name,description\nJohn,"Software Engineer, Senior"\nJane,"Product Manager, Lead"'
      );

      const result = await extractor.extract(csv);
      expect(result.tables[0].rows[0][1]).toBe('Software Engineer, Senior');
    });

    it('should handle inconsistent column counts', async () => {
      const csv = createCSVBuffer(
        'name,age,city\nJohn,30\nJane,25,London,UK'
      );

      await expect(extractor.extract(csv)).rejects.toThrow('Inconsistent column count');
    });
  });

  describe('performance', () => {
    it('should handle large CSV files efficiently', async () => {
      const rows = Array.from({ length: 10000 }, (_, i) => 
        `row${i},value${i},test${i}`
      );
      const csv = createCSVBuffer(
        `column1,column2,column3\n${rows.join('\n')}`
      );

      const startTime = Date.now();
      const result = await extractor.extract(csv);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should process within 1 second
      expect(result.tables[0].rows).toHaveLength(10000);
    });

    it('should maintain stable memory usage', async () => {
      const rows = Array.from({ length: 5000 }, (_, i) => 
        `row${i},value${i},test${i}`
      );
      const csv = createCSVBuffer(
        `column1,column2,column3\n${rows.join('\n')}`
      );

      const initialMemory = process.memoryUsage().heapUsed;
      await extractor.extract(csv);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });
  });
}); 