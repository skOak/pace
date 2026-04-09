import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const users = await prisma.user.findMany()
  console.log("Users:", users.map(u => u.uid))
  if (users.length > 0) {
    const tasks = await prisma.task.findMany()
    console.log(`Total Tasks:`, tasks.length)
    console.log(tasks.map(t => t.title))
  }
}
main().finally(() => prisma.$disconnect())
