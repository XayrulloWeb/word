/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { prisma } = require('../dist/db/client.js');

const wordUpdates = [
  ['Always', 'Всегда'],
  ['Usually', 'Обычно'],
  ['Scratch', 'Царапать, чесать'],
  ['Crash', 'Разбиваться, авария, крушение, разбиться'],
  ['Miss', 'Скучать, пропускать, пропустить'],
  ['Pray', 'Молиться, помолиться'],
  ['Draw', 'Рисовать, нарисовать, тянуть'],
  ['Throw', 'Бросать, бросить, кидать, кинуть'],
  ['Apply', 'Применять, подавать заявление, подавать заявку'],
  ['Cancel', 'Отменять, отменить, отмена'],
  ['Submarine', 'Подводная лодка, субмарина, подлодка'],
  ['Caterpillar', 'Гусеница'],
  ['Prompt', 'Подсказка, побуждать'],
  ['Rubbish', 'Мусор, хлам, отходы'],
  ['Recycle', 'Перерабатывать, переработать, утилизировать'],
  ['Climate', 'Климат'],
  ['Extinct', 'Вымерший, угасший, исчезнувший'],
  ['Script', 'Сценарий, скрипт'],
  ['Cast', 'Актерский состав, бросать, бросить, каст'],
  ['Often', 'Часто'],
  ['Sometimes', 'Иногда'],
  ['Rarely', 'Редко'],
  ['Seldom', 'Редко, изредка'],
  ['Never', 'Никогда'],
  ['Behave yourself', 'Веди себя хорошо, веди себя прилично'],
  ['Quiz show', 'Телевикторина, викторина'],
  ['Overtime', 'Сверхурочные, овертайм, сверхурочная работа'],
  ['Normally', 'Обычно, нормально, как обычно'],
  ['Politician', 'Политик'],
  ['Campaign', 'Кампания'],
  ['Election', 'Выборы'],
  ['Vote', 'Голосовать, проголосовать, голос'],
  ['Matter', 'Иметь значение, дело, материя, важно'],
  ['Perceive', 'Воспринимать, воспринять, ощущать, ощутить'],
  ['Flavour', 'Вкус, аромат'],
  ['Selfish', 'Эгоистичный, эгоист'],
  ['Sniff', 'Нюхать, понюхать, сопеть'],
  ['Forehead', 'Лоб'],
  ['Idiom', 'Идиома, фразеологизм'],
  ['Pretty', 'Довольно, красивый, симпатичный, милый'],
  ['Radiator', 'Радиатор, батарея, обогреватель'],
  ['Generous', 'Щедрый, великодушный'],
  ['Visible', 'Видимый, заметный, видный'],
  ['Emotion', 'Эмоция, чувство'],
  ['Exact', 'Точный, именно'],
  ['Emphasis', 'Акцент, ударение, особое внимание'],
];

async function main() {
  console.log(`Fixing Russian translations for ${wordUpdates.length} words...`);
  let updated = 0;
  for (const [wordEn, translationRu] of wordUpdates) {
    const res = await prisma.word.updateMany({
      where: { wordEn: { equals: wordEn, mode: 'insensitive' } },
      data: { translationRu },
    });
    console.log(`✓ ${wordEn} -> ${translationRu} (updated ${res.count})`);
    updated += res.count;
  }
  console.log(`Done! Total words updated: ${updated}`);
}

main().finally(() => prisma.$disconnect());
