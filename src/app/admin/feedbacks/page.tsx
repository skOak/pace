'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Feedback = {
  id: string;
  userId: string;
  content: string;
  images: string[];
  status: string;
  reply: string | null;
  created_at: string;
  user?: { email: string; nickname: string; avatar: string };
};

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbacks();
  }, [filter]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const url = filter === 'ALL' ? '/api/admin/feedbacks' : `/api/admin/feedbacks?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.data) {
        setFeedbacks(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, status?: string, reply?: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/feedbacks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...(status && { status }), ...(reply !== undefined && { reply }) })
      });
      if (res.ok) {
        if (reply !== undefined) {
          setSelectedId(null);
          setReplyText('');
        }
        await fetchFeedbacks();
      } else {
        const d = await res.json();
        alert(d.error || '更新失败');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 border-b border-gray-200 pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-blue-600" /> 用户意见工单
          </h1>
          <p className="text-gray-500 mt-2">在这里审阅并回复全站用户的反馈与建议。</p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === 'OPEN' ? 'default' : 'outline'} onClick={() => setFilter('OPEN')} className="gap-2">
            <Clock className="w-4 h-4" /> 待处理
          </Button>
          <Button variant={filter === 'RESOLVED' ? 'default' : 'outline'} onClick={() => setFilter('RESOLVED')} className="gap-2">
            <CheckCircle className="w-4 h-4" /> 已解决
          </Button>
          <Button variant={filter === 'ALL' ? 'default' : 'outline'} onClick={() => setFilter('ALL')}>全部</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">载入中...</div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">太棒了！当前没有任何积压的意见工单。</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feedbacks.map(fb => (
            <div key={fb.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                     {fb.user?.nickname?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{fb.user?.nickname || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{fb.user?.email} • {new Date(fb.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                  ${fb.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}
                `}>
                  {fb.status === 'OPEN' ? '待处理' : '已解决'}
                </div>
              </div>
              
              <div className="p-5">
                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{fb.content}</p>
                
                {fb.images && fb.images.length > 0 && (
                  <div className="mt-4 flex gap-3 flex-wrap">
                    {fb.images.map((img, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setZoomedImage(img)}
                        className="block max-w-[200px] max-h-[200px] border border-gray-200 rounded-lg overflow-hidden hover:shadow-md hover:border-blue-400 hover:ring-2 hover:ring-blue-100 transition-all cursor-pointer"
                      >
                        <img src={img} alt={`Upload ${idx+1}`} className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {fb.reply ? (
                <div className="p-5 bg-blue-50/50 border-t border-blue-100 mx-5 mb-5 rounded-lg">
                  <div className="font-semibold text-blue-800 text-sm mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span> 官方回复:
                  </div>
                  <p className="text-blue-900/80 text-sm whitespace-pre-wrap">{fb.reply}</p>
                </div>
              ) : selectedId === fb.id ? (
                <div className="p-5 border-t border-gray-100 bg-gray-50">
                  <Textarea 
                    placeholder="撰写回复..." 
                    className="mb-3 bg-white"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                  />
                  <div className="flex justify-end gap-2 text-sm">
                    <Button variant="ghost" onClick={() => setSelectedId(null)}>取消</Button>
                    <Button 
                      onClick={() => handleUpdate(fb.id, 'RESOLVED', replyText)} 
                      disabled={!replyText.trim() || submitting}
                    >发信并标记解决</Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedId(fb.id); setReplyText(''); }}>撰写回复</Button>
                  {fb.status === 'OPEN' && (
                    <Button variant="secondary" size="sm" onClick={() => handleUpdate(fb.id, 'RESOLVED')} disabled={submitting}>直接结单</Button>
                  )}
                  {fb.status === 'RESOLVED' && (
                    <Button variant="ghost" size="sm" onClick={() => handleUpdate(fb.id, 'OPEN')} disabled={submitting}>重新开启</Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zoomed Image Overlay */}
      {zoomedImage && (
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
        </div>
      )}
    </div>
  );
}
