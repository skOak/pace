import Dexie, { type EntityTable } from 'dexie';
import type { Task, ExecutionLog, DailyAnchor, HabitTemplate, Goal, GoalComment, SyncQueueItem } from './types';

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
  habit_templates!: EntityTable<HabitTemplate, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  goal_comments!: EntityTable<GoalComment, 'id'>;
  sync_queue!: EntityTable<SyncQueueItem, 'id'>;

  constructor() {
    super('PaceDB');
    
    // 监听升级被阻塞（多标签页问题）
    this.on('blocked', () => {
      console.warn("PaceDB upgrade blocked by another tab.");
      alert('数据库正在被其他隐身或后台标签页占用，导致无法加载。请关闭本站的其他所有 Safari 页面/标签页后重试。');
    });

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

    this.version(3).stores({
      habit_templates: 'id',
      // tasks表追加索引用于未来的查询模板关联
      tasks: '++id, status, date, is_school_done, template_id',
    });

    this.version(4).stores({
      goals: 'id',
      goal_comments: 'id, goal_id',
      tasks: '++id, status, date, is_school_done, template_id, goal_id',
    });

    this.version(5).stores({
      goals: 'id, status',
      goal_comments: 'id, goal_id',
      tasks: '++id, status, date, is_school_done, template_id, goal_id',
    });

    // 解决因代码回滚导致的 iOS Safari Dexie 降级导致数据库打不开的死锁 Bug
    // 将版本设为 6 并把错误建立的 statements 置为 null 从而将其抹除
    this.version(6).stores({
      statements: null,
      goals: 'id, status',
      goal_comments: 'id, goal_id',
      tasks: '++id, status, date, is_school_done, template_id, goal_id',
    });

    this.version(7).stores({
      sync_queue: '++id, table, action',
    });
  }
}

/** 全局数据库单例 */
export const db = new PaceDB();

/** 
 * 强制确保数据库准备就绪，带有 iOS Safari WebKit 死锁检测 
 * 如果 3 秒内未打开，直接 reject，避免全局无限 Loading 
 */
export async function ensureDbReady(): Promise<void> {
  const timeoutMs = 3000;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("数据库加载超时 (可能遇到 iOS Safari IndexedDB 死锁)。请尝试上滑杀掉 Safari 后重新打开，或清除网站数据。"));
    }, timeoutMs);

    db.open()
      .then(() => {
        clearTimeout(timer);
        resolve();
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** 
 * 彻底重置数据库服务，直接删除底层的 IndexedDB
 */
export async function hardResetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const req = window.indexedDB.deleteDatabase('PaceDB');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error("彻底删除数据库失败"));
      req.onblocked = () => console.warn("Delete blocked by other tabs");
    } catch (e) {
      reject(e);
    }
  });
}
