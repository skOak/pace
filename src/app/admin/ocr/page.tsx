import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OcrConfigPanel } from '@/components/admin/OcrConfigPanel'
import { OcrQuotaPanel } from '@/components/admin/OcrQuotaPanel'

export default async function AdminOcrPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth_token')?.value
  
  if (!token) redirect('/admin/login')
  const payload = await verifyToken(token)
  if (payload?.role !== 'SUPER_ADMIN') redirect('/admin/login')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="mb-8 border-b border-gray-200 pb-4">
        <h1 className="text-3xl font-bold text-gray-900">OCR 视觉模型网关</h1>
        <p className="text-gray-500 mt-1">管理多路识别接口凭证、设定等级调用量控制策略。</p>
      </div>
      <div className="flex flex-col gap-6 max-w-4xl">
        <OcrQuotaPanel />
        <OcrConfigPanel />
      </div>
    </div>
  )
}
