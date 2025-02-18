import { Model } from '../Model';
import { ModelError, ModelOperation } from '../types';
import { 
  TEST_MODEL_PATH, 
  TEST_DOCUMENTS, 
  TEST_MODEL_CONFIG 
} from './test-config';
import {
  createMockModel,
  mockModelConfig,
  createMockTensor,
  cleanupTensors,
} from './test-utils';
import * as tf from '@tensorflow/tfjs-node';

describe('Model', () => {
  let model: Model;

  beforeEach(() => {
    model = new Model(TEST_MODEL_PATH, TEST_MODEL_CONFIG);
  });

  afterEach(async () => {
    await model.cleanup();
    await cleanupTensors();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid config', async () => {
      await expect(model.initialize()).resolves.not.toThrow();
    });

    it('should fail initialization with invalid model path', async () => {
      const invalidModel = new Model('invalid-path');
      await expect(invalidModel.initialize()).rejects.toThrow();
    });

    it('should initialize only once', async () => {
      const initSpy = jest.spyOn(tf, 'loadLayersModel');
      await model.initialize();
      await model.initialize();
      expect(initSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('execution', () => {
    beforeEach(async () => {
      await model.initialize();
    });

    it('should execute summarization successfully', async () => {
      const result = await model.execute('summarize', {
        text: TEST_DOCUMENTS.short.text,
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics.inferenceTime).toBeGreaterThan(0);
    });

    it('should handle empty input gracefully', async () => {
      await expect(
        model.execute('summarize', { text: '' })
      ).rejects.toThrow();
    });

    it('should track memory usage', async () => {
      const result = await model.execute('summarize', {
        text: TEST_DOCUMENTS.medium.text,
      });

      expect(result.metrics.memoryUsage).toBeGreaterThan(0);
      expect(result.metrics.inputTokens).toBeGreaterThan(0);
      expect(result.metrics.outputTokens).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw ModelError for invalid operations', async () => {
      try {
        await model.execute('invalidOperation' as ModelOperation, {});
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelError);
        expect(error.code).toBe('MODEL_ERROR');
      }
    });

    it('should include metrics in error for failed executions', async () => {
      try {
        await model.execute('summarize', { text: null });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelError);
        expect(error.metrics).toBeDefined();
      }
    });
  });

  describe('resource management', () => {
    it('should cleanup resources properly', async () => {
      const memoryBefore = tf.memory();
      await model.execute('summarize', { text: TEST_DOCUMENTS.short.text });
      await model.cleanup();
      const memoryAfter = tf.memory();

      expect(memoryAfter.numTensors).toBeLessThanOrEqual(memoryBefore.numTensors);
    });

    it('should handle multiple cleanup calls gracefully', async () => {
      await model.cleanup();
      await expect(model.cleanup()).resolves.not.toThrow();
    });
  });

  describe('model updates', () => {
    it('should update weights successfully', async () => {
      const result = await model.execute('updateWeights', {
        feedback: 0.8,
      });

      expect(result).toBeDefined();
      expect(result.metrics.inferenceTime).toBeGreaterThan(0);
    });

    it('should maintain state after updates', async () => {
      const before = await model.execute('summarize', {
        text: TEST_DOCUMENTS.short.text,
      });

      await model.execute('updateWeights', { feedback: 0.9 });

      const after = await model.execute('summarize', {
        text: TEST_DOCUMENTS.short.text,
      });

      expect(after.metrics.inferenceTime).toBeDefined();
      expect(after.data).not.toEqual(before.data);
    });
  });
}); 