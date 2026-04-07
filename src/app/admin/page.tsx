import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { Users, Activity, Target, ShieldCheck, Flame, Cpu, Eye, UserPlus } from 'lucide-react'

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

  // Calculate PV and UV for today
  const year = startOfToday.getFullYear();
  const month = String(startOfToday.getMonth() + 1).padStart(2, '0');
  const day = String(startOfToday.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const todayPv = await prisma.siteVisitLog.count({
    where: { date_str: dateStr }
  })

  // Group by distinct IPs to calculate UV
  const todayUvResult = await prisma.siteVisitLog.groupBy({
    by: ['ip'],
    where: { date_str: dateStr },
  })
  const todayUv = todayUvResult.length



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
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><Eye className="w-6 h-6"/></div>
          <div>
            <div className="text-sm text-gray-500 font-medium pb-1">今日全页面请求 (PV)</div>
            <div className="text-3xl font-bold">{todayPv}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg"><UserPlus className="w-6 h-6"/></div>
          <div>
            <div className="text-sm text-gray-500 font-medium pb-1">今日设备数 (UV)</div>
            <div className="text-3xl font-bold">{todayUv}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-orange-50 text-orange-500 rounded-lg"><Flame className="w-6 h-6"/></div>
          <div>
            <div className="text-sm text-gray-500 font-medium pb-1">已登活跃 (DAU)</div>
            <div className="text-3xl font-bold">{dau}</div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
          <div className="p-3 bg-slate-50 text-slate-800 rounded-lg"><ShieldCheck className="w-6 h-6"/></div>
          <div>
            <div className="text-sm text-gray-500 font-medium pb-1">已注册用户</div>
            <div className="text-3xl font-bold">{totalUsers}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
