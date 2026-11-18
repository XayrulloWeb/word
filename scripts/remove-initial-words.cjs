/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { prisma } = require('../dist/db/client.js');

const USER_ID = BigInt(process.env.ADMIN_TELEGRAM_ID || 2053141062);

// Words to keep (from the photo + words added recently):
const KEEP_WORDS_LOWER = new Set([
  'normally',
  'specific',
  'annoyance',
  'irritation',
  'landlord',
  'torch',
  'butler',
  'sun-bath',
  'confuse',
  'parcel',
  'bark',
  'upset',
  'exhaust',
  'recognise',
  'decorate',
  'dairy',
  'camp',
  'belong to',
  'come from',
  'listen to',
  'neither',
  'either',
]);

async function main() {
  console.log(`Cleaning initial words for user ${USER_ID}...`);

  const allWords = await prisma.word.findMany({
    where: { userId: USER_ID },
  });

  const wordsToDelete = allWords.filter(
    (w) => !KEEP_WORDS_LOWER.has(w.wordEn.toLowerCase().trim())
  );

  console.log(`Found ${allWords.length} total words.`);
  console.log(`Will delete ${wordsToDelete.length} initial words.`);

  for (const w of wordsToDelete) {
    await prisma.word.delete({ where: { id: w.id } });
    console.log(`- Deleted word [${w.id}]: "${w.wordEn}"`);
  }

  // Reset user session to start fresh
  await prisma.userSession.updateMany({
    where: { userId: USER_ID },
    data: { state: 'IDLE', payload: null, wordId: null, direction: null, reviewId: null },
  });

  const remaining = await prisma.word.findMany({
    where: { userId: USER_ID },
    orderBy: { id: 'asc' },
  });

  console.log(`\nRemaining words (${remaining.length}):`);
  remaining.forEach((w, i) => console.log(`${i + 1}. [${w.id}] ${w.wordEn} -> ${w.translationRu}`));
}

main().finally(() => prisma.$disconnect());
