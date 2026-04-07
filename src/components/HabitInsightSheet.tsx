'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { HabitTemplate, Task, TaskStatus } from '@/lib/types';
import { HabitService } from '@/services/habit-service';
import { TaskService } from '@/services/task-service';
import { ExecutionLogService } from '@/services/execution-log-service';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Loader2, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface HabitInsightSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: HabitTemplate | null;
}

export function HabitInsightSheet({ open, onOpenChange, habit }: HabitInsightSheetProps) {
  const [loading, setLoading] = useState(false);
  
  // 预估进化论数据
  const [evolutionData, setEvolutionData] = useState<{ date: string; est: number; act: number }[]>([]);
  // 漏卡分析数据
  const [skipStats, setSkipStats] = useState({ external: 0, voluntary: 0, default: 0, totalExpired: 0 });
  // 节奏稳定性
  const [rhythm, setRhythm] = useState({ avgTime: '', stdDevMin: 0, sampleSize: 0 });

  useEffect(() => {
    if (open && habit) {
      loadInsights();
    } else {
      setEvolutionData([]);
      setSkipStats({ external: 0, voluntary: 0, default: 0, totalExpired: 0 });
      setRhythm({ avgTime: '', stdDevMin: 0, sampleSize: 0 });
    }
  }, [open, habit]);

  const loadInsights = async () => {
    if (!habit) return;
    setLoading(true);
    try {
      const allTasks = await TaskService.getAll();
      const habitTasks = allTasks.filter(t => t.template_id === habit.id).sort((a, b) => a.date.localeCompare(b.date));
      
      // 1. 预估进化论 (只统计已完成或至少有进展的)
      const evoData = habitTasks
        .filter(t => t.status === TaskStatus.COMPLETED || t.act_time > 0)
        .map(t => ({
          date: t.date.slice(5), // MM-DD
          est: t.est_time || 0,
          act: t.act_time || 0
        }));
      setEvolutionData(evoData);

      // 2. 漏卡分析
      const expiredTasks = habitTasks.filter(t => t.status === TaskStatus.EXPIRED);
      const extCount = expiredTasks.filter(t => t.skip_reason === 'external').length;
      const volCount = expiredTasks.filter(t => t.skip_reason === 'voluntary').length;
      const defCount = expiredTasks.length - extCount - volCount;
      setSkipStats({ external: extCount, voluntary: volCount, default: defCount, totalExpired: expiredTasks.length });

      // 3. 节奏稳定性
      const completedTasks = habitTasks.filter(t => t.status === TaskStatus.COMPLETED);
      const startTimesMin: number[] = [];
      
      for (const t of completedTasks) {
        const logs = await ExecutionLogService.getByTaskId(t.id!);
        if (logs && logs.length > 0) {
          // 只看当天的初次启动时间
          const firstLog = logs.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
          const st = new Date(firstLog.startTime);
          startTimesMin.push(st.getHours() * 60 + st.getMinutes());
        }
      }

      if (startTimesMin.length > 0) {
        const sum = startTimesMin.reduce((a, b) => a + b, 0);
        const avg = sum / startTimesMin.length;
        const variance = startTimesMin.reduce((acc, curr) => acc + Math.pow(curr - avg, 2), 0) / startTimesMin.length;
        const stdDev = Math.sqrt(variance);
        
        const avgH = Math.floor(avg / 60).toString().padStart(2, '0');
        const avgM = Math.floor(avg % 60).toString().padStart(2, '0');
        
        setRhythm({
          avgTime: `${avgH}:${avgM}`,
          stdDevMin: Math.round(stdDev),
          sampleSize: startTimesMin.length
        });
      }

    } catch (error) {
      console.error("Failed to load habit insights", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-2xl overflow-y-auto pb-24 border-l-0 sm:border-l sm:rounded-l-2xl shadow-2xl p-0">
        <div className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-start">
          <SheetHeader>
            <SheetTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              习惯洞察：{habit?.title}
              {habit?.status === 'archived' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                  已结束
                </span>
              )}
            </SheetTitle>
            <SheetDescription>
              客观还原该习惯在长周期下的数据表现与改进空间。
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>正在分析习惯数据样本...</p>
            </div>
          ) : (
            <>
              {/* Rhythm Stability */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 border-b pb-2">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  节奏稳定性 (Rhythm Stability)
                </h3>
                {rhythm.sampleSize === 0 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">尚无足够打卡记录，无法测算启动节奏。</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                      <p className="text-xs text-emerald-600 font-medium mb-1">平均启动时间</p>
                      <p className="text-2xl font-bold text-emerald-700">{rhythm.avgTime}</p>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                      <p className="text-xs text-blue-600 font-medium mb-1">波动标准差</p>
                      <p className="text-2xl font-bold text-blue-700 flex items-baseline gap-1">
                        ±{rhythm.stdDevMin} <span className="text-xs font-normal">分钟</span>
                      </p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 px-1">
                  * 波动越小，代表你的身体生物钟对该习惯越规律。
                </p>
              </section>

              {/* Estimation Evolution */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 border-b pb-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  预估进化论 (Estimation Evolution)
                </h3>
                {evolutionData.length < 2 ? (
                  <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">需完成至少 2 次才可展示收敛曲线。</p>
                ) : (
                  <div className="h-64 bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          itemStyle={{ fontSize: '13px', paddingTop: '4px' }}
                          labelStyle={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                        <Line type="monotone" name="预估时长" dataKey="est" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4, strokeWidth: 0 }} />
                        <Line type="monotone" name="实际时长" dataKey="act" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: '#3b82f6' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* Skip Analysis */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5 border-b pb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  漏卡分析 (Skip Retrospective)
                </h3>
                {skipStats.totalExpired === 0 ? (
                  <p className="text-sm text-gray-500 bg-emerald-50 border border-emerald-100 p-4 rounded-lg">太棒了，目前保持着 0 漏卡的完美记录！</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-3">
                      <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-lg flex justify-between items-center">
                        <span className="text-xs font-medium text-orange-800">因外部干扰</span>
                        <span className="text-lg font-bold text-orange-600">{skipStats.external} 次</span>
                      </div>
                      <div className="bg-rose-50/50 border border-rose-100 p-3 rounded-lg flex justify-between items-center">
                        <span className="text-xs font-medium text-rose-800">主动放弃</span>
                        <span className="text-lg font-bold text-rose-600">{skipStats.voluntary} 次</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg flex justify-between items-center">
                        <span className="text-xs font-medium text-gray-600">默认失效</span>
                        <span className="text-lg font-bold text-gray-500">{skipStats.default} 次</span>
                      </div>
                    </div>
                    {/* 柱状图直观展示 */}
                    <div className="h-40 bg-white border border-gray-100 rounded-lg p-2 flex items-center justify-center">
                       <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={[
                              { name: '外部干扰', count: skipStats.external, fill: '#f97316' },
                              { name: '主动放弃', count: skipStats.voluntary, fill: '#f43f5e' },
                              { name: '自然过期', count: skipStats.default, fill: '#9ca3af' },
                            ]}
                            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                          >
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#4b5563' }} />
                            <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}/>
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} />
                        </BarChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
