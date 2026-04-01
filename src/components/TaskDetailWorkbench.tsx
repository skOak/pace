import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Task, TaskStatus } from '@/lib/types';
import { TaskService } from '@/services/task-service';
import { TaskExecutionService } from '@/services/task-execution-service';
import { LiveTimer } from '@/components/LiveTimer';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { VideoEmbed } from '@/components/VideoEmbed';
import { TaskEditorSheet } from '@/components/TaskEditorSheet';
import { PenLine, PlayCircle, PauseCircle, CheckCircle2, Flame, Maximize2, Target } from 'lucide-react';
import { formatDuration } from '@/lib/forecast-utils';
import { GoalService } from '@/services/goal-service';
import type { Goal } from '@/lib/types';
import Link from 'next/link';

interface TaskDetailWorkbenchProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataChanged: () => void;
  onRequestReopen?: (task: Task) => void;
  onRequestComplete?: (task: Task) => void;
}

export function TaskDetailWorkbench({ task, open, onOpenChange, onDataChanged, onRequestReopen, onRequestComplete }: TaskDetailWorkbenchProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [goal, setGoal] = useState<Goal | null>(null);
  
  useEffect(() => {
    if (task) {
      setComments(task.comments || '');
    }
  }, [task]);

  useEffect(() => {
    if (task?.goal_id) {
       GoalService.getById(task.goal_id).then(g => setGoal(g || null));
    } else {
       setGoal(null);
    }
  }, [task?.goal_id]);

  if (!task) return null;

  const handleStart = async () => {
    if (new Date().getHours() >= 22) {
      alert("已经很晚啦，该休息了！明早再战吧！");
      onDataChanged();
      return;
    }
    const allTasks = await TaskService.getByDate(new Date().toISOString().slice(0, 10));
    const running = allTasks.find(t => t.status === TaskStatus.RUNNING);
    
    // 如果有其他任务在跑，直接强制暂停（简化流程便于工作台流转，如果需要严格弹窗可在组件外控制）
    if (running && running.id !== task.id) {
       await TaskExecutionService.pauseTask(running.id!);
       await TaskExecutionService.startTask(task.id!);
    } else {
       await TaskExecutionService.startTask(task.id!);
    }
    onDataChanged();
  };

  const handlePause = async () => {
    await TaskExecutionService.pauseTask(task.id!);
    onDataChanged();
  };

  const handleComplete = async () => {
    if (onRequestComplete && task) {
       onRequestComplete(task);
    } else {
       await TaskExecutionService.completeTask(task.id!);
       onDataChanged();
    }
  };

  const saveComments = async () => {
    if (!task.id) return;
    if (comments.trim() === (task.comments || '').trim()) return;
    await TaskService.update(task.id, { comments: comments.trim() });
    onDataChanged();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        {/* 覆盖整个右侧大部分的沉浸底板 */}
        <SheetContent className="!max-w-none !w-[95vw] sm:!w-[90vw] md:!w-[85vw] lg:!w-[80vw] xl:!w-[1200px] overflow-hidden p-0 rounded-l-3xl shadow-2xl transition-all duration-500 ease-out z-[90]">
          {/* 取消默认表头以免占用空间 */}
          <SheetHeader className="hidden"><SheetTitle>分析面板</SheetTitle></SheetHeader>
          
          <div className="flex flex-col md:flex-row h-full absolute inset-0 bg-white">
            {/* ========================================================= */}
            {/* 左侧 (Focus Zone) : 大时间与状态操作 */}
            {/* ========================================================= */}
            <div className="w-full md:w-[45%] lg:w-[40%] bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col justify-center items-center p-6 md:p-8 xl:p-12 border-b md:border-b-0 md:border-r border-gray-200/60 shrink-0 relative overflow-y-auto">
              {/* 返回/最小化装饰（非功能性保留位置） */}
              <div className="absolute top-6 left-6 opacity-30 pointer-events-none md:hidden text-xs font-bold uppercase tracking-widest text-gray-500">
                SWIPE DOWN ⬇
              </div>

              <div className="text-center space-y-4 mb-10 w-full animate-in slide-in-from-bottom-4 duration-700">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 leading-tight tracking-tight break-words">{task.title}</h1>
                <div className="flex justify-center flex-wrap gap-2 pt-2">
                  {task.tags?.map(t => (
                    <span key={t} className="px-3 py-1 bg-slate-200/70 text-slate-700 text-xs rounded-full font-bold shadow-sm">#{t}</span>
                  ))}
                  <span className="px-3 py-1 bg-blue-100/80 text-blue-700 text-xs rounded-full font-bold shadow-sm">
                    {task.is_school_done ? '校内完成' : `预估 ${formatDuration(task.est_time)}`}
                  </span>
                </div>

                {/* 认知维度 */}
                {(task.difficulty || task.confidence !== undefined) && (
                  <div className="inline-flex items-center justify-center gap-6 mt-6 px-6 py-3 bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/50">
                    {task.difficulty ? (
                      <div className="flex items-center gap-1" title='难度星级'>
                        {new Array(task.difficulty).fill('⭐').map((s, i) => <span key={i} className="text-xl drop-shadow-sm">{s}</span>)}
                      </div>
                    ) : null}
                    {(task.difficulty && task.confidence !== undefined) && <div className="w-[1px] h-6 bg-slate-300/50"></div>}
                    {task.confidence !== undefined ? (
                      <div className="text-3xl filter drop-shadow hover:scale-110 transition-transform cursor-help" title={task.confidence ? "成竹在胸" : "需要思考"}>
                        {task.confidence ? '😎' : '🤔'}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* 巨大的计时器环 */}
              {!task.is_school_done && (
                <div className="mb-14 relative flex items-center justify-center animate-in zoom-in-95 duration-1000">
                   <div className={`w-[240px] h-[240px] md:w-[280px] md:h-[280px] rounded-full flex flex-col items-center justify-center transition-all duration-1000
                    ${task.status === TaskStatus.RUNNING 
                      ? 'border-8 border-blue-500 bg-blue-50 shadow-[0_0_50px_rgba(59,130,246,0.25)] ring-4 ring-blue-500/20 ring-offset-4 ring-offset-blue-50' 
                      : 'border-[6px] border-slate-200 bg-white shadow-xl hover:shadow-2xl'}`}>
                      <div className="text-slate-400 text-xs md:text-sm font-bold tracking-[0.2em] uppercase mb-1 md:mb-2">{task.status === TaskStatus.RUNNING ? 'FOCUSING' : 'READY'}</div>
                      <div className="text-[3.5rem] md:text-[4.5rem] font-mono tracking-tighter font-black text-slate-800 tabular-nums">
                        <LiveTimer taskId={task.id!} baseActTime={task.act_time} status={task.status} />
                      </div>
                      {task.status === TaskStatus.PAUSED && task.act_time > 0 && <div className="text-slate-400 font-medium text-sm mt-1 uppercase tracking-widest">PAUSED</div>}
                   </div>
                   
                   {/* 点火火花装饰 */}
                   {task.status === TaskStatus.RUNNING && (
                      <div className="absolute top-8 right-8 text-2xl animate-bounce drop-shadow-[0_0_10px_rgba(255,165,0,0.8)] z-10">🔥</div>
                   )}
                </div>
              )}

              {/* 操作按钮区 */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full px-4 animate-in slide-in-from-bottom-8 duration-700 delay-150">
                {(task.status === TaskStatus.PENDING || task.status === TaskStatus.RUNNING || task.status === TaskStatus.PAUSED) && (
                  <>
                    <Button 
                      size="lg" 
                      className={`h-16 shrink-0 w-full sm:w-auto px-10 rounded-2xl text-xl font-bold shadow-xl transition-all duration-300 hover:scale-105 
                        ${task.status === TaskStatus.RUNNING 
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500' 
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500'}`}
                      onClick={task.status === TaskStatus.RUNNING ? handlePause : handleStart}
                    >
                      {task.status === TaskStatus.RUNNING ? <><PauseCircle className="mr-3 h-7 w-7"/> 暂停</> : <><PlayCircle className="mr-3 h-7 w-7" /> {task.act_time > 0 ? '继续专注' : '开始专注'}</>}
                    </Button>
                    <Button 
                      size="lg"
                      variant="outline"
                      className="h-16 w-full sm:w-auto px-8 rounded-2xl text-lg font-bold border-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 transition-all hover:scale-105 shadow-md flex-shrink-0"
                      onClick={handleComplete}
                    >
                      <CheckCircle2 className="mr-2 h-6 w-6"/> 完成
                    </Button>
                  </>
                )}
                {task.status === TaskStatus.COMPLETED && (
                   <div className="w-full">
                     <div className="text-emerald-700 font-black flex items-center justify-center gap-3 text-2xl h-16 bg-gradient-to-r from-emerald-100 to-green-50 rounded-2xl border-2 border-green-200 shadow-sm w-full">
                        <CheckCircle2 className="w-8 h-8" />
                        恭喜！任务已归档
                     </div>
                     {onRequestReopen && (
                       <Button variant="ghost" size="sm" onClick={() => onRequestReopen(task)} className="mt-2 w-full text-gray-500 hover:text-orange-600 font-medium tracking-wider">
                         重新开启任务
                       </Button>
                     )}
                   </div>
                )}
                {task.status === TaskStatus.EXPIRED && (
                   <div className="w-full">
                     <div className="text-red-500 font-black flex items-center justify-center gap-3 text-xl h-16 bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border-2 border-red-200 shadow-sm w-full">
                        🕒 已经很晚啦，该休息了！明早再战吧！
                     </div>
                   </div>
                )}
              </div>
            </div>

            {/* ========================================================= */}
            {/* 右侧 (Content Zone) : 富文本指引与复盘 */}
            {/* ========================================================= */}
            <div className="w-full md:w-[55%] lg:w-[60%] bg-white flex flex-col h-full overflow-hidden shrink-0">
              <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 md:py-12 space-y-8 scroll-smooth relative">
                 
                 {/* 专属长线目标入口 */}
                 {goal && (
                   <div className="flex items-center justify-between p-4 rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50/50 border-blue-100/50 shadow-sm mb-4 animate-in fade-in duration-500">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-inner shrink-0">
                         <Target className="w-5 h-5" />
                       </div>
                       <div className="flex flex-col">
                         <span className="text-xs text-blue-600/80 font-bold uppercase tracking-wider mb-0.5">此片段属于长线目标</span>
                         <span className="text-base font-bold text-gray-900 leading-tight">{goal.title}</span>
                       </div>
                     </div>
                     <Link href={`/goals/${goal.id}`} onClick={() => onOpenChange(false)} className="px-4 py-2 text-sm font-bold bg-white text-blue-600 rounded-xl shadow-sm border border-blue-100 hover:bg-blue-50 transition-colors shrink-0">
                       进入目标主页
                     </Link>
                   </div>
                 )}

                 {/* 首屏视频提取区 */}
                 <VideoEmbed text={task.description} />
                 
                 {/* Markdown 指引区 */}
                 <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
                       <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-[0.1em] flex items-center gap-2">
                         <Maximize2 className="w-4 h-4 text-slate-400" />
                         指南与素材
                       </h3>
                       <Button variant="ghost" size="sm" className="text-blue-600 hover:bg-blue-100 rounded-xl font-bold h-9 px-4 transition-colors" onClick={() => setEditorOpen(true)}>
                         <PenLine className="w-4 h-4 mr-1.5" />
                         全状态编辑
                       </Button>
                    </div>
                    {task.description ? (
                      <MarkdownViewer content={task.description} />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                        <PenLine className="w-12 h-12 mb-4 opacity-30" />
                        <p className="font-medium text-slate-400">尚无任务指引信息</p>
                        <Button variant="link" className="text-blue-500 font-bold p-0 h-auto mt-2" onClick={() => setEditorOpen(true)}>点击编辑添加</Button>
                      </div>
                    )}
                 </div>

                 {/* 复盘区 */}
                 <div className="pt-6 border-t-[3px] border-dashed border-slate-100">
                    <h3 className="text-sm md:text-base font-black text-slate-800 mb-4 ml-1 uppercase tracking-[0.1em] flex items-center gap-2">
                      📝 复盘与收获
                    </h3>
                    <div className="relative group">
                      <Textarea 
                         placeholder="任务完成后，可以在这里写下你的经验教训、收获或者是老师/家长的批语..." 
                         value={comments}
                         onChange={(e) => setComments(e.target.value)}
                         className="min-h-[160px] bg-amber-50/40 border-amber-200 focus-visible:ring-amber-400/50 rounded-2xl resize-y text-slate-800 p-5 md:p-6 text-base leading-relaxed md:text-lg transition-all focus:bg-white"
                         onBlur={saveComments}
                      />
                      <div className="absolute top-4 right-4 opacity-20 pointer-events-none group-focus-within:opacity-40 transition-opacity">
                         <PenLine className="w-6 h-6 text-amber-600" />
                      </div>
                      
                      {comments !== (task.comments || '') && (
                        <div className="absolute bottom-4 right-4">
                          <Button size="sm" onClick={saveComments} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold">保存修改</Button>
                        </div>
                      )}
                    </div>
                 </div>

                 {/* 底部安全内边距 */}
                 <div className="h-20" />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 弹出的属性编辑面板并调高其层级 */}
      <TaskEditorSheet 
        task={task} 
        open={editorOpen} 
        onOpenChange={setEditorOpen} 
        onSaved={onDataChanged} 
      />
    </>
  );
}
