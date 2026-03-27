'use client';

import { useState, useEffect } from 'react';
import { StatsService, DayStat, TagStat } from '@/services/stats-service';
import { Task, TaskStatus, DailyAnchor } from '@/lib/types';
import { calculateDeviationRatio, formatDuration } from '@/lib/forecast-utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Target, Clock, Zap, Tags, CalendarDays, Activity, AlertCircle } from 'lucide-react';
import { PieChart as RPieChart, Pie, Cell, Legend, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const TAG_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];

export default function InsightsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [anchors, setAnchors] = useState<DailyAnchor[]>([]);
  const [tagStats, setTagStats] = useState<TagStat[]>([]);
  const [dayStats, setDayStats] = useState<DayStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'year'>('today');
  const [sortBy, setSortBy] = useState<'default' | 'actualTime' | 'deviation'>('default');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const start = new Date();
        if (dateRange === 'today') {
           // start relies on today
        } else if (dateRange === 'week') {
           start.setDate(now.getDate() - 6);
        } else if (dateRange === 'month') {
           start.setDate(now.getDate() - 29);
        } else if (dateRange === 'year') {
           start.setDate(now.getDate() - 364);
        }

        const startStr = start.toISOString().slice(0, 10);
        const endStr = now.toISOString().slice(0, 10);

        const [t, a, ts, ds] = await Promise.all([
          StatsService.getTasksInRange(startStr, endStr),
          StatsService.getAnchorsInRange(startStr, endStr),
          StatsService.getTagStats(startStr, endStr),
          StatsService.getDailyStats(startStr, endStr)
        ]);
        
        setTasks(t);
        setAnchors(a);
        setTagStats(ts);
        setDayStats(ds);
      } catch (error) {
        console.error('Failed to load insights data', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400 font-medium">深入思考与数据聚合中...</p>
      </div>
    );
  }

  const completedTasks = tasks.filter(t => t.status === TaskStatus.COMPLETED);
  const expiredTasks = tasks.filter(t => t.status === TaskStatus.EXPIRED);
  const totalCompleted = completedTasks.length;
  
  const estimatedTasks = completedTasks.filter(t => t.est_time > 0);
  const totalEstTime = estimatedTasks.reduce((sum, t) => sum + t.est_time, 0);
  const totalActTimeForDeviation = estimatedTasks.reduce((sum, t) => sum + t.act_time, 0);
  const totalActTimeOverall = completedTasks.reduce((sum, t) => sum + t.act_time, 0);
  
  let overallDeviation = 0;
  if (totalEstTime > 0) {
    overallDeviation = Math.round((totalActTimeForDeviation / totalEstTime) * 100);
  }

  const isOverallGood = overallDeviation > 0 && overallDeviation <= 120; // 0-120% is acceptable

  // Recharts Pie Chart Data
  const pieData = tagStats.filter(t => t.totalTime > 0).map(t => ({
    name: t.tag,
    value: t.totalTime
  }));

  // Recharts Line Chart Data (Anchors)
  const formatHour = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.getHours() + d.getMinutes() / 60;
  };
  
  const anchorChartData = dayStats.map(ds => {
    const a = anchors.find(x => x.date === ds.date);
    return {
      date: ds.date.slice(5), // MM-DD
      start: a?.start_anchor ? formatHour(a.start_anchor) : null,
      end: a?.end_anchor ? formatHour(a.end_anchor) : null,
    };
  });

  return (
    <div className="space-y-8 animate-in mt-4 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <PieChart className="w-8 h-8 text-indigo-500" />
            宏观洞察
          </h1>
          <p className="text-gray-500 mt-1">
            通过长期视角复盘执行力，建立真实的节奏感
          </p>
        </div>
        <div>
          <select 
            className="bg-white border border-gray-200 text-gray-800 font-medium py-2 px-4 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer shadow-sm"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
          >
            <option value="today">今日</option>
            <option value="week">最近 7 天</option>
            <option value="month">最近 30 天</option>
            <option value="year">最近 1 年</option>
          </select>
        </div>
      </div>

      {/* 月度贡献热力图 (GitHub Style) */}
      {(dateRange === 'month' || dateRange === 'year') && (
        <Card className="border-gray-100 shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-3">
            <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-gray-500" />
              Pace 达成热力图
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 overflow-x-auto">
            <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
              {dateRange === 'year' ? (
                (() => {
                  const map: Record<string, { total: number, completed: number, warnings: number, successes: number }> = {};
                  dayStats.forEach(d => {
                    const month = d.date.substring(0, 7); // YYYY-MM
                    if (!map[month]) map[month] = { total: 0, completed: 0, warnings: 0, successes: 0 };
                    map[month].total += d.totalTasks;
                    map[month].completed += d.completedTasks;
                    if (d.status === 'WARNING') map[month].warnings++;
                    if (d.status === 'SUCCESS') map[month].successes++;
                  });
                  return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([month, stats]) => {
                    let status = 'NONE';
                    if (stats.completed > 0) {
                      status = stats.successes >= stats.warnings ? 'SUCCESS' : 'WARNING';
                    }
                    return (
                      <div 
                        key={month} 
                        className={`w-8 h-8 rounded-md transition-all flex items-center justify-center text-xs font-bold cursor-crosshair ${
                          status === 'SUCCESS' ? 'bg-emerald-400 text-emerald-950 shadow-sm' : 
                          status === 'WARNING' ? 'bg-orange-400 text-orange-950 shadow-sm' : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}
                        title={`${month}: ${status === 'SUCCESS' ? '达标为主' : status === 'WARNING' ? '失衡为主' : '无记录'} (完成 ${stats.completed} 个任务)`}
                      >
                        {parseInt(month.slice(5), 10)}月
                      </div>
                    );
                  });
                })()
              ) : (
                dayStats.map(d => (
                  <div 
                    key={d.date} 
                    className={`w-4 h-4 rounded-sm transition-all hover:scale-125 hover:shadow-md cursor-crosshair ${
                      d.status === 'SUCCESS' ? 'bg-emerald-400' : 
                      d.status === 'WARNING' ? 'bg-orange-400' : 'bg-gray-100'
                    }`}
                    title={`${d.date}: ${d.status === 'SUCCESS' ? '达标' : d.status === 'WARNING' ? '失衡' : '无记录'} (完成 ${d.completedTasks} 个任务)`}
                  />
                ))
              )}
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-gray-100 rounded-sm"></div> 无记录</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-400 rounded-sm"></div> 节奏完美</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-400 rounded-sm"></div> 节奏失常/预期偏差大</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 总体数据总结 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-indigo-100 shadow-sm bg-indigo-50/30">
          <CardContent className="p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-indigo-600 mb-2">
              <ListChecks className="w-4 h-4" />
              <span className="font-semibold text-sm">此阶段已完成</span>
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
            <div className="text-xl md:text-2xl font-bold text-blue-950">
              {formatDuration(totalActTimeOverall)}
              <span className="text-sm text-gray-400 font-medium ml-2">/ {formatDuration(totalEstTime)}</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 标签市场分布环形图 */}
        <Card className="border-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-800 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-500" />
              标签时长投入分布
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] w-full pb-4">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TAG_COLORS[index % TAG_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: any) => formatDuration(Number(value))} />
                  <Legend verticalAlign="bottom" height={36}/>
                </RPieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex justify-center items-center text-gray-400 text-sm">无标签数据</div>
            )}
          </CardContent>
        </Card>

        {/* 能量锚点趋势可视化 */}
        <Card className="border-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              起止时间趋势
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] w-full pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={anchorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <YAxis domain={[6, 24]} tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} tickFormatter={(val) => `${val}:00`} />
                <RechartsTooltip 
                  formatter={(value: any) => {
                    if (value === null || value === undefined) return '没有数据';
                    const numValue = Number(value);
                    const h = Math.floor(numValue);
                    const m = Math.round((numValue - h) * 60);
                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                  }}
                  labelStyle={{color: '#374151', fontWeight: 600}} 
                />
                <Line type="monotone" dataKey="start" name="开始时间" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} connectNulls />
                <Line type="monotone" dataKey="end" name="结束时间" stroke="#10b981" strokeWidth={3} dot={{r: 4}} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 标签深度洞察 (文字表述) */}
      {tagStats.length > 0 && (
        <Card className="border-purple-100 shadow-sm">
          <CardHeader className="bg-purple-50/50 border-b border-purple-100 pb-4">
            <CardTitle className="text-lg text-purple-900 flex items-center gap-2">
              <Tags className="w-5 h-5 text-purple-500" />
              效率偏差聚类
            </CardTitle>
            <CardDescription>各标签任务的专注耗时往往比预估快还是慢？</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {tagStats.map((stat) => {
                const isUnderEstimated = stat.efficiency > 1; // Used more time
                const deviationPercent = Math.abs(Math.round((stat.efficiency - 1) * 100));
                if (stat.efficiency === 0) return null; // No estimated time data to calculate efficiency

                return (
                  <div key={stat.tag} className="p-5 hover:bg-gray-50/50 transition-colors">
                     <div className="flex items-center justify-between mb-2">
                       <span className="font-semibold text-lg text-gray-800">#{stat.tag}</span>
                       <span className="text-sm font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                          总投入 {formatDuration(stat.totalTime)}
                       </span>
                     </div>
                     
                     <div className={`text-sm p-3 rounded-lg border ${
                        isUnderEstimated 
                          ? 'text-orange-700 bg-orange-50 border-orange-100' 
                          : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                     }`}>
                       {isUnderEstimated ? (
                         `💡 专注 ${stat.tag} 类任务时，你通常会比预估多花 ${deviationPercent}% 的时间。下次不妨把预估时间放宽敞一些！`
                       ) : (
                         `✨ 专注 ${stat.tag} 类任务时，你通畅会比预估提早 ${deviationPercent}% 完成。节奏把握得很好！`
                       )}
                     </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 自动过期任务列表 */}
      {expiredTasks.length > 0 && (
        <Card className="border-orange-100 shadow-sm">
          <CardHeader className="bg-orange-50/50 border-b border-orange-100 pb-4">
            <CardTitle className="text-lg text-orange-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              逾期未清任务
            </CardTitle>
            <CardDescription className="text-orange-700/80">以下任务未能及时完成并自动过期。也许可以考虑将其拆解，或减轻单日负荷？</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-orange-100/50 max-h-72 overflow-y-auto">
              {expiredTasks.map(task => (
                <div key={task.id} className="p-5 hover:bg-orange-50/50 transition-colors opacity-90">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700 line-through">{task.title}</span>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-sm">已过期</span>
                  </div>
                  {task.tags.length > 0 && (
                    <div className="flex gap-2 mb-2">
                      {task.tags.map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-100 text-gray-500 rounded-sm">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 font-medium">
                    所属日期: {task.date} <span className="mx-1 font-bold">·</span> 预估: {formatDuration(task.est_time)} <span className="mx-1 font-bold">·</span> 已投入: {formatDuration(task.act_time)}
                  </div>
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
              该时段尚未完成任何任务。
            </div>
          ) : (
            <div className="divide-y divide-gray-100 h-96 overflow-y-auto">
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
                          <span className="text-gray-400">—</span>
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

function ListChecks(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  );
}
