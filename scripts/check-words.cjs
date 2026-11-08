/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { prisma } = require('../dist/db/client.js');

async function main() {
  const words = await prisma.word.findMany({ orderBy: { id: 'asc' } });
  console.log(`Total words: ${words.length}`);
  for (const w of words) {
    console.log(`${w.id}: ${w.wordEn} -> ${w.translationRu}`);
  }
}

main().finally(() => prisma.$disconnect());
