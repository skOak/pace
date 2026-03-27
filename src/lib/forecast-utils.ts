import { Task, TaskStatus } from './types';

/**
 * 计算单个任务的剩余所需时间（分钟）
 * @param task 任务对象
 * @returns 剩余时间（分钟），最小为 0
 */
export function calculateRemainingTime(task: Task): number {
  if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.EXPIRED || task.status === TaskStatus.DRAFT) {
    return 0;
  }
  
  if (task.status === TaskStatus.PENDING) {
    return task.est_time;
  }
  
  // 对于 RUNNING 和 PAUSED 状态
  const remaining = task.est_time - task.act_time;
  return Math.max(remaining, 0);
}

/**
 * 计算预计完工时间
 * @param tasks 当日所有任务列表
 * @param currentTime 当前参考时间（默认为当前时间）
 * @returns 预计完工时间的 Date 对象
 */
export function calculateForecastTime(tasks: Task[], currentTime: Date = new Date()): Date {
  const totalRemainingMin = tasks.reduce((sum, task) => sum + calculateRemainingTime(task), 0);
  return new Date(currentTime.getTime() + totalRemainingMin * 60 * 1000);
}

/**
 * 计算任务用时偏差百分比（实际用时 / 预估用时）
 * @param task 任务对象
 * @returns 百分比，例如 1.25 表示超额 25%，0.8 表示提前 20% 完成。如果预估为 0，则返回 0。
 */
export function calculateDeviationRatio(task: Task): number {
  if (task.est_time === 0) {
    return -1; // -1 represents N/A (e.g., school tasks without estimation)
  }
  return task.act_time / task.est_time;
}

/**
 * 格式化时间
 * 如果是今天，显示 HH:mm
 * 如果是明天，显示 明天 HH:mm
 * 如果是后天及以后，显示 MM-DD HH:mm
 * @param date 目标时间 Date 
 * @param now 当前参比时间 Date
 * @returns 格式化后的字符串
 */
export function formatTime(date: Date | null | undefined, now: Date = new Date()): string {
  if (!date) return '--:--';
  const isSameDay = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  if (isSameDay) return timeStr;
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear()) {
    return `明天 ${timeStr}`;
  }
  
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${month}-${d} ${timeStr}`;
}
