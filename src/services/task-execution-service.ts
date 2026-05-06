import { TaskService } from './task-service';
import { ExecutionLogService } from './execution-log-service';
import { DailyAnchorService } from './daily-anchor-service';
import { TaskStatus, type Task, type ExecutionLog } from '@/lib/types';
import { db } from '@/lib/db';

/**
 * TaskExecutionService
 * 统筹排他逻辑、时长累加和每日操作锚点。
 */
export class TaskExecutionService {
  /**
   * 获取当前正在执行（RUNNING）的任务
   */
  static async getRunningTask(): Promise<Task | undefined> {
    const runningTasks = await TaskService.getByStatus(TaskStatus.RUNNING);
    return runningTasks.length > 0 ? runningTasks[0] : undefined;
  }

  /**
   * 开始/继续执行一个任务
   * 会自动暂停正在执行的其他任务，并记录每日锚点
   */
  static async startTask(taskId: number, currentRunningId?: number): Promise<void> {
    const task = await TaskService.getById(taskId);
    if (!task) throw new Error(`任务不存在: id=${taskId}`);

    if (task.status === TaskStatus.RUNNING) {
      return; // 已经是在执行状态，直接返回（防止因前端状态延迟导致的重复调用报错）
    }

    // 如果指定的 currentRunningId 存在并且正在运行，则暂停它
    if (currentRunningId && currentRunningId !== taskId) {
      await this.pauseTask(currentRunningId);
    }
    
    // 或者做个双重检查，防止前端没有传递 currentRunningId，但本身有其他 RUNNING 任务
    const runningTask = await this.getRunningTask();
    if (runningTask && runningTask.id !== taskId) {
      await this.pauseTask(runningTask.id as number);
    }

    // 更新任务日期为今天的运行起步锚点
    const today = new Date().toISOString().slice(0, 10);
    await DailyAnchorService.setStartAnchor(today);

    // 开始执行记录
    await ExecutionLogService.startLog(taskId);
    await TaskService.updateStatus(taskId, TaskStatus.RUNNING);
  }

  /**
   * 暂停一个任务
   * 结束当前的时间记录片段，并计算累加时间到 act_time
   */
  static async pauseTask(taskId: number): Promise<void> {
    const task = await TaskService.getById(taskId);
    if (!task || task.status !== TaskStatus.RUNNING) {
      return; // 只有在运行中的才能暂停
    }
    
    // 寻找没有 endTime 的 log
    const logs = await ExecutionLogService.getByTaskId(taskId);
    const activeLog = logs.find(log => !log.endTime);
    
    if (activeLog && activeLog.id) {
      await ExecutionLogService.endLog(activeLog.id);
    }

    // 重新计算该任务的实际耗时
    const totalTime = await ExecutionLogService.calculateTotalTime(taskId);
    await TaskService.update(taskId, { act_time: totalTime });
    await TaskService.updateStatus(taskId, TaskStatus.PAUSED);
  }

  /**
   * 完成任务
   * 将强制暂停当前执行片段并更新为已完成状态
   */
  static async completeTask(taskId: number): Promise<void> {
    const task = await TaskService.getById(taskId);
    if (!task) throw new Error(`任务不存在: id=${taskId}`);

    if (task.status === TaskStatus.RUNNING) {
      // 寻找没有 endTime 的 log
      const logs = await ExecutionLogService.getByTaskId(taskId);
      const activeLog = logs.find(log => !log.endTime);
      if (activeLog && activeLog.id) {
        await ExecutionLogService.endLog(activeLog.id);
      }
      const totalTime = await ExecutionLogService.calculateTotalTime(taskId);
      await TaskService.update(taskId, { act_time: totalTime });
    }

    const today = new Date().toISOString().slice(0, 10);
    await DailyAnchorService.setEndAnchor(today);
    
    await TaskService.updateStatus(taskId, TaskStatus.COMPLETED);
  }

  /**
   * 过期今日未完成的任务（用于 22:00 强制打烊）
   */
  static async expireTodayUnfinishedTasks(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const states = [TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.PAUSED];
    let count = 0;
    
    for (const status of states) {
      const tasks = await TaskService.getByStatus(status);
      const todayTasks = tasks.filter(t => t.date === today);
      
      for (const t of todayTasks) {
        if (t.id) {
          if (t.status === TaskStatus.RUNNING) {
             await this.pauseTask(t.id);
          }
          await TaskService.updateStatus(t.id, TaskStatus.EXPIRED);
          count++;
        }
      }
    }
    
    if (count > 0) {
       await DailyAnchorService.setEndAnchor(today);
    }
    return count;
  }

