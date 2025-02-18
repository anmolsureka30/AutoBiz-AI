import { VersionedTemplate } from '../../versioning/types';

export const documentAnalysisTemplateV2: VersionedTemplate = {
  id: 'document-analysis-workflow',
  name: 'Document Analysis Workflow',
  version: '2.0.0',
  previousVersions: ['1.0.0'],
  description: 'Enhanced document analysis with improved classification and sentiment analysis',
  
  migrationPath: {
    fromVersion: '1.0.0',
    toVersion: '2.0.0',
    steps: [
      {
        type: 'step',
        field: 'steps',
        action: 'add',
        value: {
          templateId: 'language-detection',
          name: 'Language Detection',
          type: 'document_analysis',
          dependencies: ['content-extraction'],
          description: 'Automatically detect document language',
          config: {
            confidence: 0.8,
            fallbackLanguage: 'en',
          },
        },
      },
      {
        type: 'parameter',
        field: 'parameters.languageCode',
        action: 'modify',
        value: {
          id: 'languageCode',
          name: 'Language Code',
          type: 'string',
          description: 'ISO language code (auto-detected if not specified)',
          required: false,
          validation: {
            pattern: '^[a-z]{2}(-[A-Z]{2})?$',
          },
        },
      },
      {
        type: 'config',
        field: 'steps.document-classification.config',
        action: 'modify',
        value: {
          modelType: 'transformer',
          confidenceThreshold: 0.8,
          maxCategories: 5,
        },
      },
      {
        type: 'metadata',
        field: 'metadata.modelVersion',
        action: 'add',
        value: 'transformer-v1',
      },
    ],
  },
  
  // Rest of the template definition...
  steps: [/* ... */],
  parameters: [/* ... */],
  metadata: {/* ... */},
}; 