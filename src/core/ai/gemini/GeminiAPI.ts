import axios, { AxiosInstance, AxiosError } from 'axios';
import { 
  GeminiConfig,
  GeminiRequest,
  GeminiResponse,
  GeminiError,
  RateLimitInfo,
  ChatMessage,
  TokenCount,
  GeminiModelConfig,
  MODEL_CONFIGS
} from './types';
import { Logger } from '../../../utils/logger';
import { RateLimiter } from './RateLimiter';
import { TokenCounter } from './TokenCounter';

export class GeminiAPI {
  private readonly client: AxiosInstance;
  private readonly rateLimiter: RateLimiter;
  private readonly tokenCounter: TokenCounter;
  private context: ChatMessage[] = [];
  private readonly modelConfig: GeminiModelConfig;

  constructor(
    private readonly config: GeminiConfig,
    private readonly logger: Logger
  ) {
    // Default to flash model if not specified
    this.config.model = this.config.model || 'gemini-1.5-pro-flash';
    this.modelConfig = MODEL_CONFIGS[this.config.model];

    // Apply model-specific defaults if not provided
    this.config = {
      ...this.config,
      temperature: config.temperature ?? this.modelConfig.defaultParams.temperature,
      topP: config.topP ?? this.modelConfig.defaultParams.topP,
      topK: config.topK ?? this.modelConfig.defaultParams.topK,
      maxOutputTokens: config.maxOutputTokens ?? this.modelConfig.maxOutputTokens
    };

    this.client = axios.create({
      baseURL: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey
      }
    });

    this.rateLimiter = new RateLimiter({
      maxRequests: 60,
      interval: 60 * 1000, // 1 minute
      ...config.retryConfig
    });

    this.tokenCounter = new TokenCounter(config.model);

    // Set up request interceptors
    this.setupInterceptors();
  }

  async generateText(prompt: string): Promise<string> {
    const endpoint = this.getModelEndpoint('generateContent');
    const request = this.createRequest([{ text: prompt }]);
    
    try {
      const response = await this.makeRequest<GeminiResponse>(endpoint, request);
      return this.processResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateChat(message: string): Promise<string> {
    // Add user message to context
    this.context.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    const request = this.createChatRequest(this.context);

    try {
      const response = await this.makeRequest<GeminiResponse>('/models/gemini-pro:generateContent', request);
      const reply = this.processResponse(response);

      // Add model response to context
      this.context.push({
        role: 'model',
        content: reply,
        timestamp: new Date()
      });

      return reply;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async generateImage(prompt: string, image: Buffer): Promise<string> {
    const request = this.createRequest([
      { text: prompt },
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: image.toString('base64')
        }
      }
    ]);

    try {
      const response = await this.makeRequest<GeminiResponse>('/models/gemini-pro-vision:generateContent', request);
      return this.processResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async countTokens(text: string): Promise<TokenCount> {
    return this.tokenCounter.countTokens(text);
  }

  clearContext(): void {
    this.context = [];
  }

  private createRequest(parts: ContentPart[]): GeminiRequest {
    return {
      contents: [{
        role: 'user',
        parts
      }],
      generationConfig: {
        temperature: this.config.temperature,
        topP: this.config.topP,
        topK: this.config.topK,
        maxOutputTokens: this.config.maxOutputTokens,
        stopSequences: this.config.stopSequences
      },
      safetySettings: this.config.safetySettings
    };
  }

  private createChatRequest(messages: ChatMessage[]): GeminiRequest {
    return {
      contents: messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      })),
      generationConfig: {
        temperature: this.config.temperature,
        topP: this.config.topP,
        topK: this.config.topK,
        maxOutputTokens: this.config.maxOutputTokens,
        stopSequences: this.config.stopSequences
      },
      safetySettings: this.config.safetySettings
    };
  }

  private async makeRequest<T>(endpoint: string, data: unknown): Promise<T> {
    await this.rateLimiter.waitForToken();

    try {
      const response = await this.client.post<T>(endpoint, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private processResponse(response: GeminiResponse): string {
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No response generated');
    }

    const candidate = response.candidates[0];
    
    // Check for safety blocks
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Response blocked due to safety concerns');
    }

    // Log safety ratings
    this.logSafetyRatings(candidate.safetyRatings);

    return candidate.content.parts[0].text || '';
  }

  private handleError(error: unknown): GeminiError {
    if (error instanceof AxiosError) {
      const geminiError: GeminiError = new Error(error.message) as GeminiError;
      geminiError.code = error.code || 'UNKNOWN_ERROR';
      geminiError.status = error.response?.status;
      geminiError.details = error.response?.data;

      this.logger.error({
        message: 'Gemini API error',
        error: geminiError,
        details: error.response?.data
      });

      return geminiError;
    }

    return error as GeminiError;
  }

  private setupInterceptors(): void {
    // Add request logging
    this.client.interceptors.request.use(config => {
      this.logger.info({
        message: 'Gemini API request',
        endpoint: config.url,
        method: config.method
      });
      return config;
    });

    // Add response logging and rate limit tracking
    this.client.interceptors.response.use(response => {
      this.logger.info({
        message: 'Gemini API response',
        status: response.status
      });

      // Update rate limit info
      const rateLimitInfo: RateLimitInfo = {
        remaining: parseInt(response.headers['x-ratelimit-remaining'] || '0'),
        limit: parseInt(response.headers['x-ratelimit-limit'] || '0'),
        reset: new Date(response.headers['x-ratelimit-reset'] || Date.now())
      };
      this.rateLimiter.updateLimits(rateLimitInfo);

      return response;
    });
  }

  private logSafetyRatings(ratings: SafetyRating[]): void {
    for (const rating of ratings) {
      if (rating.probability === 'HIGH' || rating.probability === 'MEDIUM') {
        this.logger.warn({
          message: 'High safety rating detected',
          category: rating.category,
          probability: rating.probability
        });
      }
    }
  }

  private getModelEndpoint(action: string): string {
    const modelPath = this.config.model.replace('.', '-'); // Convert 1.5 to 1-5
    return `/models/${modelPath}:${action}`;
  }
} 