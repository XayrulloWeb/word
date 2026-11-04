export const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

const normalizeRussianVariants = (text: string): string => text.replace(/ё/gu, 'е');
const normalizeUnicode = (text: string): string => text.normalize('NFKC');

export const normalizeBasic = (text: string): string =>
  normalizeRussianVariants(normalizeWhitespace(text).toLowerCase());

export const normalizeWordLookup = (text: string): string =>
  normalizeWhitespace(normalizeUnicode(text)).toLocaleLowerCase('en-US');

const stripArticles = (text: string): string => text.replace(/^(a|an|the)\s+/i, '');

const stripTrailingPunctuation = (text: string): string => text.replace(/[.,!?:;]+$/g, '');

export const normalizeAnswer = (text: string): string => {
  return stripTrailingPunctuation(normalizeBasic(text));
};

const stripEnglishInfinitive = (text: string): string => text.replace(/^to\s+/i, '');

export const normalizeEnglish = (text: string): string => {
  const cleaned = normalizeAnswer(text);
  const withoutArticles = stripArticles(cleaned);
  return stripEnglishInfinitive(withoutArticles);
};

export const answersEqual = (expected: string, actual: string): boolean => {
  const normExpected = normalizeAnswer(expected);
  const normActual = normalizeAnswer(actual);
  if (normExpected === normActual) {
    return true;
  }
  const parts = expected
    .split(/[,;/]+/)
    .map((p) => normalizeAnswer(p.replace(/\(.*?\)/g, '')))
    .filter(Boolean);
  return parts.includes(normActual);
};

export const answersEqualEnglish = (expected: string, actual: string): boolean => {
  const normExpected = normalizeEnglish(expected);
  const normActual = normalizeEnglish(actual);
  if (normExpected === normActual) {
    return true;
  }
  const parts = expected
    .split(/[,;/]+/)
    .map((p) => normalizeEnglish(p.replace(/\(.*?\)/g, '')))
    .filter(Boolean);
  return parts.includes(normActual);
};
