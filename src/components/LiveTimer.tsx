'use client';

import { useState, useEffect } from 'react';
import { ExecutionLogService } from '@/services/execution-log-service';
import { formatDuration } from '@/lib/forecast-utils';

/**
 * 动态计时器组件
 * 接受基础的累计时间 (baseActTime)，并自动加上正在进行的时间片段，实现无刷新动态跳动。
 */
export function LiveTimer({ taskId, baseActTime }: { taskId: number; baseActTime: number }) {
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

    // 每秒触发一次当前时间更新，足够精细以保证分钟跳动没有明显迟缓
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [taskId]);

  let displayTime = baseActTime;
  if (activeStartTime) {
    displayTime += Math.floor((now - activeStartTime) / 60000);
  }

  return <span>{formatDuration(displayTime)}</span>;
}
