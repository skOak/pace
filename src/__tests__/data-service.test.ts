import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { DataService } from '@/services/data-service';
import { TaskStatus } from '@/lib/types';

describe('DataService', () => {
  beforeEach(async () => {
    await db.tasks.clear();
    await db.execution_logs.clear();
    await db.daily_anchors.clear();
  });

  it('应能导出完整的 JSON 数据，并可以恢复还原', async () => {
    // 准备数据
    await db.tasks.add({
      title: '导出测试任务',
      est_time: 30,
      act_time: 0,
      status: TaskStatus.DRAFT,
      tags: ['test'],
      is_school_done: false,
      date: '2026-03-26',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    await db.daily_anchors.add({
      date: '2026-03-26',
      start_anchor: new Date().toISOString(),
    });

    // 导出
    const jsonStr = await DataService.exportData();
    const parsed = JSON.parse(jsonStr);
    
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.daily_anchors).toHaveLength(1);
    expect(parsed.execution_logs).toHaveLength(0);

    // 清空数据库来模拟新环境
    await db.tasks.clear();
    await db.daily_anchors.clear();
    expect(await db.tasks.count()).toBe(0);

    // 导入恢复
    await DataService.importData(jsonStr);
    
    // 验证
    expect(await db.tasks.count()).toBe(1);
    const tasks = await db.tasks.toArray();
    expect(tasks[0].title).toBe('导出测试任务');
    
    expect(await db.daily_anchors.count()).toBe(1);
  });
});
