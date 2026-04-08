'use client';

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, Send, X, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export function FeedbackDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (o: boolean) => void }) {
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('new');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setContent('');
      setSelectedFiles([]);
      setPreviewUrls([]);
      setErrorMsg('');
      setSuccessMsg('');
      setIsQuotaExceeded(false);
      setUploadProgress(0);
      setActiveTab('new');
      checkQuota();
      fetchHistory();
    }
  }, [open]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/feedbacks');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkQuota = async () => {
    try {
      const res = await fetch('/api/feedbacks?action=check_quota');
      if (res.ok) {
        const data = await res.json();
        if (!data.canSubmit) {
          setIsQuotaExceeded(true);
          setErrorMsg(`您今日提交的反馈已达到上限 (${data.maxQuota}次)，请明日再试`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('单张图片不能超过 2MB');
        return;
      }
      if (selectedFiles.length >= 3) {
        setErrorMsg('最多只能上传 3 张截图');
        return;
      }
      
      setSelectedFiles([...selectedFiles, file]);
      setPreviewUrls([...previewUrls, URL.createObjectURL(file)]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!content.trim()) return setErrorMsg('请输入反馈内容');
    
    setLoading(true);
    setUploadProgress(0);
    try {
      // 1. Upload files to OSS first
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        setUploadProgress(Math.floor((i / selectedFiles.length) * 50));
        const file = selectedFiles[i];
        
        // Get Pre-signed URL
        const presignRes = await fetch('/api/oss/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            size: file.size,
            folder: 'feedbacks'
          })
        });
        
        const presignData = await presignRes.json();
        if (!presignRes.ok) {
           throw new Error(presignData.error || '上传凭证获取失败');
        }

        // Upload directly to OSS
        const uploadRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: file
        });

        if (!uploadRes.ok) {
          throw new Error('上传云端失败');
        }

        uploadedImageUrls.push(presignData.fileUrl);
      }
      
      setUploadProgress(80);

      // 2. Submit Feedback ticket
      const res = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, images: uploadedImageUrls })
      });
      
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || '提交失败');
      } else {
        setUploadProgress(100);
        setSuccessMsg('反馈提交成功！感谢您的宝贵建议。');
        setTimeout(() => {
          onOpenChange(false);
        }, 1500);
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || '网络请求异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-xl">意见与问题反馈</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="new">提交反馈</TabsTrigger>
              <TabsTrigger value="history">历史记录</TabsTrigger>
            </TabsList>
            
            <TabsContent value="new" className="space-y-4 outline-none">
              {isQuotaExceeded && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-lg p-3 text-sm flex gap-2 items-start">
                  <AlertCircle className="w-5 h-5 shrink-0 text-orange-500" />
                  <span>{errorMsg}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <Textarea 
                  placeholder="请输入您遇到的问题或功能建议，超管会在看到后第一时间处理..."
                  className="min-h-[150px] resize-none focus-visible:ring-blue-500"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  disabled={loading || !!successMsg || isQuotaExceeded}
                />
              </div>

              <div className="flex justify-between items-end">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 items-center flex-wrap">
                    {previewUrls.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 group rounded-lg overflow-hidden border border-gray-200">
                        <img src={img} alt="upload preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                          disabled={loading || !!successMsg}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    {previewUrls.length < 3 && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || !!successMsg || isQuotaExceeded}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-blue-400 hover:text-blue-500 transition-all disabled:pointer-events-none disabled:opacity-50"
                      >
                        <ImagePlus className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">添加截图</span>
                      </button>
                    )}
                    
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/gif, image/webp" 
                      ref={fileInputRef}
                      className="hidden" 
                      onChange={handleImagePick}
                    />
                  </div>
                  <p className="text-xs text-gray-400">最多可上传 3 张截图证明，单张限制 2MB 以内。</p>
                </div>
              </div>

              {!isQuotaExceeded && errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
              {successMsg && <p className="text-sm text-green-600">{successMsg}</p>}

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={loading || !content.trim() || !!successMsg || isQuotaExceeded}
                  className="bg-blue-600 hover:bg-blue-700 gap-2 min-w-[120px]"
                >
                  <Send className="w-4 h-4" /> 
                  {loading && uploadProgress < 80 ? `上传中 ${uploadProgress}%` : 
                   loading ? '正在提交...' : '提交工单'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="outline-none h-[350px] overflow-y-auto pr-2 space-y-4">
              {history.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 mt-12">
                   <AlertCircle className="w-8 h-8 opacity-20" />
                   <p className="text-sm">暂无历史提交的工单</p>
                 </div>
              ) : (
                history.map((fb: any) => (
                  <div key={fb.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3 text-left">
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{fb.content}</div>
                      <div className="shrink-0">
                        {fb.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3 h-3" /> 待处理
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> 已解决
                          </span>
                        )}
                      </div>
                    </div>
                    {fb.images && fb.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {fb.images.map((img: string, i: number) => (
                           <img 
                             key={i} 
                             src={img} 
                             alt="附件" 
                             className="h-16 w-16 object-cover rounded border border-gray-200 cursor-pointer hover:border-blue-400 hover:ring-2 hover:ring-blue-100 transition-all" 
                             onClick={() => setZoomedImage(img)}
                           />
                        ))}
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {new Date(fb.created_at).toLocaleString()}
                    </span>
                    {fb.reply && (
                      <div className="mt-2 text-sm bg-blue-50 border border-blue-100 rounded-lg p-3 relative">
                        <div className="absolute -top-1.5 left-4 w-3 h-3 bg-blue-50 transform rotate-45 border-t border-l border-blue-100"></div>
                        <span className="font-semibold text-blue-800 text-xs mb-1 block">官方回复</span>
                        <div className="text-blue-900 whitespace-pre-wrap">{fb.reply}</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
          
          {/* Zoomed Image Overlay */}
          {zoomedImage && typeof document !== 'undefined' && createPortal(
            <div 
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-zoom-out"
              onClick={() => setZoomedImage(null)}
            >
               <button 
                 className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors p-2 bg-black/50 rounded-full cursor-pointer z-50"
                 onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
               >
                 <X className="w-8 h-8" />
               </button>
               <img 
                 src={zoomedImage} 
                 alt="Enlarged feedback attachment" 
                 className="max-w-[95vw] max-h-[95vh] object-contain rounded-md shadow-2xl animate-in zoom-in-95 duration-200 cursor-default" 
                 onClick={(e) => e.stopPropagation()}
               />
            </div>,
            document.body
          )}
          
      </DialogContent>
    </Dialog>
  );
}
