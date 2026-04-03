import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { TaskService } from '@/services/task-service';
import { GoalService } from '@/services/goal-service';
import { Task, TaskStatus, type Goal } from '@/lib/types';
import { Target } from 'lucide-react';
import Link from 'next/link';

interface TaskEditorSheetProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function TaskEditorSheet({ task, open, onOpenChange, onSaved }: TaskEditorSheetProps) {
  const [title, setTitle] = useState('');
  const [estTime, setEstTime] = useState('');
  const [isSchoolDone, setIsSchoolDone] = useState(false);
  const [tags, setTags] = useState('');
  const [difficulty, setDifficulty] = useState<number>(0);
  const [confidence, setConfidence] = useState<boolean | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState<Goal | null>(null);

  useEffect(() => {
    if (task && open) {
      setTitle(task.title || '');
      setEstTime(String(task.est_time || 0));
      setIsSchoolDone(task.is_school_done || false);
      setTags(task.tags ? task.tags.join(', ') : '');
      setDifficulty(task.difficulty || 0);
      setConfidence(task.confidence);
      setDescription(task.description || '');

      if (task.goal_id) {
        GoalService.getById(task.goal_id).then(g => setGoal(g || null));
      } else {
        setGoal(null);
      }
    }
  }, [task, open]);

  const handleSave = async () => {
    if (!task || !task.id) return;
    setLoading(true);
    try {
      await TaskService.update(task.id, {
        title: title.trim(),
        est_time: isSchoolDone ? 0 : (parseInt(estTime, 10) || 0),
        is_school_done: isSchoolDone,
        tags: tags.split(/[,，\s;；]+/).map(t => t.trim()).filter(Boolean),
        difficulty: difficulty || undefined,
        confidence: confidence,
        description: description.trim(),
        status: isSchoolDone && task.status !== TaskStatus.COMPLETED ? TaskStatus.COMPLETED : task.status,
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('保存任务失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!task) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!max-w-none w-full sm:!w-[520px] z-[100] overflow-y-auto !px-6 sm:!px-8">
        <SheetHeader>
          <SheetTitle>编辑属性</SheetTitle>
          <SheetDescription>
            可以在随心所欲更新预估时间和任务信息。首次更新时长时会留下认知快照。
          </SheetDescription>
        </SheetHeader>
        
        <div className="grid gap-5 py-6">
          {goal && (
             <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-100/50 shadow-sm">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-inner shrink-0">
                   <Target className="w-4 h-4" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[10px] text-blue-600/80 font-bold uppercase tracking-wider mb-0.5">所属长线目标</span>
                   <span className="text-sm font-semibold text-gray-900 leading-tight">{goal.title}</span>
                 </div>
               </div>
               <Link href={`/goals/${goal.id}`} onClick={() => onOpenChange(false)} className="px-3 py-1.5 text-xs font-semibold bg-white text-blue-600 rounded-lg shadow-sm border border-blue-100 hover:bg-blue-50 transition-colors shrink-0">
                 查看大目标视频
               </Link>
             </div>
          )}

          <div className="flex flex-col gap-2">
            <Label className="text-gray-700">任务名称</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-gray-50 border-gray-200 focus-visible:ring-blue-500" />
          </div>

          <div className={`flex items-start space-x-2 p-3 rounded-lg border ${task.status !== TaskStatus.PENDING ? 'bg-gray-50/80 border-gray-200 opacity-80' : 'bg-blue-50/50 border-blue-100'}`}>
            <input 
              type="checkbox" 
              checked={isSchoolDone}
              onChange={(e) => setIsSchoolDone(e.target.checked)}
              disabled={task.status !== TaskStatus.PENDING}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex flex-col">
              <Label className={`cursor-pointer font-medium pb-0 leading-none ${task.status !== TaskStatus.PENDING ? 'text-gray-600' : 'text-blue-800'}`}>
                在校已完成 (直接结项不计时)
              </Label>
              {task.status !== TaskStatus.PENDING && (
                <span className="text-[11px] text-gray-400 mt-1 font-normal leading-tight">
                  任务已开始或已归档，无法更改此项属性。
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-gray-700">预估时长（分钟）</Label>
            <Input
              type="number"
              value={estTime}
              onChange={(e) => setEstTime(e.target.value)}
              disabled={isSchoolDone || task.status === TaskStatus.COMPLETED}
              className="bg-gray-50 border-gray-200 disabled:opacity-75 disabled:cursor-not-allowed"
            />
            <div className="bg-orange-50/60 p-2.5 rounded-md border border-orange-100/50">
              <p className="text-xs text-orange-700/80 font-medium">
                {task.initial_estimated_duration !== undefined ? `📝 初始快照时长: ${task.initial_estimated_duration} 分钟` : '💡 这是你第一次预估，后续修改将以此为初始定锚并作快照保留。'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-700">标签（逗号/空格/分号分隔）</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="数学, 作业" className="bg-gray-50 border-gray-200" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <Label className="text-gray-700 mb-1">难度评估</Label>
              <div className="flex space-x-1.5 h-10 items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer" onClick={(e) => {
                 let target = e.target as HTMLElement;
                 if(target.tagName !== 'BUTTON') { setDifficulty(0) }
              }}>
                {[1, 2, 3].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDifficulty(level) }}
                    className={`text-2xl transition-all duration-300 ${difficulty >= level ? 'scale-110 opacity-100 drop-shadow-md' : 'opacity-30 grayscale hover:opacity-100 hover:grayscale-0'}`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <Label className="text-gray-700 mb-1">信心指数</Label>
              <div className="flex space-x-3 h-10 items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
                <button
                  type="button"
                  onClick={() => setConfidence(true)}
                  className={`text-3xl transition-all duration-300 ${confidence === true ? 'scale-110 opacity-100 drop-shadow-md' : 'opacity-30 grayscale hover:opacity-100 hover:grayscale-0'}`}
                  title="成竹在胸"
                >
                  😎
                </button>
                <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                <button
                  type="button"
                  onClick={() => setConfidence(false)}
                  className={`text-3xl transition-all duration-300 ${confidence === false ? 'scale-110 opacity-100 drop-shadow-md' : 'opacity-30 grayscale hover:opacity-100 hover:grayscale-0'}`}
                  title="需要思考"
                >
                  🤔
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <Label className="text-gray-700 flex justify-between items-center">
              <span>任务指引或富文本</span>
              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-mono">Markdown</span>
            </Label>
            <MarkdownEditor
              value={description} 
              onValueChange={setDescription} 
              className="font-mono text-sm leading-relaxed bg-white"
              placeholder="# 步骤 1\n\n可以粘贴 markdown 或者 B 站、YouTube 等外链，随时可点击下方按钮上传附件。\n"
            />
          </div>

        </div>

        <div className="flex justify-end gap-3 pb-8 mt-4 pt-4 border-t border-gray-100">
          <Button variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-100" onClick={() => onOpenChange(false)}>取消</Button>
          <Button className="bg-blue-600 hover:bg-blue-700 px-8" onClick={handleSave} disabled={loading || !title.trim()}>保存变更</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
