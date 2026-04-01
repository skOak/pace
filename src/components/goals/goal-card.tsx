'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Target, Clock, ArrowRight } from 'lucide-react';
import { type Goal } from '@/lib/types';
import { GoalService } from '@/services/goal-service';
import { cn } from '@/lib/utils';

interface GoalCardProps {
  goal: Goal;
  onUpdate?: () => void;
}

export function GoalCard({ goal }: GoalCardProps) {
  const [progressTime, setProgressTime] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchProgress = async () => {
      try {
        const time = await GoalService.getGoalProgress(goal.id);
        if (mounted) setProgressTime(time);
      } catch (e) {
        console.error('Failed to fetch goal progress', e);
      }
    };
    fetchProgress();

    return () => { mounted = false; };
  }, [goal.id]);

  const progressRatio = goal.total_estimated_duration > 0 
    ? Math.min(100, Math.round((progressTime / goal.total_estimated_duration) * 100))
    : 0;

  const remainingTime = Math.max(0, goal.total_estimated_duration - progressTime);

  // 格式化时间
  const formatTime = (minutes: number) => {
    minutes = Math.round(minutes);
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Link 
      href={`/goals/${goal.id}`}
      className="group relative flex flex-col bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all cursor-pointer overflow-hidden"
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-gray-900 text-lg leading-tight line-clamp-2">
          {goal.title}
        </h3>
        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md mb-1 shrink-0">
          <Target className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-gray-600">{progressRatio}%</span>
        </div>
      </div>

      {goal.deadline && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-gray-500 mb-4 font-medium">
          <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded text-red-500">
             <Clock className="w-3.5 h-3.5" />
             <span>截止: {goal.deadline}</span>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-auto pt-2">
        <div className="flex justify-between flex-wrap items-end mb-2 text-xs">
           <span className="font-semibold text-gray-700">总计 {formatTime(goal.total_estimated_duration)}</span>
           <span className="text-gray-400 font-medium tracking-wide">还剩 {formatTime(remainingTime)}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden relative">
          <div 
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressRatio}%` }}
          />
        </div>
      </div>

      <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:right-4 transition-all duration-300">
        <ArrowRight className="w-4 h-4 text-blue-600" />
      </div>
    </Link>
  );
}
