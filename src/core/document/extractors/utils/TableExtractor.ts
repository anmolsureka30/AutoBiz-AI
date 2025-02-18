import { Logger } from '../../../utils/logger/Logger';

interface TextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

interface TableCell {
  text: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

interface TableCandidate {
  cells: TableCell[];
  rows: number;
  cols: number;
  confidence: number;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
}

export class TableExtractor {
  private readonly logger: Logger;
  private readonly minTableSize = 4; // Minimum cells to consider as table
  private readonly maxCellSpacing = 10; // Maximum space between cells in points
  private readonly minConfidence = 0.7; // Minimum confidence score to consider as table

  constructor() {
    this.logger = new Logger('TableExtractor');
  }

  extractTables(textItems: TextItem[]): Array<{
    headers: string[];
    rows: string[][];
  }> {
    try {
      // Group text items by vertical position (potential rows)
      const rows = this.groupTextItemsByRows(textItems);
      
      // Detect table candidates
      const candidates = this.detectTableCandidates(rows);
      
      // Convert candidates to structured tables
      return candidates
        .filter(candidate => candidate.confidence >= this.minConfidence)
        .map(candidate => this.structureTable(candidate));
    } catch (error) {
      this.logger.error('Table extraction failed', { error });
      return [];
    }
  }

  private groupTextItemsByRows(items: TextItem[]): TextItem[][] {
    const sortedItems = [...items].sort((a, b) => 
      a.transform[5] - b.transform[5]  // Sort by y-coordinate
    );

    const rows: TextItem[][] = [];
    let currentRow: TextItem[] = [];
    let lastY = sortedItems[0]?.transform[5];

    for (const item of sortedItems) {
      const y = item.transform[5];
      
      // If vertical distance is significant, start new row
      if (Math.abs(y - lastY) > this.maxCellSpacing) {
        if (currentRow.length > 0) {
          rows.push(currentRow);
          currentRow = [];
        }
      }
      
      currentRow.push(item);
      lastY = y;
    }

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    return rows;
  }

  private detectTableCandidates(rows: TextItem[][]): TableCandidate[] {
    const candidates: TableCandidate[] = [];
    let currentCandidate: TableCandidate | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isTableRow = this.isLikelyTableRow(row);

      if (isTableRow) {
        if (!currentCandidate) {
          currentCandidate = this.initializeCandidate(row);
        }
        this.addRowToCandidate(currentCandidate, row, i);
      } else if (currentCandidate) {
        if (currentCandidate.cells.length >= this.minTableSize) {
          candidates.push(currentCandidate);
        }
        currentCandidate = null;
      }
    }

    if (currentCandidate && currentCandidate.cells.length >= this.minTableSize) {
      candidates.push(currentCandidate);
    }

    return candidates;
  }

  private isLikelyTableRow(items: TextItem[]): boolean {
    if (items.length < 2) return false;

    // Check for regular spacing between items
    const spacings = [];
    for (let i = 1; i < items.length; i++) {
      const spacing = items[i].transform[0] - 
        (items[i-1].transform[0] + (items[i-1].width || 0));
      spacings.push(spacing);
    }

    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const variance = spacings.reduce((a, b) => a + Math.pow(b - avgSpacing, 2), 0) / spacings.length;

    // Low variance in spacing suggests table-like structure
    return variance < (avgSpacing * 0.5);
  }

  private initializeCandidate(row: TextItem[]): TableCandidate {
    return {
      cells: [],
      rows: 0,
      cols: row.length,
      confidence: 0,
      bounds: {
        left: Math.min(...row.map(item => item.transform[0])),
        top: Math.min(...row.map(item => item.transform[5])),
        right: Math.max(...row.map(item => item.transform[0] + (item.width || 0))),
        bottom: Math.max(...row.map(item => item.transform[5] - (item.height || 0))),
      },
    };
  }

  private addRowToCandidate(candidate: TableCandidate, row: TextItem[], rowIndex: number) {
    row.forEach((item, colIndex) => {
      candidate.cells.push({
        text: item.str,
        row: rowIndex,
        col: colIndex,
        rowSpan: 1,
        colSpan: 1,
      });
    });

    candidate.rows = Math.max(candidate.rows, rowIndex + 1);
    candidate.cols = Math.max(candidate.cols, row.length);
    
    // Update confidence based on alignment and spacing
    candidate.confidence = this.calculateConfidence(candidate);
  }

  private calculateConfidence(candidate: TableCandidate): number {
    let score = 0;

    // Check column alignment
    const colAlignments = new Array(candidate.cols).fill(0);
    candidate.cells.forEach(cell => {
      colAlignments[cell.col]++;
    });

    const avgAlignment = colAlignments.reduce((a, b) => a + b, 0) / colAlignments.length;
    const alignmentVariance = colAlignments.reduce((a, b) => 
      a + Math.pow(b - avgAlignment, 2), 0) / colAlignments.length;

    score += (1 - Math.min(alignmentVariance / avgAlignment, 1)) * 0.5;

    // Check row consistency
    const rowCounts = new Map<number, number>();
    candidate.cells.forEach(cell => {
      rowCounts.set(cell.row, (rowCounts.get(cell.row) || 0) + 1);
    });

    const consistentRows = Array.from(rowCounts.values())
      .filter(count => count === candidate.cols).length;
    
    score += (consistentRows / candidate.rows) * 0.5;

    return score;
  }

  private structureTable(candidate: TableCandidate): {
    headers: string[];
    rows: string[][];
  } {
    // Assume first row is headers
    const matrix: string[][] = Array(candidate.rows)
      .fill(null)
      .map(() => Array(candidate.cols).fill(''));

    candidate.cells.forEach(cell => {
      matrix[cell.row][cell.col] = cell.text;
    });

    return {
      headers: matrix[0],
      rows: matrix.slice(1),
    };
  }
} 