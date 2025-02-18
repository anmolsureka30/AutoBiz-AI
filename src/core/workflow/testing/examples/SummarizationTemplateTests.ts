import { TemplateTestSuite } from '../types';
import { documentSummarizationTemplate } from '../../templates/DocumentSummarizationTemplate';

export const summarizationTestSuite: TemplateTestSuite = {
  name: 'Document Summarization Template Tests',
  description: 'Test cases for the document summarization workflow template',
  tests: [
    {
      name: 'Basic summarization with default parameters',
      template: documentSummarizationTemplate,
      input: {
        documentId: 'test-doc-1',
      },
      expectedSteps: [
        'text-extraction',
        'section-segmentation',
        'key-points-extraction',
        'summary-generation',
        'summary-refinement',
      ],
    },
    {
      name: 'Summarization with custom parameters',
      template: documentSummarizationTemplate,
      input: {
        documentId: 'test-doc-2',
        languageCode: 'fr',
        maxPoints: 15,
        summaryConfig: {
          maxLength: 500,
          style: 'detailed',
          format: 'html',
        },
      },
      expectedOutput: {
        summary: expect.any(String),
        keyPoints: expect.arrayContaining([expect.any(String)]),
        metadata: expect.objectContaining({
          language: 'fr',
          pointsExtracted: expect.any(Number),
        }),
      },
    },
    {
      name: 'Should fail with invalid language code',
      template: documentSummarizationTemplate,
      input: {
        documentId: 'test-doc-3',
        languageCode: 'invalid',
      },
      shouldFail: true,
      expectedErrors: [
        'Invalid language code format',
      ],
    },
    {
      name: 'Should fail with missing required parameter',
      template: documentSummarizationTemplate,
      input: {},
      shouldFail: true,
      expectedErrors: [
        'Missing required parameter: documentId',
      ],
    },
  ],
  async setup() {
    // Setup test environment, e.g., prepare test documents
    await this.prepareTestDocuments();
  },
  async teardown() {
    // Clean up test environment
    await this.cleanupTestDocuments();
  },
}; 