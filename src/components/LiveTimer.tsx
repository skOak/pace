'use client';

import { useState, useEffect } from 'react';
import { ExecutionLogService } from '@/services/execution-log-service';
import { TaskStatus } from '@/lib/types';

/**
 * 动态计时器组件
 * 接受基础的累计时间 (baseActTime)，并自动加上正在进行的时间片段，实现无刷新动态跳动。
 */
export function LiveTimer({ taskId, baseActTime, status, className }: { taskId: number; baseActTime: number; status?: string; className?: string }) {
  const [activeStartTime, setActiveStartTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;
    setNow(Date.now()); // 状态切换时立即校准当前时间，防止初次渲染的旧时间早于数据库插入时间产生负数

    if (status === TaskStatus.COMPLETED || status === TaskStatus.PAUSED || status === TaskStatus.PENDING) {
      setActiveStartTime(null);
      return;
    }

    // 获取该任务当前活跃的执行记录
    ExecutionLogService.getByTaskId(taskId).then(logs => {
      if (!mounted) return;
      const activeLog = logs.find(l => !l.endTime);
      if (activeLog) {
        setActiveStartTime(new Date(activeLog.startTime).getTime());
      } else {
        setActiveStartTime(null);
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
  }, [taskId, status]);

  let totalSeconds = Math.floor(baseActTime * 60);
  if (activeStartTime) {
    totalSeconds += Math.max(0, Math.floor((now - activeStartTime) / 1000));
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
