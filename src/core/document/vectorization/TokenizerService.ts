import { Logger } from '../../utils/logger/Logger';
import { encode } from 'gpt-tokenizer';

export class TokenizerService {
  private readonly logger: Logger;
  private readonly modelName: string;

  constructor(modelName: string) {
    this.logger = new Logger('TokenizerService');
    this.modelName = modelName;
  }

  async countTokens(text: string): Promise<number> {
    try {
      // Use GPT tokenizer for token counting
      // This should be replaced with the appropriate tokenizer for your model
      const tokens = encode(text);
      return tokens.length;
    } catch (error) {
      this.logger.error('Token counting failed', { error });
      // Fallback to rough estimation
      return Math.ceil(text.length / 4);
    }
  }

  async encode(text: string): Promise<number[]> {
    try {
      return encode(text);
    } catch (error) {
      this.logger.error('Text encoding failed', { error });
      throw error;
    }
  }

  async decode(tokens: number[]): Promise<string> {
    // Implement token decoding based on your model's requirements
    throw new Error('Not implemented');
  }
} 