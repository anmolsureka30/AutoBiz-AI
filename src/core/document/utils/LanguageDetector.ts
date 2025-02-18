import { Logger } from '../../utils/logger/Logger';
import * as franc from 'franc';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

export class LanguageDetector {
  private readonly logger: Logger;
  private readonly minTextLength = 20;
  private readonly minConfidence = 0.5;

  constructor() {
    this.logger = new Logger('LanguageDetector');
  }

  detect(text: string): LanguageDetectionResult | null {
    try {
      if (!text || text.length < this.minTextLength) {
        return null;
      }

      const [language, confidence] = franc.all(text)[0] || [];
      
      if (!language || confidence < this.minConfidence) {
        return null;
      }

      return {
        language,
        confidence: confidence as number,
      };
    } catch (error) {
      this.logger.error('Language detection failed', { error });
      return null;
    }
  }

  detectBatch(texts: string[]): Array<LanguageDetectionResult | null> {
    return texts.map(text => this.detect(text));
  }

  getMostLikelyLanguage(texts: string[]): LanguageDetectionResult | null {
    try {
      const results = this.detectBatch(texts)
        .filter((result): result is LanguageDetectionResult => result !== null);

      if (results.length === 0) {
        return null;
      }

      // Group by language and calculate average confidence
      const languageScores = results.reduce((acc, result) => {
        const existing = acc.get(result.language) || { count: 0, totalConfidence: 0 };
        acc.set(result.language, {
          count: existing.count + 1,
          totalConfidence: existing.totalConfidence + result.confidence,
        });
        return acc;
      }, new Map<string, { count: number; totalConfidence: number }>());

      // Find language with highest average confidence
      let bestLanguage = null;
      let bestScore = 0;

      for (const [language, scores] of languageScores.entries()) {
        const avgConfidence = scores.totalConfidence / scores.count;
        if (avgConfidence > bestScore) {
          bestScore = avgConfidence;
          bestLanguage = language;
        }
      }

      return bestLanguage ? { language: bestLanguage, confidence: bestScore } : null;
    } catch (error) {
      this.logger.error('Batch language detection failed', { error });
      return null;
    }
  }
} 