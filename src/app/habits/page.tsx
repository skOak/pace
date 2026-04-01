'use client';

import { useState, useEffect, useCallback } from 'react';
import { HabitService } from '@/services/habit-service';
import { TaskService } from '@/services/task-service';
import { TaskStatus, type HabitTemplate, type Task } from '@/lib/types';
import { HabitEditorDialog } from '@/components/HabitEditorDialog';
import { HabitInsightSheet } from '@/components/HabitInsightSheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit3, CalendarCheck2, PlayCircle, Loader2, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { formatDuration } from '@/lib/forecast-utils';

export default function HabitsPage() {
  const [habits, setHabits] = useState<HabitTemplate[]>([]);
  const [todaysTasks, setTodaysTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitTemplate | null>(null);
  const [skipHabit, setSkipHabit] = useState<HabitTemplate | null>(null);
  const [insightHabit, setInsightHabit] = useState<HabitTemplate | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allHabits = await HabitService.getAll();
      const today = new Date().toISOString().slice(0, 10);
      const tasks = await TaskService.getByDate(today);

      setHabits(allHabits.sort((a, b) => {
        const order = { active: 1, paused: 2, archived: 3 };
        if (a.status !== b.status) return order[a.status] - order[b.status];
        // 按创建时间降序
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));
      setTodaysTasks(tasks);
    } catch (e) {
      console.error('Failed to load habits', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleEdit = (habit: HabitTemplate) => {
    setEditingHabit(habit);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingHabit(null);
    setEditorOpen(true);
  };

  const handleSaveDone = async (habitId: string) => {
    // 检查这个刚刚建好/改好的习惯是否恰好符合今天，且今天还没生成，符合则自动帮他省去手动点的麻烦
    const template = await HabitService.getById(habitId);
    if (template && template.status === 'active' && HabitService.shouldGenerateToday(template, new Date())) {
      const today = new Date().toISOString().slice(0, 10);
      const tasks = await TaskService.getByDate(today);
      const alreadyGenerated = tasks.some(t => t.template_id === template.id);
      if (!alreadyGenerated) {
        await HabitService.generateTaskForDay(template, today);
      }
    }
    loadData();
  };

  const handleAddToToday = async (habit: HabitTemplate) => {
    const today = new Date().toISOString().slice(0, 10);
    await HabitService.generateTaskForDay(habit, today);
    loadData(); // 刷新列表状态
  };

  const handleSkipToday = (habit: HabitTemplate) => {
    setSkipHabit(habit);
  };

  const handleSkipConfirm = async (reason: 'external' | 'voluntary') => {
    if (!skipHabit) return;
    const generatedTask = todaysTasks.find(t => t.template_id === skipHabit.id);
    if (generatedTask && generatedTask.id) {
      // 更新为已过期并附加漏卡原因
      // 由于 TypeScript 定义可能未导出所有需要的状态对象，我们通过 4(EXPIRED) 假定
      await TaskService.update(generatedTask.id, {
        status: 4 as any, // TaskStatus.EXPIRED
        skip_reason: reason
      });
      loadData();
    }
    setSkipHabit(null);
  };

  if (loading && habits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mb-4" />
        <p>正在加载习惯列表...</p>
      </div>
    );
  }

  const todayDate = new Date();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-24 mt-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            我的习惯
          </h1>
          <p className="text-gray-500 mt-1">
            重复的力量：在这里定义你的默认节奏。
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 shadow-md transition-transform hover:scale-105">
          <Plus className="w-4 h-4 mr-1.5" />新建模板
        </Button>
      </div>

      <div className="grid gap-3">
        {habits.length === 0 ? (
          <div className="py-12 border-2 border-dashed border-gray-200 rounded-2xl text-center bg-white/50">
            <h3 className="text-lg font-medium text-gray-700 mb-2">没有任何习惯模板</h3>
            <p className="text-sm text-gray-400 mb-6">点击右上角新建一个习惯，比如每天早读、课后锻炼等。</p>
            <Button variant="outline" onClick={handleCreate} className="border-blue-200 text-blue-600 hover:bg-blue-50">
              <Plus className="w-4 h-4 mr-1.5" /> 开始创建
            </Button>
          </div>
        ) : (
          habits.map((habit) => {
            const hasGeneratedTask = todaysTasks.some(t => t.template_id === habit.id);
            const isRestDayToday = !HabitService.shouldGenerateToday(habit, todayDate);

            // 状态推断
            let status = '已暂停';
            let badgeClass = 'bg-gray-100 text-gray-500';

            if (habit.status === 'archived') {
              status = '已归档';
              badgeClass = 'bg-gray-200 text-gray-500';
            } else if (habit.status === 'active') {
              if (hasGeneratedTask) {
                // 如果今天已经有打卡任务了，我们需要判断它是否还没完成/过期
                const t = todaysTasks.find(task => task.template_id === habit.id);
                if (t && t.status === TaskStatus.EXPIRED) {
                  status = '已跳过';
                  badgeClass = 'bg-gray-100 text-gray-500';
                } else if (t && t.status === TaskStatus.COMPLETED) {
                  status = '已打卡';
                  badgeClass = 'bg-emerald-100 text-emerald-700';
                } else if (t && (t.status === TaskStatus.RUNNING || t.status === TaskStatus.PAUSED)) {
                  status = '进行中';
                  badgeClass = 'bg-amber-100 text-amber-700';
                } else {
                  status = '待打卡';
                  badgeClass = 'bg-blue-100 text-blue-700';
                }
              } else if (isRestDayToday) {
                status = '休息日';
                badgeClass = 'bg-emerald-100 text-emerald-700';
              } else {
                status = '待触发';
                badgeClass = 'bg-orange-100 text-orange-700';
              }
            }

            const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
            const getFrequencyText = () => {
              if (habit.frequency_type === 'Weekly') {
                if (habit.frequency_rule.length === 7) return '每天';
                if (habit.frequency_rule.join(',') === '1,2,3,4,5') return '上学日';
                if (habit.frequency_rule.join(',') === '6,7') return '周末';
                return `按周 (${habit.frequency_rule.map(d => WEEKDAYS[d - 1]).join('、')})`;
              }
              return `每月 (${habit.frequency_rule.length}天)`;
            };

            return (
              <Card key={habit.id} className={`group overflow-hidden transition-all hover:shadow-md ${habit.status !== 'active' ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  {/* 左侧信息 */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <h3 className="text-lg font-bold text-gray-800 truncate">{habit.title}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border border-transparent whitespace-nowrap ${badgeClass}`}>
                        {status}
                      </span>
                      {habit.tags.length > 0 && habit.tags.map(t => (
                        <span key={t} className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-sm truncate max-w-[80px]">#{t}</span>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1">
                        <CalendarCheck2 className="w-3.5 h-3.5 text-gray-400" />
                        {getFrequencyText()}
                      </span>
                      {habit.end_type === 'date' && <span className="text-gray-400">至 {habit.end_date} 止</span>}
                      {habit.end_type === 'occurrences' && <span className="text-gray-400">进行 {habit.generated_count || 0}/{habit.end_occurrences} 次</span>}
                      <span>预估：{formatDuration(habit.estimated_duration)}</span>
                    </div>
                  </div>

                  {/* 右侧操作 */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-gray-100">
                    {/* 根据状态提供快捷按钮 */}
                    {status === '待打卡' && typeof todaysTasks.find(t => t.template_id === habit.id)?.id !== 'undefined' && (
                      <Button variant="ghost" size="sm" onClick={() => handleSkipToday(habit)} className="h-8 text-gray-500 hover:text-orange-600 hover:bg-orange-50 mr-1">
                        今日跳过
                      </Button>
                    )}
                    {status === '休息日' || status === '待触发' ? (
                      <Button variant="ghost" size="sm" onClick={() => handleAddToToday(habit)} className="h-8 text-blue-600 hover:bg-blue-50 mr-1">
                        <PlayCircle className="w-4 h-4 mr-1" />
                        加入今天
                      </Button>
                    ) : null}


                    {habit.status !== 'archived' && (
                      <Button variant="outline" size="sm" onClick={() => handleEdit(habit)} className="h-8 md:px-3 text-gray-500 hover:text-blue-600 border-gray-200">
                        <Edit3 className="w-3.5 h-3.5 mr-1 hidden sm:inline-block" />
                        修改
                      </Button>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => setInsightHabit(habit)} className="h-8 md:px-3 text-blue-500 hover:text-blue-700 hover:bg-blue-50 border-gray-200">
                      <TrendingUp className="w-3.5 h-3.5 mr-0 sm:mr-1" />
                      <span className="hidden sm:inline-block">洞察</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <HabitEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        habit={editingHabit}
        onSave={handleSaveDone}
      />

      <Dialog open={!!skipHabit} onOpenChange={(open) => !open && setSkipHabit(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>跳过今日习惯</DialogTitle>
            <DialogDescription>
              将今日的该习惯任务标记为已跳过/已过期。请选择跳过的主要原因：
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50 h-12" onClick={() => handleSkipConfirm('external')}>
              因外部干扰跳过 (例如突发事件、身体不适)
            </Button>
            <Button variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50 h-12" onClick={() => handleSkipConfirm('voluntary')}>
              主动放弃 (例如今天不想做)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipHabit(null)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HabitInsightSheet
        open={!!insightHabit}
        onOpenChange={(open) => !open && setInsightHabit(null)}
        habit={insightHabit}
      />
    </div>
  );
}
