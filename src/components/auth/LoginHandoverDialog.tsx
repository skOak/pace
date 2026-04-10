'use client'

import React, { useState, useRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/providers/AuthProvider'
import { db, hardResetDatabase } from '@/lib/db'
import { DataService } from '@/services/data-service'
import { SettingsService } from '@/services/settings-service'
import { ALLOWED_EMAIL_DOMAINS } from '@/lib/constants'

export function LoginHandoverDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const { refreshAuth } = useAuth()
  const [emailPrefix, setEmailPrefix] = useState('')
  const [emailDomain, setEmailDomain] = useState(ALLOWED_EMAIL_DOMAINS[0])
  const [code, setCode] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [step, setStep] = useState<'login' | 'handover'>('login')
  const [loading, setLoading] = useState(false)
  const [handoverToken, setHandoverToken] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [agreed, setAgreed] = useState(false)
  const turnstileRef = useRef<TurnstileInstance>(null)

  React.useEffect(() => {
    if (!open) {
      setEmailPrefix('')
      setCode('')
      setTurnstileToken('')
      setStep('login')
      setLoading(false)
      setErrorMsg('')
      setSuccessMsg('')
      setAgreed(false)
    }
  }, [open])

  const handleSendCode = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    const email = `${emailPrefix}${emailDomain}`
    if (!/^[a-zA-Z0-9_.-]+$/.test(emailPrefix)) return setErrorMsg('邮箱前缀格式不正确，只能包含字母、数字、点或下划线')
    if (!emailPrefix || !turnstileToken) return setErrorMsg('请填写完整的邮箱并通过人机验证')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST', body: JSON.stringify({ email, turnstileToken })
      })
      if (!res.ok) {
        try {
          const errData = await res.json()
          setErrorMsg(errData.error || '发送验证码失败')
        } catch (e) {
          setErrorMsg('发送验证码失败')
        }
      } else {
        setSuccessMsg(process.env.NODE_ENV !== 'production' ? '验证码已发送 (开发环境可用: 888888)' : '验证码已发送，请前往您的邮箱查收')
      }
    } catch (err) {
      setErrorMsg('网络连接异常，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    const email = `${emailPrefix}${emailDomain}`
    if (!/^[a-zA-Z0-9_.-]+$/.test(emailPrefix)) return setErrorMsg('请输入有效的邮箱前缀')
    setLoading(true)

    try {
      const localProfile = await SettingsService.getProfile();
      const localTaskCount = await db.tasks.count()
      const localGoalCount = await db.goals.count()
      const hasLocalData = localTaskCount > 0 || localGoalCount > 0

      const payload = {
        email, code,
        nickname: localProfile?.name || undefined,
        avatar: localProfile?.avatar || undefined,
        checkOnly: true
      };
      const res = await fetch('/api/auth/login', {
        method: 'POST', body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        setHandoverToken(data.handoverToken)

        if (hasLocalData) {
          if (data.hasCloudData) {
            setLoading(false)
            setStep('handover')
          } else {
            await executeMerge(data.handoverToken)
          }
        } else {
          await executeWipeAndLogin(data.handoverToken)
        }
      } else {
        setLoading(false)
        try {
          const errData = await res.json()
          setErrorMsg(errData.error || '登录失败: 验证码错误或过期')
        } catch (e) {
          setErrorMsg('登录失败: 内部跨源错误')
        }
      }
    } catch (err) {
      setLoading(false)
      setErrorMsg('网络请求异常，请检查您的网络设置并重试')
    }
  }

  const confirmSession = async (token: string) => {
    const res = await fetch('/api/auth/confirm-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token })
    });
    if (!res.ok) throw new Error('Session Confirm Failed');
  };

  const executeMerge = async (token: string) => {
    try {
      await confirmSession(token);

      // --- Avatar upload & Profile Sync logic ---
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const { user } = await meRes.json();
          const cloudName = user?.nickname;
          const cloudAvatar = user?.avatar;
          
          if (!cloudName && !cloudAvatar) {
            // Cloud is empty. We are safe to promote the local offline profile to the cloud.
            const profile = await SettingsService.getProfile();
            if (profile) {
              if (profile.avatar && profile.avatar.startsWith('data:')) {
                const res = await fetch(profile.avatar);
                const blob = await res.blob();
                const file = new File([blob], 'avatar.webp', { type: 'image/webp' });

                const presignRes = await fetch('/api/oss/upload-url', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, folder: 'avatars' })
                });

                if (presignRes.ok) {
                  const { uploadUrl, fileUrl } = await presignRes.json();
                  const uploadRes = await fetch(uploadUrl, { method: 'PUT', body: file, headers: {'Content-Type': file.type} });
                  if (uploadRes.ok) {
                    profile.avatar = fileUrl;
                    await SettingsService.setProfile(profile.name, profile.avatar);
                  }
                }
              }
              
              await fetch('/api/auth/me', {
                method: 'PATCH',
                body: JSON.stringify({ nickname: profile.name, avatar: profile.avatar }),
                headers: { 'Content-Type': 'application/json' }
              });
            }
          } else {
            // Cloud profile already exists! Adopt cloud profile locally instead of overwriting.
            await SettingsService.setProfile(cloudName || '', cloudAvatar || '');
          }
        }
      } catch (profileErr) {
        console.warn('Avatar/profile sync during handover failed, skipping...', profileErr);
      }
      // --- END Avatar upload logic ---

      const [tasks, execution_logs, daily_anchors, habit_templates, goals, goal_comments] = await Promise.all([
        db.tasks.toArray(),
        db.execution_logs.toArray(),
        db.daily_anchors.toArray(),
        db.habit_templates.toArray(),
        db.goals.toArray(),
        db.goal_comments.toArray()
      ]);

      const payload = {
        tasks, execution_logs, daily_anchors, habit_templates, goals, goal_comments
      };

      const res = await fetch('/api/sync/import-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '同步失败');
      }

      await executeWipeAndLogin(token);
    } catch (e: any) {
      console.error(e);
      alert(e.message || '上传合并失败，请重试');
      setLoading(false);
    }
  }

  const handleManualExport = async () => {
    try {
      await DataService.downloadExportFile();
    } catch (e) {
      console.error(e)
      alert("导出失败")
    }
  }

  const executeWipeAndLogin = async (tokenOverride?: string) => {
    const tokenToUse = tokenOverride || handoverToken;
    if (tokenToUse) await confirmSession(tokenToUse);

    await hardResetDatabase();
    await refreshAuth();
    onOpenChange(false);
    window.location.reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{step === 'login' ? '登录 Pace 账号' : '发现离线数据冲突'}</DialogTitle>
        </DialogHeader>
        {step === 'login' ? (
          <div className="space-y-4 pt-4">
            <div className="flex flex-col gap-1 text-sm">
              <label className="font-medium text-gray-700">登录邮箱</label>
              <div className="flex relative">
                <Input
                  placeholder="邮箱账号 (如: simon)"
                  value={emailPrefix}
                  onChange={e => setEmailPrefix(e.target.value)}
                  className="rounded-e-none border-r-0 focus-visible:z-10 focus-visible:ring-1"
                />
                <select
                  className="border border-gray-200 rounded-e-md focus:outline-none focus:ring-1 focus:ring-gray-300 px-2 bg-gray-50 text-gray-600 appearance-none w-36 cursor-pointer"
                  value={emailDomain}
                  onChange={e => setEmailDomain(e.target.value)}
                >
                  {ALLOWED_EMAIL_DOMAINS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="邮件验证码" value={code} onChange={e => setCode(e.target.value)} />
              <Button onClick={handleSendCode} disabled={loading || !emailPrefix || !turnstileToken || !agreed} className="disabled:cursor-not-allowed">获取</Button>
            </div>

            <div className="my-2 flex flex-col items-center gap-1 justify-center min-h-[65px]">
              <Turnstile 
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} 
                options={{ language: 'zh-cn' }} 
                onSuccess={setTurnstileToken} 
                onExpire={() => {
                  setTurnstileToken('');
                  setErrorMsg('人机验证已超时过期，请点击重新验证。');
                  turnstileRef.current?.reset();
                }}
                onError={() => {
                  setTurnstileToken('');
                  setErrorMsg('验证组件遇到网络异常，系统已自动尝试重连，请稍候。');
                  turnstileRef.current?.reset();
                }}
              />
              {process.env.NODE_ENV !== 'production' && (
                <p className="text-[10px] text-gray-400 text-center leading-tight">
                  💡 开发提示：目前的 Turnstile 为测试配置，正式编译会自动隐藏此栏。<br />
                  内测阶段可使用任意邮箱地址，并输入万能验证码 <b>888888</b>
                </p>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-200">
                <span className="text-base leading-none">⚠️</span>
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg flex items-start gap-2 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-200">
                <span className="text-base leading-none">✅</span>
                <span className="font-medium">{successMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="privacy-handover"
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <label htmlFor="privacy-handover" className="text-xs text-gray-500 cursor-pointer selection:bg-transparent">
                我已阅读并完全同意 <a href="/privacy" target="_blank" className="text-blue-600 hover:text-blue-800 hover:underline">《隐私条款》</a> 以及数据接管细则
              </label>
            </div>

            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:cursor-not-allowed" onClick={handleLogin} disabled={loading || !emailPrefix || !code || !agreed}>
              {loading ? '处理中...' : '登录并接管设备'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <DialogDescription className="text-gray-800 leading-relaxed font-medium bg-red-50 p-4 rounded-lg flex items-start gap-2">
              <span className="text-xl">⚠️</span> 登录将完全接管并锁定此设备，这意味着当前设备上**所有本地未登录时的操作数据都将被清空**且被该账号云端内容覆盖。强烈建议您先导出 JSON 备份。
            </DialogDescription>
            <div className="flex flex-col gap-3 pt-2">
              <Button variant="outline" onClick={handleManualExport} className="border-gray-300">第一步：手动导出本地 JSON 备份</Button>
              <Button onClick={() => { setLoading(true); executeWipeAndLogin(); }} className="bg-red-600 text-white hover:bg-red-700 font-bold" disabled={loading}>
                {loading ? '处理中...' : '我已经知晓，确认清空并登录'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
