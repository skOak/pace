import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { DailyAnchorService } from '@/services/daily-anchor-service';

describe('DailyAnchorService', () => {
  beforeEach(async () => {
    await db.tasks.clear();
    await db.execution_logs.clear();
    await db.daily_anchors.clear();
  });

  describe('getOrCreate', () => {
    it('应为新日期创建空记录', async () => {
      const anchor = await DailyAnchorService.getOrCreate('2026-03-26');
      expect(anchor).toBeDefined();
      expect(anchor.date).toBe('2026-03-26');
      expect(anchor.start_anchor).toBeUndefined();
      expect(anchor.end_anchor).toBeUndefined();
    });

    it('如果记录已存在则直接返回', async () => {
      await DailyAnchorService.getOrCreate('2026-03-26');
      await DailyAnchorService.setStartAnchor(
        '2026-03-26',
        new Date('2026-03-26T08:00:00.000Z')
      );

      const anchor = await DailyAnchorService.getOrCreate('2026-03-26');
      expect(anchor.start_anchor).toBeDefined();
    });
  });

  describe('setStartAnchor', () => {
    it('应在无值时写入 start_anchor', async () => {
      await DailyAnchorService.setStartAnchor(
        '2026-03-26',
        new Date('2026-03-26T08:30:00.000Z')
      );

      const anchor = await DailyAnchorService.get('2026-03-26');
      expect(anchor).toBeDefined();
      expect(anchor!.start_anchor).toBe('2026-03-26T08:30:00.000Z');
    });

    it('已有 start_anchor 时不覆盖（保留最早时间）', async () => {
      // 第一次设置
      await DailyAnchorService.setStartAnchor(
        '2026-03-26',
        new Date('2026-03-26T08:00:00.000Z')
      );

      // 第二次尝试设置（更晚的时间）
      await DailyAnchorService.setStartAnchor(
        '2026-03-26',
        new Date('2026-03-26T09:00:00.000Z')
      );

      const anchor = await DailyAnchorService.get('2026-03-26');
      // 应保持第一次的时间
      expect(anchor!.start_anchor).toBe('2026-03-26T08:00:00.000Z');
    });
  });

  describe('setEndAnchor', () => {
    it('应写入 end_anchor', async () => {
      await DailyAnchorService.setEndAnchor(
        '2026-03-26',
        new Date('2026-03-26T20:00:00.000Z')
      );

      const anchor = await DailyAnchorService.get('2026-03-26');
      expect(anchor!.end_anchor).toBe('2026-03-26T20:00:00.000Z');
    });

    it('每次调用都覆盖（保留最晚时间）', async () => {
      await DailyAnchorService.setEndAnchor(
        '2026-03-26',
        new Date('2026-03-26T18:00:00.000Z')
      );

      await DailyAnchorService.setEndAnchor(
        '2026-03-26',
        new Date('2026-03-26T21:00:00.000Z')
      );

      const anchor = await DailyAnchorService.get('2026-03-26');
      // 应为最后一次设置的时间
      expect(anchor!.end_anchor).toBe('2026-03-26T21:00:00.000Z');
    });
  });
});
