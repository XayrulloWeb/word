require('dotenv').config();
const { prisma } = require('../dist/db/client.js');
const { addWordForUser } = require('../dist/services/reviewService.js');

const USER_ID = BigInt(process.env.ADMIN_TELEGRAM_ID || 2053141062);

const words = [
  // 50 words from Image 1
  ["However", "Однако"],
  ["Although", "Хотя"],
  ["Instead", "Вместо этого"],
  ["Besides", "Кроме того"],
  ["Therefore", "Поэтому, следовательно"],
  ["Unless", "Если не"],
  ["Despite", "Несмотря на"],
  ["At least", "По крайней мере"],
  ["As soon as", "Как только"],
  ["Even though", "Несмотря на то что"],
  ["Achieve", "Достигать"],
  ["Afford", "Позволить себе"],
  ["Assume", "Предполагать"],
  ["Complain", "Жаловаться"],
  ["Consider", "Рассматривать, обдумывать"],
  ["Convince", "Убеждать"],
  ["Deliver", "Доставлять, сдавать результат"],
  ["Discover", "Обнаруживать, узнавать"],
  ["Encourage", "Поддерживать, побуждать"],
  ["Handle", "Справляться с чем-либо"],
  ["Involve", "Включать, вовлекать"],
  ["Maintain", "Поддерживать, обслуживать"],
  ["Mention", "Упоминать"],
  ["Offer", "Предлагать"],
  ["Prevent", "Предотвращать"],
  ["Provide", "Предоставлять, обеспечивать"],
  ["Recommend", "Рекомендовать"],
  ["Refuse", "Отказываться"],
  ["Remind", "Напоминать"],
  ["Replace", "Заменять"],
  ["Solve", "Решать проблему"],
  ["Suggest", "Предлагать, советовать"],
  ["Suppose", "Полагать, предполагать"],
  ["Trust", "Доверять"],
  ["Waste", "Тратить впустую"],
  ["Deal with", "Разбираться с чем-либо"],
  ["Run out of", "Израсходовать, остаться без чего-либо"],
  ["Get used to", "Привыкать к чему-либо"],
  ["Look forward to", "Ждать с нетерпением"],
  ["Make sure", "Убедиться, проследить"],
  ["Reliable", "Надёжный"],
  ["Confident", "Уверенный в себе"],
  ["Convenient", "Удобный"],
  ["Crowded", "Переполненный, многолюдный"],
  ["Likely", "Вероятный"],
  ["Similar", "Похожий"],
  ["Suitable", "Подходящий"],
  ["Necessary", "Необходимый"],
  ["Issue", "Проблема, вопрос"],
  ["Choice", "Выбор"],

  // 50 words from Image 2
  ["Actually", "На самом деле"],
  ["By the way", "Кстати"],
  ["Anyway", "В любом случае"],
  ["Basically", "В основном"],
  ["Probably", "Вероятно"],
  ["Maybe", "Может быть"],
  ["Especially", "Особенно"],
  ["Usually", "Обычно"],
  ["Suddenly", "Внезапно"],
  ["Finally", "Наконец"],
  ["Afterwards", "После этого"],
  ["Recently", "Недавно"],
  ["Already", "Уже"],
  ["Yet", "Ещё"],
  ["Still", "Всё ещё"],
  ["Meanwhile", "Тем временем"],
  ["Almost", "Почти"],
  ["Enough", "Достаточно"],
  ["Somewhere", "Где-то"],
  ["Somewhere else", "Где-то в другом месте"],
  ["Forget", "Забывать"],
  ["Remember", "Помнить"],
  ["Realize", "Осознавать"],
  ["Notice", "Замечать"],
  ["Figure out", "Разобраться, понять"],
  ["Find out", "Выяснить, узнать"],
  ["Manage", "Справляться, управлять"],
  ["Avoid", "Избегать"],
  ["Need", "Нуждаться"],
  ["Expect", "Ожидать"],
  ["Come in", "Входить"],
  ["Go out", "Выходить"],
  ["Stop by", "Заглянуть, зайти по пути"],
  ["Pick up", "Подобрать, забрать"],
  ["Drop off", "Высадить, завезти"],
  ["Find", "Находить"],
  ["Bring", "Приносить"],
  ["Borrow", "Брать взаймы"],
  ["Lend", "Давать взаймы"],
  ["Cancel", "Отменять"],
  ["Apply", "Подавать заявку, применять"],
  ["Get admitted", "Поступить, быть принятым"],
  ["Improve", "Улучшать, совершенствовать"],
  ["Attend", "Посещать, присутствовать"],
  ["Available", "Доступный"],
  ["Opportunity", "Возможность"],
  ["Requirement", "Требование"],
  ["Figure", "Цифра, фигура"],
  ["I mean", "Я имею в виду"],
  ["It depends", "Это зависит от ситуации"]
];

async function main() {
  console.log(`Starting word import for user ${USER_ID}... Total words: ${words.length}`);
  let added = 0;
  let skipped = 0;

  for (const [wordEn, translationRu] of words) {
    try {
      await addWordForUser(USER_ID, wordEn, translationRu);
      console.log(`+ Added: "${wordEn}" -> "${translationRu}"`);
      added++;
    } catch (err) {
      if (err.name === 'DuplicateWordError' || err.message?.includes('Duplicate')) {
        console.log(`= Already exists: "${wordEn}"`);
        skipped++;
      } else {
        console.error(`! Error adding "${wordEn}":`, err.message);
      }
    }
  }

  console.log(`Import finished! Added: ${added}, Skipped/Duplicates: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
