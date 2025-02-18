import { WorkflowTemplate } from '../template-types';

export const documentAnalysisTemplate: WorkflowTemplate = {
  id: 'document-analysis-workflow',
  name: 'Document Analysis Workflow',
  description: 'Comprehensive document analysis including content extraction, classification, and sentiment analysis',
  version: '1.0.0',
  steps: [
    {
      templateId: 'content-extraction',
      name: 'Content Extraction',
      type: 'document_analysis',
      dependencies: [],
      description: 'Extract text and structured content from document',
      parameters: ['documentId', 'extractionConfig'],
      validation: {
        preconditions: ['document.size < 50MB', 'document.format in ["pdf", "docx", "txt"]'],
        timeout: 300000, // 5 minutes
      },
      config: {
        extractTables: true,
        extractImages: true,
        preserveFormatting: true,
      },
    },
    {
      templateId: 'document-classification',
      name: 'Document Classification',
      type: 'document_analysis',
      dependencies: ['content-extraction'],
      description: 'Classify document type and content categories',
      parameters: ['classificationModel'],
      validation: {
        timeout: 60000, // 1 minute
      },
      config: {
        modelType: 'multilabel',
        confidenceThreshold: 0.7,
      },
    },
    {
      templateId: 'sentiment-analysis',
      name: 'Sentiment Analysis',
      type: 'document_analysis',
      dependencies: ['content-extraction'],
      description: 'Analyze sentiment and emotional tone',
      parameters: ['languageCode'],
      config: {
        granularity: 'paragraph',
        aspects: ['tone', 'emotion', 'subjectivity'],
      },
    },
    {
      templateId: 'key-phrase-extraction',
      name: 'Key Phrase Extraction',
      type: 'document_analysis',
      dependencies: ['content-extraction', 'document-classification'],
      description: 'Extract key phrases and topics',
      config: {
        maxPhrases: 20,
        minRelevanceScore: 0.5,
      },
    },
  ],
  parameters: [
    {
      id: 'documentId',
      name: 'Document ID',
      type: 'string',
      description: 'ID of the document to analyze',
      required: true,
    },
    {
      id: 'extractionConfig',
      name: 'Extraction Configuration',
      type: 'object',
      description: 'Configuration for content extraction',
      required: false,
      defaultValue: {
        extractTables: true,
        extractImages: true,
      },
    },
    {
      id: 'classificationModel',
      name: 'Classification Model',
      type: 'string',
      description: 'Model to use for document classification',
      required: false,
      defaultValue: 'general-v2',
      validation: {
        enum: ['general-v1', 'general-v2', 'financial', 'legal'],
      },
    },
    {
      id: 'languageCode',
      name: 'Language Code',
      type: 'string',
      description: 'ISO language code for text analysis',
      required: false,
      defaultValue: 'en',
      validation: {
        pattern: '^[a-z]{2}(-[A-Z]{2})?$',
      },
    },
  ],
  metadata: {
    created: new Date('2024-01-01'),
    lastModified: new Date('2024-01-01'),
    author: 'system',
    category: ['document-analysis', 'ai-processing'],
    tags: ['analysis', 'classification', 'sentiment', 'extraction'],
    usageCount: 0,
    averageExecutionTime: 0,
    successRate: 0,
  },
}; 