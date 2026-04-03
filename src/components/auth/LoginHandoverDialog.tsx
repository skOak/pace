'use client'

import React, { useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/providers/AuthProvider'
import { db, hardResetDatabase } from '@/lib/db'
import { DataService } from '@/services/data-service'
import { SettingsService } from '@/services/settings-service'

export function LoginHandoverDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { refreshAuth } = useAuth()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [role, setRole] = useState<'USER'|'ASSISTANT'>('USER')
  const [step, setStep] = useState<'login' | 'handover'>('login')
  const [loading, setLoading] = useState(false)

  const handleSendCode = async () => {
    if (!phone || !turnstileToken) return alert('请填写手机号并通过人机验证')
    setLoading(true)
    const res = await fetch('/api/auth/send-code', {
      method: 'POST', body: JSON.stringify({ phone, turnstileToken })
    })
    setLoading(false)
    if (!res.ok) alert('发送失败')
    else alert('验证码已发送 (开发测试阶段输入任意内容验证失败则回退错误，输入 888888 万能验证码通过)')
  }

  const handleLogin = async () => {
    setLoading(true)
    const localProfile = await SettingsService.getProfile();
    const payload = { 
        phone, code, role, 
        nickname: localProfile?.name || undefined, 
        avatar: localProfile?.avatar || undefined 
    };
    const res = await fetch('/api/auth/login', {
      method: 'POST', body: JSON.stringify(payload)
    })
    setLoading(false)
    if (res.ok) {
      // Pre-check Dexie
      const taskCount = await db.tasks.count()
      if (taskCount > 0) {
         setStep('handover')
      } else {
         await refreshAuth()
         onOpenChange(false)
         window.location.reload()
      }
    } else {
      alert('登录失败: 验证码错误或过期')
    }
  }

  const handleMerge = async () => {
    // Sprint 14 merge logic placeholder: 
    // In future iterations, we iterate Dexie table and send to /api/sync/import-local
    alert('暂未实现上传合并，暂时仅切入登录态')
    await refreshAuth()
    onOpenChange(false)
    window.location.reload()
  }

  const handleWipeAndExport = async () => {
    try {
      const data = await DataService.exportData()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pace-export-${new Date().toISOString()}.json`
      a.click()
  
      await hardResetDatabase()
      await refreshAuth()
      onOpenChange(false)
      window.location.reload()
    } catch(e) {
      console.error(e)
      alert("导出失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'login' ? '登录 Pace 账号' : '发现离线数据冲突'}</DialogTitle>
        </DialogHeader>
        {step === 'login' ? (
          <div className="space-y-4 pt-4">
             <Input placeholder="输入您的手机号" value={phone} onChange={e => setPhone(e.target.value)} />
             <div className="flex gap-2">
               <Input placeholder="短信验证码" value={code} onChange={e => setCode(e.target.value)} />
               <Button onClick={handleSendCode} disabled={loading || !phone || !turnstileToken}>获取</Button>
             </div>
             <div className="flex items-center justify-between text-sm">
               <label className="font-medium text-gray-700">账户类型:</label>
               <select className="border border-gray-200 rounded p-1.5 focus:outline-none" value={role} onChange={e => setRole(e.target.value as any)}>
                 <option value="USER">标准用户计划 (标准权限)</option>
                 <option value="ASSISTANT">协助者计划 (协助权限)</option>
               </select>
             </div>
             <div className="my-2 flex flex-col items-center gap-1 justify-center">
               <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} onSuccess={setTurnstileToken} />
               <p className="text-[10px] text-gray-400 text-center leading-tight">
                 💡 提示：目前的 Turnstile 红色警告为主网隔离的测试配置，实际环境会恢复正常。<br/>
                 内测阶段请使用任意手机号码，并输入万能验证码 <b>888888</b>
               </p>
             </div>
             <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleLogin} disabled={loading || !phone || !code}>登录并接管设备</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <DialogDescription className="text-gray-800 leading-relaxed">
              我们检测到您的设备上有未同步的离线数据记录。为了保证物理设备与云端身份的唯一绑定，请决定如何处理这些本地数据：
            </DialogDescription>
            <div className="flex flex-col gap-3 pt-2">
              <Button onClick={handleMerge} className="bg-gray-800 text-white hover:bg-gray-900">保留本地记录并合并至云端</Button>
              <Button variant="destructive" onClick={handleWipeAndExport} className="hover:bg-red-600">导出我的记录为 JSON 备份并清空本地登入</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
