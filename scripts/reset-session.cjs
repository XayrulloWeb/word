/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { prisma } = require('../dist/db/client.js');

async function main() {
  const sessions = await prisma.userSession.findMany();
  console.log(`Sessions count: ${sessions.length}`);
  for (const s of sessions) {
    console.log(`User ${s.userId}: state=${s.state}, payload=${JSON.stringify(s.payload)}`);
  }
  // Reset any active session so user starts fresh with UTF-8 words
  await prisma.userSession.updateMany({
    data: { state: 'IDLE', payload: null, wordId: null, direction: null, reviewId: null },
  });
  console.log('User sessions reset to IDLE.');
}

main().finally(() => prisma.$disconnect());
