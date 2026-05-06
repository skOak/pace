import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Task } from '@/lib/types';
import { TaskExecutionService } from '@/services/task-execution-service';
import { ExecutionLogService } from '@/services/execution-log-service';

interface RetroactiveTimeEditorDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function RetroactiveTimeEditorDialog({ task, open, onOpenChange, onSaved }: RetroactiveTimeEditorDialogProps) {
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [originalStartTimeMs, setOriginalStartTimeMs] = useState<number>(0);
  const [originalDate, setOriginalDate] = useState<Date>(new Date());

  useEffect(() => {
    if (open && task && task.id) {
      setError('');
      setLoading(true);
      
      ExecutionLogService.getByTaskId(task.id).then(logs => {
        if (logs.length > 0) {
           const firstLog = logs[0];
           const lastLog = logs[logs.length - 1];
           
           const dStart = new Date(firstLog.startTime);
           setOriginalDate(dStart);
           setOriginalStartTimeMs(dStart.getTime());
           
           const dEnd = lastLog.endTime ? new Date(lastLog.endTime) : new Date();
           
           setStartTime(dStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
           setEndTime(dEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        } else {
           // No logs yet
           const now = new Date();
           setOriginalDate(now);
           setStartTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
           setEndTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }
      }).finally(() => setLoading(false));
    }
  }, [open, task]);

  const handleSubmit = async () => {
    if (!task || !task.id) return;
    if (!startTime || !endTime) {
      setError('请输入完整的起止时间');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const startSplit = startTime.split(':');
      const endSplit = endTime.split(':');
      
      const parsedStart = new Date(originalDate);
      parsedStart.setHours(parseInt(startSplit[0], 10), parseInt(startSplit[1], 10), 0, 0);
      
      const parsedEnd = new Date(originalDate);
      parsedEnd.setHours(parseInt(endSplit[0], 10), parseInt(endSplit[1], 10), 0, 0);

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
      <DialogContent className="!z-[999] sm:max-w-[425px] top-[30%] sm:top-[50%]" overlayClassName="!z-[999]">
        <DialogHeader>
          <DialogTitle>修正任务时间</DialogTitle>
          <DialogDescription>
            此操作将合并覆盖当前任务的所有分段执行记录，合并为一段完整的时间区间。这可能会影响真实性的还原，请谨慎操作。
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {error && <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</div>}
          
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
          <Button onClick={handleSubmit} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">确定修正</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
