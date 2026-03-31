import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Task } from '@/lib/types';

interface TaskFeedbackDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comments: string) => Promise<void>;
}

export function TaskFeedbackDialog({ task, open, onOpenChange, onConfirm }: TaskFeedbackDialogProps) {
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && task) {
      setComments(task.comments || '');
    }
  }, [open, task]);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(comments);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>任务完成啦！🎉</DialogTitle>
          <DialogDescription>
            {task.title} 已经完成，要不要简单写个收尾评价或是家长点评？（可选）
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            placeholder="例如：正确率还不错，就是计算稍微慢了点..." 
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="min-h-[120px] resize-y"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading ? '处理中...' : (comments.trim() ? '保存评价并完成' : '直接完成')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
