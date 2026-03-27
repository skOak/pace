'use client';

import { useState, useEffect } from 'react';
import { Plus, Camera, Image as ImageIcon, PenLine, ListPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { TaskStatus } from '@/lib/types';
import { TaskService } from '@/services/task-service';
import { StatsService } from '@/services/stats-service';
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
  const [frequentTags, setFrequentTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [smartBufferSuggestion, setSmartBufferSuggestion] = useState<string | null>(null);
  
  // 批量添加状态
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState('');

  // 当弹窗打开时，加载可用标签频率
  useEffect(() => {
    if (open) {
      TaskService.getAll().then(allTasks => {
        const counts: Record<string, number> = {};
        allTasks.forEach(task => {
          task.tags.forEach(t => {
            counts[t] = (counts[t] || 0) + 1;
          });
        });
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([tag]) => tag)
          .slice(0, 8); // 取前8个最常用的
        setFrequentTags(sorted);
      });
    }
  }, [open]);

  // 当标签发生变化时，防抖检查 Smart Buffer
  useEffect(() => {
    if (!open || !tags) {
       setSmartBufferSuggestion(null);
       return;
    }
    const currentTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (currentTags.length === 0) {
       setSmartBufferSuggestion(null);
       return;
    }
    
    const checkBuffer = async () => {
      for (const t of currentTags) {
        const result = await StatsService.checkSmartBuffer(t);
        if (result.active) {
           setSmartBufferSuggestion(`💡 根据最近的记录，做 #${t} 通常比预估多花 ${result.extraMinutes} 分钟。要不要把这次的预估调长一点？`);
           return;
        }
      }
      setSmartBufferSuggestion(null);
    };

    const timer = setTimeout(() => {
       checkBuffer();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [tags, open]);

  const handleTagClick = (t: string) => {
    const currentTags = tags.split(',').map(s => s.trim()).filter(Boolean);
    if (!currentTags.includes(t)) {
       setTags(currentTags.length > 0 ? `${tags}, ${t}` : t);
    }
  };

  const handleBatchSave = async () => {
    if (!batchText.trim()) return;

    setLoading(true);
    try {
      const lines = batchText.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
      let currentGroupTag = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        let rawTitle = trimmed;
        let groupTagToAdd = '';

        // 判断当前行是否为子任务 (支持 - 或 * 或 + 开头)
        const subTaskMatch = line.match(/^\s*[-*+]\s+(.*)/);
        if (subTaskMatch) {
          rawTitle = subTaskMatch[1];
          groupTagToAdd = currentGroupTag; // 继承上方科目
        } else {
          // 当前不是子任务，判定它是普通的独立任务(Format 1)，还是科目组Header(Format 2)
          let isGroupHeader = false;
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            if (nextLine.match(/^\s*[-*+]\s+/)) {
              isGroupHeader = true;
            }
          }
          if (isGroupHeader) {
            // 解析Header可能自带的部分特殊符号（为了干净），一般就是纯文本，比如“语文”
            currentGroupTag = trimmed.replace(/[:：\s]+$/, '');
            continue; // 跳过，不创建任务
          } else {
            // 普通的第一种格式，清理掉先前的分组状态以防串连
            currentGroupTag = '';
          }
        }

        let isSchoolDone = false;
        let estTime = 25; // 默认时长
        let taskTags: string[] = [];
        let title = rawTitle;

        // 解析 [✓...] 或 ✓ 或 校内完成
        const schoolDoneMatch = title.match(/\[(✓|v|校内完成).*?\]/i) || title.match(/(?:^|\s)(✓|校内完成)(?:\s|$)/);
        if (schoolDoneMatch) {
          isSchoolDone = true;
          title = title.replace(schoolDoneMatch[0], '');
        }

        // 解析 [xxm] 或 xxm 或 xx分钟
        const timeMatch = title.match(/\[(\d+)\s*m?\]/i) || title.match(/(?:^|\s)(\d+)(m|分钟)(?:\s|$)/i);
        if (timeMatch) {
          estTime = parseInt(timeMatch[1] || timeMatch[2], 10);
          title = title.replace(timeMatch[0], '');
        }

        // 解析 [#标签1,标签2] 或 #标签1,标签2 (支持紧贴任务名，支持逗号后跟空格如 #课内, 数学)
        const tagMatch = title.match(/\[#(.*?)\]/) || title.match(/#([^\s,，]+(?:[,，]\s*[^\s,，]+)*)/);
        if (tagMatch) {
          const tagStr = tagMatch[1] || tagMatch[2];
          taskTags = tagStr.split(/[,，]+/).map(t => t.trim()).filter(Boolean);
          title = title.replace(tagMatch[0], '');
        }

        // 追加分组大标签并去重
        if (groupTagToAdd && !taskTags.includes(groupTagToAdd)) {
          taskTags.push(groupTagToAdd);
        }

        title = title.replace(/\s+/g, ' ').trim();
        if (!title) continue;

        await TaskService.create({
          title,
          est_time: isSchoolDone ? 0 : estTime,
          act_time: isSchoolDone ? estTime : 0, // 校内完成将其解析的时长作为实际时长
          tags: taskTags,
          is_school_done: isSchoolDone,
          status: isSchoolDone ? TaskStatus.COMPLETED : defaultStatus,
        });
      }

      setBatchText('');
      setBatchOpen(false);
      if (onTaskAdded) onTaskAdded();
    } catch (error) {
      console.error('Failed to parse batch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

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
    <>
      {/* 悬浮操作枢纽 */}
      <div className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-40">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-transform" size="icon" />
            }
          >
            <Plus className="h-6 w-6 text-white" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-44 bg-white border-0 shadow-xl rounded-2xl p-2 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 duration-200">
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-blue-50 focus:text-blue-700 rounded-xl font-medium transition-colors"
              onClick={() => alert("拍照录入功能开发中...")}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 mr-3">
                <Camera className="h-4 w-4 text-blue-600" />
              </div>
              <span>拍照录入</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-emerald-50 focus:text-emerald-700 rounded-xl font-medium transition-colors"
              onClick={() => alert("相册上传功能开发中...")}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 mr-3">
                <ImageIcon className="h-4 w-4 text-emerald-600" />
              </div>
              <span>相册上传</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-purple-50 focus:text-purple-700 rounded-xl font-medium transition-colors"
              onClick={() => setBatchOpen(true)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 mr-3">
                <ListPlus className="h-4 w-4 text-purple-600" />
              </div>
              <span>批量添加</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="py-3 px-3 cursor-pointer text-gray-700 focus:bg-orange-50 focus:text-orange-700 rounded-xl font-medium transition-colors"
              onClick={() => setOpen(true)}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 mr-3">
                <PenLine className="h-4 w-4 text-orange-600" />
              </div>
              <span>手动填写</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 批量添加弹窗 */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>批量添加任务</DialogTitle>
            <DialogDescription>
              支持单行解析 (空格分隔) 或 树状层级解析：<br/>
              <code>语数英<br/>  - 修改试卷 45m<br/>  - 预习 #课内 30m ✓</code>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <textarea
              className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              placeholder={"数学\n  - 练习册复习 45m ✓\n语文\n  - 阅读报纸 #阅读 30m\n  - 背诵 15m"}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>取消</Button>
            <Button onClick={handleBatchSave} disabled={loading || !batchText.trim()}>
              {loading ? '解析中...' : '确认批量生成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 单个添加弹窗 */}
      <Dialog open={open} onOpenChange={setOpen}>
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
                max="1440"
                maxLength={4}
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
                max="1440"
                maxLength={4}
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
            {frequentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {frequentTags.map(tag => (
                  <button 
                    key={tag} 
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-transparent transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            {smartBufferSuggestion && (
              <div className="text-sm text-orange-700 bg-orange-50/80 border border-orange-100 p-2.5 rounded-lg mt-2 font-medium animate-in fade-in slide-in-from-top-1">
                {smartBufferSuggestion}
              </div>
            )}
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
    </>
  );
}
