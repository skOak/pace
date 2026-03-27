import { db } from '@/lib/db';
import { Task, TaskStatus, DailyAnchor } from '@/lib/types';

export interface DayStat {
  date: string;
  status: 'SUCCESS' | 'WARNING' | 'NONE';
  totalTasks: number;
  completedTasks: number;
}

export interface TagStat {
  tag: string;
  efficiency: number; // Avg(act / est)
  totalTime: number; // Sum(act)
}

export class StatsService {
  /** 获取特定日期内的所有任务 */
  static async getTasksInRange(startDate: string, endDate: string): Promise<Task[]> {
    return db.tasks
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  /** 获取特定日期内的锚点 */
  static async getAnchorsInRange(startDate: string, endDate: string): Promise<DailyAnchor[]> {
    return db.daily_anchors
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
  }

  /** 获取每日状态评价 (WeeklyStrip 使用) */
  static async getDailyStats(startDate: string, endDate: string): Promise<DayStat[]> {
    const tasks = await this.getTasksInRange(startDate, endDate);
    
    const tasksByDate: Record<string, Task[]> = {};
    tasks.forEach(t => {
      if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
      tasksByDate[t.date].push(t);
    });

    const result: DayStat[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const dayTasks = tasksByDate[dateStr] || [];
      
      if (dayTasks.length === 0) {
        result.push({ date: dateStr, status: 'NONE', totalTasks: 0, completedTasks: 0 });
      } else {
        const hasExpired = dayTasks.some(t => t.status === TaskStatus.EXPIRED);
        const completed = dayTasks.filter(t => t.status === TaskStatus.COMPLETED && t.est_time > 0 && !t.is_school_done);
        
        let avgDeviation = 1;
        if (completed.length > 0) {
          const totalEst = completed.reduce((sum, t) => sum + t.est_time, 0);
          const totalAct = completed.reduce((sum, t) => sum + t.act_time, 0);
          avgDeviation = totalEst > 0 ? totalAct / totalEst : 1;
        }

        let status: 'SUCCESS' | 'WARNING' | 'NONE' = 'SUCCESS';
        if (hasExpired || avgDeviation > 1.3) {
          status = 'WARNING';
        } else if (avgDeviation >= 0.8 && avgDeviation <= 1.2 && !dayTasks.some(t => t.status !== TaskStatus.COMPLETED)) {
           status = 'SUCCESS';
        } else if (dayTasks.some(t => t.status !== TaskStatus.COMPLETED)) {
           status = 'NONE';
        }

        result.push({
          date: dateStr,
          status,
          totalTasks: dayTasks.length,
          completedTasks: dayTasks.filter(t => t.status === TaskStatus.COMPLETED).length
        });
      }
      
      current.setDate(current.getDate() + 1);
    }
    return result;
  }

  /** 计算标签统计 (聚类与时长分布) */
  static async getTagStats(startDate: string, endDate: string): Promise<TagStat[]> {
    const tasks = await this.getTasksInRange(startDate, endDate);
    const tagMap: Record<string, { totalEst: number, totalAct: number, totalTime: number }> = {};

    tasks.forEach(t => {
      t.tags.forEach(tag => {
        if (!tagMap[tag]) tagMap[tag] = { totalEst: 0, totalAct: 0, totalTime: 0 };
        tagMap[tag].totalTime += t.act_time;
        
        if (t.status === TaskStatus.COMPLETED && !t.is_school_done && t.est_time > 0) {
          tagMap[tag].totalEst += t.est_time;
          tagMap[tag].totalAct += t.act_time;
        }
      });
    });

    return Object.entries(tagMap).map(([tag, data]) => ({
      tag,
      efficiency: data.totalEst > 0 ? data.totalAct / data.totalEst : 0,
      totalTime: data.totalTime
    })).sort((a, b) => b.totalTime - a.totalTime);
  }

  /** 智能偏差修正建议：判断最近3次该标签任务的偏差是否连续超过 20% */
  static async checkSmartBuffer(tag: string): Promise<{ active: boolean; extraMinutes: number }> {
    const tasks = await db.tasks
      .where('status')
      .equals(TaskStatus.COMPLETED)
      .toArray();

    const taggedTasks = tasks
      .filter(t => t.tags.includes(tag) && !t.is_school_done && t.est_time > 0)
      .sort((a, b) => b.id! - a.id!); // ID 越新越大

    const recent3 = taggedTasks.slice(0, 3);
    if (recent3.length < 3) return { active: false, extraMinutes: 0 };

    const isConsistentlyLow = recent3.every(t => (t.act_time / t.est_time) > 1.2);
    if (!isConsistentlyLow) return { active: false, extraMinutes: 0 };

    const avgExtra = recent3.reduce((sum, t) => sum + (t.act_time - t.est_time), 0) / 3;
    return { active: true, extraMinutes: Math.round(avgExtra) };
  }
}
