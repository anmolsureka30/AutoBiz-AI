import { WasmModuleConfig, WasmModuleType } from '../../types';

export interface DocumentStructure {
  type: 'paragraph' | 'heading' | 'list' | 'table' | 'image' | 'code' | 'quote';
  content: string;
  metadata: {
    level?: number; // For headings
    format?: string; // For images/code
    style?: Record<string, string>;
    confidence: number;
  };
  children?: DocumentStructure[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TableStructure {
  headers: string[];
  rows: string[][];
  metadata: {
    rowCount: number;
    columnCount: number;
    confidence: number;
    format?: string;
  };
}

export interface DocumentAnalysisConfig extends WasmModuleConfig {
  type: WasmModuleType.DocumentAnalysis;
  options?: {
    mode: 'fast' | 'accurate';
    minConfidence: number;
    enableOCR: boolean;
    detectTables: boolean;
    detectLists: boolean;
    preserveFormatting: boolean;
    language?: string;
    maxDepth?: number;
  };
}

export interface DocumentAnalysisResult {
  structure: DocumentStructure[];
  tables: TableStructure[];
  metadata: {
    pageCount: number;
    language: string;
    processingTime: number;
    confidence: number;
    warnings?: string[];
  };
  statistics: {
    paragraphCount: number;
    headingCount: number;
    tableCount: number;
    imageCount: number;
    listCount: number;
    wordCount: number;
    averageConfidence: number;
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  metadata?: {
    font?: string;
    fontSize?: number;
    style?: Record<string, string>;
  };
}

export interface DocumentAnalysisError {
  code: string;
  message: string;
  details?: {
    page?: number;
    element?: string;
    cause?: string;
  };
} 