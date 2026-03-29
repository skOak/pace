'use client';

import { useState, useEffect } from 'react';
import { ExecutionLogService } from '@/services/execution-log-service';

/**
 * 动态计时器组件
 * 接受基础的累计时间 (baseActTime)，并自动加上正在进行的时间片段，实现无刷新动态跳动。
 */
export function LiveTimer({ taskId, baseActTime, className }: { taskId: number; baseActTime: number; className?: string }) {
  const [activeStartTime, setActiveStartTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;

    // 获取该任务当前活跃的执行记录
    ExecutionLogService.getByTaskId(taskId).then(logs => {
      if (!mounted) return;
      const activeLog = logs.find(l => !l.endTime);
      if (activeLog) {
        setActiveStartTime(new Date(activeLog.startTime).getTime());
      }
    });

    // 每秒触发一次当前时间更新，足够精细以保证秒跳动
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [taskId]);

  let totalSeconds = Math.floor(baseActTime * 60);
  if (activeStartTime) {
    totalSeconds += Math.floor((now - activeStartTime) / 1000);
  }

  // 超过99分钟了就停止计时 (99分59秒是上限)
  const MAX_SECONDS = 99 * 60 + 59;
  if (totalSeconds > MAX_SECONDS) {
    totalSeconds = MAX_SECONDS;
  }

  const mm = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const ss = (totalSeconds % 60).toString().padStart(2, '0');

  return (
    <span className={className || "font-mono tabular-nums text-blue-600 font-semibold tracking-tight"}>
      {mm}:{ss}
    </span>
  );
}
