import { db } from '@/lib/db';
import type { DailyAnchor } from '@/lib/types';

/**
 * DailyAnchorService — 每日行为锚点管理
 *
 * 记录每天的"首次启动时间"和"末次结束时间"，
 * 用于计算积极度（冷启动时长）和负荷（收尾一致性）。
 */
export class DailyAnchorService {
  /**
   * 获取或初始化当日锚点记录
   * 如果当日记录不存在则自动创建空记录
   */
  static async getOrCreate(date: string): Promise<DailyAnchor> {
    const existing = await db.daily_anchors.get(date);
    if (existing) {
      return existing;
    }

    const anchor: DailyAnchor = { date };
    await db.daily_anchors.put(anchor);
    return anchor;
  }

  /**
   * 记录当日首次启动时间
   * 仅在 start_anchor 为空时写入，不覆盖（确保记录的是"最早"的启动时间）
   * @param date 日期 (YYYY-MM-DD)
   * @param now 可选，指定时间（默认为当前时间），便于测试
   */
  static async setStartAnchor(date: string, now?: Date): Promise<void> {
    const anchor = await this.getOrCreate(date);

    // 如果已有 start_anchor，不覆盖
    if (anchor.start_anchor) {
      return;
    }

    await db.daily_anchors.update(date, {
      start_anchor: (now ?? new Date()).toISOString(),
    });
  }

  /**
   * 更新当日最后任务结束时间
   * 每次任务结束时都覆盖写入（确保记录的是"最晚"的结束时间）
   * @param date 日期 (YYYY-MM-DD)
   * @param now 可选，指定时间（默认为当前时间），便于测试
   */
  static async setEndAnchor(date: string, now?: Date): Promise<void> {
    await this.getOrCreate(date);

    await db.daily_anchors.update(date, {
      end_anchor: (now ?? new Date()).toISOString(),
    });
  }

  /** 获取指定日期的锚点（不自动创建） */
  static async get(date: string): Promise<DailyAnchor | undefined> {
    return db.daily_anchors.get(date);
  }
}
