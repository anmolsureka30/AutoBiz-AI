import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { DocumentProcessingAgent } from '../DocumentProcessingAgent';
import { AgentConfig } from '../../base/types';
import { Logger } from '../../../utils/logger';
import { StateStore } from '../../../core/state/StatePersistence';
import { 
  DocumentProcessingRequest, 
  DocumentMetadata, 
  DocumentProcessingResponse 
} from '../types';

type MockLogger = {
  info: jest.Mock;
  error: jest.Mock;
};

type MockStateStore = {
  saveState: jest.Mock;
  loadState: jest.Mock;
  clearState: jest.Mock;
  getAllStates: jest.Mock;
};

describe('DocumentProcessingAgent', () => {
  let agent: DocumentProcessingAgent;
  let mockLogger: MockLogger;
  let mockStateStore: MockStateStore;

  const testMetadata: DocumentMetadata = {
    filename: 'test.txt',
    type: 'text',
    size: 100,
    createdAt: new Date(),
    modifiedAt: new Date(),
    hash: 'test-hash'
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    mockStateStore = {
      saveState: jest.fn().mockResolvedValue(undefined),
      loadState: jest.fn().mockResolvedValue(null),
      clearState: jest.fn().mockResolvedValue(undefined),
      getAllStates: jest.fn().mockResolvedValue(new Map())
    };

    const config: AgentConfig = {
      id: 'test-doc-agent',
      name: 'Test Document Agent',
      version: '1.0.0',
      logger: mockLogger as Logger
    };

    agent = new DocumentProcessingAgent(config, mockStateStore as unknown as StateStore);
  });

  it('should process text documents correctly', async () => {
    const testContent = 'This is a test document content';
    const request: DocumentProcessingRequest = {
      id: 'test-request',
      type: 'document_processing_request',
      payload: {
        documentId: 'test-doc',
        content: testContent,
        metadata: testMetadata,
      },
      timestamp: new Date(),
      priority: 1
    };

    const response = await agent.process(request);
    expect(response.type).toBe('document_processing_response');
    
    const processingResponse = response as DocumentProcessingResponse;
    expect(processingResponse.payload.status).toBe('success');
    expect(processingResponse.payload.content.text).toBe(testContent);
    expect(processingResponse.payload.documentId).toBe('test-doc');
  });

  it('should reject unsupported document types', async () => {
    const request: DocumentProcessingRequest = {
      id: 'test-request',
      type: 'document_processing_request',
      payload: {
        documentId: 'test-doc',
        content: 'test content',
        metadata: {
          ...testMetadata,
          type: 'unsupported' as any
        },
      },
      timestamp: new Date(),
      priority: 1
    };

    await expect(agent.process(request)).rejects.toThrow('Unsupported document type');
  });

  it('should handle extraction errors correctly', async () => {
    const request: DocumentProcessingRequest = {
      id: 'test-request',
      type: 'document_processing_request',
      payload: {
        documentId: 'test-doc',
        content: Buffer.from([]), // Empty buffer to trigger error
        metadata: {
          ...testMetadata,
          type: 'pdf'
        },
      },
      timestamp: new Date(),
      priority: 1
    };

    await expect(agent.process(request)).rejects.toThrow('PDF extraction not implemented');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Content extraction failed'
      })
    );
  });

  it('should emit processing events', async () => {
    const eventSpy = jest.fn();
    agent.on('processing:start', eventSpy);
    agent.on('processing:progress', eventSpy);
    agent.on('processing:complete', eventSpy);

    const request: DocumentProcessingRequest = {
      id: 'test-request',
      type: 'document_processing_request',
      payload: {
        documentId: 'test-doc',
        content: 'test content',
        metadata: testMetadata,
      },
      timestamp: new Date(),
      priority: 1
    };

    await agent.process(request);

    expect(eventSpy).toHaveBeenCalledTimes(3);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'test-doc',
        stage: 'extraction'
      })
    );
  });

  it('should handle learning updates', async () => {
    const feedback = {
      taskId: 'test-task',
      expectedOutput: { text: 'expected content' },
      actualOutput: { text: 'actual content' },
      score: 0.8,
      metadata: {}
    };

    await agent.emit('learning:update', feedback);
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Updating processing models',
        taskId: 'test-task'
      })
    );
  });

  it('should track processing queue state', async () => {
    const request: DocumentProcessingRequest = {
      id: 'test-request',
      type: 'document_processing_request',
      payload: {
        documentId: 'test-doc',
        content: 'test content',
        metadata: testMetadata,
      },
      timestamp: new Date(),
      priority: 1
    };

    const processPromise = agent.process(request);
    
    const state = agent.getState();
    expect(state.status).toBe('processing');
    expect(state.currentTasks).toHaveLength(1);
    expect(state.currentTasks[0].id).toBe('test-doc');

    await processPromise;

    const finalState = agent.getState();
    expect(finalState.status).toBe('idle');
    expect(finalState.currentTasks).toHaveLength(0);
  });

  it('should persist state changes', async () => {
    const request: DocumentProcessingRequest = {
      id: 'test-request',
      type: 'document_processing_request',
      payload: {
        documentId: 'test-doc',
        content: 'test content',
        metadata: testMetadata,
      },
      timestamp: new Date(),
      priority: 1
    };

    await agent.process(request);

    expect(mockStateStore.saveState).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Agent state persisted'
      })
    );
  });
}); 