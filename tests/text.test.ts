import { describe, expect, it } from 'vitest';
import {
  normalizeWhitespace,
  normalizeAnswer,
  normalizeEnglish,
  answersEqual,
  answersEqualEnglish,
} from '../src/utils/text';

describe('text utils', () => {
  it('normalizeWhitespace collapses spaces', () => {
    expect(normalizeWhitespace('  hello\n  world\t ')).toBe('hello world');
  });

  it('normalizeAnswer trims, lowercases, strips trailing punctuation', () => {
    expect(normalizeAnswer('  HeLLo!!! ')).toBe('hello');
    expect(normalizeAnswer('test?')).toBe('test');
  });

  it('normalizeEnglish strips leading articles', () => {
    expect(normalizeEnglish('The Apple')).toBe('apple');
    expect(normalizeEnglish('an orange')).toBe('orange');
    expect(normalizeEnglish('a banana')).toBe('banana');
  });

  it('answersEqual ignores case and whitespace', () => {
    expect(answersEqual('  Иди  ', 'иди  ')).toBe(true);
  });

  it('answersEqualEnglish ignores articles and punctuation', () => {
    expect(answersEqualEnglish('apple', 'the apple')).toBe(true);
    expect(answersEqualEnglish('orange', 'An orange.')).toBe(true);
  });

  it('answersEqual matches Russian synonyms and case/verb forms', () => {
    expect(answersEqual('Применять, подавать заявление', 'подавать заявку')).toBe(true);
    expect(answersEqual('Применять, подавать заявление', 'подать заявку')).toBe(true);
    expect(answersEqual('Применять, подавать заявление', 'подать заявление')).toBe(true);
    expect(answersEqual('Применять, подавать заявление', 'применить')).toBe(true);
    expect(answersEqual('Разбиваться, авария, крушение', 'разбиться')).toBe(true);
    expect(answersEqual('Отменять', 'отменить')).toBe(true);
    expect(answersEqual('Отменять', 'отмена')).toBe(true);
    expect(answersEqual('Красивый, симпатичный', 'красивая')).toBe(true);
  });

  it('answersEqualEnglish matches English synonyms', () => {
    expect(answersEqualEnglish('improve', 'upgrade')).toBe(true);
    expect(answersEqualEnglish('rubbish', 'trash')).toBe(true);
    expect(answersEqualEnglish('pretty', 'beautiful')).toBe(true);
    expect(answersEqualEnglish('submarine', 'sub')).toBe(true);
    expect(answersEqualEnglish('overtime', 'extra time')).toBe(true);
  });
});
