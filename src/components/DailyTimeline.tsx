import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { Task, ExecutionLog } from '@/lib/types';
import { RetroactiveTaskDialog } from './RetroactiveTaskDialog';

const TAG_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];

export interface DailyTimelineProps {
  logs: ExecutionLog[];
  tasks: Task[];
  tagStats?: { tag: string; totalTime: number }[];
  onDataChanged?: () => void;
}

export function DailyTimeline({ logs, tasks, tagStats = [], onDataChanged }: DailyTimelineProps) {
  const [selectedLogId, setSelectedLogId] = useState<number | string | null>(null);
  const [retroDialogOpen, setRetroDialogOpen] = useState(false);
  const [retroStartTime, setRetroStartTime] = useState<Date>(new Date());
  const [retroEndTime, setRetroEndTime] = useState<Date>(new Date());

  const nowMs = new Date().getTime();
  let minTime = Infinity;
  let maxTime = -Infinity;

  const timelineBlocks = logs.map(log => {
    const task = tasks.find(t => t.id === log.taskId);
    if (!task) return null;
    const startMs = new Date(log.startTime).getTime();
    const endMs = log.endTime ? new Date(log.endTime).getTime() : nowMs;
    
    if (startMs < minTime) minTime = startMs;
    if (endMs > maxTime) maxTime = endMs;
    
    return {
      log,
      task,
      startMs,
      endMs,
      durationMs: endMs - startMs
    };
  }).filter(Boolean) as any[];

  if (timelineBlocks.length > 0) {
    const HALF_HOUR = 30 * 60 * 1000;
    minTime = Math.floor(minTime / HALF_HOUR) * HALF_HOUR;
    maxTime = Math.ceil(maxTime / HALF_HOUR) * HALF_HOUR;
    if (maxTime - minTime < 60 * 60 * 1000) {
        maxTime = minTime + 60 * 60 * 1000;
    }
  } else {
    // If no blocks, show current hour
    const now = new Date();
    minTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - 1).getTime();
    maxTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1).getTime();
  }

  const totalTimelineMs = Math.max(maxTime - minTime, 1);

  // Check for conflicts (overlap)
  const isConflict = (block: any) => {
    return timelineBlocks.some(other => 
      other.log.id !== block.log.id && 
      block.startMs < other.endMs && 
      block.endMs > other.startMs
    );
  };

  const handleBlankClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const clickedTimeMs = minTime + percentage * totalTimelineMs;
    
    // Suggest a 30 minute block around the clicked time
    const start = new Date(clickedTimeMs - 15 * 60 * 1000);
    const end = new Date(clickedTimeMs + 15 * 60 * 1000);
    
    setRetroStartTime(start);
    setRetroEndTime(end);
    setRetroDialogOpen(true);
  };

  return (
    <>
      <Card className="border-gray-100 shadow-sm relative z-10 w-full overflow-visible" onClick={() => setSelectedLogId(null)}>
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="text-lg text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            当日专注时间轴
          </CardTitle>
          <CardDescription>动态变焦的专注时间片段排布 (从 {new Date(minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 起算)。点击空白处可快速补录。</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 overflow-visible">
          <div 
            className="relative w-full h-11 bg-gray-100 rounded-lg min-w-[280px] mt-16 mb-4 cursor-crosshair group hover:bg-gray-200 transition-colors"
            onClick={handleBlankClick}
            title="点击空白处补录记录"
          >
            {/* x-axis boundaries text */}
            <div className="absolute -top-7 left-0 text-xs text-gray-400 font-medium pointer-events-none">
              {new Date(minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="absolute -top-7 right-0 text-xs text-gray-400 font-medium pointer-events-none">
              {new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>

            {timelineBlocks.map((block, idx) => {
                const blockId = block.log.id || `idx-${idx}`;
                const leftPct = ((block.startMs - minTime) / totalTimelineMs) * 100;
                const widthPct = (block.durationMs / totalTimelineMs) * 100;
                const isActive = !block.log.endTime;
                const isSelected = selectedLogId === blockId;
                const conflict = isConflict(block);
                
                let colorIndex = 0;
                if (block.task.tags?.length > 0) {
                  const tagStatIndex = tagStats.findIndex(ts => ts.tag === block.task.tags[0]);
                  if (tagStatIndex !== -1) colorIndex = tagStatIndex;
                }
                const color = conflict ? '#ef4444' : TAG_COLORS[colorIndex % TAG_COLORS.length]; // Red if conflict

                return (
                  <div 
                    key={`log-${blockId}`}
                    className={`absolute h-full cursor-pointer transition-opacity z-10
                      ${isSelected ? '!z-[60]' : 'hover:z-50'}
                      ${selectedLogId && !isSelected ? 'opacity-30' : 'opacity-100'}`}
                    style={{
                      left: `${Math.max(0, leftPct)}%`,
                      width: `${Math.min(100 - leftPct, widthPct)}%`,
                      minWidth: '2px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLogId(selectedLogId === blockId ? null : blockId);
                    }}
                  >
                    <div 
                      className={`w-full h-full rounded-md shadow-sm border border-white/20 transition-all origin-center
                        ${isActive ? 'animate-pulse ring-2 ring-indigo-300' : ''}
                        ${isSelected ? 'scale-y-[1.4] ring-2 ring-gray-900 shadow-md' : 'hover:scale-y-110'}
                        ${conflict ? 'border-red-500 border-2' : ''}
                      `}
                      style={{ backgroundColor: color }}
                    />

                    {/* Tap Tooltip */}
                    <div className={`absolute bottom-[calc(100%+14px)] left-1/2 -translate-x-1/2 bg-white text-gray-800 py-2.5 px-3.5 rounded-xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),_0_0_10px_0_rgba(0,0,0,0.05)] border border-gray-100 pointer-events-none whitespace-nowrap transition-all origin-bottom flex flex-col items-center ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                        <span className="font-semibold text-xs text-gray-800 tracking-wide">
                          {block.task.title} {block.task.is_adjusted ? ' ✏️' : ''} {conflict ? ' ⚠️冲突' : ''}
                        </span>
                      </div>
                      
                      <div className="text-gray-500 font-mono text-[10px] flex items-center gap-1">
                        {new Date(block.startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-gray-300">~</span>
                        {isActive ? <span className="text-amber-600 font-bold animate-pulse">进行中</span> : new Date(block.endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-white" />
                    </div>
                  </div>
                );
            })}
          </div>
          
          {/* List / Legend */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-2">
              {[...timelineBlocks].sort((a,b) => a.startMs - b.startMs).map((block, idx) => {
                const blockId = block.log.id || `idx-${idx}`;
                const isActive = !block.log.endTime;
                const isSelected = selectedLogId === blockId;
                const conflict = isConflict(block);
                
                let colorIndex = 0;
                if (block.task.tags?.length > 0) {
                  const tagStatIndex = tagStats.findIndex(ts => ts.tag === block.task.tags[0]);
                  if (tagStatIndex !== -1) colorIndex = tagStatIndex;
                }
                const color = conflict ? '#ef4444' : TAG_COLORS[colorIndex % TAG_COLORS.length];
                
                const mins = Math.round(block.durationMs / 60000);
                const durText = mins >= 60 ? `${Math.floor(mins/60)}h${mins%60}m` : `${mins}m`;
                
                return (
                  <div 
                    key={`legend-${idx}`} 
                    className={`flex items-start gap-2 text-sm transition-all p-3 rounded-xl border shadow-sm cursor-pointer
                      ${isSelected ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20 scale-[1.02]' : 'bg-gray-50/50 hover:bg-gray-100/50 border-gray-100'}
                      ${selectedLogId && !isSelected ? 'opacity-40 grayscale-[30%]' : 'opacity-100'}
                      ${conflict && !isSelected ? 'bg-red-50/50 border-red-100' : ''}
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLogId(selectedLogId === blockId ? null : blockId);
                    }}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0 mt-1 shadow-sm transition-transform" style={{ backgroundColor: color, transform: isSelected ? 'scale(1.2)' : 'scale(1)' }} />
                    <div className="min-w-0 flex-1">
                      <div className={`font-semibold truncate transition-colors ${isSelected ? 'text-indigo-900' : 'text-gray-800'}`}>
                        {block.task.title}
                        {block.task.is_adjusted && <span className="ml-1 opacity-70" title="该记录经过人工修正">✏️</span>}
                        {conflict && <span className="ml-1 text-red-500 text-xs" title="该记录与其它任务时间重叠">⚠️重叠</span>}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono mt-1">
                        {new Date(block.startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-1 text-gray-300">~</span>
                        {isActive ? <span className="text-amber-600 font-bold animate-pulse">进行中</span> : new Date(block.endMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className={`ml-2 font-sans rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wider transition-colors ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}`}>{durText}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      <RetroactiveTaskDialog 
        open={retroDialogOpen}
        onOpenChange={setRetroDialogOpen}
        defaultStartTime={retroStartTime}
        defaultEndTime={retroEndTime}
        onTaskCreated={() => {
          if (onDataChanged) onDataChanged();
        }}
      />
    </>
  );
}
