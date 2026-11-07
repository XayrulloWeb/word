import { describe, expect, it } from 'vitest';
import { checkAnswer, checkAnswerAsync } from '../src/services/answerChecker';

describe('answerChecker', () => {
  it('accepts English answer with articles for RU_TO_EN', () => {
    const result = checkAnswer('RU_TO_EN', 'apple', 'яблоко', 'the apple');
    expect(result.correct).toBe(true);
  });

  it('rejects wrong English answer for RU_TO_EN', () => {
    const result = checkAnswer('RU_TO_EN', 'apple', 'яблоко', 'orange');
    expect(result.correct).toBe(false);
  });

  it('checks Russian answer for EN_TO_RU', () => {
    const result = checkAnswer('EN_TO_RU', 'apple', 'яблоко', '  яблоко ');
    expect(result.correct).toBe(true);
  });

  it('accepts synonymous phrase for Apply (подавать заявку)', () => {
    const result = checkAnswer(
      'EN_TO_RU',
      'Apply',
      'Применять, подавать заявление',
      'подавать заявку'
    );
    expect(result.correct).toBe(true);
  });

  it('accepts perfective verb for Apply (подать заявку)', () => {
    const result = checkAnswer(
      'EN_TO_RU',
      'Apply',
      'Применять, подавать заявление',
      'подать заявку'
    );
    expect(result.correct).toBe(true);
  });

  it('accepts English synonym (upgrade for improve)', () => {
    const result = checkAnswer(
      'RU_TO_EN',
      'Improve',
      'Улучшать, совершенствовать',
      'upgrade'
    );
    expect(result.correct).toBe(true);
  });

  it('checkAnswerAsync works seamlessly', async () => {
    const result = await checkAnswerAsync(
      'EN_TO_RU',
      'Apply',
      'Применять, подавать заявление',
      'подавать заявку'
    );
    expect(result.correct).toBe(true);
  });
});
