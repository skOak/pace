import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskExecutionService } from '@/services/task-execution-service';

interface RetroactiveTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStartTime: Date;
  defaultEndTime: Date;
  onTaskCreated: () => void;
}

export function RetroactiveTaskDialog({ open, onOpenChange, defaultStartTime, defaultEndTime, onTaskCreated }: RetroactiveTaskDialogProps) {
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setError('');
      // Format to HH:mm for input type="time"
      setStartTime(defaultStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      setEndTime(defaultEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }
  }, [open, defaultStartTime, defaultEndTime]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请输入任务名称');
      return;
    }
    if (!startTime || !endTime) {
      setError('请输入完整的起止时间');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const startSplit = startTime.split(':');
      const endSplit = endTime.split(':');
      
      const parsedStart = new Date(defaultStartTime);
      parsedStart.setHours(parseInt(startSplit[0], 10), parseInt(startSplit[1], 10), 0, 0);
      
      const parsedEnd = new Date(defaultEndTime);
      parsedEnd.setHours(parseInt(endSplit[0], 10), parseInt(endSplit[1], 10), 0, 0);

      if (parsedStart >= parsedEnd) {
        setError('结束时间必须晚于开始时间');
        return;
      }

      await TaskExecutionService.createRetroactiveTask(title.trim(), parsedStart, parsedEnd);
      
      onOpenChange(false);
      onTaskCreated();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!z-[999] sm:max-w-[425px] top-[30%] sm:top-[50%]" overlayClassName="!z-[999]">
        <DialogHeader>
          <DialogTitle>补录任务记录</DialogTitle>
          <DialogDescription>
            快速将刚刚做过的事情填补到时间轴中。
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {error && <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</div>}
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">任务名称</label>
            <Input 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="例如：背单词、阅读、整理房间..."
              className="rounded-xl"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">开始时间</label>
              <Input 
                type="time" 
                value={startTime} 
                onChange={e => setStartTime(e.target.value)} 
                className="rounded-xl font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">结束时间</label>
              <Input 
                type="time" 
                value={endTime} 
                onChange={e => setEndTime(e.target.value)} 
                className="rounded-xl font-mono"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading}>确定补录</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
