export interface ChunkMetadata {
  index: number;
  total: number;
  offset: number;
  size: number;
  hash?: string;
}

export interface ChunkHeader {
  metadata: ChunkMetadata;
  checksum?: string;
  compression?: 'none' | 'gzip' | 'deflate';
  encoding?: string;
}

export interface ValidatorConfig {
  validateChecksum?: boolean;
  validateOrder?: boolean;
  validateCompleteness?: boolean;
  validateSize?: boolean;
} 