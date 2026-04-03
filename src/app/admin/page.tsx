import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { Users, Activity, Target, ShieldCheck, Flame, Cpu } from 'lucide-react'
import { UserManagementTable } from '@/components/admin/UserManagementTable'

export default async function AdminDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  
  if (!token) redirect('/admin/login')
  const payload = await verifyToken(token)
  if (payload?.role !== 'SUPER_ADMIN') redirect('/admin/login')

  const totalUsers = await prisma.user.count()
  const superAdmins = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } })
  
  // Calculate DAU
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dauResult = await prisma.executionLog.groupBy({
    by: ['userId'],
    where: { startTime: { gte: startOfToday } },
  })
  const dau = dauResult.length

  const recentUsers = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
    take: 10,
    select: {
      uid: true,
      phone: true,
      nickname: true,
      role: true,
      level: true,
      created_at: true,
    }
  })

  // Format the date for the client component
  const serializedUsers = recentUsers.map((u: any) => ({
    ...u,
    created_at: u.created_at.toISOString()
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="mb-8 flex justify-between items-end border-b border-gray-200 pb-4">
        <h1 className="text-3xl flex items-center gap-3 font-bold text-gray-900">
           系统总览 <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">v1.1</span>
        </h1>
        <div className="flex gap-4 text-xs font-mono text-gray-500">
           <div className="flex items-center gap-1"><Cpu className="w-4 h-4 text-gray-400"/> 系统负载: ~12%</div>
           <div className="flex items-center gap-1"><Activity className="w-4 h-4 text-gray-400"/> API 耗时: 45ms</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-6 h-6"/></div>
          <div>
            <div className="text-sm text-gray-500 font-medium pb-1">总注册用户</div>
            <div className="text-3xl font-bold">{totalUsers}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-orange-50 text-orange-500 rounded-lg"><Flame className="w-6 h-6"/></div>
          <div>
            <div className="text-sm text-gray-500 font-medium pb-1">今日活跃 (DAU)</div>
            <div className="text-3xl font-bold">{dau}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-slate-50 text-slate-800 rounded-lg"><ShieldCheck className="w-6 h-6"/></div>
          <div>
            <div className="text-sm text-gray-500 font-medium pb-1">管理员账号</div>
            <div className="text-3xl font-bold">{superAdmins}</div>
          </div>
        </div>
      </div>

      <UserManagementTable initialUsers={serializedUsers} currentUserUid={payload.uid as string} />
    </div>
  )
}
