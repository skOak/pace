'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface OcrConfig {
  id: string;
  name: string;
  secretId: string;
  secretKey: string;
  isActive: boolean;
}

export function OcrConfigPanel() {
  const [configs, setConfigs] = useState<OcrConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSid, setNewSid] = useState('');
  const [newSkey, setNewSkey] = useState('');

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/config');
      if (!res.ok) {
        console.error('Failed to fetch configs, status:', res.status);
        return;
      }
      const data = await res.json();
      if (data.data) {
        setConfigs(data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveConfigs = async (newConfigs: OcrConfig[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrConfigs: newConfigs })
      });
      if (!res.ok) {
        throw new Error(`Failed to save configs, status: ${res.status}`);
      }
      setConfigs(newConfigs);
    } catch (e: any) {
      console.error(e);
      alert('保存配置失败: ' + (e.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!newName || !newSid || !newSkey) return;
    const newConfig: OcrConfig = {
      id: Date.now().toString(),
      name: newName,
      secretId: newSid,
      secretKey: newSkey,
      isActive: configs.length === 0, // auto active if it is the first one
    };
    saveConfigs([...configs, newConfig]);
    setAdding(false);
    setNewName(''); setNewSid(''); setNewSkey('');
  };

  const handleDelete = (id: string) => {
    saveConfigs(configs.filter(c => c.id !== id));
  };

  const handleSetActive = (id: string) => {
    saveConfigs(configs.map(c => ({
      ...c,
      isActive: c.id === id
    })));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          OCR 服务验证配置
        </h2>
        <Button onClick={() => setAdding(true)} variant="outline" size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> 添加新配置
        </Button>
      </div>

      <div className="p-6 text-sm">
        {configs.length === 0 && !adding ? (
          <div className="text-gray-500 text-center py-6">暂无配置，请添加腾讯云 OCR 接口凭证以便在线用户使用配额。</div>
        ) : (
          <div className="space-y-4">
            {configs.map(config => (
              <div key={config.id} className={`flex items-center justify-between p-4 rounded-lg border ${config.isActive ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'} transition-all`}>
                <div className="flex flex-col gap-1">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    {config.name}
                    {config.isActive && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>}
                  </div>
                  <div className="text-gray-500 font-mono text-xs">SecretId: {config.secretId}</div>
                  <div className="text-gray-400 font-mono text-xs">SecretKey: {config.secretKey.substring(0, 4)}••••••••••</div>
                </div>
                <div className="flex items-center gap-3">
                  {!config.isActive && (
                    <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-600" onClick={() => handleSetActive(config.id)} disabled={loading}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> 设为激活
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-600" onClick={() => handleDelete(config.id)} disabled={loading}>
                     <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {adding && (
          <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="font-medium mb-3 text-gray-800">新建配置</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label>配置名称 (如: 主账号)</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="名称" />
              </div>
              <div className="space-y-1.5">
                <Label>SecretId</Label>
                <Input value={newSid} onChange={e => setNewSid(e.target.value)} placeholder="AKID..." />
              </div>
              <div className="space-y-1.5">
                <Label>SecretKey</Label>
                <Input value={newSkey} onChange={e => setNewSkey(e.target.value)} type="password" placeholder="Key..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}>取消</Button>
              <Button size="sm" onClick={handleAdd} disabled={!newName || !newSid || !newSkey || loading}>保存</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
