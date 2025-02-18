import { ChatMessage } from '../../chat/types';

export type GeminiModel = 
  | 'gemini-pro'
  | 'gemini-pro-vision'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-pro-vision'
  | 'gemini-1.5-pro-flash'
  | 'gemini-ultra';

export interface GeminiConfig {
  apiKey: string;
  model: GeminiModel;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  safetySettings?: SafetySetting[];
  baseUrl?: string;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
  };
}

export interface SafetySetting {
  category: SafetyCategory;
  threshold: SafetyThreshold;
}

export type SafetyCategory =
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT';

export type SafetyThreshold =
  | 'BLOCK_NONE'
  | 'BLOCK_LOW'
  | 'BLOCK_MEDIUM'
  | 'BLOCK_HIGH';

export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: ContentPart[];
}

export interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64 encoded
  };
}

export interface GenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
}

export interface GeminiResponse {
  candidates: Candidate[];
  promptFeedback?: PromptFeedback;
}

export interface Candidate {
  content: GeminiContent;
  finishReason: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  index: number;
  safetyRatings: SafetyRating[];
}

export interface SafetyRating {
  category: SafetyCategory;
  probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PromptFeedback {
  safetyRatings: SafetyRating[];
}

export interface TokenCount {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}

export interface GeminiError extends Error {
  code: string;
  status?: number;
  details?: unknown;
}

export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

export interface GeminiModelConfig {
  maxTokens: number;
  maxOutputTokens: number;
  supportedFeatures: {
    vision?: boolean;
    streaming?: boolean;
    flash?: boolean;
  };
  defaultParams: {
    temperature: number;
    topP: number;
    topK: number;
  };
}

export const MODEL_CONFIGS: Record<GeminiModel, GeminiModelConfig> = {
  'gemini-1.5-pro-flash': {
    maxTokens: 16384,
    maxOutputTokens: 2048,
    supportedFeatures: {
      flash: true,
      streaming: true
    },
    defaultParams: {
      temperature: 0.9,
      topP: 1,
      topK: 32
    }
  },
  'gemini-1.5-pro': {
    maxTokens: 32768,
    maxOutputTokens: 4096,
    supportedFeatures: {
      streaming: true
    },
    defaultParams: {
      temperature: 0.7,
      topP: 1,
      topK: 40
    }
  },
  // ... other model configs
}; 