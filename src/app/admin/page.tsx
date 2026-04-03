'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AdminPage() {
  const { user, status } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && status !== 'loading') {
      if (!user || user.role !== 'SUPER_ADMIN') {
        alert('无权访问此页面')
        router.push('/')
      }
    }
  }, [mounted, status, user, router])

  if (!mounted || status === 'loading') return <div className="p-8 text-gray-500">加载权限中...</div>
  
  if (!user || user.role !== 'SUPER_ADMIN') return null

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Pace 超级管理后台</h1>
      <div className="bg-white rounded-xl shadow-sm border p-6 max-w-sm">
        <h2 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">系统概览</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">注册用户总数</span>
            <span className="font-semibold text-gray-800">1</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 text-sm">今日活跃人数</span>
            <span className="font-semibold text-green-600">1</span>
          </div>
        </div>
        <p className="mt-6 text-xs text-gray-400 bg-gray-50 rounded p-2 text-center">
          注: 极简版面暂未接入实时 API
        </p>
      </div>
    </div>
  )
}
