import { WasmModuleConfig, WasmModuleType } from '../../types';

export interface TextChunk {
  id: string;
  text: string;
  start: number;
  end: number;
  metadata?: {
    type?: string;
    language?: string;
    confidence?: number;
    [key: string]: unknown;
  };
}

export interface TextProcessingConfig extends WasmModuleConfig {
  type: WasmModuleType.TextProcessing;
  options?: {
    chunkSize?: number;
    overlap?: number;
    preserveWhitespace?: boolean;
    preserveNewlines?: boolean;
    trimChunks?: boolean;
    language?: string;
    encoding?: string;
  };
}

export interface TextProcessingResult {
  chunks: TextChunk[];
  stats: {
    inputLength: number;
    chunkCount: number;
    averageChunkSize: number;
    processingTime: number;
    memoryUsed: number;
  };
  metadata: {
    language?: string;
    encoding?: string;
    confidence?: number;
    [key: string]: unknown;
  };
}

export interface NLPResult {
  tokens: string[];
  sentences: string[];
  paragraphs: string[];
  entities?: {
    text: string;
    type: string;
    start: number;
    end: number;
    confidence: number;
  }[];
  metadata: {
    language: string;
    confidence: number;
    processingTime: number;
  };
}

export interface TextProcessingError {
  code: string;
  message: string;
  details?: {
    position?: number;
    context?: string;
    cause?: string;
  };
} 