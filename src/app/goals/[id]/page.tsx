'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Clock, ArrowLeft, MessageSquare, Send, Calendar, Activity, PenLine, PlusSquare } from 'lucide-react';
import { GoalService } from '@/services/goal-service';
import { type Goal, type GoalComment, type Task } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GoalEditorDialog } from '@/components/goals/goal-editor-dialog';
import { GoalSessionDialog } from '@/components/goals/goal-session-dialog';
import { MarkdownViewer } from '@/components/MarkdownViewer';
import { VideoEmbed } from '@/components/VideoEmbed';
import { TaskDetailWorkbench } from '@/components/TaskDetailWorkbench';

const STATUS_MAP: Record<string, { label: string, color: string }> = {
  PENDING: { label: '待办', color: 'bg-gray-100 text-gray-600' },
  RUNNING: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  PAUSED: { label: '已暂停', color: 'bg-orange-100 text-orange-700' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-700' },
  EXPIRED: { label: '已过期', color: 'bg-slate-100 text-slate-500' },
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-600' },
};

export default function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const goalId = resolvedParams.id;
  
  const [goal, setGoal] = useState<Goal | null>(null);
  const [progressTime, setProgressTime] = useState(0);
  const [sessions, setSessions] = useState<Task[]>([]);
  const [comments, setComments] = useState<GoalComment[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [userRole, setUserRole] = useState<'child' | 'parent'>('child');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);

  const fetchData = async () => {
    try {
      if (!goal) setLoading(true);
      const fetchedGoal = await GoalService.getById(goalId);
      if (fetchedGoal) {
        setGoal(fetchedGoal);
        const [time, sess, comms] = await Promise.all([
          GoalService.getGoalProgress(goalId),
          GoalService.getSessionsByGoalId(goalId),
          GoalService.getComments(goalId),
        ]);
        setProgressTime(time);
        const sortedSessions = sess.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setSessions(sortedSessions);
        setComments(comms);
        
        setSelectedTask(current => {
          if (!current) return current;
          return sortedSessions.find(s => s.id === current.id) || current;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [goalId]);

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    try {
      await GoalService.addComment(goalId, userRole, newComment.trim());
      setNewComment('');
      const comms = await GoalService.getComments(goalId);
      setComments(comms);
    } catch (err) {
      console.error('Failed to post comment', err);
    }
  };

  if (loading) {
    return <div className="flex-1 p-8 flex items-center justify-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  if (!goal) {
    return <div className="flex-1 p-8">长线目标不存在或已被删除。</div>;
  }

  const progressRatio = goal.total_estimated_duration > 0 
    ? Math.min(100, Math.round((progressTime / goal.total_estimated_duration) * 100))
    : 0;
  
  const remainingTime = Math.max(0, goal.total_estimated_duration - progressTime);
  const isOvertime = progressTime > goal.total_estimated_duration;

  // 格式化时间
  const formatTime = (minutes: number) => {
    minutes = Math.round(minutes);
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="flex flex-col h-screen md:h-[100dvh] bg-gray-50/50">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white/80 border-b backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
              <Target className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight flex items-center gap-2">
                {goal.title}
                <button onClick={() => setIsEditorOpen(true)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500 transition-colors">
                  <PenLine className="w-3.5 h-3.5" />
                </button>
              </h1>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 font-medium">
                {goal.deadline && (
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> 截止 {goal.deadline}</span>
                )}
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> 难度 {Array(goal.difficulty || 1).fill('★').join('')}</span>
              </div>
            </div>
          </div>
        </div>
        
        <Button onClick={() => setIsSessionDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 gap-1.5 shadow-sm">
          <PlusSquare className="w-4 h-4" />
          <span className="font-medium">导入今日任务</span>
        </Button>
      </header>

      {/* 进度与警示条 */}
      <div className="shrink-0 bg-white border-b px-6 py-4 flex flex-col gap-3">
        <div className="flex justify-between items-end text-sm">
           <div className="flex items-baseline gap-2">
             <span className="text-2xl font-bold text-gray-900">{progressRatio}%</span>
             <span className="text-gray-500 font-medium tracking-wide">已完成 {formatTime(progressTime)} / 预算 {formatTime(goal.total_estimated_duration)}</span>
           </div>
           {!isOvertime && remainingTime > 0 && (
             <span className="text-blue-600 font-medium">剩余：{formatTime(remainingTime)}</span>
           )}
           {isOvertime && (
             <span className="text-red-500 font-medium">已超出预算时间 {formatTime(progressTime - goal.total_estimated_duration)}！</span>
           )}
        </div>
        <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden relative">
          <div 
            className={cn("absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out", isOvertime ? "bg-red-500" : "bg-blue-500")}
            style={{ width: `${Math.min(100, progressRatio)}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* 左侧区域：项目说明与嵌入视图 */}
        <div className="flex-1 md:w-1/2 overflow-y-auto p-6 bg-white md:border-r border-gray-100">
           <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b">项目背景与资料</h2>
           {!goal.description ? (
             <div className="text-gray-400 text-sm italic">暂无详细说明。</div>
           ) : (
             <div className="flex flex-col gap-2">
                <VideoEmbed text={goal.description} />
                <MarkdownViewer content={goal.description} />
             </div>
           )}
        </div>

        {/* 右侧区域：Sessions & Comments */}
        <div className="flex-1 md:w-1/2 flex flex-col bg-gray-50/50 overflow-hidden h-full">
          
          {/* Session List */}
          <section className="shrink-0 flex flex-col max-h-[45%] border-b border-gray-200 bg-white/50 z-10 transition-all">
            <div className="p-6 pb-2 shrink-0">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" />
                执行片段记录 (Sessions)
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
              {sessions.length === 0 ? (
                <div className="text-sm text-gray-400 py-4 text-center border border-dashed rounded-xl bg-gray-50">
                  尚未提取执行片段。点击右上角的「导入今日任务」开始你的第一步。
                </div>
              ) : (
                sessions.map(session => (
                  <div 
                    key={session.id} 
                    className="bg-white p-2.5 pl-4 pr-3 rounded-xl border shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between group cursor-pointer"
                    onClick={() => { setSelectedTask(session); setWorkbenchOpen(true); }}
                  >
                    <div className="flex flex-col gap-0.5 w-[45%] sm:w-[50%] mr-2 shrink">
                      <span className="font-semibold text-gray-900 line-clamp-1 group-hover:text-blue-700 transition-colors" title={session.title}>{session.title}</span>
                      <span className="text-[10px] font-mono text-gray-400 tracking-tight">{new Date(session.created_at).toLocaleString([], {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                       <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap", STATUS_MAP[session.status]?.color || "bg-gray-100 text-gray-600")}>
                         {STATUS_MAP[session.status]?.label || session.status}
                       </span>
                       <span className="text-sm font-black text-gray-700 w-8 text-right shrink-0">{Math.round(session.act_time || 0)}m</span>
                       <div className="ml-1 h-7 px-3 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center font-bold rounded-lg shrink-0 transition-colors text-xs shadow-sm">
                         前往
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Comments List */}
          <section className="flex-1 flex flex-col min-h-0 bg-transparent">
            <div className="p-6 pb-2 shrink-0">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                进度日记与反馈
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className={cn("flex flex-col max-w-[85%]", comment.user_role === 'parent' ? "items-start" : "items-end self-end ml-auto")}>
                   <span className="text-[10px] text-gray-400 mb-1 px-1">{comment.user_role === 'parent' ? '家长' : '我'} • {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                   <div className={cn("px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap shadow-sm", comment.user_role === 'parent' ? "bg-white border text-gray-800 rounded-tl-none" : "bg-blue-600 text-white rounded-tr-none")}>
                     {comment.content}
                   </div>
                </div>
              ))}
              {comments.length === 0 && (
                 <div className="text-sm text-gray-400 py-4 text-center border border-dashed rounded-xl bg-gray-50/80">
                    没有新的留言记录。
                 </div>
              )}
            </div>
          </section>

          {/* Comment Input Area */}
          <div className="shrink-0 border-t bg-white p-4 pb-24 md:pb-12 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-end gap-3 max-w-2xl mx-auto">
              {/* Role Switcher */}
              <div className="flex flex-col gap-1 shrink-0 bg-gray-100 p-1 rounded-lg">
                 <button 
                   onClick={() => setUserRole('child')}
                   className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors", userRole === 'child' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700")}
                 >记录进度</button>
                 <button 
                   onClick={() => setUserRole('parent')}
                   className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition-colors", userRole === 'parent' ? "bg-white shadow-sm text-emerald-600" : "text-gray-500 hover:text-gray-700")}
                 >家长点评</button>
              </div>
              <div className="flex-1 relative">
                <textarea
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border-gray-200 outline-none hover:bg-white focus:bg-white focus:ring-2 ring-blue-500 border rounded-xl text-sm resize-none transition-all"
                  rows={2}
                  placeholder={userRole === 'child' ? "记录下现在的想法、困难或进度..." : "写下鼓励的话语或调整建议..."}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                     // 仅支持非中文输入状态下的 ctrl+enter 或 command+enter 发送
                     if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                         e.preventDefault();
                         handlePostComment();
                     }
                  }}
                />
                <button
                   onClick={handlePostComment}
                   disabled={!newComment.trim()}
                   className="absolute right-3 bottom-3 p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 顶部按钮调用的 导入片段 对话框 */}
      <GoalSessionDialog 
        open={isSessionDialogOpen} 
        onOpenChange={setIsSessionDialogOpen} 
        onSessionAdded={fetchData} 
        goal={goal} 
      />

      {/* 隐藏的 GoalEditorDialog 用于内容编辑 */}
      <GoalEditorDialog
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        goal={goal}
        onGoalSaved={fetchData}
      />

      <TaskDetailWorkbench 
        task={selectedTask} 
        open={workbenchOpen} 
        onOpenChange={setWorkbenchOpen} 
        onDataChanged={fetchData} 
      />
    </div>
  );
}
