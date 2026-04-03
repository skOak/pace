'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Turnstile } from '@marsidev/react-turnstile'
import { useAuth } from '@/components/providers/AuthProvider'

export default function AdminLoginPage() {
  const router = useRouter()
  const { refreshAuth } = useAuth()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSendCode = async () => {
    if (!phone || !turnstileToken) return alert('请通过人机验证并填写手机号')
    setLoading(true)
    const res = await fetch('/api/auth/send-code', {
      method: 'POST', body: JSON.stringify({ phone, turnstileToken })
    })
    setLoading(false)
    if (!res.ok) alert('发送失败')
    else alert('验证码发送成功 (内测可用 888888)')
  }

  const handleLogin = async () => {
    setLoading(true)
    const payload = {
        phone,
        code,
        role: 'SUPER_ADMIN'
    }
    const res = await fetch('/api/auth/login', {
      method: 'POST', body: JSON.stringify(payload)
    })
    setLoading(false)
    if (res.ok) {
      await refreshAuth()
      router.push('/admin')
    } else {
      alert('登录失败，可能是验证码错误')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-sm w-full">
        <h1 className="text-2xl font-bold mb-2">超级管理员入口</h1>
        <p className="text-gray-500 text-sm mb-6">请输入管理员手机号验证身份</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">手机号</label>
            <input 
              type="text" 
              className="w-full border border-gray-200 rounded-lg p-2 outline-none focus:border-blue-500" 
              value={phone} onChange={e => setPhone(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">验证码</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="w-full border border-gray-200 rounded-lg p-2 outline-none focus:border-blue-500" 
                value={code} onChange={e => setCode(e.target.value)} 
              />
              <button 
                onClick={handleSendCode} 
                disabled={loading || !phone || !turnstileToken}
                className="bg-gray-100 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                获取
              </button>
            </div>
          </div>
          
          <div className="my-2 flex flex-col items-center gap-1 justify-center">
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} onSuccess={setTurnstileToken} />
          </div>

          <button 
            type="button" 
            onClick={handleLogin}
            disabled={loading || !phone || !code}
            className="w-full py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            进入系统
          </button>
        </div>
      </div>
    </div>
  )
}
