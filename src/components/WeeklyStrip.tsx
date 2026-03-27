import { useEffect, useState } from 'react';
import { StatsService, DayStat } from '@/services/stats-service';

export function WeeklyStrip() {
  const [stats, setStats] = useState<DayStat[]>([]);

  useEffect(() => {
    const loadStats = async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      
      const startDateStr = start.toISOString().slice(0, 10);
      const endDateStr = end.toISOString().slice(0, 10);
      
      const s = await StatsService.getDailyStats(startDateStr, endDateStr);
      setStats(s);
    };
    loadStats();
  }, []);

  const getDayLabel = (dateStr: string) => {
    const chars = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const d = new Date(dateStr);
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today ? '今天' : chars[d.getDay()];
  };

  if (stats.length === 0) return null;

  return (
    <div className="flex justify-between items-center gap-2 mb-8 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
      {stats.map(day => (
        <div key={day.date} className="flex flex-col items-center flex-1 gap-1.5 group cursor-default">
          <div className={`text-[10px] font-medium transition-colors ${
            day.date === new Date().toISOString().slice(0, 10) ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
          }`}>
            {getDayLabel(day.date)}
          </div>
          <div 
            className={`w-full h-1.5 rounded-full transition-all ${
              day.status === 'SUCCESS' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 
              day.status === 'WARNING' ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' : 
              'bg-gray-200 group-hover:bg-gray-300'
            }`}
             title={`${day.date}: ${day.status === 'SUCCESS' ? '完美的一天' : day.status === 'WARNING' ? '节奏失控' : '进行或无任务'} (完成 ${day.completedTasks}/${day.totalTasks})`}
          />
        </div>
      ))}
    </div>
  );
}
