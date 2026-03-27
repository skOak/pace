import { db } from '@/lib/db';
import type { Task, ExecutionLog, DailyAnchor } from '@/lib/types';

export class DataService {
  /**
   * 导出所有数据为 JSON 字符串
   */
  static async exportData(): Promise<string> {
    const tasks = await db.tasks.toArray();
    const executionLogs = await db.execution_logs.toArray();
    const dailyAnchors = await db.daily_anchors.toArray();

    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      tasks,
      execution_logs: executionLogs,
      daily_anchors: dailyAnchors,
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 从 JSON 字符串全量恢复数据
   * 警告：这将清空现有数据
   */
  static async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      
      // 基本的数据格式校验
      if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.execution_logs) || !Array.isArray(data.daily_anchors)) {
        throw new Error('无效的备份文件格式');
      }

      await db.transaction('rw', db.tasks, db.execution_logs, db.daily_anchors, async () => {
        // 清空现有数据
        await db.tasks.clear();
        await db.execution_logs.clear();
        await db.daily_anchors.clear();

        // 批量导入 (使用 bulkPut 替代 bulkAdd 以彻底规避由于即使 clear() 后，部分浏览器底层 IndexedDB 仍遗留的 autoincrement 冲突导致写入失败的问题)
        if (data.tasks.length > 0) {
          await db.tasks.bulkPut(data.tasks);
        }
        if (data.execution_logs.length > 0) {
          await db.execution_logs.bulkPut(data.execution_logs);
        }
        if (data.daily_anchors.length > 0) {
          await db.daily_anchors.bulkPut(data.daily_anchors);
        }
      });
    } catch (error) {
      console.error('导入数据失败:', error);
      throw error;
    }
  }
}
