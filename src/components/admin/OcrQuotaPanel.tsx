'use client';

import { useState, useEffect } from 'react';
import { Target, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function OcrQuotaPanel() {
  const [freeQuota, setFreeQuota] = useState('1');
  const [proQuota, setProQuota] = useState('100');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchQuotas();
  }, []);

  const fetchQuotas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config?keys=ocr_quotas');
      if (!res.ok) return;
      const data = await res.json();
      if (data.ocrQuotas) {
        setFreeQuota(data.ocrQuotas.free?.toString() || '1');
        setProQuota(data.ocrQuotas.pro?.toString() || '100');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveQuotas = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ocrQuotas: {
            free: parseInt(freeQuota) || 1,
            pro: parseInt(proQuota) || 100,
          }
        })
      });
      if (!res.ok) throw new Error('Save failed');
      alert('额度保存成功！随时生效。');
    } catch (e) {
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-gray-500" />
          全站算力配额控制
        </h2>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-2">
          <Info className="w-5 h-5 flex-shrink-0 text-blue-500" />
          <div>修改这些数值可以即时限制全站用户的调用上限，保护云端接口资金池安全。</div>
        </div>

        {loading ? (
          <div className="py-4 text-center text-sm text-gray-400 animate-pulse">配置加载中...</div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="free-quota" className="flex items-center justify-between">
                <div>免费用户 (FREE) 每日限额</div>
                <div className="text-xs text-gray-400">目前默认: 1 次</div>
              </Label>
              <Input
                id="free-quota"
                type="number"
                min="0"
                value={freeQuota}
                onChange={(e) => setFreeQuota(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pro-quota" className="flex items-center justify-between">
                <div>专业用户 (PRO) 每日限额</div>
                <div className="text-xs text-blue-500/80 font-medium tracking-wide border border-blue-200 bg-blue-50 rounded-full px-2 py-0.5">高优体验</div>
              </Label>
              <Input
                id="pro-quota"
                type="number"
                min="0"
                value={proQuota}
                onChange={(e) => setProQuota(e.target.value)}
                className="w-full font-bold text-blue-600"
              />
            </div>

            <div className="pt-2">
              <Button onClick={saveQuotas} disabled={saving} className="w-full gap-2">
                <Save className="w-4 h-4" />
                {saving ? '保存中...' : '覆写限额设置'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
