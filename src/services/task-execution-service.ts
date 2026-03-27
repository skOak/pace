import { TaskService } from './task-service';
import { ExecutionLogService } from './execution-log-service';
import { DailyAnchorService } from './daily-anchor-service';
import { TaskStatus, type Task } from '@/lib/types';

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
    await TaskService.update(taskId, { act_time: Math.round(totalTime) });
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
      await TaskService.update(taskId, { act_time: Math.round(totalTime) });
    }

    const today = new Date().toISOString().slice(0, 10);
    await DailyAnchorService.setEndAnchor(today);
    
    // 如果任务是从 PENDING 直接 COMPLETED 或从 PAUSED -> COMPLETED 都可以
    await TaskService.updateStatus(taskId, TaskStatus.COMPLETED);
  }
}
