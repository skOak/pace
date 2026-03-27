'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TaskStatus } from '@/lib/types';
import { TaskService } from '@/services/task-service';
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
  DialogTrigger,
} from '@/components/ui/dialog';

interface AddTaskDialogProps {
  onTaskAdded?: () => void;
  defaultStatus?: TaskStatus;
}

export function AddTaskDialog({ onTaskAdded, defaultStatus = TaskStatus.PENDING }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [estTime, setEstTime] = useState<string>('25');
  const [actTime, setActTime] = useState<string>('15');
  const [isSchoolDone, setIsSchoolDone] = useState(false);
  const [tags, setTags] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;

    setLoading(true);
    try {
      const tagArray = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await TaskService.create({
        title: title.trim(),
        est_time: isSchoolDone ? 0 : (parseInt(estTime, 10) || 0),
        act_time: isSchoolDone ? (parseInt(actTime, 10) || 0) : 0,
        tags: tagArray,
        is_school_done: isSchoolDone,
        status: isSchoolDone ? TaskStatus.COMPLETED : defaultStatus,
      });

      // 重置表单
      setTitle('');
      setEstTime('25');
      setActTime('15');
      setIsSchoolDone(false);
      setTags('');
      setOpen(false);

      // 通知父组件刷新
      if (onTaskAdded) {
        onTaskAdded();
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="fixed bottom-20 right-6 md:bottom-8 md:right-8 h-14 w-14 rounded-full shadow-lg" size="icon" />
        }
      >
        <Plus className="h-6 w-6" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>添加新任务</DialogTitle>
          <DialogDescription>
            录入一项新任务，它会自动排入你今天的节奏中。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">任务名称</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：完成数学试卷"
              className="col-span-3"
            />
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <input 
              type="checkbox" 
              id="is_school_done" 
              checked={isSchoolDone}
              onChange={(e) => setIsSchoolDone(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
            />
            <Label htmlFor="is_school_done" className="font-normal cursor-pointer text-gray-700">在校已完成 (直接记为完成不计时)</Label>
          </div>

          {!isSchoolDone ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="est_time">预估时长（分钟）</Label>
              <Input
                id="est_time"
                type="number"
                value={estTime}
                onChange={(e) => setEstTime(e.target.value)}
                className="col-span-3"
                min="1"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="act_time">实际用时（分钟）</Label>
              <Input
                id="act_time"
                type="number"
                value={actTime}
                onChange={(e) => setActTime(e.target.value)}
                className="col-span-3"
                min="1"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="tags">标签（逗号分隔）</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如：数学,作业"
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={handleSave} disabled={loading || !title.trim()}>
            {loading ? '保存中...' : '保存任务'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
