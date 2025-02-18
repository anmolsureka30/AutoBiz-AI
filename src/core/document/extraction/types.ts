export interface ExtractedContent {
  text: string;
  metadata: Record<string, unknown>;
  pages?: ExtractedPage[];
  tables?: ExtractedTable[];
  images?: ExtractedImage[];
  language?: string;
  confidence?: number;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  tables?: ExtractedTable[];
  images?: ExtractedImage[];
  layout?: PageLayout;
}

export interface ExtractedTable {
  id: string;
  pageNumber?: number;
  position?: TablePosition;
  headers?: string[];
  rows: string[][];
  confidence?: number;
}

export interface ExtractedImage {
  id: string;
  pageNumber?: number;
  position?: ImagePosition;
  mimeType: string;
  data: Buffer;
  alt?: string;
  confidence?: number;
}

export interface PageLayout {
  width: number;
  height: number;
  elements: LayoutElement[];
}

export interface LayoutElement {
  type: 'text' | 'table' | 'image' | 'heading' | 'list';
  bounds: BoundingBox;
  content?: string;
  confidence?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TablePosition extends BoundingBox {
  rotation?: number;
}

export interface ImagePosition extends BoundingBox {
  rotation?: number;
  scale?: number;
}

export interface ExtractionOptions {
  pages?: number[];
  includeTables?: boolean;
  includeImages?: boolean;
  includeLayout?: boolean;
  ocrConfig?: OCRConfig;
  language?: string[];
}

export interface OCRConfig {
  enabled: boolean;
  mode?: 'fast' | 'accurate';
  languages?: string[];
  dpi?: number;
  preprocessing?: ImagePreprocessing;
}

export interface ImagePreprocessing {
  grayscale?: boolean;
  denoise?: boolean;
  deskew?: boolean;
  threshold?: number;
} 