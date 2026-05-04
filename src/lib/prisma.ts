import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

declare global {
  var prismaGlobal2: undefined | ReturnType<typeof prismaClientSingleton>
}

import { startFeedbackNotifier } from './feedbackNotifier'

const prisma = globalThis.prismaGlobal2 ?? prismaClientSingleton()

// 启动后台定时器（10分钟巡检一次用户反馈）
startFeedbackNotifier()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal2 = prisma
