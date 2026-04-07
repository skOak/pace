import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { UserManagementTable } from '@/components/admin/UserManagementTable'

export default async function AdminUsersPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  
  if (!token) redirect('/admin/login')
  const payload = await verifyToken(token)
  if (payload?.role !== 'SUPER_ADMIN') redirect('/admin/login')

  const recentUsers = await prisma.user.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      _count: {
        select: { tasks: true, habitTemplates: true, goals: true }
      }
    },
    take: 50,
  })

  // Format the date for the client component
  const serializedUsers = recentUsers.map((u: any) => ({
    ...u,
    created_at: u.created_at.toISOString()
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">用户控制台</h1>
        <p className="text-gray-500 mt-1">全站账号管理、权限升降级及风控。</p>
      </div>
      <UserManagementTable initialUsers={serializedUsers} currentUserUid={payload.uid as string} />
    </div>
  )
}
