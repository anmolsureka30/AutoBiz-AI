import { AgentConfig } from '../types';

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  language?: string;
  format?: string;
}

export interface Summary {
  text: string;
  keyPoints: string[];
  confidence: number;
  wordCount: number;
}

export interface DocumentProcessingConfig extends AgentConfig {
  maxLength?: number;
  minConfidence?: number;
  targetLanguage?: string;
  preserveFormatting?: boolean;
  extractKeyPoints?: boolean;
} 