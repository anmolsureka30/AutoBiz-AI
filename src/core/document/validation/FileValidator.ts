import { createHash } from 'crypto';
import { Logger } from '../../utils/logger/Logger';
import {
  DocumentType,
  DocumentMetadata,
  ValidationRule,
  ValidationResult,
  ValidationReport,
  FileValidationOptions,
} from '../types';
import { defaultValidationRules } from './rules';
import { detectDocumentType } from '../utils/typeDetection';
import { extractBasicMetadata } from '../utils/metadataExtractor';

export class FileValidator {
  private readonly logger: Logger;
  private readonly rules: Map<string, ValidationRule>;
  private readonly options: Required<FileValidationOptions>;

  constructor(options: FileValidationOptions = {}) {
    this.logger = new Logger('FileValidator');
    this.rules = new Map();
    this.options = {
      maxSize: options.maxSize ?? 100 * 1024 * 1024, // 100MB default
      allowedTypes: options.allowedTypes ?? Object.values(DocumentType),
      requiredMetadata: options.requiredMetadata ?? ['type', 'size', 'mimeType', 'hash'],
      customRules: options.customRules ?? [],
      skipRules: options.skipRules ?? [],
      strict: options.strict ?? false,
    };

    this.initializeRules();
  }

  private initializeRules(): void {
    // Add default rules
    for (const rule of defaultValidationRules) {
      if (!this.options.skipRules.includes(rule.id)) {
        this.rules.set(rule.id, rule);
      }
    }

    // Add custom rules
    for (const rule of this.options.customRules) {
      this.rules.set(rule.id, rule);
    }
  }

  async validate(file: Buffer): Promise<ValidationReport> {
    try {
      const startTime = Date.now();
      const results: ValidationResult[] = [];
      const metadata = await this.gatherMetadata(file);

      // Basic validation
      if (file.length > this.options.maxSize) {
        results.push({
          valid: false,
          rule: 'file-size',
          details: `File size ${file.length} exceeds maximum ${this.options.maxSize}`,
        });
      }

      if (!this.options.allowedTypes.includes(metadata.type!)) {
        results.push({
          valid: false,
          rule: 'file-type',
          details: `File type ${metadata.type} not allowed`,
        });
      }

      // Run all validation rules
      for (const rule of this.rules.values()) {
        try {
          const result = await rule.validate(file, metadata);
          results.push(result);
        } catch (error) {
          this.logger.error(`Rule ${rule.id} failed`, { error });
          if (this.options.strict) {
            throw error;
          }
          results.push({
            valid: false,
            rule: rule.id,
            error: error as Error,
          });
        }
      }

      // Check required metadata
      for (const field of this.options.requiredMetadata) {
        if (!(field in metadata)) {
          results.push({
            valid: false,
            rule: 'required-metadata',
            details: `Missing required metadata field: ${field}`,
          });
        }
      }

      const report: ValidationReport = {
        valid: results.every(r => r.valid),
        metadata,
        results,
        errors: results.filter(r => !r.valid && this.rules.get(r.rule)?.severity === 'error'),
        warnings: results.filter(r => !r.valid && this.rules.get(r.rule)?.severity === 'warning'),
        timestamp: new Date(),
      };

      this.logger.info('Validation completed', {
        duration: Date.now() - startTime,
        valid: report.valid,
        errors: report.errors.length,
        warnings: report.warnings.length,
      });

      return report;
    } catch (error) {
      this.logger.error('Validation failed', { error });
      throw error;
    }
  }

  private async gatherMetadata(file: Buffer): Promise<Partial<DocumentMetadata>> {
    const type = await detectDocumentType(file);
    const basicMetadata = await extractBasicMetadata(file);
    
    return {
      ...basicMetadata,
      type,
      size: file.length,
      hash: this.calculateHash(file),
      mimeType: this.getMimeType(type),
    };
  }

  private calculateHash(file: Buffer): string {
    return createHash('sha256').update(file).digest('hex');
  }

  private getMimeType(type: DocumentType): string {
    const mimeTypes: Record<DocumentType, string> = {
      [DocumentType.PDF]: 'application/pdf',
      [DocumentType.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      [DocumentType.CSV]: 'text/csv',
      [DocumentType.TXT]: 'text/plain',
      [DocumentType.UNKNOWN]: 'application/octet-stream',
    };
    return mimeTypes[type];
  }
} 