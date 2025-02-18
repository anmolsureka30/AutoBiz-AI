import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { GeminiAPI } from '../GeminiAPI';
import { Logger } from '../../../../utils/logger';
import { GeminiConfig, GeminiResponse } from '../types';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeminiAPI Integration Tests', () => {
  let api: GeminiAPI;
  let mockLogger: {
    info: jest.Mock;
    error: jest.Mock;
    warn: jest.Mock;
  };

  const testConfig: GeminiConfig = {
    apiKey: 'test-api-key',
    model: 'gemini-1.5-pro-flash',
    temperature: 0.9,
    maxTokens: 1000,
    timeout: 5000,
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000
    }
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    api = new GeminiAPI(testConfig, mockLogger as unknown as Logger);

    // Reset axios mocks
    mockedAxios.create.mockReturnValue(mockedAxios as any);
    mockedAxios.post.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Text Generation', () => {
    const mockResponse: GeminiResponse = {
      candidates: [{
        content: {
          role: 'model',
          parts: [{ text: 'Generated response' }]
        },
        finishReason: 'STOP',
        index: 0,
        safetyRatings: []
      }],
      promptFeedback: {
        safetyRatings: []
      }
    };

    it('should generate text successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await api.generateText('Test prompt');

      expect(result).toBe('Generated response');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/models/gemini-pro:generateContent',
        expect.objectContaining({
          contents: [{
            role: 'user',
            parts: [{ text: 'Test prompt' }]
          }]
        })
      );
    });

    it('should handle rate limiting', async () => {
      // First call hits rate limit
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' }
        }
      });
      // Second call succeeds
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await api.generateText('Test prompt');

      expect(result).toBe('Generated response');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Rate limited, retrying'
        })
      );
    });

    it('should respect safety settings', async () => {
      const safetyResponse: GeminiResponse = {
        candidates: [{
          content: {
            role: 'model',
            parts: [{ text: 'Safe response' }]
          },
          finishReason: 'SAFETY',
          index: 0,
          safetyRatings: [{
            category: 'HARM_CATEGORY_HATE_SPEECH',
            probability: 'HIGH'
          }]
        }],
        promptFeedback: {
          safetyRatings: []
        }
      };

      mockedAxios.post.mockResolvedValueOnce({ data: safetyResponse });

      await expect(api.generateText('Unsafe prompt')).rejects.toThrow(
        'Response blocked due to safety concerns'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'High safety rating detected'
        })
      );
    });
  });

  describe('Chat Generation', () => {
    it('should maintain chat context', async () => {
      const responses = [
        { data: createMockResponse('First response') },
        { data: createMockResponse('Second response') }
      ];

      mockedAxios.post
        .mockResolvedValueOnce(responses[0])
        .mockResolvedValueOnce(responses[1]);

      const firstResponse = await api.generateChat('First message');
      const secondResponse = await api.generateChat('Second message');

      expect(firstResponse).toBe('First response');
      expect(secondResponse).toBe('Second response');

      // Verify context is maintained
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        '/models/gemini-pro:generateContent',
        expect.objectContaining({
          contents: [
            { role: 'user', parts: [{ text: 'First message' }] },
            { role: 'model', parts: [{ text: 'First response' }] },
            { role: 'user', parts: [{ text: 'Second message' }] }
          ]
        })
      );
    });

    it('should clear chat context', async () => {
      mockedAxios.post.mockResolvedValue({ 
        data: createMockResponse('Response') 
      });

      await api.generateChat('First message');
      api.clearContext();
      await api.generateChat('New message');

      // Verify only the new message is sent
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        '/models/gemini-pro:generateContent',
        expect.objectContaining({
          contents: [
            { role: 'user', parts: [{ text: 'New message' }] }
          ]
        })
      );
    });
  });

  describe('Image Generation', () => {
    let testImage: Buffer;

    beforeEach(async () => {
      testImage = await fs.readFile(path.join(__dirname, 'test-image.jpg'));
    });

    it('should process images with text prompts', async () => {
      mockedAxios.post.mockResolvedValueOnce({ 
        data: createMockResponse('Image description') 
      });

      const result = await api.generateImage(
        'Describe this image',
        testImage
      );

      expect(result).toBe('Image description');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/models/gemini-pro-vision:generateContent',
        expect.objectContaining({
          contents: [{
            role: 'user',
            parts: [
              { text: 'Describe this image' },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: expect.any(String) // base64 encoded image
                }
              }
            ]
          }]
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.generateText('Test')).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Gemini API error'
        })
      );
    });

    it('should handle API errors', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: 'Invalid request' }
        }
      });

      await expect(api.generateText('Test')).rejects.toThrow('Invalid request');
    });

    it('should handle timeout errors', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      });

      await expect(api.generateText('Test')).rejects.toThrow('timeout');
    });
  });

  describe('Flash Model Specific Tests', () => {
    it('should use correct endpoint for flash model', async () => {
      mockedAxios.post.mockResolvedValueOnce({ 
        data: createMockResponse('Flash response') 
      });

      await api.generateText('Test prompt');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/models/gemini-1-5-pro-flash:generateContent',
        expect.any(Object)
      );
    });

    it('should apply flash model specific parameters', async () => {
      mockedAxios.post.mockResolvedValueOnce({ 
        data: createMockResponse('Response') 
      });

      await api.generateText('Test prompt');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.9,
            topK: 32,
            maxOutputTokens: 2048
          })
        })
      );
    });

    it('should handle flash model specific features', async () => {
      const streamingResponse = {
        candidates: [{
          content: {
            role: 'model',
            parts: [{ text: 'Fast response' }]
          },
          finishReason: 'STOP',
          index: 0,
          safetyRatings: [],
          generationTime: 150 // milliseconds
        }],
        promptFeedback: {
          safetyRatings: [],
          performanceMetrics: {
            latencyMs: 150
          }
        }
      };

      mockedAxios.post.mockResolvedValueOnce({ data: streamingResponse });

      const result = await api.generateText('Quick test');
      expect(result).toBe('Fast response');
    });
  });
});

function createMockResponse(text: string): GeminiResponse {
  return {
    candidates: [{
      content: {
        role: 'model',
        parts: [{ text }]
      },
      finishReason: 'STOP',
      index: 0,
      safetyRatings: []
    }],
    promptFeedback: {
      safetyRatings: []
    }
  };
} 