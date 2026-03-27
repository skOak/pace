'use client';

import { useState, useRef } from 'react';
import { DataService } from '@/services/data-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Upload, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const json = await DataService.exportData();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const defaultName = `pace_backup_${dateStr}.json`;

      // 优先尝试使用强大的 File System Access API
      // 这会直接弹出原生保存对话框，用户亲眼确认文件名，完美解决乱码/哈希名问题。
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: 'JSON 文件', accept: { 'application/json': ['.json'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(json);
          await writable.close();
          // 如果这里成功，就直接返回，不再执行后续代码
          return;
        } catch (err: any) {
          // 如果用户点击“取消”保存，直接终止
          if (err.name === 'AbortError') return;
          console.warn('原生保存 API 报错，降级使用传统方案:', err);
        }
      }

      // 如果浏览器不支持 (比如 Firefox/Safari/移动端) 则降级使用 Data URI
      // Data URI 不需要通过内存引用的释放戳（RevokeObjectURL），彻底规避时序导致的丢失名称 Bug。
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (error) {
      console.error('导出失败:', error);
      alert('导出备份失败');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('警告：导入备份将覆盖所有现有数据，且不可恢复。是否确认继续？')) {
      e.target.value = '';
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      await DataService.importData(text);
      alert('数据恢复成功！');
      window.location.href = '/'; // 恢复后刷新到首页
    } catch (error) {
      console.error('导入失败:', error);
      alert('恢复备份失败，请检查文件格式是否正确。');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 animate-in mt-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">设置</h1>
        <p className="text-gray-500 mt-1">管理应用数据与偏好设置</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle>数据备份与恢复</CardTitle>
            <CardDescription>
              将你的所有任务和历史记录导出为本地文件，或从文件中恢复。Pace 的数据仅保存在你的浏览器中，不会上传到任何服务器。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleExport} className="flex-1 bg-blue-600 hover:bg-blue-700 h-10">
                <Download className="w-4 h-4 mr-2" />
                导出数据备份
              </Button>
              
              <div className="flex-1">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 h-10"
                  disabled={importing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {importing ? '恢复中...' : '导入数据恢复 (覆盖当前)'}
                </Button>
              </div>
            </div>

            <div className="flex bg-amber-50 rounded-lg p-3 text-sm text-amber-800 border border-amber-200/50 mt-4">
              <AlertTriangle className="w-5 h-5 mr-2 shrink-0 text-amber-500" />
              <p>导入备份文件将会<b>永久覆盖</b>当前浏览器中的所有 Pace 数据，请谨慎操作。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
