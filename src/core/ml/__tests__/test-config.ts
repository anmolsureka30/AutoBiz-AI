export const TEST_MODEL_PATH = 'file://test-models/summarization-model.json';

export const TEST_DOCUMENTS = {
  short: {
    text: 'This is a short test document for summarization.',
    expectedSummary: 'Short test document.',
  },
  medium: {
    text: `Machine learning is a field of study that gives computers the ability to learn 
    without being explicitly programmed. It focuses on developing computer programs that 
    can access data and use it to learn for themselves.`,
    expectedSummary: 'Machine learning enables computers to learn from data without explicit programming.',
  },
};

export const TEST_MODEL_CONFIG = {
  device: 'cpu' as const,
  precision: 'float32' as const,
  maxBatchSize: 1,
  timeout: 5000,
}; 