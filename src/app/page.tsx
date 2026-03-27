'use client';

import { useState, useEffect, useCallback } from 'react';
import { TaskService } from '@/services/task-service';
import { TaskExecutionService } from '@/services/task-execution-service';
import { ExecutionLogService } from '@/services/execution-log-service';
import { DailyAnchorService } from '@/services/daily-anchor-service';
import { calculateForecastTime, calculateDeviationRatio, formatTime, formatDuration } from '@/lib/forecast-utils';
import { TaskStatus, type Task } from '@/lib/types';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { LiveTimer } from '@/components/LiveTimer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, PlayCircle, Clock, PauseCircle, Target, Flame, Trash2 } from 'lucide-react';
import { WeeklyStrip } from '@/components/WeeklyStrip';

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [startAnchor, setStartAnchor] = useState<string | null>(null);
  const [endAnchor, setEndAnchor] = useState<string | null>(null);
  const [totalActTime, setTotalActTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeRunningStartTime, setActiveRunningStartTime] = useState<number | null>(null);
  const [startAnchorDate, setStartAnchorDate] = useState<Date | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionTaskName, setTransitionTaskName] = useState('');



  const loadTasks = useCallback(async () => {
    try {
      // 1. 先执行自动过期检查，清理非今天的未完成任务
      await TaskService.expireOverdueTasks();

      // 1.5 如果时间超过 22:00 晚安期限，强制过期今天的未完成任务
      if (new Date().getHours() >= 22) {
        await TaskExecutionService.expireTodayUnfinishedTasks();
      }

      // 2. 获取今天的任务
      const today = new Date().toISOString().slice(0, 10);
      const allTasks = await TaskService.getByDate(today);
      setTasks(allTasks);

      // 3. 获取锚点和总用时基础值
      const anchor = await DailyAnchorService.get(today);
      setStartAnchor(anchor?.start_anchor ? formatTime(new Date(anchor.start_anchor)) : null);
      setStartAnchorDate(anchor?.start_anchor ? new Date(anchor.start_anchor) : null);
      setEndAnchor(anchor?.end_anchor ? formatTime(new Date(anchor.end_anchor)) : null);
      setTotalActTime(allTasks.reduce((sum, t) => t.is_school_done ? sum : sum + t.act_time, 0));

      // 4. 获取运行中任务的活跃记录时间点，以提供动态时长加成
      const runningTask = allTasks.find(t => t.status === TaskStatus.RUNNING);
      if (runningTask && runningTask.id) {
        const logs = await ExecutionLogService.getByTaskId(runningTask.id);
        const activeLog = logs.find(l => !l.endTime);
        if (activeLog) {
          setActiveRunningStartTime(new Date(activeLog.startTime).getTime());
        } else {
          setActiveRunningStartTime(null);
        }
      } else {
        setActiveRunningStartTime(null);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 每分钟更新一次当前时间以刷新预测和时长
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (now.getHours() >= 22) {
        loadTasks();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [loadTasks]);

  const [taskToSwitch, setTaskToSwitch] = useState<Task | null>(null);
  const [runningTaskForSwitch, setRunningTaskForSwitch] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  const handleStartTask = async (task: Task) => {
    if (new Date().getHours() >= 22) {
      alert("已经很晚啦，该休息了！明早再战吧！");
      await loadTasks();
      return;
    }

    const running = tasks.find(t => t.status === TaskStatus.RUNNING);
    if (running && running.id !== task.id) {
      setRunningTaskForSwitch(running);
      setTaskToSwitch(task);
    } else {
      triggerTransition(task, () => TaskExecutionService.startTask(task.id!));
    }
  };

  const confirmSwitch = async () => {
    if (taskToSwitch && runningTaskForSwitch) {
      triggerTransition(taskToSwitch, () => TaskExecutionService.startTask(taskToSwitch.id!, runningTaskForSwitch.id!));
    }
  };

  const triggerTransition = (task: Task, action: () => Promise<void>) => {
    setTaskToSwitch(null);
    setRunningTaskForSwitch(null);
    setTransitionTaskName(task.title);
    setIsTransitioning(true);
    
    setTimeout(async () => {
      await action();
      await loadTasks();
      // 在完成获取数据和执行请求后再稍等片刻让淡出平滑
      setTimeout(() => setIsTransitioning(false), 500);
    }, 800);
  };

  const handlePauseTask = async (task: Task) => {
    await TaskExecutionService.pauseTask(task.id!);
    loadTasks();
  };

  const handleCompleteTask = async (task: Task) => {
    await TaskExecutionService.completeTask(task.id!);
    loadTasks();
  };

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400 font-medium">加载今日节奏中...</p>
      </div>
    );
  }

  // 分组
  const runningTasks = tasks.filter((t) => t.status === TaskStatus.RUNNING);
  const pendingTasks = tasks.filter((t) => t.status === TaskStatus.PENDING || t.status === TaskStatus.PAUSED);
  const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED);

  const expectedFinishTime = formatTime(calculateForecastTime(tasks, currentTime), currentTime);

  // 动态总用时 = 数据库所有任务的基础 total + 当前正在执行碎片的时间差
  let displayTotalTime = totalActTime;
  if (activeRunningStartTime) {
    displayTotalTime += Math.floor((currentTime.getTime() - activeRunningStartTime) / 60000);
  }

  const isAllCompleted = tasks.length > 0 && pendingTasks.length === 0 && runningTasks.length === 0;
  const displayEndAnchor = isAllCompleted ? endAnchor : null;

  const isSparkEligible = startAnchorDate && startAnchorDate.getHours() >= 17 && startAnchorDate.getHours() < 18;
  const sparkTaskId = isSparkEligible ? (runningTasks.length > 0 ? runningTasks[0].id : (pendingTasks.length > 0 ? pendingTasks[0].id : null)) : null;

  return (
    <>
      <div className="space-y-8 animate-in mt-4 pb-24">
      {/* 宏观周看板 */}
      <WeeklyStrip />

      {/* 顶部复盘与预测区 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="md:col-span-2 flex flex-col justify-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">今天</h1>
          <div className="mt-1 text-sm md:text-base">
            {pendingTasks.length + runningTasks.length > 0 ? (
              <p className="text-gray-500 flex items-center gap-2">
                你还有 {pendingTasks.length + runningTasks.length} 个任务待完成
                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium border border-blue-100">
                  预计 {expectedFinishTime} 收尾
                </span>
              </p>
            ) : tasks.length > 0 ? (
              <p className="text-emerald-600 font-medium flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> ✨ 今日任务已全部完成！
              </p>
            ) : (
              <p className="text-gray-500">
                今天还没有添加任何任务，赶紧开始规划吧！
              </p>
            )}
          </div>
        </div>
        
        <div className="flex gap-3 md:justify-end items-center">
          <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex-1 md:flex-none">
            <div className="flex items-center gap-1.5 text-orange-600 mb-1">
              <Target className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">起止区间</span>
            </div>
            <div className="text-lg font-bold text-orange-950 flex items-center gap-1">
              <span>{startAnchor || '--:--'}</span>
              <span className="text-sm font-normal text-orange-400 mx-0.5">~</span>
              <span className={displayEndAnchor ? '' : 'text-orange-950/40 text-base'}>{displayEndAnchor || '--:--'}</span>
            </div>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex-1 md:flex-none">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
              <Flame className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">今日总用时</span>
            </div>
            <div className="text-lg font-bold text-emerald-950">{formatDuration(displayTotalTime)}</div>
          </div>
        </div>
      </div>

      {/* 正在运行的任务 */}
      {runningTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2">
            <PlayCircle className="w-4 h-4" /> 专注中
          </h2>
          {runningTasks.map((task) => {
            const isSparkTask = task.id === sparkTaskId;
            return (
            <Card key={task.id} className={`border-blue-100 shadow-md ${isSparkTask ? 'shadow-yellow-200/50 border-yellow-400 bg-gradient-to-r from-yellow-50 to-white' : 'shadow-blue-500/5 bg-gradient-to-r from-blue-50 to-white'}`}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900 text-lg flex items-center gap-2">
                    {task.title}
                    {isSparkTask && <span className="text-yellow-500 animate-pulse text-xl">⚡</span>}
                  </h3>
                  <div className="flex gap-2 mt-2">
                    {task.tags.map(tag => (
                      <span key={tag} className="text-xs px-2 py-1 bg-blue-100/50 text-blue-700 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 text-right">
                  <div className="flex items-center gap-1.5 text-blue-600 font-medium">
                    <Clock className="w-4 h-4" />
                    <span>已专注 <LiveTimer taskId={task.id!} baseActTime={task.act_time} /> / 预估 {formatDuration(task.est_time)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 border-blue-200 text-blue-700 hover:bg-blue-100"
                      onClick={() => handlePauseTask(task)}
                    >
                      <PauseCircle className="w-4 h-4 mr-1" />
                      暂停
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleCompleteTask(task)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      完成
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        </div>
      )}

      {/* 待执行的任务 */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4" /> 待办列表
        </h2>
        {pendingTasks.length === 0 ? (
          <div className="py-8 text-center bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="text-gray-400">目前没有待办事项</p>
          </div>
        ) : new Date().getHours() >= 22 ? (
          <div className="py-8 text-center bg-white rounded-2xl border border-dashed border-red-200 bg-red-50/50">
            <p className="text-red-500 font-medium">🕒 已经很晚啦，当前不能继续专注任务。该休息了，晚安！</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pendingTasks.map((task) => {
              const isSparkTask = task.id === sparkTaskId;
              return (
              <Card key={task.id} className={`group shadow-sm hover:shadow-md transition-all ${isSparkTask ? 'border-yellow-400 bg-yellow-50/10' : 'border-gray-100'}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800 flex items-center gap-2">
                      {task.title}
                      {isSparkTask && <span className="text-yellow-500 text-sm">⚡</span>}
                    </h3>
                    {task.tags.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5">
                        {task.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex items-center gap-1.5 text-sm text-gray-400 font-medium">
                      {task.status === TaskStatus.PAUSED && <span>已用 {formatDuration(task.act_time)} / </span>}
                      <span>预估 {formatDuration(task.est_time)}</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {task.act_time === 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
                          onClick={() => setTaskToDelete(task)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          删除
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                        onClick={() => handleStartTask(task)}
                      >
                        <PlayCircle className="w-4 h-4 mr-1" />
                        {task.status === TaskStatus.PAUSED ? '继续' : '开始'}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50 px-2"
                        onClick={() => handleCompleteTask(task)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        完成
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        )}
      </div>

      {/* 已完成的任务 */}
      {completedTasks.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <h2 className="text-sm font-semibold text-green-600 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> 已完成
          </h2>
          <div className="grid gap-2">
            {completedTasks.map((task) => {
              const ratio = calculateDeviationRatio(task);
              const isNA = ratio === -1;
              const isGood = isNA ? true : ratio <= 1.0;
              const ratioPercent = isNA ? 0 : Math.round(ratio * 100);
              
              return (
                <div key={task.id} className="relative p-3 bg-gray-50/50 rounded-xl flex items-center justify-between opacity-80 overflow-hidden shadow-sm">
                  {!isNA && (
                    <div 
                      className={`absolute top-0 left-0 h-full opacity-10 ${isGood ? 'bg-green-500' : 'bg-red-500'}`} 
                      style={{ width: `${Math.min(ratioPercent, 100)}%` }}
                    />
                  )}
                  <div className="flex items-center gap-3 relative z-10">
                    <span className="text-gray-500 line-through">{task.title}</span>
                    {isNA ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-bold bg-gray-200 text-gray-500">
                        校内完成
                      </span>
                    ) : (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-bold ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {ratioPercent}% 用时
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-medium relative z-10">
                    {isNA ? formatDuration(task.act_time) : `${formatDuration(task.act_time)} / ${formatDuration(task.est_time)}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>

      {/* 添加任务 FAB 置于动画外层以防止固定定位元素在进入动画期间发生闪烁 */}
      <AddTaskDialog onTaskAdded={loadTasks} defaultStatus={TaskStatus.PENDING} />

      {/* 确认切换对话框 */}
      <Dialog open={!!taskToSwitch} onOpenChange={(open) => !open && setTaskToSwitch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>是否切换任务？</DialogTitle>
            <DialogDescription>
              任务 <strong>{runningTaskForSwitch?.title}</strong> 正在执行中。
              是否先暂停它，并将其切换为 <strong>{taskToSwitch?.title}</strong>？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTaskToSwitch(null)}>取消</Button>
            <Button onClick={confirmSwitch}>暂停现有并开始新任务</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 删除确认对话框 */}
      <Dialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确定删除任务？</DialogTitle>
            <DialogDescription>
              任务 <strong>{taskToDelete?.title}</strong> 尚未执行。删除后不可恢复且不计入任何统计。确信不需要该任务了吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTaskToDelete(null)}>取消</Button>
            <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => {
              if (taskToDelete?.id) {
                await TaskService.delete(taskToDelete.id);
                setTaskToDelete(null);
                loadTasks();
              }
            }}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 沉浸动画转场遮罩 */}
      {isTransitioning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/95 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="text-center animate-in zoom-in-95 duration-500 delay-150">
            <h2 className="text-2xl font-light text-white opacity-90 tracking-widest mb-4">深呼吸</h2>
            <p className="text-gray-300">准备进入 <span className="text-blue-400 font-medium px-1">{transitionTaskName}</span> 的时间</p>
          </div>
        </div>
      )}
    </>
  );
}
