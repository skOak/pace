import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Task } from '@/lib/types';

interface TaskReopenDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function TaskReopenDialog({ task, open, onOpenChange, onConfirm }: TaskReopenDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason);
      setReason('');
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
          <DialogTitle>重新开启任务</DialogTitle>
          <DialogDescription>
             为什么要重新开启已经完成的任务？请简要说明原因（如：老师要求返工、需要修正）。
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            placeholder="请输入重开原因..." 
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px] resize-y"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !reason.trim()} className="bg-orange-600 hover:bg-orange-700">
            {loading ? '处理中...' : '确认重开'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
