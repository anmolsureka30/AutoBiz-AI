declare module 'pdf-lib' {
  export class PDFDocument {
    static load(data: Buffer | Uint8Array, options?: any): Promise<PDFDocument>;
    getPageCount(): number;
    getPage(index: number): PDFPage;
    getDocumentInfo(): Promise<PDFDocumentInfo>;
  }

  export class PDFPage {
    getSize(): { width: number; height: number };
    getTextContent(): Promise<PDFTextContent>;
    doc: {
      getOperatorList(): Promise<PDFOperatorList>;
    };
  }

  export interface PDFDocumentInfo {
    Title?: string;
    Author?: string;
    Subject?: string;
    Keywords?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: Date;
    ModificationDate?: Date;
    Trapped?: boolean;
  }

  export interface PDFTextContent {
    items: PDFTextItem[];
  }

  export interface PDFTextItem {
    str: string;
    transform: number[];
    width?: number;
    height?: number;
  }

  export interface PDFOperatorList {
    fnArray: number[];
    argsArray: any[];
  }
}

declare module 'pdfjs-dist' {
  export const OPS: {
    paintImageXObject: number;
    beginMarkedContent: number;
    setFont: number;
    showText: number;
    endMarkedContent: number;
  };
} 