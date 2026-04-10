import { db } from '@/lib/db';
import type { Task, ExecutionLog, DailyAnchor } from '@/lib/types';
import { SettingsService } from './settings-service';

export class DataService {
  /**
   * 导出所有数据为 JSON 字符串
   */
  static async exportData(): Promise<string> {
    const tasks = await db.tasks.toArray();
    const executionLogs = await db.execution_logs.toArray();
    const dailyAnchors = await db.daily_anchors.toArray();
    
    // 扩展新模型数据
    const habit_templates = await db.habit_templates.toArray();
    const goals = await db.goals.toArray();
    const goal_comments = await db.goal_comments.toArray();

    // 解析并带出设置数据（针对强加密项临时解密提取明文）
    const rawSettings = await db.settings.toArray();
    const settingsExtracted = await Promise.all(
      rawSettings
        .filter(s => s.key !== 'master_crypto_key') // 绝不跨设备导出加密核心锁
        .map(async (s) => {
          // 嗅探是否为 AES 加密结构
          if (s.value && typeof s.value === 'object' && s.value.ciphertext && s.value.iv) {
            const plain = await SettingsService.getSecure(s.key);
            return { key: s.key, value: plain, _wasSecure: true };
          }
          return s;
        })
    );

    const data = {
      version: 2, // 升级数据导出版本号以包含新业务表
      timestamp: new Date().toISOString(),
      tasks,
      execution_logs: executionLogs,
      daily_anchors: dailyAnchors,
      habit_templates,
      goals,
      goal_comments,
      settings: settingsExtracted
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 触发浏览器下载备份文件
   */
  static async downloadExportFile(): Promise<void> {
    try {
      const json = await this.exportData();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const defaultName = `pace_backup_${dateStr}.json`;

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: 'JSON 文件', accept: { 'application/json': ['.json'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(json);
          await writable.close();
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.warn('原生保存 API 报错，降级使用传统方案:', err);
        }
      }

      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('导出文件失败:', error);
      throw error;
    }
  }

  /**
   * 清空所有数据 (用于测试与重置)
   */
  static async clearAllData(): Promise<void> {
    await db.transaction('rw', 
      [db.tasks, db.execution_logs, db.daily_anchors,
      db.habit_templates, db.goals, db.goal_comments, 
      db.sync_queue, db.settings], 
      async () => {
        await db.tasks.clear();
        await db.execution_logs.clear();
        await db.daily_anchors.clear();
        await db.habit_templates.clear();
        await db.goals.clear();
        await db.goal_comments.clear();
        await db.sync_queue.clear();
        await db.settings.clear();
    });
  }

  /**
   * 清空指定日期的任务及相关记录
   */
  static async clearTodayData(dateStr: string): Promise<void> {
    await db.transaction('rw', db.tasks, db.execution_logs, db.daily_anchors, async () => {
      // 获取当天的任务
      const todayTasks = await db.tasks.where('date').equals(dateStr).toArray();
      const taskIds = todayTasks.map(t => t.id).filter(id => id !== undefined) as number[];
      
      if (taskIds.length > 0) {
        // 删除当天的所有任务
        await db.tasks.bulkDelete(taskIds);
        
        // 删除这些任务关联的所有执行记录
        const logs = await db.execution_logs.where('taskId').anyOf(taskIds).toArray();
        const logIds = logs.map(l => l.id).filter(id => id !== undefined) as number[];
        await db.execution_logs.bulkDelete(logIds);
      }
      
      // 删除当天的锚点
      await db.daily_anchors.delete(dateStr);
    });
  }

  /**
   * 从 JSON 字符串全量恢复数据
   * 警告：这将清空现有数据
   */
  static async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      
      // 基本的数据格式校验 (兼容 v1 老版本和 v2 新版本格式)
      if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.execution_logs)) {
        throw new Error('无效的备份文件格式');
      }

      await db.transaction('rw', 
        [db.tasks, db.execution_logs, db.daily_anchors,
        db.habit_templates, db.goals, db.goal_comments],
        async () => {
          // 清空现有数据
          await db.tasks.clear();
          await db.execution_logs.clear();
          await db.daily_anchors.clear();
          await db.habit_templates.clear();
          await db.goals.clear();
          await db.goal_comments.clear();

          // 批量导入
          if (data.tasks?.length > 0) await db.tasks.bulkPut(data.tasks);
          if (data.execution_logs?.length > 0) await db.execution_logs.bulkPut(data.execution_logs);
          if (data.daily_anchors?.length > 0) await db.daily_anchors.bulkPut(data.daily_anchors);
          if (data.habit_templates?.length > 0) await db.habit_templates.bulkPut(data.habit_templates);
          if (data.goals?.length > 0) await db.goals.bulkPut(data.goals);
          if (data.goal_comments?.length > 0) await db.goal_comments.bulkPut(data.goal_comments);
      });

      // 独立恢复设置内容（因为重加密机制需要规避 IndexedDB 嵌套锁竞争）
      if (data.settings && Array.isArray(data.settings)) {
        for (const s of data.settings) {
          if (s._wasSecure) {
            await SettingsService.setSecure(s.key, s.value);
          } else {
            await SettingsService.set(s.key, s.value);
          }
        }
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      throw error;
    }
  }
}
