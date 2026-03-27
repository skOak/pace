'use client';

import { useState, useEffect, useCallback } from 'react';
import { TaskService } from '@/services/task-service';
import { TaskExecutionService } from '@/services/task-execution-service';
import { ExecutionLogService } from '@/services/execution-log-service';
import { DailyAnchorService } from '@/services/daily-anchor-service';
import { calculateForecastTime, calculateDeviationRatio, formatTime } from '@/lib/forecast-utils';
import { TaskStatus, type Task } from '@/lib/types';
import { AddTaskDialog } from '@/components/AddTaskDialog';
import { LiveTimer } from '@/components/LiveTimer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle2, PlayCircle, Clock, PauseCircle, Target, Flame } from 'lucide-react';

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [startAnchor, setStartAnchor] = useState<string | null>(null);
  const [endAnchor, setEndAnchor] = useState<string | null>(null);
  const [totalActTime, setTotalActTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeRunningStartTime, setActiveRunningStartTime] = useState<number | null>(null);

  // 每分钟更新一次当前时间以刷新预测和时长
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      // 1. 先执行自动过期检查，清理非今天的未完成任务
      await TaskService.expireOverdueTasks();

      // 2. 获取今天的任务
      const today = new Date().toISOString().slice(0, 10);
      const allTasks = await TaskService.getByDate(today);
      setTasks(allTasks);

      // 3. 获取锚点和总用时基础值
      const anchor = await DailyAnchorService.get(today);
      setStartAnchor(anchor?.start_anchor ? formatTime(new Date(anchor.start_anchor)) : null);
      setEndAnchor(anchor?.end_anchor ? formatTime(new Date(anchor.end_anchor)) : null);
      setTotalActTime(allTasks.reduce((sum, t) => sum + t.act_time, 0));

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

  const [taskToSwitch, setTaskToSwitch] = useState<Task | null>(null);
  const [runningTaskForSwitch, setRunningTaskForSwitch] = useState<Task | null>(null);

  const handleStartTask = async (task: Task) => {
    const running = tasks.find(t => t.status === TaskStatus.RUNNING);
    if (running && running.id !== task.id) {
      setRunningTaskForSwitch(running);
      setTaskToSwitch(task);
    } else {
      await TaskExecutionService.startTask(task.id!);
      loadTasks();
    }
  };

  const confirmSwitch = async () => {
    if (taskToSwitch && runningTaskForSwitch) {
      await TaskExecutionService.startTask(taskToSwitch.id!, runningTaskForSwitch.id!);
      setTaskToSwitch(null);
      setRunningTaskForSwitch(null);
      loadTasks();
    }
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

  return (
    <>
      <div className="space-y-8 animate-in mt-4 pb-24">
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
            <div className="text-lg font-bold text-emerald-950">{displayTotalTime} <span className="text-sm font-medium text-emerald-700">m</span></div>
          </div>
        </div>
      </div>

      {/* 正在运行的任务 */}
      {runningTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-2">
            <PlayCircle className="w-4 h-4" /> 专注中
          </h2>
          {runningTasks.map((task) => (
            <Card key={task.id} className="border-blue-100 shadow-md shadow-blue-500/5 bg-gradient-to-r from-blue-50 to-white">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900 text-lg">{task.title}</h3>
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
                    <span>已专注 <LiveTimer taskId={task.id!} baseActTime={task.act_time} />m / 预估 {task.est_time}m</span>
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
          ))}
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
        ) : (
          <div className="grid gap-3">
            {pendingTasks.map((task) => (
              <Card key={task.id} className="group border-gray-100 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800">{task.title}</h3>
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
                      {task.status === TaskStatus.PAUSED && <span>已用 {task.act_time}m / </span>}
                      <span>预估 {task.est_time}m</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
            ))}
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
                <div key={task.id} className="p-3 bg-gray-50/50 rounded-xl flex items-center justify-between opacity-80">
                  <div className="flex items-center gap-3">
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
                  <span className="text-xs text-gray-400 font-medium">
                    {isNA ? `${task.act_time}m` : `${task.act_time}m / ${task.est_time}m`}
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
    </>
  );
}
