import { db } from '@/lib/db';
import {
  TaskStatus,
  VALID_STATUS_TRANSITIONS,
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
} from '@/lib/types';

/**
 * TaskService — 任务增删改查与状态流转
 *
 * 所有数据操作通过 Dexie.js 持久化到 IndexedDB，
 * 业务逻辑独立于 React 组件，确保后期迁移时无需修改 UI。
 */
export class TaskService {
  /**
   * 创建新任务
   * 默认状态为 DRAFT，默认日期为今天
   */
  static async create(input: CreateTaskInput): Promise<number> {
    const now = new Date().toISOString();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const task: Task = {
      title: input.title,
      est_time: input.est_time ?? 0,
      act_time: 0,
      status: input.status ?? TaskStatus.DRAFT,
      tags: input.tags ?? [],
      is_school_done: input.is_school_done ?? false,
      date: input.date ?? today,
      created_at: now,
      updated_at: now,
    };

    const id = await db.tasks.add(task);
    return id;
  }

  /** 按 ID 查询单个任务 */
  static async getById(id: number): Promise<Task | undefined> {
    return db.tasks.get(id);
  }

  /** 获取指定日期的所有任务 */
  static async getByDate(date: string): Promise<Task[]> {
    return db.tasks.where('date').equals(date).toArray();
  }

  /** 按状态筛选任务 */
  static async getByStatus(status: TaskStatus): Promise<Task[]> {
    return db.tasks.where('status').equals(status).toArray();
  }

  /** 获取所有任务 */
  static async getAll(): Promise<Task[]> {
    return db.tasks.toArray();
  }

  /** 更新任务字段（自动刷新 updated_at） */
  static async update(id: number, changes: UpdateTaskInput): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error(`任务不存在: id=${id}`);
    }

    await db.tasks.update(id, {
      ...changes,
      updated_at: new Date().toISOString(),
    });
  }

  /** 删除任务 */
  static async delete(id: number): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error(`任务不存在: id=${id}`);
    }
    await db.tasks.delete(id);
  }

  /**
   * 状态流转（含合法性校验）
   *
   * 合法转换规则：
   * - DRAFT → PENDING
   * - PENDING → RUNNING, EXPIRED
   * - RUNNING → PAUSED, COMPLETED
   * - PAUSED → RUNNING, COMPLETED, EXPIRED
   * - COMPLETED / EXPIRED 为终态，不可再转换
   */
  static async updateStatus(id: number, newStatus: TaskStatus): Promise<void> {
    const task = await db.tasks.get(id);
    if (!task) {
      throw new Error(`任务不存在: id=${id}`);
    }

    const allowedTargets = VALID_STATUS_TRANSITIONS[task.status];
    if (!allowedTargets.includes(newStatus)) {
      throw new Error(
        `非法状态转换: ${task.status} → ${newStatus}。` +
        `允许的目标状态: [${allowedTargets.join(', ')}]`
      );
    }

    await db.tasks.update(id, {
      status: newStatus,
      updated_at: new Date().toISOString(),
    });
  }
}
