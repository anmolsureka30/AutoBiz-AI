import { WorkflowTemplate } from '../template-types';

export const documentSummarizationTemplate: WorkflowTemplate = {
  id: 'document-summarization-workflow',
  name: 'Document Summarization Workflow',
  description: 'Generate comprehensive summaries of documents with key points and insights',
  version: '1.0.0',
  steps: [
    {
      templateId: 'text-extraction',
      name: 'Text Extraction',
      type: 'document_analysis',
      dependencies: [],
      description: 'Extract clean text content from document',
      parameters: ['documentId', 'languageCode'],
      validation: {
        preconditions: ['document.size < 100MB'],
        timeout: 180000, // 3 minutes
      },
      config: {
        preserveFormatting: false,
        extractHeaders: true,
        cleanupMode: 'aggressive',
      },
    },
    {
      templateId: 'section-segmentation',
      name: 'Section Segmentation',
      type: 'document_analysis',
      dependencies: ['text-extraction'],
      description: 'Split document into logical sections',
      config: {
        detectHeadings: true,
        minSectionLength: 100,
        mergeSimilarSections: true,
      },
    },
    {
      templateId: 'key-points-extraction',
      name: 'Key Points Extraction',
      type: 'document_analysis',
      dependencies: ['section-segmentation'],
      description: 'Extract main points and insights',
      parameters: ['maxPoints'],
      config: {
        relevanceThreshold: 0.7,
        deduplicationEnabled: true,
        categorizePoints: true,
      },
    },
    {
      templateId: 'summary-generation',
      name: 'Summary Generation',
      type: 'document_summarization',
      dependencies: ['section-segmentation', 'key-points-extraction'],
      description: 'Generate document summary',
      parameters: ['summaryConfig'],
      config: {
        style: 'concise',
        includeTOC: true,
        includeKeyPoints: true,
      },
    },
    {
      templateId: 'summary-refinement',
      name: 'Summary Refinement',
      type: 'document_analysis',
      dependencies: ['summary-generation'],
      description: 'Refine and polish the summary',
      config: {
        improveClarity: true,
        fixGrammar: true,
        optimizeStructure: true,
      },
    },
  ],
  parameters: [
    {
      id: 'documentId',
      name: 'Document ID',
      type: 'string',
      description: 'ID of the document to summarize',
      required: true,
    },
    {
      id: 'languageCode',
      name: 'Language Code',
      type: 'string',
      description: 'ISO language code of the document',
      required: false,
      defaultValue: 'en',
      validation: {
        pattern: '^[a-z]{2}(-[A-Z]{2})?$',
      },
    },
    {
      id: 'maxPoints',
      name: 'Maximum Key Points',
      type: 'number',
      description: 'Maximum number of key points to extract',
      required: false,
      defaultValue: 10,
      validation: {
        minimum: 5,
        maximum: 30,
      },
    },
    {
      id: 'summaryConfig',
      name: 'Summary Configuration',
      type: 'object',
      description: 'Configuration for summary generation',
      required: false,
      defaultValue: {
        maxLength: 1000,
        style: 'concise',
        format: 'markdown',
      },
    },
  ],
  metadata: {
    created: new Date('2024-01-01'),
    lastModified: new Date('2024-01-01'),
    author: 'system',
    category: ['summarization', 'document-processing'],
    tags: ['summary', 'key-points', 'analysis'],
    usageCount: 0,
    averageExecutionTime: 0,
    successRate: 0,
  },
}; 