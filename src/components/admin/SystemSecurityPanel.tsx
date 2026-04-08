'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function SystemSecurityPanel() {
  const [loading, setLoading] = useState(false);
  const [globalLoginEnabled, setGlobalLoginEnabled] = useState(false);
  const [feedbackQuota, setFeedbackQuota] = useState('3');

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch('/api/admin/config');
        if (res.ok) {
          const data = await res.json();
          if (data.configs) {
            if (data.configs.GLOBAL_LOGIN_ENABLED === 'true') {
              setGlobalLoginEnabled(true);
            }
            if (data.configs.USER_FEEDBACK_QUOTA) {
              setFeedbackQuota(data.configs.USER_FEEDBACK_QUOTA);
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchConfigs();
  }, []);

  const saveConfig = async (key: string, value: string) => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (e) {
      console.error(e);
      alert('保存设置失败');
      throw e;
    }
  };

  const handleToggleLogin = async () => {
    setLoading(true);
    const newValue = !globalLoginEnabled;
    try {
      await saveConfig('GLOBAL_LOGIN_ENABLED', newValue ? 'true' : 'false');
      setGlobalLoginEnabled(newValue);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuota = async () => {
    setLoading(true);
    try {
      if (parseInt(feedbackQuota) >= 0) {
        await saveConfig('USER_FEEDBACK_QUOTA', feedbackQuota);
        alert('配额保存成功');
      } else {
        alert('请输入有效的限额数量');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-6">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          {globalLoginEnabled ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-amber-600" />}
          全局安全与权限网关
        </h2>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* Module 1: Global Login Switch */}
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">全站公众注册与登录</h3>
            <p className="text-sm text-gray-500 mt-1">控制非超管游客是否可以通过邮箱验证码登入系统并接管本地数据。</p>
          </div>
          
          <div className={`p-4 rounded-lg flex items-center justify-between border ${globalLoginEnabled ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <span className={`font-medium ${globalLoginEnabled ? 'text-emerald-800' : 'text-amber-800'}`}>
              当前状态: {globalLoginEnabled ? '已开放公众使用' : '内测锁定状态 (仅超管白名单)'}
            </span>
            <Button 
              onClick={handleToggleLogin} 
              disabled={loading}
              className={globalLoginEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {globalLoginEnabled ? '点击锁定隔离' : '解除限制开放'}
            </Button>
          </div>
        </div>

        {/* Module 2: Feedback Quota */}
        <div className="space-y-4 md:pl-8 pt-8 md:pt-0">
          <div>
            <h3 className="font-semibold text-gray-800">用户意见反馈配额</h3>
            <p className="text-sm text-gray-500 mt-1">控制每个账号单日最大允许发送意见工单的数量（防止资源爆破）。</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Label className="whitespace-nowrap font-medium text-gray-700">每日限额 (次):</Label>
            <Input 
              type="number" 
              min="0"
              className="w-24 border-gray-200" 
              value={feedbackQuota} 
              onChange={e => setFeedbackQuota(e.target.value)} 
            />
            <Button variant="outline" onClick={handleSaveQuota} disabled={loading}>保存配额</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
