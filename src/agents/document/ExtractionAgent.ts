import { BaseAgent } from '../base/BaseAgent';
import { ProcessResult, Feedback } from '../base/types';
import { Document } from './types';
import { 
  ExtractionResult, 
  ExtractionConfig, 
  Entity,
  TableData,
  Relationship 
} from './extraction-types';

export class ExtractionAgent extends BaseAgent {
  private readonly config: ExtractionConfig;
  private readonly defaultConfig: Partial<ExtractionConfig> = {
    minConfidence: 0.6,
    extractTables: true,
    extractRelationships: true,
    entityTypes: ['person', 'organization', 'date', 'money'],
  };

  constructor(config: ExtractionConfig) {
    super(config);
    this.config = { ...this.defaultConfig, ...config };
  }

  async process(document: Document): Promise<ProcessResult<ExtractionResult>> {
    const startTime = Date.now();

    try {
      this.state.status = 'processing';
      await this.validateInput(document);

      // Preprocess the document
      const preprocessedText = await this.preprocessDocument(document);

      // Extract entities
      const entities = await this.extractEntities(preprocessedText);

      // Extract tables if configured
      const tables = this.config.extractTables 
        ? await this.extractTables(document)
        : [];

      // Extract relationships if configured
      const relationships = this.config.extractRelationships 
        ? await this.extractRelationships(entities)
        : [];

      const extractionResult: ExtractionResult = {
        documentId: document.id,
        entities,
        relationships,
        tables,
        created: new Date(),
        metadata: {
          modelVersion: await this.model.execute<string>('getVersion'),
          confidence: this.calculateOverallConfidence(entities, relationships, tables),
          processingTime: Date.now() - startTime,
        },
      };

      const result: ProcessResult<ExtractionResult> = {
        success: true,
        data: extractionResult,
        processingTime: Date.now() - startTime,
        metadata: {
          entityCount: entities.length,
          tableCount: tables.length,
          relationshipCount: relationships.length,
        },
      };

      await this.updateMetrics(result);
      this.state.status = 'idle';

      return result;

    } catch (error) {
      this.handleError(error as Error);
      
      return {
        success: false,
        error: error as Error,
        processingTime: Date.now() - startTime,
        metadata: {
          documentId: document.id,
        },
      };
    }
  }

  private async extractEntities(text: string): Promise<Entity[]> {
    const entities = await this.model.execute<Entity[]>('extractEntities', {
      text,
      entityTypes: this.config.entityTypes,
      minConfidence: this.config.minConfidence,
    });

    // Apply custom patterns if configured
    if (this.config.customPatterns) {
      const customEntities = await this.extractCustomEntities(text);
      entities.push(...customEntities);
    }

    return entities.filter(entity => entity.confidence >= this.config.minConfidence);
  }

  private async extractCustomEntities(text: string): Promise<Entity[]> {
    const customEntities: Entity[] = [];

    this.config.customPatterns?.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        customEntities.push({
          id: crypto.randomUUID(),
          type: 'custom',
          value: match[0],
          confidence: 1.0, // Custom patterns are considered exact matches
          position: {
            start: match.index,
            end: match.index + match[0].length,
          },
          metadata: {
            pattern: pattern.source,
          },
        });
      }
    });

    return customEntities;
  }

  private async extractTables(document: Document): Promise<TableData[]> {
    return this.model.execute<TableData[]>('extractTables', {
      document,
      minConfidence: this.config.minConfidence,
    });
  }

  private async extractRelationships(entities: Entity[]): Promise<Relationship[]> {
    return this.model.execute<Relationship[]>('extractRelationships', {
      entities,
      minConfidence: this.config.minConfidence,
    });
  }

  private calculateOverallConfidence(
    entities: Entity[],
    relationships: Relationship[],
    tables: TableData[]
  ): number {
    const confidences: number[] = [
      ...entities.map(e => e.confidence),
      ...relationships.map(r => r.confidence),
      ...tables.map(t => t.confidence),
    ];

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  protected async updateModel(feedback: Feedback): Promise<void> {
    if (feedback.score < 0.7) {
      this.logger.warn('Low extraction quality detected', {
        taskId: feedback.taskId,
        score: feedback.score,
        comments: feedback.comments,
      });
    }

    await this.model.execute<void>('updateExtractionModel', {
      feedback: feedback.score,
      learningRate: this.config.learningRate,
      metadata: feedback.metadata,
    });
  }
} 