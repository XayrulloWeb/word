/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config();
const { prisma } = require('../dist/db/client.js');

const USER_ID = BigInt(process.env.ADMIN_TELEGRAM_ID || 2053141062);

async function main() {
  console.log(`Resetting all reviews to unlearned (stage 0) for user ${USER_ID}...`);
  const res = await prisma.review.updateMany({
    where: { userId: USER_ID },
    data: {
      stage: 0,
      hardStreak: 0,
      lastResult: null,
      lastAnswerText: null,
      lastReviewAt: null,
      intervalMinutes: 5,
    },
  });
  console.log(`Updated ${res.count} review cards to stage 0!`);

  await prisma.userSession.updateMany({
    where: { userId: USER_ID },
    data: {
      state: 'IDLE',
      payload: null,
      wordId: null,
      direction: null,
      reviewId: null,
    },
  });
  console.log('User session reset to IDLE.');
}

main().finally(() => prisma.$disconnect());
