'use client';

import { useState, useEffect } from 'react';
import { TaskService } from '@/services/task-service';
import { Task, TaskStatus } from '@/lib/types';
import { calculateDeviationRatio } from '@/lib/forecast-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Target, Clock, Zap } from 'lucide-react';

export default function InsightsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await TaskService.getByDate(today);
        setTasks(data);
      } catch (error) {
        console.error('Failed to load tasks', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400 font-medium">深入思考中...</p>
      </div>
    );
  }

  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
  const totalCompleted = completedTasks.length;
  
  const estimatedTasks = completedTasks.filter(t => t.est_time > 0);
  const totalEstTime = estimatedTasks.reduce((sum, t) => sum + t.est_time, 0);
  const totalActTimeForDeviation = estimatedTasks.reduce((sum, t) => sum + t.act_time, 0);
  const totalActTimeOverall = completedTasks.reduce((sum, t) => sum + t.act_time, 0);
  
  let overallDeviation = 0;
  if (totalEstTime > 0) {
    overallDeviation = Math.round((totalActTimeForDeviation / totalEstTime) * 100);
  }

  const isOverallGood = overallDeviation <= 100;

  return (
    <div className="space-y-8 animate-in mt-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
          <PieChart className="w-8 h-8 text-indigo-500" />
          今日节奏复盘
        </h1>
        <p className="text-gray-500 mt-1">
          回顾今天的预估与实际执行情况，感受时间的流派
        </p>
      </div>

      {/* 总体数据总结 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-indigo-100 shadow-sm bg-indigo-50/30">
          <CardContent className="p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <ListChecks className="w-4 h-4" />
              <span className="font-semibold text-sm">已完成任务数</span>
            </div>
            <div className="text-3xl font-bold text-indigo-950">{totalCompleted} <span className="text-base text-indigo-600 font-normal">个</span></div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 shadow-sm bg-blue-50/30">
          <CardContent className="p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Clock className="w-4 h-4" />
              <span className="font-semibold text-sm">总专注时长 / 预估</span>
            </div>
            <div className="text-3xl font-bold text-blue-950">
              {totalActTimeOverall} <span className="text-base text-blue-600 font-normal mr-2">m</span> 
              <span className="text-xl text-gray-400 font-medium">/ 预估 {totalEstTime} m</span>
            </div>
          </CardContent>
        </Card>

        <Card className={isOverallGood ? 'border-emerald-100 bg-emerald-50/30' : 'border-orange-100 bg-orange-50/30'}>
          <CardContent className="p-5 flex flex-col justify-center">
            <div className={`flex items-center gap-2 mb-2 ${isOverallGood ? 'text-emerald-600' : 'text-orange-600'}`}>
              {isOverallGood ? <Target className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              <span className="font-semibold text-sm">总体耗时比 (实际/预估)</span>
            </div>
            <div className={`text-3xl font-bold ${isOverallGood ? 'text-emerald-950' : 'text-orange-950'}`}>
              {totalEstTime > 0 ? `${overallDeviation}%` : '--%'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 任务流列表分析 */}
      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="text-lg">已完成任务偏差详情</CardTitle>
          <CardDescription>对比每个任务的预估时间与实际时间的差距</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {completedTasks.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              今日尚未完成任何任务，去看板开始专注吧！
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {completedTasks.map(task => {
                const ratio = calculateDeviationRatio(task);
                const isNA = ratio === -1;
                const isGood = isNA ? true : ratio <= 1.0;
                const ratioPercent = isNA ? 0 : Math.round(ratio * 100);
                
                // 计算进度条宽度 (最多延伸到 150%)
                const barWidth = isNA ? '100%' : (Math.min(ratioPercent, 150) + '%');
                
                return (
                  <div key={task.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium text-gray-800">{task.title}</div>
                      {isNA ? (
                        <div className="text-xs px-2 py-0.5 rounded-sm font-bold bg-gray-100 text-gray-500">
                          校内完成
                        </div>
                      ) : (
                        <div className={`text-xs px-2 py-0.5 rounded-sm font-bold ${isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {ratioPercent}% 用时
                        </div>
                      )}
                    </div>
                    
                    <div className="w-full bg-gray-100 rounded-full h-2.5 relative">
                      <div 
                        className={`h-2.5 rounded-full ${isNA ? 'bg-gray-300' : (isGood ? 'bg-emerald-400' : 'bg-red-400')}`}
                        style={{ width: barWidth }}
                      ></div>
                      {/* 100% 预期标识线 */}
                      {!isNA && <div className="absolute top-0 bottom-0 left-[100%] border-l-2 border-dashed border-gray-400/50 -ml-px z-10 hidden md:block" title="100% 预估基准线"></div>}
                    </div>
                    
                    <div className="flex justify-between mt-2 text-xs text-gray-500 font-medium">
                      <span>实际: {task.act_time}m</span>
                      {isNA ? (
                        <span className="text-gray-400">校内完成 (系统外专注)</span>
                      ) : (
                        <span>预估: {task.est_time}m</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Extract component icon inside component file for ListChecks as it is missing from main imports
function ListChecks(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  );
}
