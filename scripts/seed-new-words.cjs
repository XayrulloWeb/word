/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { prisma } = require('../dist/db/client.js');
const { addWordForUser } = require('../dist/services/reviewService.js');

const USER_ID = BigInt(process.env.ADMIN_TELEGRAM_ID || 2053141062);

const newWords = [
  ['Always', 'Всегда'],
  ['Usually', 'Обычно'],
  ['Scratch', 'Царапать, чесать'],
  ['Crash', 'Разбиваться, авария, крушение'],
  ['Miss', 'Скучать, пропускать'],
  ['Pray', 'Молиться'],
  ['Draw', 'Рисовать, тянуть'],
  ['Throw', 'Бросать, кидать'],
  ['Apply', 'Применять, подавать заявление'],
  ['Cancel', 'Отменять'],
  ['Submarine', 'Подводная лодка, субмарина'],
  ['Caterpillar', 'Гусеница'],
  ['Prompt', 'Подсказка, побуждать'],
  ['Rubbish', 'Мусор'],
  ['Recycle', 'Перерабатывать, утилизировать'],
  ['Climate', 'Климат'],
  ['Extinct', 'Вымерший, угасший'],
  ['Script', 'Сценарий, скрипт'],
  ['Cast', 'Актерский состав, бросать'],
  ['Often', 'Часто'],
  ['Sometimes', 'Иногда'],
  ['Rarely', 'Редко'],
  ['Seldom', 'Редко, изредка'],
  ['Never', 'Никогда'],
  ['Behave yourself', 'Веди себя хорошо, веди себя прилично'],
  ['Quiz show', 'Телевикторина, викторина'],
  ['Overtime', 'Сверхурочные, овертайм'],
  ['Normally', 'Обычно, нормально'],
  ['Politician', 'Политик'],
  ['Campaign', 'Кампания'],
  ['Election', 'Выборы'],
  ['Vote', 'Голосовать, голос'],
  ['Matter', 'Иметь значение, дело, материя'],
  ['Perceive', 'Воспринимать, ощущать'],
  ['Flavour', 'Вкус, аромат'],
  ['Selfish', 'Эгоистичный'],
  ['Sniff', 'Нюхать, сопеть'],
  ['Forehead', 'Лоб'],
  ['Idiom', 'Идиома'],
  ['Pretty', 'Довольно, красивый, симпатичный'],
  ['Radiator', 'Радиатор, батарея'],
  ['Generous', 'Щедрый, великодушный'],
  ['Visible', 'Видимый, заметный'],
  ['Emotion', 'Эмоция, чувство'],
  ['Exact', 'Точный'],
  ['Emphasis', 'Акцент, ударение, особое внимание'],
];

async function main() {
  console.log(`Starting word import for user ${USER_ID}... Total words: ${newWords.length}`);
  let added = 0;
  let skipped = 0;

  for (const [wordEn, translationRu] of newWords) {
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
