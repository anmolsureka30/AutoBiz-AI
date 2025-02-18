import { BaseAgent } from '../base/BaseAgent';
import { ProcessResult } from '../base/types';
import { Document, Summary, DocumentProcessingConfig } from './types';

export class SummarizationAgent extends BaseAgent {
  private readonly config: DocumentProcessingConfig;

  constructor(config: DocumentProcessingConfig) {
    super(config);
    this.config = config;
  }

  async process(document: Document): Promise<ProcessResult<Summary>> {
    const startTime = Date.now();

    try {
      this.state.status = 'processing';
      await this.validateInput(document);

      // Extract and preprocess text
      const preprocessedText = await this.preprocessDocument(document);

      // Generate summary using WASM module
      const summaryData = await this.model.execute<{
        content: string;
        keyPoints: string[];
        confidence: number;
      }>('summarize', preprocessedText, {
        maxLength: this.config.maxSummaryLength,
        targetLang: this.config.targetLanguage,
      });

      const summary: Summary = {
        id: crypto.randomUUID(),
        documentId: document.id,
        content: summaryData.content,
        keyPoints: summaryData.keyPoints,
        confidence: summaryData.confidence,
        created: new Date(),
        metadata: {
          originalLanguage: document.metadata.language,
          processingConfig: this.config,
        },
      };

      const result: ProcessResult<Summary> = {
        success: true,
        data: summary,
        processingTime: Date.now() - startTime,
        metadata: {
          documentSize: document.metadata.size,
          summaryLength: summary.content.length,
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
          documentSize: document.metadata.size,
        },
      };
    }
  }

  private async preprocessDocument(document: Document): Promise<string> {
    // Remove unnecessary whitespace and normalize text
    let text = document.content.trim().replace(/\s+/g, ' ');

    // Handle different document types
    switch (document.metadata.type.toLowerCase()) {
      case 'pdf':
        text = await this.cleanPDFText(text);
        break;
      case 'html':
        text = await this.cleanHTMLText(text);
        break;
      // Add more document type handling as needed
    }

    return text;
  }

  private async cleanPDFText(text: string): Promise<string> {
    // Remove PDF-specific artifacts
    return text
      .replace(/\f/g, '\n') // Form feed to newline
      .replace(/([^\n])-\n([^\n])/g, '$1$2') // Join hyphenated words
      .replace(/\n{3,}/g, '\n\n'); // Normalize multiple newlines
  }

  private async cleanHTMLText(text: string): Promise<string> {
    // Remove HTML tags and decode entities
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, ' ')
      .trim();
  }

  protected async updateModel(feedback: Feedback): Promise<void> {
    if (feedback.score < 0.7) {
      // Log low performance for analysis
      this.logger.warn('Low summary quality detected', {
        taskId: feedback.taskId,
        score: feedback.score,
        comments: feedback.comments,
      });
    }

    // Update model weights using feedback
    await this.model.execute<void>('updateWeights', {
      feedback: feedback.score,
      learningRate: this.config.learningRate,
    });
  }
} 