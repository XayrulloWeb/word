/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { prisma } = require('../dist/db/client.js');
const { addWordForUser } = require('../dist/services/reviewService.js');

const USER_ID = BigInt(process.env.ADMIN_TELEGRAM_ID || 2053141062);

const newWords = [
  ['Specific', 'Специфический, особенный'],
  ['Annoyance', 'Раздражение, досада'],
  ['Irritation', 'Гнев, раздражение'],
  ['Landlord', 'Лендлорд, арендодатель, хозяин'],
  ['Torch', 'Фонарь, факел, фонарик'],
  ['Butler', 'Дворецкий, старший лакей'],
  ['Sun-bath', 'Солнечная ванна, загар, загорать'],
  ['Confuse', 'Смущенный, смущать, путать'],
  ['Parcel', 'Посылка, пакет, бандероль'],
  ['Bark', 'Кора, лай, лаять'],
  ['Upset', 'Огорчать, расстраивать, огорченный'],
  ['Exhaust', 'Уставать, истощать, изнурять'],
  ['Recognise', 'Узнать, узнавать, распознавать'],
  ['Decorate', 'Украшать, декорировать, украсить'],
  ['Dairy', 'Ежедневный, дневник'],
  ['Camp', 'Лагерь'],
  ['Belong to', 'Принадлежит к..., принадлежать'],
  ['Come from', 'Происходить, родом с..., быть родом из'],
  ['Listen to', 'Слушать, послушать'],
];

async function main() {
  console.log(`Adding ${newWords.length} new words for user ${USER_ID}...`);
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

  console.log(`Finished adding words! Added: ${added}, Skipped/Existing: ${skipped}`);

  // Reset active session so user starts immediately with the new words in rotation
  await prisma.userSession.updateMany({
    where: { userId: USER_ID },
    data: { state: 'IDLE', payload: null, wordId: null, direction: null, reviewId: null },
  });
  console.log('User session reset to IDLE.');
}

main().finally(() => prisma.$disconnect());
