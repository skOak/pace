'use client';

import { useState } from 'react';
import { Target, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GoalService } from '@/services/goal-service';
import type { Goal } from '@/lib/types';
import { cn } from '@/lib/utils';

interface GoalEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoalSaved?: () => void;
  goal?: Goal; // 如果传入则是编辑状态，否则是新建
}

export function GoalEditorDialog({ open, onOpenChange, onGoalSaved, goal }: GoalEditorDialogProps) {
  const [title, setTitle] = useState(goal?.title || '');
  const [totalTime, setTotalTime] = useState(goal?.total_estimated_duration?.toString() || '300');
  const [deadline, setDeadline] = useState(goal?.deadline || '');
  const [difficulty, setDifficulty] = useState(goal?.difficulty || 1);
  const [confidence, setConfidence] = useState(goal?.confidence ?? true);
  const [description, setDescription] = useState(goal?.description || '');
  const [loading, setLoading] = useState(false);

  // 当为每次打开时重置状态（如有必要可移到 useEffect 监听 open）

  const handleSave = async () => {
    if (!title.trim()) return;
    
    setLoading(true);
    try {
      const parsedTime = parseInt(totalTime, 10) || 0;
      
      if (goal) {
        // Edit mode
        await GoalService.update(goal.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          total_estimated_duration: parsedTime,
          deadline: deadline || undefined,
          difficulty,
          confidence,
        });
      } else {
        // Create mode
        await GoalService.create({
          title: title.trim(),
          description: description.trim() || undefined,
          total_estimated_duration: parsedTime,
          deadline: deadline || undefined,
          difficulty,
          confidence,
        });
        
        // Clear form after create
        setTitle('');
        setTotalTime('300');
        setDeadline('');
        setDifficulty(1);
        setConfidence(true);
        setDescription('');
      }

      onOpenChange(false);
      onGoalSaved?.();
    } catch (err) {
      console.error('Failed to save goal:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            {goal ? '编辑目标' : '设定长线目标'}
          </DialogTitle>
          <DialogDescription>
            将庞大的挑战拆解成明确的里程碑，Pace 会帮你追踪进度与反馈。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal_title">目标名称</Label>
            <Input
              id="goal_title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：准备期中考试 / 完成阅读挑战"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Total Estimated Time */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="total_time">总预算时长 (分钟)</Label>
              <Input
                id="total_time"
                type="number"
                value={totalTime}
                onChange={(e) => setTotalTime(e.target.value)}
                placeholder="例如 300"
                min="0"
              />
            </div>
            {/* Deadline */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="deadline">截止日期</Label>
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            {/* Difficulty */}
            <div className="flex flex-col gap-2">
              <Label>主观难度</Label>
              <div className="flex gap-1.5 h-10 items-center">
                {[1, 2, 3].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={cn(
                      "flex-1 h-8 rounded-md border text-sm flex items-center justify-center transition-colors",
                      difficulty === level 
                        ? "bg-orange-50 border-orange-200 text-orange-600 font-medium" 
                        : "border-gray-200 text-gray-400 hover:bg-gray-50"
                    )}
                  >
                    {Array(level).fill('★').join('')}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence */}
            <div className="flex flex-col gap-2">
              <Label>起步信心度</Label>
              <div className="flex gap-2 h-10 items-center">
                <button
                  type="button"
                  onClick={() => setConfidence(true)}
                  className={cn(
                    "flex-1 h-8 rounded-md border text-sm flex items-center justify-center transition-colors",
                    confidence 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-medium" 
                      : "border-gray-200 text-gray-400 hover:bg-gray-50"
                  )}
                >
                  😎 有把握
                </button>
                <button
                  type="button"
                  onClick={() => setConfidence(false)}
                  className={cn(
                    "flex-1 h-8 rounded-md border text-sm flex items-center justify-center transition-colors",
                    !confidence 
                      ? "bg-purple-50 border-purple-200 text-purple-700 font-medium" 
                      : "border-gray-200 text-gray-400 hover:bg-gray-50"
                  )}
                >
                  🤔 挑战大
                </button>
              </div>
            </div>
          </div>

          {/* Markdown Description */}
          <div className="flex flex-col gap-2 mt-2">
            <Label htmlFor="goal_description" className="flex items-center gap-1.5">
              <PenLine className="w-4 h-4 text-blue-500" />
              项目说明与素材 (支持 Markdown)
            </Label>
            <MarkdownEditor
              id="goal_description"
              className="bg-blue-50/20"
              placeholder="详细的行动指南、参考资料链接、视频嵌入代码等，随时可点击下方按钮上传附件..."
              value={description}
              onValueChange={setDescription}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={loading || !title.trim()}>
            {loading ? '保存中...' : '保存目标'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
