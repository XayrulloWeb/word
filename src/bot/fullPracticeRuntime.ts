import type { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../db/client';
import { setState, resetState } from '../services/sessionService';
import type { UserSession } from '../generated/prisma/client';
import { checkAnswerAsync } from '../services/answerChecker';
import { applyRating } from '../services/reviewService';
import { recordCompletion } from '../services/userService';
import type { Lang } from '../i18n';
import { escapeHtml } from '../utils/html';
import { answersEqual, answersEqualEnglish } from '../utils/text';

export interface FullPracticeStats {
  total: number;
  correct: number;
  wrong: number;
  [key: string]: unknown;
}

export type PracticeSubMode = 'typing' | 'choices';

export interface FullPracticePayload {
  mode: 'full_practice';
  subMode?: PracticeSubMode;
  stats: FullPracticeStats;
  currentWordId: number;
  wordEn: string;
  translationRu: string;
  direction: 'EN_TO_RU' | 'RU_TO_EN';
  questionPrompt: string;
  correctAnswer: string;
  options: string[];
  baseHeader?: string;
  hintPresses?: number;
  recentWordIds?: number[];
  [key: string]: unknown;
}

export const generateSmartHint = (text: string, press: number): string => {
  const words = text.trim().split(/\s+/);
  return words
    .map((word) => {
      const chars = Array.from(word);
      const letterIdxs: number[] = [];
      chars.forEach((c, i) => {
        if (/[\p{L}\p{N}]/u.test(c)) letterIdxs.push(i);
      });

      if (letterIdxs.length <= 1) return chars.join(' ');

      const revealed = new Set<number>();
      // Press 1: reveal 1st letter
      if (letterIdxs[0] !== undefined) revealed.add(letterIdxs[0]);

      // Press 2: reveal 2nd letter
      if (press >= 2 && letterIdxs[1] !== undefined) {
        revealed.add(letterIdxs[1]);
      }

      // Press 3: reveal last letter and 3rd letter if long enough
      if (press >= 3) {
        const lastIdx = letterIdxs[letterIdxs.length - 1];
        if (lastIdx !== undefined) revealed.add(lastIdx);
        if (letterIdxs.length >= 5 && letterIdxs[2] !== undefined) {
          revealed.add(letterIdxs[2]);
        }
      }

      return chars
        .map((c, i) => (revealed.has(i) ? c : /[\p{L}\p{N}]/u.test(c) ? '_' : c))
        .join(' ');
    })
    .join('   ');
};

export const isFullPracticeCallbackData = (data: string): boolean => {
  return (
    data.startsWith('fp_ans:') ||
    data === 'fp_stop' ||
    data === 'fp_dont_know' ||
    data === 'fp_hint'
  );
};

export const isFullPracticeSession = (session: UserSession | null | undefined): boolean => {
  return session?.state === 'QUIZ_ACTIVE' && (session?.payload as any)?.mode === 'full_practice';
};

export const createFullPracticeRuntime = (deps: {
  mainReplyKeyboard: (lang: Lang) => any;
  stopReplyKeyboard: (lang: Lang) => any;
}) => {
  const sendNextQuestion = async (
    ctx: Context,
    userId: bigint,
    lang: Lang,
    stats: FullPracticeStats,
    subMode: PracticeSubMode = 'typing',
    recentWordIds: number[] = []
  ) => {
    const userWords = await prisma.word.findMany({
      where: { userId },
      select: {
        id: true,
        wordEn: true,
        translationRu: true,
        reviews: {
          select: { stage: true, direction: true },
        },
      },
    });

    if (userWords.length === 0) {
      await resetState(userId);
      const noWordsText =
        lang === 'uz'
          ? 'Lug‘atingizda hozircha so‘zlar yo‘q. Avval so‘z qo‘shing!'
          : 'В вашем словаре пока нет слов. Сначала добавьте слова через «➕ Добавить слово»!';
      await ctx.reply(noWordsText, {
        parse_mode: 'HTML',
        ...deps.mainReplyKeyboard(lang),
      });
      return;
    }

    // Window size for recent words: e.g. min(5, userWords.length - 1)
    const maxRecent = Math.max(1, Math.min(5, userWords.length - 1));
    const recentSet = new Set(recentWordIds.slice(-maxRecent));

    // Filter unmastered words (where any direction has stage < 3)
    const learningWords = userWords.filter((w) => {
      const maxStage = Math.max(0, ...w.reviews.map((r) => r.stage));
      return maxStage < 3;
    });

    // Separate into unmastered pool excluding recent words
    const nonRecentLearning = learningWords.filter((w) => !recentSet.has(w.id));
    const poolLearning = nonRecentLearning.length > 0 ? nonRecentLearning : learningWords;

    // All words pool excluding recent words
    const nonRecentAll = userWords.filter((w) => !recentSet.has(w.id));
    const poolAll = nonRecentAll.length > 0 ? nonRecentAll : userWords;

    // 75% prioritize unmastered words, 25% pick from all words for refresher
    let target: typeof userWords[0] | undefined;
    if (poolLearning.length > 0 && Math.random() < 0.75) {
      target = poolLearning[Math.floor(Math.random() * poolLearning.length)];
    } else {
      target = poolAll[Math.floor(Math.random() * poolAll.length)];
    }
    if (!target) {
      target = userWords[0];
    }
    if (!target) {
      return;
    }

    // Direction: Always chosen language -> English ("выбранный язык на английский")
    const direction: 'EN_TO_RU' | 'RU_TO_EN' = 'RU_TO_EN';
    const questionPrompt = target.translationRu;
    const correctAnswer = target.wordEn;

    const questionNumber = stats.total + 1;
    const fromFlag = lang === 'uz' ? '🇺🇿' : '🇷🇺';
    const targetLangName = lang === 'uz' ? 'inglizcha' : 'английском';

    let options: string[] = [];
    if (subMode === 'choices') {
      const uniqueDistractors: string[] = [];
      const seen = new Set<string>([correctAnswer.toLowerCase().trim()]);
      const otherWords = userWords.filter((w) => w.id !== target.id);
      const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());
      for (const w of shuffledOthers) {
        const text = w.wordEn;
        const norm = text.toLowerCase().trim();
        if (!seen.has(norm)) {
          seen.add(norm);
          uniqueDistractors.push(text);
          if (uniqueDistractors.length === 3) break;
        }
      }
      options = [correctAnswer, ...uniqueDistractors].sort(() => 0.5 - Math.random());
    }

    const header =
      subMode === 'choices'
        ? lang === 'uz'
          ? `❓ <b>Savol #${questionNumber}</b> (Natija: ${stats.correct}/${stats.total})\n` +
            `So‘z: ${fromFlag} <b>${escapeHtml(questionPrompt)}</b>\n\n` +
            `To‘g‘ri <b>${targetLangName}</b> tarjimani tanlang:`
          : `❓ <b>Вопрос #${questionNumber}</b> (Счёт: ${stats.correct}/${stats.total})\n` +
            `Слово: ${fromFlag} <b>${escapeHtml(questionPrompt)}</b>\n\n` +
            `Выберите правильный перевод на <b>${targetLangName}</b>:`
        : lang === 'uz'
          ? `❓ <b>Savol #${questionNumber}</b> (Natija: ${stats.correct}/${stats.total})\n` +
            `So‘z: ${fromFlag} <b>${escapeHtml(questionPrompt)}</b>\n\n` +
            `✍️ <b>${targetLangName}</b> tarjimasini yozing:`
          : `❓ <b>Вопрос #${questionNumber}</b> (Счёт: ${stats.correct}/${stats.total})\n` +
            `Слово: ${fromFlag} <b>${escapeHtml(questionPrompt)}</b>\n\n` +
            `✍️ Напишите перевод на <b>${targetLangName}</b>:`;

    const nextRecentWordIds = [...recentWordIds.slice(-maxRecent), target.id];

    const payload: FullPracticePayload = {
      mode: 'full_practice',
      subMode,
      stats,
      currentWordId: target.id,
      wordEn: target.wordEn,
      translationRu: target.translationRu,
      direction,
      questionPrompt,
      correctAnswer,
      options,
      baseHeader: header,
      hintPresses: 0,
      recentWordIds: nextRecentWordIds,
    };

    await setState(userId, 'QUIZ_ACTIVE', {
      wordId: target.id,
      direction,
      payload,
    });

    const inlineKeyboardRows: any[] = [];
    if (subMode === 'choices') {
      for (let idx = 0; idx < options.length; idx++) {
        inlineKeyboardRows.push([
          Markup.button.callback(options[idx]!, `fp_ans:${idx}`),
        ]);
      }
      inlineKeyboardRows.push([
        Markup.button.callback(lang === 'uz' ? '🤷 Bilmayman' : '🤷 Не знаю ответ', 'fp_dont_know'),
        Markup.button.callback(lang === 'uz' ? '🛑 To‘xtatish' : '🛑 Остановить опрос', 'fp_stop'),
      ]);
    } else {
      inlineKeyboardRows.push([
        Markup.button.callback(lang === 'uz' ? '💡 Maslahat' : '💡 Подсказка', 'fp_hint'),
        Markup.button.callback(lang === 'uz' ? '🤷 Bilmayman' : '🤷 Не знаю ответ', 'fp_dont_know'),
      ]);
      inlineKeyboardRows.push([
        Markup.button.callback(lang === 'uz' ? '🛑 To‘xtatish' : '🛑 Остановить опрос', 'fp_stop'),
      ]);
    }

    await ctx.reply(header, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(inlineKeyboardRows),
    });
  };

  const stopPractice = async (ctx: Context, userId: bigint, lang: Lang, customStats?: FullPracticeStats) => {
    let stats = customStats;
    if (!stats) {
      const session = await prisma.userSession.findUnique({ where: { userId } });
      stats = (session?.payload as any)?.stats ?? { total: 0, correct: 0, wrong: 0 };
    }

    await resetState(userId);

    const accuracy = stats && stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

    const summaryText =
      lang === 'uz'
        ? `🏁 <b>Mashg‘ulot yakunlandi!</b>\n\n` +
          `📊 <b>Natijalar:</b>\n` +
          `• Jami savollar: <b>${stats ? stats.total : 0}</b>\n` +
          `• ✅ To‘g‘ri: <b>${stats ? stats.correct : 0}</b>\n` +
          `• ❌ Xato: <b>${stats ? stats.wrong : 0}</b>\n` +
          `• 🎯 Aniqlik: <b>${accuracy}%</b>\n\n` +
          `Qayta boshlash uchun pastdagi menyudan so‘rov turini tanlang!`
        : `🏁 <b>Опрос завершён!</b>\n\n` +
          `📊 <b>Результаты тренировки:</b>\n` +
          `• Всего вопросов: <b>${stats ? stats.total : 0}</b>\n` +
          `• ✅ Правильно: <b>${stats ? stats.correct : 0}</b>\n` +
          `• ❌ Ошибок: <b>${stats ? stats.wrong : 0}</b>\n` +
          `• 🎯 Точность: <b>${accuracy}%</b>\n\n` +
          `Отличная работа! Чтобы продолжить в любой момент, выберите нужный режим опроса в меню.`;

    await ctx.reply(summaryText, {
      parse_mode: 'HTML',
      ...deps.mainReplyKeyboard(lang),
    });
  };

  const startFullPractice = async (
    ctx: Context,
    userId: bigint,
    lang: Lang,
    subMode: PracticeSubMode = 'typing'
  ) => {
    const wordCount = await prisma.word.count({ where: { userId } });
    if (wordCount === 0) {
      const emptyText =
        lang === 'uz'
          ? 'Lug‘atingizda hozircha so‘zlar yo‘q. Yangi so‘z qo‘shish uchun «➕ So‘z qo‘shish» tugmasini bosing.'
          : 'В вашем словаре пока нет слов. Нажмите «➕ Добавить слово», чтобы добавить слова для тренировки!';
      await ctx.reply(emptyText, {
        parse_mode: 'HTML',
        ...deps.mainReplyKeyboard(lang),
      });
      return;
    }

    const startNotice =
      subMode === 'choices'
        ? lang === 'uz'
          ? `🚀 <b>To‘liq so‘rov (4 variant) boshlandi!</b>\n` +
            `Lug‘atdagi jami <b>${wordCount}</b> ta so‘z bo‘yicha to‘xtovsiz so‘rov.\n` +
            `Tugmalardan to‘g‘ri javobni tanlang.\n` +
            `To‘xtatish uchun istalgan vaqtda <b>«🛑 So‘rovni to‘xtatish»</b> tugmasini bosing.`
          : `🚀 <b>Опрос с 4 вариантами ответов запущен!</b>\n` +
            `Тренировка по всем <b>${wordCount}</b> словам словаря.\n` +
            `Выбирайте правильный ответ из 4 кнопок.\n` +
            `Когда захотите сделать паузу, нажмите кнопку <b>«🛑 Остановить опрос»</b>.`
        : lang === 'uz'
          ? `🚀 <b>To‘liq so‘rov (Yozma) boshlandi!</b>\n` +
            `Lug‘atdagi jami <b>${wordCount}</b> ta so‘z bo‘yicha to‘xtovsiz so‘rov.\n` +
            `Tarjimalarni xabarlar orqali yozib yuboring (kerak bo‘lsa 💡 ishorani bosing).\n` +
            `To‘xtatish uchun istalgan vaqtda <b>«🛑 So‘rovni to‘xtatish»</b> tugmasini bosing.`
          : `🚀 <b>Опрос со вводом слова запущен!</b>\n` +
            `Тренировка по всем <b>${wordCount}</b> словам словаря.\n` +
            `Пишите перевод сообщением прямо в чат (при необходимости жмите 💡 Подсказка).\n` +
            `Когда захотите сделать паузу, нажмите кнопку <b>«🛑 Остановить опрос»</b>.`;

    await ctx.reply(startNotice, {
      parse_mode: 'HTML',
      ...deps.stopReplyKeyboard(lang),
    });

    const initialStats: FullPracticeStats = { total: 0, correct: 0, wrong: 0 };
    await sendNextQuestion(ctx, userId, lang, initialStats, subMode);
  };

  const handleAnswerEvaluation = async (
    ctx: Context,
    userId: bigint,
    lang: Lang,
    payload: FullPracticePayload,
    isCorrect: boolean,
    userGivenAnswer: string
  ) => {
    const stats: FullPracticeStats = {
      total: payload.stats.total + 1,
      correct: payload.stats.correct + (isCorrect ? 1 : 0),
      wrong: payload.stats.wrong + (isCorrect ? 0 : 1),
    };

    // Update review schedule in database if review exists
    let newStage = 0;
    try {
      const review = await prisma.review.findFirst({
        where: { userId, wordId: payload.currentWordId, direction: payload.direction },
      });
      if (review) {
        const updated = await applyRating(
          review,
          isCorrect ? 'GOOD' : 'HARD',
          isCorrect ? 'CORRECT' : 'INCORRECT',
          payload.direction,
          userGivenAnswer
        );
        newStage = updated.stage;
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await recordCompletion(user, isCorrect);
      }
    } catch {
      // Non-fatal, continue continuous practice
    }

    const pairHtml = `<b>${escapeHtml(payload.wordEn)}</b> — <b>${escapeHtml(payload.translationRu)}</b>`;

    const starCount = Math.min(3, Math.max(0, newStage));
    const stars = '⭐'.repeat(starCount) + '☆'.repeat(3 - starCount);

    let progressNote = '';
    if (isCorrect) {
      if (newStage >= 3) {
        progressNote =
          lang === 'uz'
            ? `\n🏆 <b>So‘z to‘liq yodlandi! Uni aniq bilasiz!</b> (${stars})`
            : `\n🏆 <b>Слово выучено! Вы точно его знаете!</b> (${stars})`;
      } else {
        progressNote =
          lang === 'uz'
            ? `\n📈 <b>Daraja:</b> ${starCount}/3 (${stars})`
            : `\n📈 <b>Прогресс:</b> ${starCount}/3 (${stars})`;
      }
    } else {
      progressNote =
        lang === 'uz'
          ? `\n📉 <i>Xato: so‘z yana so‘raladi!</i>`
          : `\n📉 <i>Ошибка: слово будет повторено ещё раз!</i>`;
    }

    let feedback: string;
    const isExplicitDontKnow =
      userGivenAnswer === 'Не знаю' || userGivenAnswer === 'Bilmayman' || userGivenAnswer === '?';

    if (isExplicitDontKnow) {
      feedback =
        lang === 'uz'
          ? `💡 <b>To‘g‘ri javob:</b>\n${pairHtml}${progressNote}`
          : `💡 <b>Правильный перевод:</b>\n${pairHtml}${progressNote}`;
    } else if (isCorrect) {
      feedback =
        lang === 'uz'
          ? `✅ <b>To‘g‘ri!</b>\n${pairHtml}${progressNote}`
          : `✅ <b>Верно!</b>\n${pairHtml}${progressNote}`;
    } else {
      feedback =
        lang === 'uz'
          ? `❌ <b>Noto‘g‘ri!</b> (Sizning javobingiz: <i>${escapeHtml(userGivenAnswer)}</i>)\n💡 <b>To‘g‘ri javob:</b>\n${pairHtml}${progressNote}`
          : `❌ <b>Неверно!</b> (Ваш ответ: <i>${escapeHtml(userGivenAnswer)}</i>)\n💡 <b>Правильный перевод:</b>\n${pairHtml}${progressNote}`;
    }

    await ctx.reply(feedback, { parse_mode: 'HTML' });

    // IMMEDIATELY SEND NEXT QUESTION (Continuous!)
    const currentRecent = Array.isArray(payload.recentWordIds) ? payload.recentWordIds : [];
    const updatedRecent = [...currentRecent, payload.currentWordId];
    await sendNextQuestion(ctx, userId, lang, stats, payload.subMode || 'typing', updatedRecent);
  };

  const handleFullPracticeCallback = async (
    ctx: Context,
    userId: bigint,
    lang: Lang,
    data: string,
    session: UserSession
  ) => {
    if (data === 'fp_stop') {
      await ctx.answerCbQuery();
      const payload = session.payload as FullPracticePayload | undefined;
      await stopPractice(ctx, userId, lang, payload?.stats);
      return;
    }

    if (data === 'fp_dont_know') {
      const payload = session.payload as FullPracticePayload | undefined;
      if (!payload) {
        await ctx.answerCbQuery(lang === 'uz' ? 'Savol muddati o‘tgan' : 'Вопрос устарел');
        return;
      }
      await ctx.answerCbQuery();
      await handleAnswerEvaluation(
        ctx,
        userId,
        lang,
        payload,
        false,
        lang === 'uz' ? 'Bilmayman' : 'Не знаю'
      );
      return;
    }

    if (data === 'fp_hint') {
      const payload = session.payload as FullPracticePayload | undefined;
      if (!payload) {
        await ctx.answerCbQuery(lang === 'uz' ? 'Xatolik' : 'Ошибка');
        return;
      }

      const targetWord = (payload.direction === 'RU_TO_EN' ? payload.wordEn : payload.translationRu)
        .split(/[,;/]+/)[0]
        ?.trim() || payload.correctAnswer;

      const currentPress = Number(payload.hintPresses ?? 0) || 0;
      if (currentPress >= 3) {
        await ctx.answerCbQuery(
          lang === 'uz' ? 'Barcha ishoralar ko‘rsatildi (3/3)!' : 'Все подсказки уже открыты (3/3)!'
        );
        return;
      }

      const nextPress = currentPress + 1;
      const masked = generateSmartHint(targetWord, nextPress);

      await ctx.answerCbQuery(lang === 'uz' ? `💡 Ishora (${nextPress}/3)` : `💡 Подсказка (${nextPress}/3)`);

      const updatedPayload: FullPracticePayload = {
        ...payload,
        hintPresses: nextPress,
      };

      await prisma.userSession.update({
        where: { userId },
        data: { payload: updatedPayload as any },
      });

      const baseHeader = typeof payload.baseHeader === 'string' ? payload.baseHeader : '';
      const hintLabel = lang === 'uz' ? '💡 <b>Ishora:</b>' : '💡 <b>Подсказка:</b>';
      const newText = `${baseHeader}\n\n${hintLabel} <code>${escapeHtml(masked)}</code> (${nextPress}/3)`;

      const inlineKeyboardRows: any[] = [];
      if (payload.subMode === 'choices' && Array.isArray(payload.options) && payload.options.length > 0) {
        for (let idx = 0; idx < payload.options.length; idx++) {
          inlineKeyboardRows.push([
            Markup.button.callback(payload.options[idx]!, `fp_ans:${idx}`),
          ]);
        }
        inlineKeyboardRows.push([
          Markup.button.callback(lang === 'uz' ? '🤷 Bilmayman' : '🤷 Не знаю ответ', 'fp_dont_know'),
          Markup.button.callback(lang === 'uz' ? '🛑 To‘xtatish' : '🛑 Остановить опрос', 'fp_stop'),
        ]);
      } else {
        inlineKeyboardRows.push([
          Markup.button.callback(lang === 'uz' ? '💡 Maslahat' : '💡 Подсказка', 'fp_hint'),
          Markup.button.callback(lang === 'uz' ? '🤷 Bilmayman' : '🤷 Не знаю ответ', 'fp_dont_know'),
        ]);
        inlineKeyboardRows.push([
          Markup.button.callback(lang === 'uz' ? '🛑 To‘xtatish' : '🛑 Остановить опрос', 'fp_stop'),
        ]);
      }

      try {
        await ctx.editMessageText(newText, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard(inlineKeyboardRows),
        });
      } catch {
        // Fall back gracefully if edit fails
      }
      return;
    }

    if (data.startsWith('fp_ans:')) {
      const idx = parseInt(data.replace('fp_ans:', ''), 10);
      const payload = session.payload as FullPracticePayload | undefined;

      if (!payload || !Array.isArray(payload.options) || idx < 0 || idx >= payload.options.length) {
        await ctx.answerCbQuery(lang === 'uz' ? 'Savol muddati o‘tgan' : 'Вопрос устарел');
        const hintMsg =
          lang === 'uz'
            ? 'ℹ️ <i>Bu savol muddati o‘tgan. Yangi so‘rov boshlash uchun menyudan tugmani tanlang!</i>'
            : 'ℹ️ <i>Этот вопрос уже неактуален (бот был обновлён). Нажмите на кнопку опроса в меню внизу, чтобы начать!</i>';
        await ctx.reply(hintMsg, {
          parse_mode: 'HTML',
          ...deps.mainReplyKeyboard(lang),
        });
        return;
      }

      await ctx.answerCbQuery();

      const chosenOption = payload.options[idx];
      if (!chosenOption) {
        return;
      }
      const isCorrect =
        chosenOption.trim().toLowerCase() === payload.correctAnswer.trim().toLowerCase() ||
        answersEqual(payload.correctAnswer, chosenOption) ||
        answersEqualEnglish(payload.correctAnswer, chosenOption);

      await handleAnswerEvaluation(ctx, userId, lang, payload, isCorrect, chosenOption);
    }
  };

  const handleFullPracticeText = async (
    ctx: Context,
    userId: bigint,
    lang: Lang,
    text: string,
    session: UserSession
  ) => {
    const trimmed = text.trim();
    if (
      trimmed === '🛑 Остановить опрос' ||
      trimmed === '🛑 So‘rovni to‘xtatish' ||
      trimmed === '/stop' ||
      trimmed.toLowerCase() === 'стоп' ||
      trimmed.toLowerCase() === 'stop'
    ) {
      const payload = session.payload as FullPracticePayload | undefined;
      await stopPractice(ctx, userId, lang, payload?.stats);
      return;
    }

    const payload = session.payload as FullPracticePayload | undefined;
    if (!payload || !payload.correctAnswer) {
      await stopPractice(ctx, userId, lang);
      return;
    }

    const lower = trimmed.toLowerCase();
    if (
      lower === 'не знаю' ||
      lower === 'хз' ||
      lower === '?' ||
      lower === 'dont know' ||
      lower === "don't know" ||
      lower === 'bilmayman'
    ) {
      await handleAnswerEvaluation(
        ctx,
        userId,
        lang,
        payload,
        false,
        lang === 'uz' ? 'Bilmayman' : 'Не знаю'
      );
      return;
    }

    if (
      lower === 'подсказка' ||
      lower === 'подскажи' ||
      lower === 'hint' ||
      lower === 'help' ||
      lower === 'ishora' ||
      lower === 'maslahat'
    ) {
      const currentPress = Number(payload.hintPresses ?? 0) || 0;
      const nextPress = Math.min(3, currentPress + 1);
      const targetWord = (payload.direction === 'RU_TO_EN' ? payload.wordEn : payload.translationRu)
        .split(/[,;/]+/)[0]
        ?.trim() || payload.correctAnswer;
      const masked = generateSmartHint(targetWord, nextPress);

      const updatedPayload: FullPracticePayload = {
        ...payload,
        hintPresses: nextPress,
      };
      await prisma.userSession.update({
        where: { userId },
        data: { payload: updatedPayload as any },
      });

      const hintLabel = lang === 'uz' ? '💡 <b>Ishora:</b>' : '💡 <b>Подсказка:</b>';
      await ctx.reply(`${hintLabel} <code>${escapeHtml(masked)}</code> (${nextPress}/3)`, {
        parse_mode: 'HTML',
      });
      return;
    }

    const checkRes = await checkAnswerAsync(
      payload.direction,
      payload.wordEn,
      payload.translationRu,
      trimmed
    );

    await handleAnswerEvaluation(ctx, userId, lang, payload, checkRes.correct, trimmed);
  };

  return {
    startFullPractice,
    stopPractice,
    handleFullPracticeCallback,
    handleFullPracticeText,
  };
};
