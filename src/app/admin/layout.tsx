import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Shield } from 'lucide-react'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  let isAdmin = false

  if (token) {
    const payload = await verifyToken(token)
    if (payload?.role === 'SUPER_ADMIN') {
      isAdmin = true
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" />
            <span className="font-bold text-lg tracking-tight">Pace Admin</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-4 text-sm font-medium">
              <Link href="/admin" className="hover:text-blue-300 transition-colors">仪表盘</Link>
              <Link href="/" className="hover:text-blue-300 transition-colors">返回应用</Link>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col">
         {children}
      </main>
    </div>
  )
}
