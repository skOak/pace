import { db } from '@/lib/db';
import { TaskStatus, type HabitTemplate } from '@/lib/types';
import { TaskService } from './task-service';

export class HabitService {
  /** 创建习惯模板 */
  static async create(template: Omit<HabitTemplate, 'id' | 'created_at'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newTemplate: HabitTemplate = {
      ...template,
      id,
      created_at: now,
    };

    await db.habit_templates.add(newTemplate);
    return id;
  }

  /** 获取所有习惯模板 */
  static async getAll(): Promise<HabitTemplate[]> {
    return db.habit_templates.toArray();
  }
  
  /** 按 ID 获取 */
  static async getById(id: string): Promise<HabitTemplate | undefined> {
    return db.habit_templates.get(id);
  }

  /** 获取激活的习惯模板 */
  static async getActive(): Promise<HabitTemplate[]> {
    const all = await db.habit_templates.toArray();
    return all.filter(h => h.status === 'active');
  }

  /** 更新习惯模板 */
  static async update(id: string, changes: Partial<HabitTemplate>): Promise<void> {
    await db.habit_templates.update(id, changes);
  }

  /** 删除习惯模板 (支持带有历史记录的软删除/归档) */
  static async delete(id: string): Promise<void> {
    const template = await this.getById(id);
    if (!template) return;
    
    if ((template.generated_count || 0) > 0) {
      // 若已有历史数据，自动转为 'archived'
      await this.update(id, { status: 'archived' });
    } else {
      // 仅限从未生成过任务的习惯可被硬删除
      await db.habit_templates.delete(id);
    }
  }

  /**
   * 判断今天是否该生成习惯任务
   * frequency_type: 'Weekly' | 'Monthly'
   * frequency_rule: number[]
   */
  static shouldGenerateToday(template: HabitTemplate, checkDate: Date): boolean {
    if (template.status !== 'active') return false;
    
    // 检查重复限额
    if (template.end_type === 'occurrences') {
       if ((template.generated_count || 0) >= (template.end_occurrences || 0)) {
           // 达到次数时标记为归档 (由于 shouldGenerateToday 在引导时或检查时调用，顺手归档)
           this.update(template.id!, { status: 'archived' });
           return false;
       }
    }
    if (template.end_type === 'date' && template.end_date) {
       // local target date string e.g. "2026-03-31"
       const year = checkDate.getFullYear();
       const month = String(checkDate.getMonth() + 1).padStart(2, '0');
       const day = String(checkDate.getDate()).padStart(2, '0');
       const todayStr = `${year}-${month}-${day}`;
       if (todayStr > template.end_date) {
           this.update(template.id!, { status: 'archived' });
           return false;
       }
    }

    if (template.frequency_type === 'Weekly') {
      // getDay() 返回 0(周日) - 6(周六)
      // rule中 1-7 表示周一到周日
      let dayOfWeek = checkDate.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      return template.frequency_rule.includes(dayOfWeek);
    } 
    
    if (template.frequency_type === 'Monthly') {
      const dayOfMonth = checkDate.getDate();
      return template.frequency_rule.includes(dayOfMonth);
    }

    return false;
  }

  /** 
   * 手动为某一天生成任务 (如：今日跳过/休息日强行加入今天，或自动冷启动)
   */
  static async generateTaskForDay(template: HabitTemplate, targetDate: string): Promise<number> {
    const taskId = await TaskService.create({
      title: template.title,
      est_time: template.estimated_duration,
      tags: template.tags,
      status: TaskStatus.PENDING,
      date: targetDate,
      template_id: template.id,
      description: template.description || `从习惯模板 \`${template.title}\` 自动生成。`,
      difficulty: template.difficulty,
      confidence: template.confidence
    });
    
    // 增加生成次数
    const newCount = (template.generated_count || 0) + 1;
    await this.update(template.id, { generated_count: newCount });
    
    return taskId;
  }

  /**
   * 应用启动时的冷启动自动生成逻辑
   */
  static async bootstrapSync(targetDateStr?: string): Promise<boolean> {
    // 强制使用本地时区的日期 YYYY-MM-DD
    const localNow = new Date();
    const year = localNow.getFullYear();
    const month = String(localNow.getMonth() + 1).padStart(2, '0');
    const day = String(localNow.getDate()).padStart(2, '0');
    
    let todayStr = `${year}-${month}-${day}`;
    let targetDateObj = localNow;
    
    if (targetDateStr) {
      todayStr = targetDateStr;
      targetDateObj = new Date(targetDateStr + "T00:00:00");
    }

    const lastSync = localStorage.getItem('last_habit_sync_date');
    if (lastSync === todayStr) {
      // 今日已同步，直接返回
      return false;
    }

    // 获取所有活跃模板
    const activeTemplates = await this.getActive();

    for (const template of activeTemplates) {
      if (this.shouldGenerateToday(template, targetDateObj)) {
        // 防止防抖/并发导致的重复生成: 检查今天是否已经有该 template 的任务
        const todaysTasks = await TaskService.getByDate(todayStr);
        const alreadyGenerated = todaysTasks.some(t => t.template_id === template.id);
        
        if (!alreadyGenerated) {
          await this.generateTaskForDay(template, todayStr);
        }
      }
    }

    // 更新最后同步日期
    localStorage.setItem('last_habit_sync_date', todayStr);
    return true;
  }
}
