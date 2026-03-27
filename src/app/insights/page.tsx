'use client';

import { useState, useEffect } from 'react';
import { TaskService } from '@/services/task-service';
import { Task, TaskStatus } from '@/lib/types';
import { calculateDeviationRatio, formatDuration } from '@/lib/forecast-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Target, Clock, Zap, Tags } from 'lucide-react';

export default function InsightsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'default' | 'actualTime' | 'deviation'>('default');

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

  // --- 标签聚类分析 ---
  const tagStats: Record<string, {
    totalAct: number; totalEst: number;
    schoolAct: number; schoolCount: number;
    homeAct: number; homeEst: number; homeCount: number;
  }> = {};

  completedTasks.forEach(task => {
    task.tags.forEach(tag => {
      if (!tagStats[tag]) {
        tagStats[tag] = { totalAct: 0, totalEst: 0, schoolAct: 0, schoolCount: 0, homeAct: 0, homeEst: 0, homeCount: 0 };
      }
      
      const stat = tagStats[tag];
      stat.totalAct += task.act_time;
      stat.totalEst += task.est_time;
      
      if (task.is_school_done) {
        stat.schoolAct += task.act_time;
        stat.schoolCount += 1;
      } else {
        stat.homeAct += task.act_time;
        stat.homeEst += task.est_time;
        stat.homeCount += 1;
      }
    });
  });

  const tagAnalysisList = Object.entries(tagStats).map(([tag, stat]) => {
     // 分析逻辑
     const homeDeviation = stat.homeEst > 0 ? stat.homeAct / stat.homeEst : 0;
     const avgSchoolTime = stat.schoolCount > 0 ? Math.round(stat.schoolAct / stat.schoolCount) : 0;
     const avgHomeTime = stat.homeCount > 0 ? Math.round(stat.homeAct / stat.homeCount) : 0;
     
     const isUnderEstimated = stat.homeEst > 0 && stat.homeAct > stat.homeEst;
     const underEstimateMinutes = isUnderEstimated ? stat.homeAct - stat.homeEst : 0;
     
     const hasBoth = stat.schoolCount > 0 && stat.homeCount > 0;
     
     return { tag, stat, homeDeviation, avgSchoolTime, avgHomeTime, isUnderEstimated, underEstimateMinutes, hasBoth };
  }).sort((a, b) => b.stat.totalAct - a.stat.totalAct); // 按总投入时长排序

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
              {formatDuration(totalActTimeOverall)}
              <span className="text-xl text-gray-400 font-medium ml-2">/ 预估 {formatDuration(totalEstTime)}</span>
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

      {/* 标签深度洞察 */}
      {tagAnalysisList.length > 0 && (
        <Card className="border-purple-100 shadow-sm">
          <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-4">
            <CardTitle className="text-lg text-purple-900 flex items-center gap-2">
              <Tags className="w-5 h-5 text-purple-500" />
              标签聚类与效率对比
            </CardTitle>
            <CardDescription>各科目/标签的投入时长与环境效率差异</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {tagAnalysisList.map(({ tag, stat, avgSchoolTime, avgHomeTime, isUnderEstimated, underEstimateMinutes, hasBoth }) => (
                <div key={tag} className="p-5 hover:bg-gray-50/50 transition-colors">
                   <div className="flex items-center justify-between mb-2">
                     <span className="font-semibold text-lg text-gray-800">#{tag}</span>
                     <span className="text-sm font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        总投入 {formatDuration(stat.totalAct)}
                     </span>
                   </div>
                   
                   {isUnderEstimated && (
                     <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md mb-2 border border-red-100 inline-block font-medium">
                       💡 提示：在此类任务中容易低估时长，今日累计超出预期 {formatDuration(underEstimateMinutes)}
                     </div>
                   )}
                   
                   {hasBoth && (
                     <div className="flex items-center gap-4 text-sm mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                       <span className="text-gray-500 font-medium">校内外对比 (单次均耗时)</span>
                       <div className="flex gap-4 font-semibold">
                         <span className="text-indigo-600">校内 {formatDuration(avgSchoolTime)}/次</span>
                         <span className="text-blue-600">校外 {formatDuration(avgHomeTime)}/次</span>
                       </div>
                     </div>
                   )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 任务流列表分析 */}
      <Card className="border-gray-100 shadow-sm">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">已完成任务偏差详情</CardTitle>
            <CardDescription>对比每个任务的预估时间与实际时间的差距</CardDescription>
          </div>
          <select 
            className="text-sm bg-white border border-gray-200 text-gray-700 py-1.5 px-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="default">默认排列</option>
            <option value="actualTime">实际耗时最长</option>
            <option value="deviation">预估与实际偏差最大</option>
          </select>
        </CardHeader>
        <CardContent className="p-0">
          {completedTasks.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              今日尚未完成任何任务，去看板开始专注吧！
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(() => {
                let sortedList = [...completedTasks];
                if (sortBy === 'actualTime') {
                  sortedList.sort((a, b) => b.act_time - a.act_time);
                } else if (sortBy === 'deviation') {
                  sortedList.sort((a, b) => {
                    const devA = (a.est_time > 0 && !a.is_school_done) ? Math.abs(a.act_time - a.est_time) : -1;
                    const devB = (b.est_time > 0 && !b.is_school_done) ? Math.abs(b.act_time - b.est_time) : -1;
                    return devB - devA;
                  });
                }
                
                return sortedList.map(task => {
                  const ratio = calculateDeviationRatio(task);
                  const isNA = ratio === -1;
                  const isGood = isNA ? true : ratio <= 1.0;
                  const ratioPercent = isNA ? 0 : Math.round(ratio * 100);
                  
                  // 进度条渲染新逻辑: 计算最大容积作为基底 100%
                  let maxTime = Math.max(task.act_time, task.est_time);
                  if (maxTime === 0) maxTime = 1;

                  const actPercent = isNA ? 100 : (task.act_time / maxTime) * 100;
                  const estPercent = isNA ? 100 : (task.est_time / maxTime) * 100;
                  const isOverEstimate = !isNA && task.act_time > task.est_time;
                  
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
                      
                      <div className="w-full bg-gray-100 rounded-full h-2.5 relative overflow-hidden">
                        <div 
                          className={`h-2.5 rounded-full ${isNA ? 'bg-gray-300' : (isGood ? 'bg-emerald-400' : 'bg-red-400')}`}
                          style={{ width: actPercent + '%' }}
                        ></div>
                        {/* 仅当超出预期并充满时，在内部描绘一条虚线基准，避免丑陋的右边缘溢出符号 */}
                        {isOverEstimate && (
                          <div 
                            className="absolute top-0 bottom-0 border-l-2 border-dashed border-red-900/40 -ml-px z-10 hidden md:block" 
                            style={{ left: estPercent + '%' }}
                            title="100% 预估基准线"
                          ></div>
                        )}
                      </div>
                      
                      <div className="flex justify-between mt-2 text-xs text-gray-500 font-medium">
                        <span>实际: {formatDuration(task.act_time)}</span>
                        {isNA ? (
                          <span className="text-gray-400">校内完成 (系统外专注)</span>
                        ) : (
                          <span>预估: {formatDuration(task.est_time)}</span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
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
