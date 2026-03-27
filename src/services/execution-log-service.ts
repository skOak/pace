import { db } from '@/lib/db';
import type { ExecutionLog } from '@/lib/types';

/**
 * ExecutionLogService — 执行记录管理
 *
 * 记录每次任务从"开始"到"暂停/结束"的时间片段，
 * 用于精确计算任务的实际累计运行时间。
 */
export class ExecutionLogService {
  /**
   * 创建一条新的执行记录（开始计时）
   * @param taskId 关联的任务 ID
   * @param now 可选，指定开始时间（默认为当前时间），便于测试
   * @returns 新记录的 ID
   */
  static async startLog(taskId: number, now?: Date): Promise<number> {
    const log: ExecutionLog = {
      taskId,
      startTime: (now ?? new Date()).toISOString(),
    };
    const id = await db.execution_logs.add(log);
    return id as number;
  }

  /**
   * 结束一条执行记录（停止计时）
   * @param logId 执行记录 ID
   * @param now 可选，指定结束时间（默认为当前时间），便于测试
   * @returns 本次执行时长（分钟）
   */
  static async endLog(logId: number, now?: Date): Promise<number> {
    const log = await db.execution_logs.get(logId);
    if (!log) {
      throw new Error(`执行记录不存在: id=${logId}`);
    }
    if (log.endTime) {
      throw new Error(`执行记录已结束: id=${logId}`);
    }

    const endTime = (now ?? new Date()).toISOString();
    await db.execution_logs.update(logId, { endTime });

    // 计算本次时长（分钟）
    const durationMs = new Date(endTime).getTime() - new Date(log.startTime).getTime();
    return durationMs / (1000 * 60);
  }

  /** 获取某任务的所有执行片段 */
  static async getByTaskId(taskId: number): Promise<ExecutionLog[]> {
    return db.execution_logs.where('taskId').equals(taskId).toArray();
  }

  /**
   * 汇总某任务的总实际用时（分钟）
   * 仅统计已结束（有 endTime）的片段
   */
  static async calculateTotalTime(taskId: number): Promise<number> {
    const logs = await db.execution_logs.where('taskId').equals(taskId).toArray();

    let totalMs = 0;
    for (const log of logs) {
      if (log.endTime) {
        const start = new Date(log.startTime).getTime();
        const end = new Date(log.endTime).getTime();
        totalMs += end - start;
      }
    }

    return totalMs / (1000 * 60);
  }
}
