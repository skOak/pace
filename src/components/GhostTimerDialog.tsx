import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Task } from '@/lib/types';
import { TaskExecutionService } from '@/services/task-execution-service';
import { ExecutionLogService } from '@/services/execution-log-service';

interface GhostTimerDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function GhostTimerDialog({ task, open, onOpenChange, onSaved }: GhostTimerDialogProps) {
  const [endTime, setEndTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [startTimeMs, setStartTimeMs] = useState<number>(0);

  useEffect(() => {
    if (open && task && task.id) {
      setError('');
      // Guess a reasonable end time (e.g., current time or start + 1h, but let's just use current time for simplicity or let user pick)
      const now = new Date();
      setEndTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
      
      // Fetch logs to get the real start time
      ExecutionLogService.getByTaskId(task.id).then(logs => {
        if (logs.length > 0) {
           const firstLog = logs[0];
           setStartTimeMs(new Date(firstLog.startTime).getTime());
        }
      });
    }
  }, [open, task]);

  const handleSubmit = async () => {
    if (!task || !task.id) return;
    if (!endTime) {
      setError('请输入结束时间');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const endSplit = endTime.split(':');
      const parsedEnd = new Date();
      parsedEnd.setHours(parseInt(endSplit[0], 10), parseInt(endSplit[1], 10), 0, 0);

      const parsedStart = new Date(startTimeMs);

      if (parsedStart >= parsedEnd) {
        // if crossed midnight
        if (parsedStart.getHours() > parsedEnd.getHours()) {
            parsedEnd.setDate(parsedEnd.getDate() + 1);
        } else {
            setError('结束时间必须晚于开始时间');
            return;
        }
      }

      await TaskExecutionService.updateRetroactiveTime(task.id, parsedStart, parsedEnd);
      
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-orange-600 flex items-center gap-2">
            <span>⏱️</span> 异常时长纠偏
          </DialogTitle>
          <DialogDescription>
            任务 <strong>{task.title}</strong> 的运行时间异常（超过4小时且未手动停止），系统已自动将其挂起。你到底做到了几点？请修正结束时间。
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {error && <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</div>}
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">实际结束时间</label>
            <Input 
              type="time" 
              value={endTime} 
              onChange={e => setEndTime(e.target.value)} 
              className="rounded-xl font-mono"
            />
            <p className="text-xs text-gray-500">
              记录的开始时间: {new Date(startTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>稍后处理</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-orange-500 hover:bg-orange-600">确定修正</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
