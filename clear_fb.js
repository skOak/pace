const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.feedback.deleteMany({});
  console.log('Deleted feedbacks:', result);
}

main().finally(() => prisma.$disconnect());
