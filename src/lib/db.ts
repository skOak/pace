import Dexie, { type EntityTable } from 'dexie';
import type { Task, ExecutionLog, DailyAnchor } from './types';

/**
 * PaceDB — 本地优先的浏览器数据库
 *
 * 使用 Dexie.js 封装 IndexedDB，定义三张核心表：
 * - tasks: 任务主表
 * - execution_logs: 执行记录表（计时片段）
 * - daily_anchors: 每日行为锚点表
 *
 * 设计原则：
 * 1. 字段索引仅建在需要查询筛选的列上
 * 2. 所有时间戳使用 ISO 8601 字符串，便于后期无痛迁移至云端 SQL
 * 3. 导出单例实例 `db`，全局共享
 */
export class PaceDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  execution_logs!: EntityTable<ExecutionLog, 'id'>;
  daily_anchors!: EntityTable<DailyAnchor, 'date'>;
  settings!: EntityTable<{ key: string; value: any }, 'key'>;

  constructor() {
    super('PaceDB');

    this.version(1).stores({
      // tasks: 自增主键 id，索引 status/date/is_school_done 用于常见查询
      tasks: '++id, status, date, is_school_done',
      // execution_logs: 自增主键 id，索引 taskId 用于按任务查询片段
      execution_logs: '++id, taskId, startTime',
      // daily_anchors: 以日期字符串为主键（非自增）
      daily_anchors: 'date',
    });

    this.version(2).stores({
      settings: 'key',
    });
  }
}

/** 全局数据库单例 */
export const db = new PaceDB();
