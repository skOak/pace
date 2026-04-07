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
  const [agreed, setAgreed] = useState(false)

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) return alert('请输入11位有效的中国内地手机号')
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
    if (!/^1[3-9]\d{9}$/.test(phone)) return alert('请输入11位有效的中国内地手机号')
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
                disabled={loading || !phone || !turnstileToken || !agreed}
                className="bg-gray-100 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                获取
              </button>
            </div>
          </div>
          
          <div className="my-2 flex flex-col items-center gap-1 justify-center">
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} onSuccess={setTurnstileToken} />
          </div>

          <div className="flex items-center gap-2 mt-4 mb-2">
            <input 
              type="checkbox" 
              id="privacy" 
              className="w-4 h-4 rounded border-gray-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <label htmlFor="privacy" className="text-xs text-gray-500 cursor-pointer selection:bg-transparent">
              我已阅读并同意 <a href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">《隐私条款》</a>
            </label>
          </div>

          <button 
            type="button" 
            onClick={handleLogin}
            disabled={loading || !phone || !code || !agreed}
            className="w-full mt-2 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            进入系统
          </button>
        </div>
      </div>
    </div>
  )
}
