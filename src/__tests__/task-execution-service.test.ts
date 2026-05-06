import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { TaskService } from '@/services/task-service';
import { TaskExecutionService } from '@/services/task-execution-service';
import { DailyAnchorService } from '@/services/daily-anchor-service';
import { ExecutionLogService } from '@/services/execution-log-service';
import { TaskStatus } from '@/lib/types';

describe('TaskExecutionService', () => {
  beforeEach(async () => {
    // 每次测试前清空本地数据库
    await db.tasks.clear();
    await db.execution_logs.clear();
    await db.daily_anchors.clear();
  });

  const createDummyTask = async () => {
    return await TaskService.create({ title: 'Test Task', est_time: 25, status: TaskStatus.PENDING });
  };

  it('获取执行中的任务 (getRunningTask) 应该正常工作', async () => {
    const taskId = await createDummyTask();
    
    // 尚未运行，应当返回 undefined
    let runningTask = await TaskExecutionService.getRunningTask();
    expect(runningTask).toBeUndefined();

    // 手动设为运行时
    await TaskService.updateStatus(taskId, TaskStatus.RUNNING);
    runningTask = await TaskExecutionService.getRunningTask();
    expect(runningTask?.id).toBe(taskId);
  });

  it('起步新任务 (startTask) 并正确记录状态与锚点', async () => {
    const taskId = await createDummyTask();
    await TaskExecutionService.startTask(taskId);

    const task = await TaskService.getById(taskId);
    expect(task?.status).toBe(TaskStatus.RUNNING);

    // 验证生成了 execution log
    const logs = await ExecutionLogService.getByTaskId(taskId);
    expect(logs.length).toBe(1);
    expect(logs[0].endTime).toBeUndefined();

    // 验证生成了 daily anchor
    const today = new Date().toISOString().slice(0, 10);
    const anchor = await DailyAnchorService.get(today);
    expect(anchor?.start_anchor).toBeDefined();
  });

  it('排他性：启动一个新任务时，应当自动暂停正在运行的任务', async () => {
    const task1Id = await createDummyTask();
    const task2Id = await createDummyTask();

    // 启动任务 1
    await TaskExecutionService.startTask(task1Id);

    // 启动任务 2
    await TaskExecutionService.startTask(task2Id, task1Id);

    const task1 = await TaskService.getById(task1Id);
    const task2 = await TaskService.getById(task2Id);

    // 任务 1 应被标记为 PAUSED
    expect(task1?.status).toBe(TaskStatus.PAUSED);
    // 任务 2 应当是 RUNNING
    expect(task2?.status).toBe(TaskStatus.RUNNING);

    // 任务 1 的执行片段应被补齐 endTime
    const logs1 = await ExecutionLogService.getByTaskId(task1Id);
    expect(logs1[0].endTime).toBeDefined();
  });

  it('暂停任务 (pauseTask) 应保存执行耗时', async () => {
    const taskId = await createDummyTask();
    await TaskExecutionService.startTask(taskId);

    // 模拟暂停
    await TaskExecutionService.pauseTask(taskId);

    const task = await TaskService.getById(taskId);
    expect(task?.status).toBe(TaskStatus.PAUSED);
    
    // 我们在这里仅验证 act_time 更新逻辑已被调用
    expect(task?.act_time).toBeGreaterThanOrEqual(0);

    const logs = await ExecutionLogService.getByTaskId(taskId);
    expect(logs[0].endTime).toBeDefined();
  });

  it('完成任务 (completeTask) 应记录 end_anchor 并且记录总时间', async () => {
    const taskId = await createDummyTask();
    await TaskExecutionService.startTask(taskId);
    
    await TaskExecutionService.completeTask(taskId);

    const task = await TaskService.getById(taskId);
    expect(task?.status).toBe(TaskStatus.COMPLETED);

    // 验证每日末次锚点记录
    const today = new Date().toISOString().slice(0, 10);
    const anchor = await DailyAnchorService.get(today);
    expect(anchor?.end_anchor).toBeDefined();
  });
  describe('Sprint 18 - Retroactive Correction & Ghost Timers', () => {
    it('checkTimeConflict 应正确检测时间交集', async () => {
      // 任务 1: 10:00 - 11:00
      const task1Id = await TaskExecutionService.createRetroactiveTask('Task 1', new Date('2026-05-06T10:00:00'), new Date('2026-05-06T11:00:00'));
      
      // 测试冲突：10:30 - 11:30 (与 Task 1 交集)
      const conflict1 = await TaskExecutionService.checkTimeConflict(undefined, new Date('2026-05-06T10:30:00'), new Date('2026-05-06T11:30:00'), '2026-05-06');
      expect(conflict1).not.toBeNull();
      expect(conflict1?.id).toBe(task1Id);

      // 测试不冲突：11:00 - 12:00 (接壤但不交集)
      const conflict2 = await TaskExecutionService.checkTimeConflict(undefined, new Date('2026-05-06T11:00:00'), new Date('2026-05-06T12:00:00'), '2026-05-06');
      expect(conflict2).toBeNull();
    });

    it('createRetroactiveTask 应创建标记有 is_adjusted 的已完成任务', async () => {
      const start = new Date('2026-05-06T09:00:00');
      const end = new Date('2026-05-06T09:30:00');
      const taskId = await TaskExecutionService.createRetroactiveTask('Retro Task', start, end);
      
      const task = await TaskService.getById(taskId);
      expect(task?.status).toBe(TaskStatus.COMPLETED);
      expect(task?.is_adjusted).toBe(true);
      expect(task?.adjustment_reason).toBe('时间轴补录');
      expect(task?.act_time).toBe(30);

      const logs = await ExecutionLogService.getByTaskId(taskId);
      expect(logs.length).toBe(1);
      expect(logs[0].startTime).toBe(start.toISOString());
      expect(logs[0].endTime).toBe(end.toISOString());
    });

    it('updateRetroactiveTime 应覆写所有的历史记录并重置 act_time', async () => {
      const taskId = await createDummyTask();
      // 模拟一些零碎记录
      await db.execution_logs.add({ taskId, startTime: '2026-05-06T08:00:00', endTime: '2026-05-06T08:10:00' });
      await db.execution_logs.add({ taskId, startTime: '2026-05-06T08:20:00', endTime: '2026-05-06T08:30:00' });
      
      const newStart = new Date('2026-05-06T08:00:00');
      const newEnd = new Date('2026-05-06T09:00:00');
      await TaskExecutionService.updateRetroactiveTime(taskId, newStart, newEnd);

      const task = await TaskService.getById(taskId);
      expect(task?.is_adjusted).toBe(true);
      expect(task?.act_time).toBe(60);

      const logs = await ExecutionLogService.getByTaskId(taskId);
      expect(logs.length).toBe(1);
      expect(logs[0].startTime).toBe(newStart.toISOString());
      expect(logs[0].endTime).toBe(newEnd.toISOString());
    });

    it('suspendGhostTimers 应自动挂起超过4小时的运行任务', async () => {
      const taskId = await createDummyTask();
      await TaskService.updateStatus(taskId, TaskStatus.RUNNING);
      
      const now = new Date();
      // 伪造一条 5 小时前的进行中记录
      const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      await db.execution_logs.add({ taskId, startTime: fiveHoursAgo.toISOString() });

      const ghosts = await TaskExecutionService.suspendGhostTimers();
      expect(ghosts.length).toBe(1);
      expect(ghosts[0].id).toBe(taskId);

      const task = await TaskService.getById(taskId);
      expect(task?.status).toBe(TaskStatus.PAUSED);
      expect(task?.is_adjusted).toBe(true);
      expect(task?.adjustment_reason).toBe('运行超过4小时自动挂起');

      const logs = await ExecutionLogService.getByTaskId(taskId);
      expect(logs[0].endTime).toBeDefined(); // 应当已被终止
    });
  });
});
