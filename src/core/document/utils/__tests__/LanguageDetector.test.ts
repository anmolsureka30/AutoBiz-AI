import { describe, it, expect, beforeEach } from '@jest/globals';
import { LanguageDetector } from '../LanguageDetector';

describe('LanguageDetector', () => {
  let detector: LanguageDetector;

  beforeEach(() => {
    detector = new LanguageDetector();
  });

  it('should detect English text', () => {
    const result = detector.detect('This is a sample English text for testing language detection.');
    expect(result?.language).toBe('eng');
    expect(result?.confidence).toBeGreaterThan(0.5);
  });

  it('should detect Spanish text', () => {
    const result = detector.detect('Este es un texto de ejemplo en español para probar la detección de idioma.');
    expect(result?.language).toBe('spa');
    expect(result?.confidence).toBeGreaterThan(0.5);
  });

  it('should handle short text', () => {
    const result = detector.detect('Hi');
    expect(result).toBeNull();
  });

  it('should detect most likely language from multiple texts', () => {
    const texts = [
      'This is English text.',
      'More English content here.',
      'Una frase en español.',
    ];

    const result = detector.getMostLikelyLanguage(texts);
    expect(result?.language).toBe('eng');
  });
}); 