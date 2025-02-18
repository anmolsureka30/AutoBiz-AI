import { describe, it, expect, beforeEach } from '@jest/globals';
import { TableExtractor } from '../TableExtractor';

describe('TableExtractor', () => {
  let extractor: TableExtractor;

  beforeEach(() => {
    extractor = new TableExtractor();
  });

  it('should detect and extract simple tables', () => {
    const textItems = [
      // Header row
      { str: 'Name', transform: [0, 0, 0, 0, 10, 100], width: 30 },
      { str: 'Age', transform: [0, 0, 0, 0, 50, 100], width: 20 },
      { str: 'City', transform: [0, 0, 0, 0, 80, 100], width: 30 },
      // Data row 1
      { str: 'John', transform: [0, 0, 0, 0, 10, 80], width: 30 },
      { str: '25', transform: [0, 0, 0, 0, 50, 80], width: 20 },
      { str: 'NY', transform: [0, 0, 0, 0, 80, 80], width: 30 },
      // Data row 2
      { str: 'Jane', transform: [0, 0, 0, 0, 10, 60], width: 30 },
      { str: '30', transform: [0, 0, 0, 0, 50, 60], width: 20 },
      { str: 'LA', transform: [0, 0, 0, 0, 80, 60], width: 30 },
    ];

    const tables = extractor.extractTables(textItems);

    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Name', 'Age', 'City']);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0]).toEqual(['John', '25', 'NY']);
    expect(tables[0].rows[1]).toEqual(['Jane', '30', 'LA']);
  });

  it('should handle irregular spacing', () => {
    const textItems = [
      // Header row with irregular spacing
      { str: 'Col1', transform: [0, 0, 0, 0, 10, 100], width: 30 },
      { str: 'Col2', transform: [0, 0, 0, 0, 60, 100], width: 20 },
      { str: 'Col3', transform: [0, 0, 0, 0, 90, 100], width: 30 },
      // Data row with matching spacing
      { str: 'Data1', transform: [0, 0, 0, 0, 10, 80], width: 30 },
      { str: 'Data2', transform: [0, 0, 0, 0, 60, 80], width: 20 },
      { str: 'Data3', transform: [0, 0, 0, 0, 90, 80], width: 30 },
    ];

    const tables = extractor.extractTables(textItems);

    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Col1', 'Col2', 'Col3']);
    expect(tables[0].rows[0]).toEqual(['Data1', 'Data2', 'Data3']);
  });

  it('should ignore non-table content', () => {
    const textItems = [
      // Regular paragraph
      { str: 'This is not', transform: [0, 0, 0, 0, 10, 200], width: 50 },
      { str: 'a table.', transform: [0, 0, 0, 0, 70, 200], width: 40 },
      // Actual table
      { str: 'Header1', transform: [0, 0, 0, 0, 10, 100], width: 30 },
      { str: 'Header2', transform: [0, 0, 0, 0, 50, 100], width: 30 },
      { str: 'Value1', transform: [0, 0, 0, 0, 10, 80], width: 30 },
      { str: 'Value2', transform: [0, 0, 0, 0, 50, 80], width: 30 },
    ];

    const tables = extractor.extractTables(textItems);

    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Header1', 'Header2']);
    expect(tables[0].rows[0]).toEqual(['Value1', 'Value2']);
  });
}); 