  /**
   * 检查时间区间是否与当天其他任务的记录冲突
   */
  static async checkTimeConflict(taskId: number | undefined, start: Date, end: Date, dateStr: string): Promise<Task | null> {
    const allTasks = await TaskService.getByDate(dateStr);
    const otherTasks = allTasks.filter(t => t.id !== taskId);
    if (otherTasks.length === 0) return null;

    const otherTaskIds = otherTasks.map(t => t.id as number);
    const otherLogs = await ExecutionLogService.getByTaskIds(otherTaskIds);

    const checkStartMs = start.getTime();
    const checkEndMs = end.getTime();

    for (const log of otherLogs) {
      const logStartMs = new Date(log.startTime).getTime();
      const logEndMs = log.endTime ? new Date(log.endTime).getTime() : new Date().getTime(); // 如果是正在运行，当做目前为止

      // 重叠条件：新的开始时间早于旧的结束时间，且新的结束时间晚于旧的开始时间
      if (checkStartMs < logEndMs && checkEndMs > logStartMs) {
         // 发生冲突，返回冲突的任务
         return otherTasks.find(t => t.id === log.taskId) || null;
      }
    }
    return null;
  }

  /**
   * 追溯编辑任务的开始与结束时间（直接覆盖）
   */
  static async updateRetroactiveTime(taskId: number, start: Date, end: Date): Promise<void> {
    const task = await TaskService.getById(taskId);
    if (!task) throw new Error(`任务不存在: id=${taskId}`);

    const dateStr = start.toISOString().slice(0, 10);
    const conflictTask = await this.checkTimeConflict(taskId, start, end, dateStr);
    if (conflictTask) {
      throw new Error(`该时间段你正在执行 [${conflictTask.title}]，请先调整该任务。`);
    }

    // 删除当前任务所有的执行记录
    const existingLogs = await ExecutionLogService.getByTaskId(taskId);
    for (const log of existingLogs) {
       if (log.id) await db.execution_logs.delete(log.id);
    }

    // 重新创建一个覆盖全局的记录
    const newLog: ExecutionLog = {
       taskId,
       startTime: start.toISOString(),
       endTime: end.toISOString(),
    };
    await db.execution_logs.add(newLog);

    const actTime = (end.getTime() - start.getTime()) / (1000 * 60);
    await TaskService.update(taskId, {
       act_time: actTime,
       is_adjusted: true,
       adjustment_reason: '手动追溯修正'
    });
  }

  /**
   * 创建补录任务
   */
  static async createRetroactiveTask(title: string, start: Date, end: Date): Promise<number> {
    const dateStr = start.toISOString().slice(0, 10);
    const conflictTask = await this.checkTimeConflict(undefined, start, end, dateStr);
    if (conflictTask) {
      throw new Error(`该时间段你正在执行 [${conflictTask.title}]，请先调整该任务。`);
    }

    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

    // 先创建一个已完成任务
    const taskId = await TaskService.create({
      title,
      date: dateStr,
      status: TaskStatus.COMPLETED,
      est_time: duration,
      act_time: duration,
      tags: [],
      is_school_done: false,
      is_adjusted: true,
      adjustment_reason: '时间轴补录'
    });

    const newLog: ExecutionLog = {
       taskId,
       startTime: start.toISOString(),
       endTime: end.toISOString(),
    };
    await db.execution_logs.add(newLog);
    
    // 更新锚点
    await DailyAnchorService.setStartAnchor(dateStr);
    await DailyAnchorService.setEndAnchor(dateStr);

    return taskId;
  }

  /**
   * 幽灵计时器检测
   * 主动挂起超过 4 小时未停止的任务
   */
  static async suspendGhostTimers(): Promise<Task[]> {
    const runningTasks = await TaskService.getByStatus(TaskStatus.RUNNING);
    const ghostTasks: Task[] = [];
    const now = new Date().getTime();

    for (const task of runningTasks) {
      if (!task.id) continue;
      const logs = await ExecutionLogService.getByTaskId(task.id);
      const activeLog = logs.find(log => !log.endTime);

      if (activeLog) {
         const startMs = new Date(activeLog.startTime).getTime();
         const hoursDiff = (now - startMs) / (1000 * 60 * 60);

         if (hoursDiff > 4) {
            // 挂起它
            await ExecutionLogService.endLog(activeLog.id!);
            const totalTime = await ExecutionLogService.calculateTotalTime(task.id);
            await TaskService.update(task.id, { 
               act_time: totalTime,
               is_adjusted: true, // 标记为被系统打断调整
               adjustment_reason: '运行超过4小时自动挂起' 
            });
            await TaskService.updateStatus(task.id, TaskStatus.PAUSED);
            ghostTasks.push(task);
         }
      }
    }
    return ghostTasks;
  }
}
