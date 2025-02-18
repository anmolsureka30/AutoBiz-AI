import { GeminiModel, TokenCount } from './types';
import { Logger } from '../../../utils/logger';

interface TokenizerConfig {
  maxTokens: number;
  avgTokensPerChar: number;
  specialTokens: Map<string, number>;
}

export class TokenCounter {
  private readonly config: TokenizerConfig;

  constructor(
    private readonly model: GeminiModel,
    private readonly logger?: Logger
  ) {
    this.config = this.getModelConfig(model);
  }

  async countTokens(text: string): Promise<TokenCount> {
    try {
      const tokens = this.estimateTokenCount(text);
      
      return {
        totalTokens: tokens,
        promptTokens: tokens,
        completionTokens: 0 // Will be filled by response
      };
    } catch (error) {
      this.logger?.error({
        message: 'Token counting failed',
        error: error instanceof Error ? error.message : String(error),
        model: this.model
      });
      throw error;
    }
  }

  private estimateTokenCount(text: string): number {
    // Handle empty or invalid input
    if (!text || typeof text !== 'string') {
      return 0;
    }

    let tokenCount = 0;
    let currentPosition = 0;

    while (currentPosition < text.length) {
      // Check for special tokens first
      let matchFound = false;
      for (const [pattern, tokenLength] of this.config.specialTokens.entries()) {
        if (text.startsWith(pattern, currentPosition)) {
          tokenCount += tokenLength;
          currentPosition += pattern.length;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        // Handle regular characters
        const char = text[currentPosition];
        
        // Count UTF-16 surrogate pairs as one token
        if (this.isHighSurrogate(char.charCodeAt(0)) && 
            currentPosition + 1 < text.length && 
            this.isLowSurrogate(text.charCodeAt(currentPosition + 1))) {
          tokenCount += 1;
          currentPosition += 2;
        } else {
          // Regular character
          tokenCount += this.getCharTokenCount(char);
          currentPosition += 1;
        }
      }
    }

    return Math.ceil(tokenCount);
  }

  private getCharTokenCount(char: string): number {
    // Special handling for different character types
    if (this.isWhitespace(char)) {
      return 0.25; // Whitespace typically shares tokens
    }
    if (this.isPunctuation(char)) {
      return 0.5; // Punctuation often shares tokens
    }
    if (this.isNumeric(char)) {
      return 0.5; // Numbers often share tokens
    }
    if (this.isASCII(char)) {
      return 0.75; // ASCII characters often share tokens
    }
    return this.config.avgTokensPerChar; // Unicode characters typically need more tokens
  }

  private getModelConfig(model: GeminiModel): TokenizerConfig {
    switch (model) {
      case 'gemini-pro':
        return {
          maxTokens: 32768,
          avgTokensPerChar: 1.3,
          specialTokens: new Map([
            ['\n', 0.5],
            [' ', 0.25],
            ['http://', 1],
            ['https://', 1],
            ['www.', 1],
            ['.com', 1],
            // Add more special tokens as needed
          ])
        };
      case 'gemini-pro-vision':
        return {
          maxTokens: 16384,
          avgTokensPerChar: 1.3,
          specialTokens: new Map([
            ['\n', 0.5],
            [' ', 0.25],
            // Vision model specific tokens
          ])
        };
      case 'gemini-ultra':
        return {
          maxTokens: 65536,
          avgTokensPerChar: 1.3,
          specialTokens: new Map([
            ['\n', 0.5],
            [' ', 0.25],
            // Ultra model specific tokens
          ])
        };
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  private isPunctuation(char: string): boolean {
    return /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/.test(char);
  }

  private isNumeric(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isASCII(char: string): boolean {
    return char.charCodeAt(0) < 128;
  }

  private isHighSurrogate(code: number): boolean {
    return code >= 0xD800 && code <= 0xDBFF;
  }

  private isLowSurrogate(code: number): boolean {
    return code >= 0xDC00 && code <= 0xDFFF;
  }
} 