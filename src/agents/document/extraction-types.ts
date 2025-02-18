import { Document } from './types';

export interface Entity {
  id: string;
  type: EntityType;
  value: string;
  confidence: number;
  position: {
    start: number;
    end: number;
  };
  metadata?: Record<string, unknown>;
}

export type EntityType = 
  | 'person'
  | 'organization'
  | 'location'
  | 'date'
  | 'money'
  | 'percentage'
  | 'email'
  | 'phone'
  | 'custom';

export interface ExtractionResult {
  documentId: string;
  entities: Entity[];
  relationships: Relationship[];
  tables: TableData[];
  created: Date;
  metadata: {
    modelVersion: string;
    confidence: number;
    processingTime: number;
  };
}

export interface Relationship {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface TableData {
  id: string;
  headers: string[];
  rows: string[][];
  position: {
    pageNumber: number;
    bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  };
  confidence: number;
}

export interface ExtractionConfig extends DocumentProcessingConfig {
  entityTypes: EntityType[];
  minConfidence: number;
  extractTables: boolean;
  extractRelationships: boolean;
  customPatterns?: RegExp[];
} 