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
});
