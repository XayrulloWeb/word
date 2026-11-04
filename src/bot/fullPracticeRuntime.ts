import type { Context } from 'telegraf';
import { Markup } from 'telegraf';
import { prisma } from '../db/client';
import { setState, resetState } from '../services/sessionService';
import type { UserSession } from '../generated/prisma/client';
import { checkAnswer } from '../services/answerChecker';
import { applyRating } from '../services/reviewService';
import { recordCompletion } from '../services/userService';
import type { Lang } from '../i18n';
import { escapeHtml } from '../utils/html';

export interface FullPracticeStats {
  total: number;
  correct: number;
  wrong: number;
  [key: string]: unknown;
}

export interface FullPracticePayload {
  mode: 'full_practice';
  stats: FullPracticeStats;
  currentWordId: number;
  wordEn: string;
  translationRu: string;
  direction: 'EN_TO_RU' | 'RU_TO_EN';
  questionPrompt: string;
  correctAnswer: string;
  options: string[];
  [key: string]: unknown;
}

export const isFullPracticeCallbackData = (data: string): boolean => {
  return data.startsWith('fp_ans:') || data === 'fp_stop' || data === 'fp_dont_know';
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
    stats: FullPracticeStats
  ) => {
    const userWords = await prisma.word.findMany({
      where: { userId },
      select: { id: true, wordEn: true, translationRu: true },
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

    // Pick random target word
    const target = userWords[Math.floor(Math.random() * userWords.length)];
    if (!target) {
      return;
    }

    // Direction: 50% EN -> RU, 50% RU -> EN
    const isEnToRu = Math.random() < 0.5;
    const direction: 'EN_TO_RU' | 'RU_TO_EN' = isEnToRu ? 'EN_TO_RU' : 'RU_TO_EN';
    const questionPrompt = isEnToRu ? target.wordEn : target.translationRu;
    const correctAnswer = isEnToRu ? target.translationRu : target.wordEn;

    const payload: FullPracticePayload = {
      mode: 'full_practice',
      stats,
      currentWordId: target.id,
      wordEn: target.wordEn,
      translationRu: target.translationRu,
      direction,
      questionPrompt,
      correctAnswer,
      options: [],
    };

    await setState(userId, 'QUIZ_ACTIVE', {
      wordId: target.id,
      direction,
      payload,
    });

    const questionNumber = stats.total + 1;
    const fromFlag = isEnToRu ? '🇬🇧' : '🇷🇺';
    const targetLangName = isEnToRu
      ? (lang === 'uz' ? 'o‘zbekcha/ruscha' : 'русском')
      : (lang === 'uz' ? 'inglizcha' : 'английском');

    const header =
      lang === 'uz'
        ? `❓ <b>Savol #${questionNumber}</b> (Natija: ${stats.correct}/${stats.total})\n` +
          `So‘z: ${fromFlag} <b>${escapeHtml(questionPrompt)}</b>\n\n` +
          `✍️ <b>${targetLangName}</b> tarjimasini yozing:`
        : `❓ <b>Вопрос #${questionNumber}</b> (Счёт: ${stats.correct}/${stats.total})\n` +
          `Слово: ${fromFlag} <b>${escapeHtml(questionPrompt)}</b>\n\n` +
          `✍️ Напишите перевод на <b>${targetLangName}</b>:`;

    // Only "Don't know" and "Stop" buttons - user types their own answer
    const inlineKeyboardRows = [
      [
        Markup.button.callback(lang === 'uz' ? '🤷 Bilmayman' : '🤷 Не знаю ответ', 'fp_dont_know'),
        Markup.button.callback(lang === 'uz' ? '🛑 To‘xtatish' : '🛑 Остановить опрос', 'fp_stop'),
      ],
    ];

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
          `Qayta boshlash uchun «🚀 To‘liq so‘rov» tugmasini bosing!`
        : `🏁 <b>Опрос завершён!</b>\n\n` +
          `📊 <b>Результаты тренировки:</b>\n` +
          `• Всего вопросов: <b>${stats ? stats.total : 0}</b>\n` +
          `• ✅ Правильно: <b>${stats ? stats.correct : 0}</b>\n` +
          `• ❌ Ошибок: <b>${stats ? stats.wrong : 0}</b>\n` +
          `• 🎯 Точность: <b>${accuracy}%</b>\n\n` +
          `Отличная работа! Чтобы продолжить опрос в любой момент, нажмите <b>«🚀 Начать опрос (Фулл)»</b>.`;

    await ctx.reply(summaryText, {
      parse_mode: 'HTML',
      ...deps.mainReplyKeyboard(lang),
    });
  };

  const startFullPractice = async (ctx: Context, userId: bigint, lang: Lang) => {
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
      lang === 'uz'
        ? `🚀 <b>To‘liq so‘rov boshlandi!</b>\n` +
          `Lug‘atdagi jami <b>${wordCount}</b> ta so‘z bo‘yicha to‘xtovsiz so‘rov.\n` +
          `Tarjimalarni xabarlar orqali yozib yuboring.\n` +
          `To‘xtatish uchun istalgan vaqtda <b>«🛑 So‘rovni to‘xtatish»</b> tugmasini bosing.`
        : `🚀 <b>Бесконечный опрос запущен!</b>\n` +
          `Тренировка по всем <b>${wordCount}</b> словам словаря.\n` +
          `Пишите перевод сообщением прямо в чат.\n` +
          `Когда захотите сделать паузу, нажмите кнопку <b>«🛑 Остановить опрос»</b>.`;

    await ctx.reply(startNotice, {
      parse_mode: 'HTML',
      ...deps.stopReplyKeyboard(lang),
    });

    const initialStats: FullPracticeStats = { total: 0, correct: 0, wrong: 0 };
    await sendNextQuestion(ctx, userId, lang, initialStats);
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
    try {
      const review = await prisma.review.findFirst({
        where: { userId, wordId: payload.currentWordId, direction: payload.direction },
      });
      if (review) {
        await applyRating(
          review,
          isCorrect ? 'GOOD' : 'HARD',
          isCorrect ? 'CORRECT' : 'INCORRECT',
          payload.direction,
          userGivenAnswer
        );
      }
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await recordCompletion(user, isCorrect);
      }
    } catch {
      // Non-fatal, continue continuous practice
    }

    const pairHtml = `<b>${escapeHtml(payload.wordEn)}</b> — <b>${escapeHtml(payload.translationRu)}</b>`;

    let feedback: string;
    const isExplicitDontKnow =
      userGivenAnswer === 'Не знаю' || userGivenAnswer === 'Bilmayman' || userGivenAnswer === '?';

    if (isExplicitDontKnow) {
      feedback =
        lang === 'uz'
          ? `💡 <b>To‘g‘ri javob:</b>\n${pairHtml}`
          : `💡 <b>Правильный перевод:</b>\n${pairHtml}`;
    } else if (isCorrect) {
      feedback =
        lang === 'uz'
          ? `✅ <b>To‘g‘ri!</b>\n${pairHtml}`
          : `✅ <b>Верно!</b>\n${pairHtml}`;
    } else {
      feedback =
        lang === 'uz'
          ? `❌ <b>Noto‘g‘ri!</b> (Sizning javobingiz: <i>${escapeHtml(userGivenAnswer)}</i>)\n💡 <b>To‘g‘ri javob:</b>\n${pairHtml}`
          : `❌ <b>Неверно!</b> (Ваш ответ: <i>${escapeHtml(userGivenAnswer)}</i>)\n💡 <b>Правильный перевод:</b>\n${pairHtml}`;
    }

    await ctx.reply(feedback, { parse_mode: 'HTML' });

    // IMMEDIATELY SEND NEXT QUESTION (Continuous!)
    await sendNextQuestion(ctx, userId, lang, stats);
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
      await ctx.answerCbQuery();
      const payload = session.payload as FullPracticePayload | undefined;
      if (!payload) return;
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

    if (data.startsWith('fp_ans:')) {
      const idx = parseInt(data.replace('fp_ans:', ''), 10);
      const payload = session.payload as FullPracticePayload | undefined;

      if (!payload || !Array.isArray(payload.options) || idx < 0 || idx >= payload.options.length) {
        await ctx.answerCbQuery(lang === 'uz' ? 'Savol muddati o‘tgan' : 'Вопрос устарел');
        return;
      }

      await ctx.answerCbQuery();

      const chosenOption = payload.options[idx];
      if (!chosenOption) {
        return;
      }
      const isCorrect = chosenOption.trim().toLowerCase() === payload.correctAnswer.trim().toLowerCase();

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

    const { correct } = checkAnswer(
      payload.direction,
      payload.wordEn,
      payload.translationRu,
      trimmed
    );

    await handleAnswerEvaluation(ctx, userId, lang, payload, correct, trimmed);
  };

  return {
    startFullPractice,
    stopPractice,
    handleFullPracticeCallback,
    handleFullPracticeText,
  };
};
