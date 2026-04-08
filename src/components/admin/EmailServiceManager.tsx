'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Settings2, Save, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function EmailServiceManager() {
  const [provider, setProvider] = useState<'RESEND' | 'SMTP2GO'>('RESEND');
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState({ text: '', type: '' });

  const [testForm, setTestForm] = useState({ to: '', subject: 'Pace 邮箱服务测试', html: '这是一封由 Pace 超管后台触发的测试服务商连通性的邮件。' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/admin/config');
      if (res.ok) {
        const data = await res.json();
        if (data.configs?.PRIMARY_MAIL_PROVIDER) {
          setProvider(data.configs.PRIMARY_MAIL_PROVIDER as 'RESEND' | 'SMTP2GO');
        }
      }
    } catch (e) {}
    setLoadingConfig(false);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    setConfigMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'PRIMARY_MAIL_PROVIDER', value: provider })
      });
      if (res.ok) {
        setConfigMsg({ text: '保存成功，当前设定生效。', type: 'success' });
      } else {
        setConfigMsg({ text: '保存失败', type: 'error' });
      }
    } catch (e) {
      setConfigMsg({ text: '网络异常，保存失败', type: 'error' });
    }
    setSavingConfig(false);
  };

  const handleTestEmail = async () => {
    setTestResult({ text: '', type: '' });
    if (!testForm.to || !testForm.subject || !testForm.html) {
      return setTestResult({ text: '请完整填写表单内容', type: 'error' });
    }
    setTesting(true);
    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testForm)
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ text: data.message || `发件成功，最终响应服务商：${data.provider}`, type: 'success' });
      } else {
        setTestResult({ text: data.error || '发件失败', type: 'error' });
      }
    } catch (e) {
      setTestResult({ text: '请求异常', type: 'error' });
    }
    setTesting(false);
  };

  if (loadingConfig) return <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center h-48 text-gray-400">加载配置中...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
      
      {/* 栏 1: 发信通道主权控制 */}
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <Settings2 className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-800 text-lg">主辅邮件平台热切换</h2>
        </div>
        
        <p className="text-sm text-gray-500 leading-relaxed">
          Pace 当前支持 Resend(首选) 与 SMTP2GO(降级) 自动容错双通道发信。在出现通道被阻时，您可以在此强制设定优先级。
        </p>

        <div className="space-y-3">
          <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-colors ${provider === 'RESEND' ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-200'}`}>
             <div className="flex items-center gap-3">
               <input type="radio" className="w-4 h-4 text-blue-600 focus:ring-blue-500" name="mailProvider" checked={provider === 'RESEND'} onChange={() => setProvider('RESEND')} />
               <div>
                 <div className="font-medium text-gray-900">Resend (API 模式)</div>
                 <div className="text-xs text-gray-500 mt-1">发信速度极快，自带回执追踪分析。作为默认的一类选项。</div>
               </div>
             </div>
          </label>

          <label className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-colors ${provider === 'SMTP2GO' ? 'bg-amber-50 border-amber-200' : 'hover:bg-gray-50 border-gray-200'}`}>
             <div className="flex items-center gap-3">
               <input type="radio" className="w-4 h-4 text-amber-600 focus:ring-amber-500" name="mailProvider" checked={provider === 'SMTP2GO'} onChange={() => setProvider('SMTP2GO')} />
               <div>
                 <div className="font-medium text-gray-900">SMTP2GO (REST 降级模式)</div>
                 <div className="text-xs text-gray-500 mt-1">到达率很高，适合做紧急替换热备服务器。</div>
               </div>
             </div>
          </label>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <div className="text-sm">
             {configMsg.text && (
               <span className={`flex items-center gap-1 ${configMsg.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
                 {configMsg.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                 {configMsg.text}
               </span>
             )}
          </div>
          <Button onClick={handleSaveConfig} disabled={savingConfig} className="bg-gray-900 hover:bg-gray-800 text-white">
            <Save className="w-4 h-4 mr-2" />
            {savingConfig ? '保存中...' : '提交策略更改'}
          </Button>
        </div>
      </div>

      {/* 栏 2: 测试发信功能 */}
      <div className="p-6 space-y-6 bg-slate-50">
        <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
          <Mail className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-800 text-lg">快速发件测试连通性</h2>
        </div>
        
        <div className="space-y-4">
           <div>
             <label className="text-xs font-semibold text-gray-500 mb-1.5 block">收件人 (Email)</label>
             <Input placeholder="输入接收测试件的真实邮箱..." value={testForm.to} onChange={e => setTestForm({...testForm, to: e.target.value})} className="bg-white" />
           </div>
           <div>
             <label className="text-xs font-semibold text-gray-500 mb-1.5 block">邮件主题</label>
             <Input placeholder="输入邮件的标题..." value={testForm.subject} onChange={e => setTestForm({...testForm, subject: e.target.value})} className="bg-white" />
           </div>
           <div>
             <label className="text-xs font-semibold text-gray-500 mb-1.5 block">HTML 格式内容</label>
             <textarea 
               className="w-full min-h-[100px] border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white" 
               placeholder="<h1>标题</h1><p>内容...</p>"
               value={testForm.html}
               onChange={e => setTestForm({...testForm, html: e.target.value})}
             />
           </div>

           <div className="pt-2">
             <Button onClick={handleTestEmail} disabled={testing || !testForm.to} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
               <Send className="w-4 h-4 mr-2" />
               {testing ? '发送调度中...' : '立即发出测试邮件'}
             </Button>

             {testResult.text && (
               <div className={`mt-4 p-3 rounded-lg text-sm flex items-start gap-2 border animate-in slide-in-from-top-1 ${testResult.type === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-green-50 border-green-200 text-green-700'}`}>
                 <div className="mt-0.5">
                   {testResult.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                 </div>
                 <div className="font-medium">{testResult.text}</div>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
