import { VectorizationConfig, TextChunk } from './types';
import { Logger } from '../../utils/logger/Logger';
import { TokenizerService } from './TokenizerService';

export class TextChunker {
  private readonly logger: Logger;
  private readonly config: Required<VectorizationConfig>;
  private readonly tokenizer: TokenizerService;

  constructor(config: Required<VectorizationConfig>) {
    this.logger = new Logger('TextChunker');
    this.config = config;
    this.tokenizer = new TokenizerService(config.model);
  }

  async chunk(text: string): Promise<TextChunk[]> {
    try {
      // First split into sentences
      const sentences = this.splitIntoSentences(text);
      
      // Then combine sentences into chunks
      const chunks = await this.createChunks(sentences);

      this.logger.debug('Text chunking completed', {
        originalLength: text.length,
        sentences: sentences.length,
        chunks: chunks.length,
      });

      return chunks;
    } catch (error) {
      this.logger.error('Text chunking failed', { error });
      throw error;
    }
  }

  private splitIntoSentences(text: string): string[] {
    // Use regex for basic sentence splitting
    // This could be enhanced with a more sophisticated sentence tokenizer
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    // Handle any remaining text that doesn't end with sentence punctuation
    const remaining = text.replace(/[^.!?]+[.!?]+/g, '').trim();
    if (remaining) {
      sentences.push(remaining);
    }

    return sentences.map(s => s.trim()).filter(Boolean);
  }

  private async createChunks(sentences: string[]): Promise<TextChunk[]> {
    const chunks: TextChunk[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;
    let startIndex = 0;

    for (const sentence of sentences) {
      const sentenceTokens = await this.tokenizer.countTokens(sentence);

      // If a single sentence exceeds maxTokens, split it
      if (sentenceTokens > this.config.maxTokens) {
        if (currentChunk.length > 0) {
          chunks.push(await this.createChunk(
            currentChunk.join(' '),
            startIndex,
            startIndex + currentChunk.join(' ').length
          ));
          startIndex += currentChunk.join(' ').length;
          currentChunk = [];
          currentTokens = 0;
        }

        const subChunks = await this.splitLongSentence(sentence, sentenceTokens);
        for (const subChunk of subChunks) {
          chunks.push(await this.createChunk(
            subChunk,
            startIndex,
            startIndex + subChunk.length
          ));
          startIndex += subChunk.length;
        }
        continue;
      }

      // Check if adding this sentence would exceed maxTokens
      if (currentTokens + sentenceTokens > this.config.maxTokens) {
        chunks.push(await this.createChunk(
          currentChunk.join(' '),
          startIndex,
          startIndex + currentChunk.join(' ').length
        ));
        startIndex += currentChunk.join(' ').length;
        currentChunk = [sentence];
        currentTokens = sentenceTokens;
      } else {
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Add any remaining text as the last chunk
    if (currentChunk.length > 0) {
      chunks.push(await this.createChunk(
        currentChunk.join(' '),
        startIndex,
        startIndex + currentChunk.join(' ').length
      ));
    }

    // Add overlapping content if configured
    if (this.config.overlap && this.config.overlap > 0) {
      return this.addOverlap(chunks);
    }

    return chunks;
  }

  private async splitLongSentence(
    sentence: string,
    totalTokens: number
  ): Promise<string[]> {
    const words = sentence.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const word of words) {
      const wordTokens = await this.tokenizer.countTokens(word);
      
      if (currentTokens + wordTokens > this.config.maxTokens) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join(' '));
          currentChunk = [word];
          currentTokens = wordTokens;
        } else {
          // Word itself exceeds maxTokens, split by character
          chunks.push(word);
        }
      } else {
        currentChunk.push(word);
        currentTokens += wordTokens;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  private async createChunk(
    text: string,
    startIndex: number,
    endIndex: number
  ): Promise<TextChunk> {
    return {
      text,
      startIndex,
      endIndex,
      tokens: await this.tokenizer.countTokens(text),
    };
  }

  private addOverlap(chunks: TextChunk[]): TextChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: TextChunk[] = [];
    const overlapTokens = Math.floor(this.config.maxTokens * (this.config.overlap! / 100));

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (i > 0) {
        // Add overlap from previous chunk
        const prevChunk = chunks[i - 1];
        const overlapText = prevChunk.text.split(/\s+/).slice(-overlapTokens).join(' ');
        chunk.text = overlapText + ' ' + chunk.text;
        chunk.startIndex = prevChunk.endIndex - overlapText.length;
      }

      if (i < chunks.length - 1) {
        // Add overlap from next chunk
        const nextChunk = chunks[i + 1];
        const overlapText = nextChunk.text.split(/\s+/).slice(0, overlapTokens).join(' ');
        chunk.text = chunk.text + ' ' + overlapText;
        chunk.endIndex = nextChunk.startIndex + overlapText.length;
      }

      overlappedChunks.push(chunk);
    }

    return overlappedChunks;
  }
} 