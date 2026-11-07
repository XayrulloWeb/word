import type { CardDirection } from '../generated/prisma/client';
import { answersEqual, answersEqualEnglish } from '../utils/text';
import { translateAutoWithMyMemory } from './translation';

export type AnswerCheckResult = {
  correct: boolean;
  normalizedExpected: string;
};

export const checkAnswer = (
  direction: CardDirection,
  expectedEn: string,
  expectedRu: string,
  userAnswer: string
): AnswerCheckResult => {
  if (direction === 'RU_TO_EN') {
    const correct = answersEqualEnglish(expectedEn, userAnswer);
    return { correct, normalizedExpected: expectedEn };
  }
  // EN_TO_RU
  const correct = answersEqual(expectedRu, userAnswer);
  return { correct, normalizedExpected: expectedRu };
};

export const checkAnswerAsync = async (
  direction: CardDirection,
  expectedEn: string,
  expectedRu: string,
  userAnswer: string
): Promise<AnswerCheckResult> => {
  const syncCheck = checkAnswer(direction, expectedEn, expectedRu, userAnswer);
  if (syncCheck.correct) {
    return syncCheck;
  }

  const trimmed = userAnswer.trim();
  if (!trimmed || trimmed.length < 2) {
    return syncCheck;
  }

  try {
    if (direction === 'EN_TO_RU') {
      const translatedEn = await translateAutoWithMyMemory(trimmed, 'en');
      if (translatedEn && answersEqualEnglish(expectedEn, translatedEn)) {
        return { correct: true, normalizedExpected: expectedRu };
      }
    } else {
      const translatedRu = await translateAutoWithMyMemory(trimmed, 'ru');
      if (translatedRu && answersEqual(expectedRu, translatedRu)) {
        return { correct: true, normalizedExpected: expectedEn };
      }
    }
  } catch {
    // If translation service is unavailable, keep the sync result
  }

  return syncCheck;
};
