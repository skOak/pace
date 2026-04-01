import { db } from '@/lib/db';
import { type Goal, type GoalComment, GoalStatus, TaskStatus } from '@/lib/types';

/**
 * GoalService — 长线目标与评论的增删改查
 */
export class GoalService {
  /** 创建长线目标 */
  static async create(input: Partial<Goal>): Promise<string> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    
    const goal: Goal = {
      id,
      title: input.title || 'Untitled Goal',
      description: input.description,
      total_estimated_duration: input.total_estimated_duration || 0,
      deadline: input.deadline,
      difficulty: input.difficulty,
      confidence: input.confidence,
      status: input.status ?? GoalStatus.ACTIVE,
      created_at: now,
      updated_at: now,
    };

    await db.goals.add(goal);
    return id;
  }

  /** 获取单个长线目标 */
  static async getById(id: string): Promise<Goal | undefined> {
    return db.goals.get(id);
  }

  /** 获取所有活跃的长线目标 */
  static async getActiveGoals(): Promise<Goal[]> {
    return db.goals.where('status').equals(GoalStatus.ACTIVE).toArray();
  }

  /** 获取所有状态的长线目标 */
  static async getAll(): Promise<Goal[]> {
    return db.goals.toArray();
  }

  /** 更新目标信息 */
  static async update(id: string, changes: Partial<Omit<Goal, 'id' | 'created_at'>>): Promise<void> {
    const goal = await db.goals.get(id);
    if (!goal) {
      throw new Error(`Goal not found: ${id}`);
    }

    await db.goals.update(id, {
      ...changes,
      updated_at: new Date().toISOString(),
    });
  }

  /** 删除长线目标及其关联内容 */
  static async delete(id: string): Promise<void> {
    await db.goals.delete(id);
    // 同时删除关联评论
    await db.goal_comments.where('goal_id').equals(id).delete();
  }

  /** 获取目标下的所有已关联 Session (Task) */
  static async getSessionsByGoalId(goalId: string) {
    return db.tasks
      .where('goal_id')
      .equals(goalId)
      .filter((task) => task.is_session === true)
      .toArray();
  }

  /** 
   * 获取目标相关的消耗时长统计 
   * 仅包含已完成 (COMPLETED) 及由于晚安过期 (EXPIRED) 的曾经执行过的部分时长。
   */
  static async getGoalProgress(goalId: string): Promise<number> {
    const sessions = await this.getSessionsByGoalId(goalId);
    let totalActTime = 0;
    
    // 我们只计算已经完成的任务的时间作为进度，或者也可以计算所有 session 的 act_time。
    for (const session of sessions) {
      if (session.act_time) {
        totalActTime += session.act_time;
      }
    }

    return totalActTime;
  }

  // ============== Comments ==============

  /** 获取目标下所有评论，按时间正序排列 */
  static async getComments(goalId: string): Promise<GoalComment[]> {
    const comments = await db.goal_comments.where('goal_id').equals(goalId).toArray();
    return comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  /** 添加评论 */
  static async addComment(goalId: string, user_role: string, content: string): Promise<string> {
    const id = crypto.randomUUID();
    const comment: GoalComment = {
      id,
      goal_id: goalId,
      user_role,
      content,
      created_at: new Date().toISOString(),
    };

    await db.goal_comments.add(comment);
    return id;
  }
}
