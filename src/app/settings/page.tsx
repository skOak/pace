'use client';

import { useState, useRef, useEffect } from 'react';
import { DataService } from '@/services/data-service';
import { SettingsService } from '@/services/settings-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Download, Upload, AlertTriangle, KeyRound, CheckCircle2, UserCircle, Image as ImageIcon } from 'lucide-react';
import { AvatarCropper } from '@/components/AvatarCropper';

export default function SettingsPage() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 个人资料状态
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);
  
  // Cropper 状态
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState('');

  // OCR 设置状态
  const [ocrSecretId, setOcrSecretId] = useState('');
  const [ocrSecretKey, setOcrSecretKey] = useState('');
  const [savingOcr, setSavingOcr] = useState(false);
  const [saveOcrSuccess, setSaveOcrSuccess] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const sid = await SettingsService.getSecure('ocr_secret_id');
      const skey = await SettingsService.getSecure('ocr_secret_key');
      if (sid) setOcrSecretId(sid);
      if (skey) setOcrSecretKey(skey);

      const profile = await SettingsService.getProfile();
      if (profile) {
        setProfileName(profile.name || '');
        setProfileAvatar(profile.avatar || '');
      }
    };
    loadSettings();
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setSaveProfileSuccess(false);
    try {
      await SettingsService.setProfile(profileName, profileAvatar);
      // 派发自定义全局事件，使得 Sidebar 能够立刻监听到最新的资料并刷新
      window.dispatchEvent(new Event('pace_profile_updated'));
      setSaveProfileSuccess(true);
      setTimeout(() => setSaveProfileSuccess(false), 3000);
    } catch (e) {
      console.error('保存资料报错', e);
      alert('保存失败，请检查或重试');
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      setCropperImageUrl(imageUrl);
      setCropperOpen(true);
    }
    e.target.value = '';
  };
  
  const handleCropSave = (base64Image: string) => {
    setProfileAvatar(base64Image);
    setCropperOpen(false);
  };

  const handleSaveOcrSettings = async () => {
    setSavingOcr(true);
    setSaveOcrSuccess(false);
    try {
      await SettingsService.setSecure('ocr_secret_id', ocrSecretId);
      await SettingsService.setSecure('ocr_secret_key', ocrSecretKey);
      setSaveOcrSuccess(true);
      setTimeout(() => setSaveOcrSuccess(false), 3000);
    } catch (e) {
      console.error('保存 OCR 设置报错', e);
      alert('保存失败，请验证环境或重试');
    } finally {
      setSavingOcr(false);
    }
  };

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
        {/* 个人资料卡片 */}
        <Card className="border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-indigo-500" />
              名片与个性化
            </CardTitle>
            <CardDescription>
              设置您在 Pace 中被称呼的名字，并上传一个圆形头像，增加应用互动沉浸感。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* 头像区域 */}
              <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
                <div 
                  className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative group cursor-pointer hover:border-indigo-400 transition-colors"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-400 group-hover:text-indigo-400 transition-colors" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-white text-xs font-medium">更换</span>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute opacity-0 w-0 h-0"
                  ref={avatarInputRef}
                  onChange={onAvatarFileChange}
                />
              </div>

              {/* 昵称区域 */}
              <div className="flex-1 space-y-2 w-full">
                <Label htmlFor="profileName">怎么称呼您？</Label>
                <Input
                  id="profileName"
                  placeholder="限制最多 10 个字符"
                  maxLength={10}
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="max-w-md"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50/50 border-t border-gray-100 mt-2 px-6 py-4">
            <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-indigo-600 hover:bg-indigo-700">
              {savingProfile ? '保存中...' : '保存个性化资料'}
            </Button>
            {saveProfileSuccess && (
              <span className="ml-4 text-sm text-emerald-600 flex items-center animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 mr-1" />资料已更新生效
              </span>
            )}
          </CardFooter>
        </Card>

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

        <Card className="border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-500" />
              腾讯云 OCR 视觉识别配置
            </CardTitle>
            <CardDescription>
              配置您的腾讯云 API 密钥以启用拍照录入功能。这些凭据将通过 AES-GCM 加密，并仅持久化在您本机的浏览器中，绝不会被上传。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secretId">SecretId</Label>
              <Input
                id="secretId"
                type="password"
                placeholder="请输入腾讯云 API 的 SecretId"
                value={ocrSecretId}
                onChange={(e) => setOcrSecretId(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secretKey">SecretKey</Label>
              <Input
                id="secretKey"
                type="password"
                placeholder="请输入腾讯云 API 的 SecretKey"
                value={ocrSecretKey}
                onChange={(e) => setOcrSecretKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50/50 border-t border-gray-100 mt-2 px-6 py-4">
            <Button onClick={handleSaveOcrSettings} disabled={savingOcr} className="bg-blue-600 hover:bg-blue-700">
              {savingOcr ? '保存中...' : '保存 OCR 配置'}
            </Button>
            {saveOcrSuccess && (
              <span className="ml-4 text-sm text-emerald-600 flex items-center animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 mr-1" />已安全加密并保存
              </span>
            )}
          </CardFooter>
        </Card>
      </div>

      <AvatarCropper 
        open={cropperOpen} 
        onOpenChange={setCropperOpen} 
        imageUrl={cropperImageUrl} 
        onCropSave={handleCropSave} 
      />
    </div>
  );
}
