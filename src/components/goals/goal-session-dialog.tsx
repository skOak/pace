'use client';

import { useState } from 'react';
import { PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskService } from '@/services/task-service';
import { TaskStatus, type Goal } from '@/lib/types';

interface GoalSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionAdded?: () => void;
  goal: Goal;
}

export function GoalSessionDialog({ open, onOpenChange, onSessionAdded, goal }: GoalSessionDialogProps) {
  const [title, setTitle] = useState(goal.title + ' - 片段');
  const [estTime, setEstTime] = useState<string>('25');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setLoading(true);
    try {
      const parsedTime = parseInt(estTime, 10) || 0;
      
      await TaskService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        est_time: parsedTime,
        act_time: 0,
        status: TaskStatus.PENDING,
        goal_id: goal.id,
        is_session: true,
      });

      onOpenChange(false);
      onSessionAdded?.();
      
      // 重置以供下次提取
      setTitle(goal.title + ' - 片段');
      setEstTime('25');
      setDescription('');
    } catch (err) {
      console.error('Failed to save session task:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusSquare className="w-5 h-5 text-blue-500" />
            提取片段至今日
          </DialogTitle>
          <DialogDescription>
            将「{goal.title}」拆解为一个独立的子任务，并加入今天的行动列表。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="session_title">今日执行目标</Label>
            <Input
              id="session_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：阅读第1-3章 / 观看视频 P1"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="session_est_time">本次预估投入时长 (分钟)</Label>
            <Input
              id="session_est_time"
              type="number"
              value={estTime}
              onChange={(e) => setEstTime(e.target.value)}
              min="1"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="session_desc">独立补充说明 (可选)</Label>
            <textarea
              id="session_desc"
              className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
               placeholder="仅对这个子片段特别要补充的内容..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              注：大目标的视频资料依然保留在原页面。在任务卡片中会提供一键跳转回大目标的快捷入口，无需重复粘贴。
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={loading || !title.trim()}>
            {loading ? '生成中...' : '生成今日任务'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
