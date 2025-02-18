import { AgentMessage, AgentConfig } from '../base/types';
import { Buffer } from 'buffer';

export interface Document {
  id: string;
  content: string;
  metadata: {
    title?: string;
    type: string;
    language?: string;
    created: Date;
    lastModified: Date;
    size: number;
  };
}

export interface Summary {
  id: string;
  documentId: string;
  content: string;
  keyPoints: string[];
  confidence: number;
  created: Date;
  metadata?: Record<string, unknown>;
}

export interface DocumentProcessingConfig extends AgentConfig {
  maxSummaryLength?: number;
  targetLanguage?: string;
  preserveFormatting?: boolean;
  extractKeyPoints?: boolean;
}

export type DocumentType = 'text' | 'pdf' | 'docx' | 'html';
export type ProcessingStage = 'extraction' | 'analysis' | 'validation' | 'complete';

export interface DocumentMetadata {
  filename: string;
  type: DocumentType;
  size: number;
  pageCount?: number;
  createdAt: Date;
  modifiedAt: Date;
  hash: string;
}

export interface ProcessingOptions {
  extractImages?: boolean;
  extractTables?: boolean;
  preserveFormatting?: boolean;
  language?: string;
  maxPages?: number;
  timeout?: number;
}

export interface DocumentContent {
  text: string;
  images?: {
    data: Buffer;
    metadata: {
      format: string;
      width: number;
      height: number;
      location: { page: number; bbox: number[] };
    };
  }[];
  tables?: {
    data: string[][];
    metadata: {
      rowCount: number;
      columnCount: number;
      location: { page: number; bbox: number[] };
    };
  }[];
  metadata: DocumentMetadata;
}

export interface ProcessingProgress {
  stage: ProcessingStage;
  progress: number;
  currentPage?: number;
  totalPages?: number;
  startTime: Date;
  estimatedTimeRemaining?: number;
}

export interface DocumentProcessingRequest extends AgentMessage {
  type: 'document_processing_request';
  payload: {
    documentId: string;
    content: Buffer | string;
    metadata: DocumentMetadata;
    options?: ProcessingOptions;
  };
}

export interface DocumentProcessingResponse extends AgentMessage {
  type: 'document_processing_response';
  payload: {
    documentId: string;
    content: DocumentContent;
    processingTime: number;
    status: 'success' | 'partial' | 'failed';
    error?: string;
  };
}

export interface ProcessingError extends Error {
  code: string;
  documentId: string;
  stage: ProcessingStage;
  details?: Record<string, unknown>;
} 