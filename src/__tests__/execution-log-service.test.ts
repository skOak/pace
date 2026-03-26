import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { ExecutionLogService } from '@/services/execution-log-service';

describe('ExecutionLogService', () => {
  beforeEach(async () => {
    await db.tasks.clear();
    await db.execution_logs.clear();
    await db.daily_anchors.clear();
  });

  describe('startLog / endLog', () => {
    it('应能创建一条执行记录', async () => {
      const logId = await ExecutionLogService.startLog(1);
      expect(logId).toBeDefined();

      const logs = await ExecutionLogService.getByTaskId(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].taskId).toBe(1);
      expect(logs[0].startTime).toBeDefined();
      expect(logs[0].endTime).toBeUndefined();
    });

    it('结束记录后应写入 endTime 并返回时长', async () => {
      const startDate = new Date('2026-03-26T14:00:00.000Z');
      const endDate = new Date('2026-03-26T14:30:00.000Z');

      const logId = await ExecutionLogService.startLog(1, startDate);
      const duration = await ExecutionLogService.endLog(logId, endDate);

      // 30 分钟
      expect(duration).toBeCloseTo(30, 1);

      const logs = await ExecutionLogService.getByTaskId(1);
      expect(logs[0].endTime).toBeDefined();
    });

    it('结束不存在的记录应抛错', async () => {
      await expect(ExecutionLogService.endLog(999)).rejects.toThrow('执行记录不存在');
    });

    it('重复结束已结束的记录应抛错', async () => {
      const logId = await ExecutionLogService.startLog(
        1,
        new Date('2026-03-26T14:00:00.000Z')
      );
      await ExecutionLogService.endLog(logId, new Date('2026-03-26T14:10:00.000Z'));

      await expect(ExecutionLogService.endLog(logId)).rejects.toThrow('执行记录已结束');
    });
  });

  describe('calculateTotalTime', () => {
    it('应正确累加多个已结束片段的时长', async () => {
      // 第一个片段：10 分钟
      const log1 = await ExecutionLogService.startLog(
        1,
        new Date('2026-03-26T14:00:00.000Z')
      );
      await ExecutionLogService.endLog(log1, new Date('2026-03-26T14:10:00.000Z'));

      // 第二个片段：20 分钟
      const log2 = await ExecutionLogService.startLog(
        1,
        new Date('2026-03-26T14:30:00.000Z')
      );
      await ExecutionLogService.endLog(log2, new Date('2026-03-26T14:50:00.000Z'));

      const totalTime = await ExecutionLogService.calculateTotalTime(1);
      // 10 + 20 = 30 分钟
      expect(totalTime).toBeCloseTo(30, 1);
    });

    it('应忽略未结束的片段', async () => {
      // 已结束：15 分钟
      const log1 = await ExecutionLogService.startLog(
        1,
        new Date('2026-03-26T14:00:00.000Z')
      );
      await ExecutionLogService.endLog(log1, new Date('2026-03-26T14:15:00.000Z'));

      // 未结束
      await ExecutionLogService.startLog(
        1,
        new Date('2026-03-26T15:00:00.000Z')
      );

      const totalTime = await ExecutionLogService.calculateTotalTime(1);
      expect(totalTime).toBeCloseTo(15, 1);
    });

    it('无记录时返回 0', async () => {
      const totalTime = await ExecutionLogService.calculateTotalTime(999);
      expect(totalTime).toBe(0);
    });
  });
});
