import { BaseExtractor } from './BaseExtractor';
import {
  ExtractedContent,
  ExtractedTable,
  ExtractedPage,
  ExtractedImage,
  PageLayout,
} from './types';
import { parse, Parser } from 'csv-parse';
import { detect } from 'jschardet';
import iconv from 'iconv-lite';
import { v4 as uuidv4 } from 'uuid';

interface CSVParseOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  columns?: boolean | string[];
  skipEmptyLines?: boolean;
  skipRows?: number;
  maxRows?: number;
  encoding?: string;
  trim?: boolean;
}

export class CSVExtractor extends BaseExtractor {
  private readonly defaultOptions: Required<CSVParseOptions> = {
    delimiter: ',',
    quote: '"',
    escape: '"',
    columns: true,
    skipEmptyLines: true,
    skipRows: 0,
    maxRows: Infinity,
    encoding: 'utf-8',
    trim: true,
  };

  constructor(options = {}) {
    super(options);
  }

  async extract(file: Buffer): Promise<ExtractedContent> {
    try {
      const startTime = Date.now();

      // Detect encoding
      const encoding = this.detectEncoding(file);
      const content = iconv.decode(file, encoding);

      // Parse CSV
      const records = await this.parseCSV(content, {
        ...this.defaultOptions,
        encoding,
      });

      // Convert to table format
      const table = this.convertToTable(records);

      // Create page with table
      const page: ExtractedPage = {
        pageNumber: 1,
        text: this.convertToText(records),
        tables: [table],
      };

      const result: ExtractedContent = {
        text: page.text,
        metadata: {
          encoding,
          rowCount: records.length,
          columnCount: table.headers?.length || 0,
          delimiter: this.detectDelimiter(content),
        },
        pages: [page],
        tables: [table],
        images: [],
        confidence: 1,
      };

      this.validateExtraction(result);

      this.logger.info('CSV extraction completed', {
        duration: Date.now() - startTime,
        rows: records.length,
        columns: table.headers?.length,
      });

      return result;
    } catch (error) {
      this.logger.error('CSV extraction failed', { error });
      throw error;
    }
  }

  private detectEncoding(file: Buffer): string {
    try {
      const result = detect(file);
      return result.encoding || this.defaultOptions.encoding;
    } catch {
      return this.defaultOptions.encoding;
    }
  }

  private detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(d => ({
      delimiter: d,
      count: (firstLine.match(new RegExp(d, 'g')) || []).length,
    }));

    const mostLikely = counts.reduce((max, curr) => 
      curr.count > max.count ? curr : max
    );

    return mostLikely.count > 0 ? mostLikely.delimiter : this.defaultOptions.delimiter;
  }

  private async parseCSV(
    content: string,
    options: CSVParseOptions
  ): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const records: Record<string, string>[] = [];
      const parser = parse({
        ...options,
        delimiter: this.detectDelimiter(content),
      });

      parser.on('readable', () => {
        let record;
        while ((record = parser.read()) !== null) {
          records.push(record);
        }
      });

      parser.on('error', (err) => {
        reject(err);
      });

      parser.on('end', () => {
        resolve(records);
      });

      parser.write(content);
      parser.end();
    });
  }

  private convertToTable(records: Record<string, string>[]): ExtractedTable {
    if (records.length === 0) {
      return {
        id: uuidv4(),
        headers: [],
        rows: [],
        confidence: 1,
      };
    }

    const headers = Object.keys(records[0]);
    const rows = records.map(record => 
      headers.map(header => record[header])
    );

    return {
      id: uuidv4(),
      headers,
      rows,
      confidence: 1,
    };
  }

  private convertToText(records: Record<string, string>[]): string {
    if (records.length === 0) return '';

    const headers = Object.keys(records[0]);
    const headerRow = headers.join('\t');
    const dataRows = records.map(record => 
      headers.map(header => record[header]).join('\t')
    );

    return [headerRow, ...dataRows].join('\n');
  }

  protected async extractText(page: unknown): Promise<string> {
    // Not used for CSV - text extraction is handled in main extract method
    return '';
  }

  protected async extractTables(page: unknown): Promise<ExtractedTable[]> {
    // Not used for CSV - table extraction is handled in main extract method
    return [];
  }

  protected async extractImages(page: unknown): Promise<ExtractedImage[]> {
    // CSV files don't contain images
    return [];
  }

  protected async extractLayout(page: unknown): Promise<PageLayout | undefined> {
    // CSV files don't have layout information
    return undefined;
  }

  private validateCSVStructure(records: Record<string, string>[]): void {
    if (records.length === 0) {
      throw new Error('Empty CSV file');
    }

    const headers = Object.keys(records[0]);
    if (headers.length === 0) {
      throw new Error('No columns found in CSV');
    }

    // Check for consistent column count
    const isValid = records.every(record => 
      Object.keys(record).length === headers.length
    );

    if (!isValid) {
      throw new Error('Inconsistent column count in CSV');
    }
  }
} 