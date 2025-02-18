export enum DocumentType {
  PDF = 'pdf',
  DOCX = 'docx',
  CSV = 'csv',
  TXT = 'txt',
  UNKNOWN = 'unknown'
}

export type DocumentFormat = 'pdf' | 'docx' | 'csv' | 'image';

export interface DocumentMetadata {
  type: DocumentType;
  size: number;
  created: Date;
  modified: Date;
  pages?: number;
  author?: string;
  title?: string;
  keywords?: string[];
  language?: string;
  encoding?: string;
  mimeType: string;
  hash: string;
  format: DocumentFormat;
  createdAt?: Date;
  modifiedAt?: Date;
  pageCount?: number;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  validate: (file: Buffer, metadata: Partial<DocumentMetadata>) => Promise<ValidationResult>;
  severity: 'error' | 'warning';
  category: 'security' | 'format' | 'content' | 'metadata';
}

export interface ValidationResult {
  valid: boolean;
  rule: string;
  details?: string;
  error?: Error;
}

export interface ValidationReport {
  valid: boolean;
  metadata: Partial<DocumentMetadata>;
  results: ValidationResult[];
  errors: ValidationResult[];
  warnings: ValidationResult[];
  timestamp: Date;
}

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: DocumentType[];
  requiredMetadata?: (keyof DocumentMetadata)[];
  customRules?: ValidationRule[];
  skipRules?: string[];
  strict?: boolean;
}

export interface ExtractedContent {
  text: string;
  metadata: DocumentMetadata;
  pages?: Array<{
    number: number;
    text: string;
    images?: Array<{
      data: Buffer;
      format: string;
      location: { x: number; y: number; width: number; height: number };
    }>;
  }>;
  tables?: Array<{
    headers: string[];
    rows: string[][];
    pageNumber?: number;
  }>;
  language?: string;
  confidence?: number;
}

export interface ProcessingOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  detectLanguage?: boolean;
  maxPageSize?: number;
  timeout?: number;
  useWasm?: boolean;
  useWorkers?: boolean;
  workerCount?: number;
}

export interface ProcessingResult {
  content: ExtractedContent;
  vectors?: number[][];
  error?: Error;
  processingTime: number;
  memoryUsed: number;
}

export interface DocumentValidator {
  validate(buffer: Buffer): Promise<boolean>;
  getFormat(): DocumentFormat;
}

export interface ContentExtractor {
  extract(buffer: Buffer, options: ProcessingOptions): Promise<ExtractedContent>;
  supports(format: DocumentFormat): boolean;
} 