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

const normalizeCommonTypos = (text: string): string => {
  return text
    .replace(/[-_]+/g, ' ')
    .replace(/\bsimetimes\b/g, 'sometimes')
    .replace(/\bcaterpilar\b/g, 'caterpillar')
    .replace(/\bbehav\s+yourself\b/g, 'behave yourself');
};

export const normalizeEnglish = (text: string): string => {
  const cleaned = normalizeAnswer(text);
  const withoutArticles = stripArticles(cleaned);
  const withoutInfinitive = stripEnglishInfinitive(withoutArticles);
  return normalizeCommonTypos(withoutInfinitive);
};

// Russian stemming rules to normalize case endings, verb tenses, and adjective endings
const stemRussianToken = (token: string): string => {
  let word = token.replace(/[^а-яa-z0-9]/gi, '').toLowerCase();
  if (word.length <= 3) return word;

  // Reflexive verb endings
  word = word.replace(/(ся|сь)$/, '');

  // Verb infinitives and conjugated forms
  word = word.replace(/(иться|еться|аться|яться|уться|ться|тись)$/, '');
  word = word.replace(/(ивать|ывать|евать|овать)$/, '');
  word = word.replace(/(ила|ыла|ела|ала|яла|или|ыли|ели|али|яли|ило|ыло|ело|ало|яло)$/, '');
  word = word.replace(/(ать|ять|еть|ить|уть|ти)$/, '');
  word = word.replace(/(ишь|ешь|ете|ите|ем|им|ут|ют|ат|ят|ет|ит)$/, '');

  // Adjective endings
  word = word.replace(/(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/, '');

  // Noun case and plural endings
  word = word.replace(/(ами|ями|иях|ях|ах|ом|ем|ей|ов|ев|ие|ье|ья|ам|ям|ою|ею|ью)$/, '');
  word = word.replace(/(а|я|у|ю|е|о|ы|и|ь)$/, '');

  return word;
};

// Common Russian synonyms mapped to canonical forms
const RUSSIAN_SYNONYMS: Record<string, string> = {
  // apply
  заявка: 'заявление',
  заявку: 'заявление',
  заявки: 'заявление',
  заявкой: 'заявление',
  заявке: 'заявление',
  подать: 'подавать',
  применить: 'применять',
  применение: 'применять',
  // crash
  разбиться: 'разбиваться',
  разбить: 'разбиваться',
  катастрофа: 'крушение',
  столкновение: 'авария',
  // miss
  пропустить: 'пропускать',
  упустить: 'пропускать',
  упускать: 'пропускать',
  соскучиться: 'скучать',
  // pray
  помолиться: 'молиться',
  // draw
  нарисовать: 'рисовать',
  вытягивать: 'тянуть',
  вытянуть: 'тянуть',
  чертить: 'рисовать',
  // throw
  кинуть: 'бросать',
  кидать: 'бросать',
  бросить: 'бросать',
  выбросить: 'бросать',
  выбрасывать: 'бросать',
  // cancel
  отменить: 'отменять',
  отмена: 'отменять',
  // submarine
  подлодка: 'субмарина',
  // prompt
  намек: 'подсказка',
  побудить: 'побуждать',
  // rubbish
  отходы: 'мусор',
  хлам: 'мусор',
  сор: 'мусор',
  // recycle
  переработать: 'перерабатывать',
  утилизировать: 'перерабатывать',
  // extinct
  исчезнувший: 'вымерший',
  исчезнуть: 'вымерший',
  угасший: 'вымерший',
  // cast
  каст: 'актерский состав',
  актеры: 'актерский состав',
  труппа: 'актерский состав',
  // behave
  вести: 'веди',
  // quiz
  телевикторина: 'викторина',
  квиз: 'викторина',
  // overtime
  овертайм: 'сверхурочные',
  // normally / usually
  нормально: 'обычно',
  // vote
  проголосовать: 'голосовать',
  // matter
  значить: 'иметь значение',
  важно: 'иметь значение',
  // perceive
  воспринять: 'воспринимать',
  ощутить: 'ощущать',
  осознавать: 'воспринимать',
  понимать: 'воспринимать',
  // flavour
  привкус: 'вкус',
  аромат: 'вкус',
  // selfish
  эгоист: 'эгоистичный',
  себялюбивый: 'эгоистичный',
  // sniff
  понюхать: 'нюхать',
  посопеть: 'сопеть',
  принюхиваться: 'нюхать',
  вдыхать: 'нюхать',
  // pretty
  милый: 'красивый',
  милая: 'красивый',
  красивая: 'красивый',
  симпатичная: 'симпатичный',
  // radiator
  батарея: 'радиатор',
  обогреватель: 'радиатор',
  // generous
  великодушный: 'щедрый',
  великодушная: 'щедрый',
  щедрая: 'щедрый',
  // visible
  видный: 'видимый',
  видная: 'видимый',
  заметная: 'заметный',
  // emotion
  переживание: 'эмоция',
  чувство: 'эмоция',
  // exact
  именно: 'точный',
  точная: 'точный',
  // emphasis
  внимание: 'акцент',
  ударение: 'акцент',
  упор: 'акцент',
  // improve
  улучшить: 'улучшать',
  совершенствовать: 'улучшать',
  апгрейд: 'улучшать',
  модернизировать: 'улучшать',
  // instead
  вместо: 'вместо этого',
  взамен: 'вместо этого',
  // specific
  специфичный: 'специфический',
  особенный: 'специфический',
  // annoyance
  досада: 'раздражение',
  недовольство: 'раздражение',
  // irritation
  гнев: 'раздражение',
  злость: 'раздражение',
  // landlord
  арендодатель: 'лендлорд',
  хозяин: 'лендлорд',
  // torch
  фонарик: 'фонарь',
  факел: 'фонарь',
  // butler
  лакей: 'дворецкий',
  // sun-bath
  загар: 'солнечная ванна',
  загорать: 'солнечная ванна',
  // confuse
  смутить: 'смущать',
  смущенный: 'смущать',
  путать: 'смущать',
  запутать: 'смущать',
  запутаться: 'смущать',
  // parcel
  бандероль: 'посылка',
  пакет: 'посылка',
  // bark
  лаять: 'лай',
  // upset
  огорчить: 'огорчать',
  расстраивать: 'огорчать',
  расстроить: 'огорчать',
  огорченный: 'огорчать',
  расстроенный: 'огорчать',
  // exhaust
  истощать: 'уставать',
  изнурять: 'уставать',
  устать: 'уставать',
  истощить: 'уставать',
  // recognise
  узнавать: 'узнать',
  распознать: 'узнать',
  распознавать: 'узнать',
  признать: 'узнать',
  // decorate
  украсить: 'украшать',
  декорировать: 'украшать',
  // dairy / diary
  дневник: 'ежедневный',
  ежедневник: 'ежедневный',
  // belong to
  принадлежать: 'принадлежит к',
  принадлежит: 'принадлежит к',
  // come from
  происходить: 'родом из',
  родом: 'родом из',
  'родом с': 'родом из',
  // listen
  послушать: 'слушать',
  услышать: 'слушать',
};

const canonicalRussianStem = (token: string): string => {
  const clean = token.replace(/[^а-яa-z0-9]/gi, '').toLowerCase();
  const synonym = RUSSIAN_SYNONYMS[clean] || clean;
  return stemRussianToken(synonym);
};

const matchRussianPhraseTokens = (phraseA: string, phraseB: string): boolean => {
  const normA = normalizeAnswer(phraseA);
  const normB = normalizeAnswer(phraseB);
  if (normA === normB) return true;

  const tokensA = normA.split(/\s+/).filter(Boolean);
  const tokensB = normB.split(/\s+/).filter(Boolean);

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const stemsA = tokensA.map(canonicalRussianStem).filter(Boolean);
  const stemsB = tokensB.map(canonicalRussianStem).filter(Boolean);

  // Exact stem sequence match
  if (stemsA.join(' ') === stemsB.join(' ')) return true;

  // Set-based match (ignores word order: e.g. "подавать заявку" === "заявку подавать")
  if (stemsA.length === stemsB.length && stemsA.every((s) => stemsB.includes(s))) {
    return true;
  }

  // If one phrase is a single key noun/verb from the other (e.g. user answered "заявление" or "заявка" for "подавать заявление")
  if (stemsA.length === 1 && stemsB.includes(stemsA[0]!)) {
    return true;
  }
  if (stemsB.length === 1 && stemsA.includes(stemsB[0]!)) {
    return true;
  }

  return false;
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

  if (parts.includes(normActual)) {
    return true;
  }

  for (const part of parts) {
    if (matchRussianPhraseTokens(part, actual)) {
      return true;
    }
  }

  return false;
};

// English synonyms dictionary for common vocabulary
const ENGLISH_SYNONYMS: Record<string, string[]> = {
  apply: ['apply', 'request', 'submit', 'submit application', 'file application', 'use', 'employ'],
  improve: ['improve', 'upgrade', 'enhance', 'better', 'refine', 'boost', 'develop', 'advance'],
  instead: ['instead', 'instead of', 'rather than', 'in place of'],
  rubbish: ['rubbish', 'trash', 'garbage', 'waste', 'litter', 'debris'],
  crash: ['crash', 'break', 'wreck', 'smash', 'accident', 'collide'],
  miss: ['miss', 'skip', 'lose'],
  cancel: ['cancel', 'call off', 'abort', 'drop'],
  recycle: ['recycle', 'reprocess', 'reuse'],
  pretty: ['pretty', 'beautiful', 'handsome', 'cute', 'lovely', 'attractive', 'quite', 'fairly'],
  usually: ['usually', 'normally', 'typically', 'generally', 'as a rule'],
  normally: ['normally', 'usually', 'typically', 'regularly'],
  often: ['often', 'frequently', 'regularly'],
  rarely: ['rarely', 'seldom', 'infrequently', 'hardly ever'],
  seldom: ['seldom', 'rarely', 'infrequently', 'hardly ever'],
  draw: ['draw', 'paint', 'sketch', 'pull'],
  throw: ['throw', 'cast', 'toss', 'fling'],
  cast: ['cast', 'throw', 'actors', 'troupe', 'toss'],
  script: ['script', 'scenario', 'screenplay'],
  overtime: ['overtime', 'extra time', 'extra work'],
  matter: ['matter', 'count', 'be important', 'signify', 'issue', 'substance'],
  perceive: ['perceive', 'feel', 'sense', 'notice', 'understand', 'see'],
  generous: ['generous', 'kind', 'bountiful', 'giving', 'magnanimous'],
  visible: ['visible', 'noticeable', 'seen', 'clear', 'apparent'],
  exact: ['exact', 'precise', 'accurate', 'correct'],
  emphasis: ['emphasis', 'accent', 'stress', 'focus', 'highlight'],
  submarine: ['submarine', 'sub'],
  'quiz show': ['quiz show', 'game show', 'quiz'],
  'behave yourself': ['behave yourself', 'behave', 'be good', 'act properly'],
  extinct: ['extinct', 'vanished', 'dead'],
  forehead: ['forehead', 'brow'],
  selfish: ['selfish', 'egotistical', 'self-centered'],
  sniff: ['sniff', 'smell', 'snort'],
  idiom: ['idiom', 'phrase', 'expression'],
  radiator: ['radiator', 'heater'],
  emotion: ['emotion', 'feeling', 'sentiment'],
  vote: ['vote', 'poll', 'ballot', 'elect'],
  election: ['election', 'elections', 'voting', 'poll'],
  politician: ['politician', 'statesman'],
  campaign: ['campaign', 'drive'],
  flavour: ['flavour', 'flavor', 'taste', 'savor'],
  scratch: ['scratch', 'scrape', 'claw', 'itch'],
  always: ['always', 'forever', 'ever'],
  never: ['never'],
  prompt: ['prompt', 'hint', 'clue', 'urge'],
  climate: ['climate', 'weather'],
  caterpillar: ['caterpillar'],
  specific: ['specific', 'particular', 'special'],
  annoyance: ['annoyance', 'irritation', 'vexation'],
  irritation: ['irritation', 'annoyance', 'anger'],
  landlord: ['landlord', 'lessor'],
  torch: ['torch', 'flashlight', 'lamp', 'flare'],
  butler: ['butler'],
  'sun-bath': ['sun-bath', 'sunbath', 'sun bathing', 'sunbathing'],
  sunbath: ['sun-bath', 'sunbath', 'sun bathing', 'sunbathing'],
  confuse: ['confuse', 'confused', 'embarrass', 'mix up', 'puzzle'],
  parcel: ['parcel', 'package', 'packet'],
  bark: ['bark', 'barking'],
  upset: ['upset', 'sadden', 'distress', 'disappoint'],
  exhaust: ['exhaust', 'tire', 'wear out', 'drain'],
  recognise: ['recognise', 'recognize', 'identify', 'know'],
  recognize: ['recognise', 'recognize', 'identify', 'know'],
  decorate: ['decorate', 'adorn', 'embellish'],
  dairy: ['dairy', 'diary', 'daily'],
  diary: ['dairy', 'diary', 'daily'],
  camp: ['camp'],
  'belong to': ['belong to', 'belong', 'belong to(sb)', 'belongs to'],
  'come from': ['come from', 'originate', 'come from(a place)', 'comes from'],
  listen: ['listen', 'listen to', 'hear'],
  'listen to': ['listen', 'listen to', 'hear'],
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

  if (parts.includes(normActual)) {
    return true;
  }

  // Check English synonym mappings
  const expectedKey = normExpected.toLowerCase();
  const actualKey = normActual.toLowerCase();

  const synonyms = ENGLISH_SYNONYMS[expectedKey];
  if (synonyms && synonyms.includes(actualKey)) {
    return true;
  }

  // Check reverse (if actual is key and expected is in synonyms)
  const actualSynonyms = ENGLISH_SYNONYMS[actualKey];
  if (actualSynonyms && actualSynonyms.includes(expectedKey)) {
    return true;
  }

  return false;
};
