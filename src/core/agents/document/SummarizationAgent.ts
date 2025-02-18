import { BaseAgent, ProcessResult, Feedback } from '../types';
import { Document, Summary, DocumentProcessingConfig } from './types';
import { Logger } from '../../utils/logger/Logger';
import { Model } from '../../ml/Model';

export class SummarizationAgent implements BaseAgent<Document, Summary> {
  private readonly logger: Logger;
  private readonly config: DocumentProcessingConfig;
  private readonly model: Model;

  constructor(config: DocumentProcessingConfig) {
    this.logger = new Logger('SummarizationAgent');
    this.config = {
      maxLength: 1000,
      minConfidence: 0.7,
      ...config,
    };
    this.model = new Model(config.modelPath);
  }

  async process(document: Document): Promise<ProcessResult<Summary>> {
    const startTime = Date.now();

    try {
      // Validate input
      await this.validate(document);

      // Preprocess document
      const preprocessed = await this.preprocess(document);

      // Generate summary
      const summary = await this.generateSummary(preprocessed);

      // Extract key points if requested
      const keyPoints = this.config.extractKeyPoints
        ? await this.extractKeyPoints(preprocessed, summary.text)
        : [];

      const endTime = Date.now();

      return {
        success: true,
        data: {
          ...summary,
          keyPoints,
        },
        timing: {
          startTime,
          endTime,
          duration: endTime - startTime,
        },
        metrics: {
          confidence: summary.confidence,
          quality: this.assessQuality(summary),
          performance: this.calculatePerformance(startTime, endTime),
        },
      };
    } catch (error) {
      this.logger.error('Summarization failed', { error, documentId: document.id });
      
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Summarization failed'),
        timing: {
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
        },
      };
    }
  }

  async validate(document: Document): Promise<boolean> {
    if (!document.content) {
      throw new Error('Document content is required');
    }

    if (document.language && this.config.targetLanguage &&
        document.language !== this.config.targetLanguage) {
      throw new Error('Document language does not match target language');
    }

    return true;
  }

  protected async updateModel(feedback: Feedback): Promise<void> {
    if (feedback.score < 0.7) {
      this.logger.warn('Low summary quality detected', {
        taskId: feedback.taskId,
        score: feedback.score,
        comments: feedback.comments,
      });
    }

    await this.model.execute<void>('updateWeights', {
      feedback: feedback.score,
      learningRate: this.config.learningRate || 0.01,
    });
  }

  private async preprocess(document: Document): Promise<string> {
    // Implementation of document preprocessing
    return document.content;
  }

  private async generateSummary(text: string): Promise<Summary> {
    const result = await this.model.execute<Summary>('summarize', {
      text,
      maxLength: this.config.maxLength,
      minConfidence: this.config.minConfidence,
    });

    return result;
  }

  private async extractKeyPoints(text: string, summary: string): Promise<string[]> {
    const keyPoints = await this.model.execute<string[]>('extractKeyPoints', {
      text,
      summary,
    });

    return keyPoints;
  }

  private assessQuality(summary: Summary): number {
    // Implement quality assessment logic
    return summary.confidence;
  }

  private calculatePerformance(startTime: number, endTime: number): number {
    const duration = endTime - startTime;
    const baseline = 1000; // 1 second baseline
    return Math.min(1, baseline / duration);
  }

  async cleanup(): Promise<void> {
    await this.model.cleanup();
  }
} 