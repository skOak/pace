import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { TaskService } from '@/services/task-service';
import { TaskStatus } from '@/lib/types';

describe('TaskService', () => {
  // 每个测试前清空数据库
  beforeEach(async () => {
    await db.tasks.clear();
    await db.execution_logs.clear();
    await db.daily_anchors.clear();
  });

  describe('create', () => {
    it('应能创建任务并返回 ID', async () => {
      const id = await TaskService.create({ title: '数学作业' });
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
    });

    it('创建的任务默认状态为 DRAFT', async () => {
      const id = await TaskService.create({ title: '语文作业' });
      const task = await TaskService.getById(id);
      expect(task).toBeDefined();
      expect(task!.status).toBe(TaskStatus.DRAFT);
    });

    it('应正确设置默认字段', async () => {
      const id = await TaskService.create({ title: '英语作业' });
      const task = await TaskService.getById(id);
      expect(task!.est_time).toBe(0);
      expect(task!.act_time).toBe(0);
      expect(task!.tags).toEqual([]);
      expect(task!.is_school_done).toBe(false);
      expect(task!.date).toBe(new Date().toISOString().slice(0, 10));
    });

    it('应支持自定义字段', async () => {
      const id = await TaskService.create({
        title: '物理作业',
        est_time: 45,
        tags: ['物理', '实验'],
        date: '2026-03-26',
        status: TaskStatus.PENDING,
      });
      const task = await TaskService.getById(id);
      expect(task!.est_time).toBe(45);
      expect(task!.tags).toEqual(['物理', '实验']);
      expect(task!.date).toBe('2026-03-26');
      expect(task!.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('getByDate', () => {
    it('应按日期筛选任务', async () => {
      await TaskService.create({ title: '任务A', date: '2026-03-25' });
      await TaskService.create({ title: '任务B', date: '2026-03-26' });
      await TaskService.create({ title: '任务C', date: '2026-03-26' });

      const tasks = await TaskService.getByDate('2026-03-26');
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => t.title).sort()).toEqual(['任务B', '任务C']);
    });
  });

  describe('getByStatus', () => {
    it('应按状态筛选任务', async () => {
      await TaskService.create({ title: '草稿A' });
      await TaskService.create({ title: '草稿B' });
      await TaskService.create({ title: '待办C', status: TaskStatus.PENDING });

      const drafts = await TaskService.getByStatus(TaskStatus.DRAFT);
      expect(drafts).toHaveLength(2);

      const pending = await TaskService.getByStatus(TaskStatus.PENDING);
      expect(pending).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('应更新任务字段', async () => {
      const id = await TaskService.create({ title: '旧标题' });
      await TaskService.update(id, { title: '新标题', est_time: 60 });

      const task = await TaskService.getById(id);
      expect(task!.title).toBe('新标题');
      expect(task!.est_time).toBe(60);
    });

    it('更新不存在的任务应抛错', async () => {
      await expect(TaskService.update(999, { title: '不存在' })).rejects.toThrow(
        '任务不存在'
      );
    });

    it('更改 est_time 且之前无初始预估时，应自动完成认知快照备份', async () => {
      const id = await TaskService.create({ title: '快照测试', est_time: 25 });
      let task = await TaskService.getById(id);
      expect(task!.initial_estimated_duration).toBeUndefined();

      await TaskService.update(id, { est_time: 40 });
      
      task = await TaskService.getById(id);
      expect(task!.est_time).toBe(40);
      expect(task!.initial_estimated_duration).toBe(25); // 存下了之前的预估时长

      // 再次修改时长时，初始快照不应被覆盖
      await TaskService.update(id, { est_time: 50 });
      task = await TaskService.getById(id);
      expect(task!.est_time).toBe(50);
      expect(task!.initial_estimated_duration).toBe(25);
    });

    it('支持 Sprint 9 各扩展字段读写', async () => {
      const id = await TaskService.create({ 
        title: '拓展字段', 
        description: '任务详情',
        difficulty: 3,
        confidence: true,
        template_id: 'habits-123'
      });
      let task = await TaskService.getById(id);
      
      expect(task!.description).toBe('任务详情');
      expect(task!.difficulty).toBe(3);
      expect(task!.confidence).toBe(true);
      expect(task!.template_id).toBe('habits-123');

      await TaskService.update(id, { comments: '这是复盘' });
      task = await TaskService.getById(id);
      expect(task!.comments).toBe('这是复盘');
    });
  });

  describe('delete', () => {
    it('应删除任务', async () => {
      const id = await TaskService.create({ title: '待删除' });
      await TaskService.delete(id);
      const task = await TaskService.getById(id);
      expect(task).toBeUndefined();
    });

    it('删除不存在的任务应抛错', async () => {
      await expect(TaskService.delete(999)).rejects.toThrow('任务不存在');
    });
  });

  describe('updateStatus（状态流转）', () => {
    it('DRAFT → PENDING 应成功', async () => {
      const id = await TaskService.create({ title: '测试' });
      await TaskService.updateStatus(id, TaskStatus.PENDING);
      const task = await TaskService.getById(id);
      expect(task!.status).toBe(TaskStatus.PENDING);
    });

    it('PENDING → RUNNING 应成功', async () => {
      const id = await TaskService.create({ title: '测试', status: TaskStatus.PENDING });
      await TaskService.updateStatus(id, TaskStatus.RUNNING);
      const task = await TaskService.getById(id);
      expect(task!.status).toBe(TaskStatus.RUNNING);
    });

    it('RUNNING → PAUSED 应成功', async () => {
      const id = await TaskService.create({ title: '测试', status: TaskStatus.PENDING });
      await TaskService.updateStatus(id, TaskStatus.RUNNING);
      await TaskService.updateStatus(id, TaskStatus.PAUSED);
      const task = await TaskService.getById(id);
      expect(task!.status).toBe(TaskStatus.PAUSED);
    });

    it('PAUSED → RUNNING 恢复应成功', async () => {
      const id = await TaskService.create({ title: '测试', status: TaskStatus.PENDING });
      await TaskService.updateStatus(id, TaskStatus.RUNNING);
      await TaskService.updateStatus(id, TaskStatus.PAUSED);
      await TaskService.updateStatus(id, TaskStatus.RUNNING);
      const task = await TaskService.getById(id);
      expect(task!.status).toBe(TaskStatus.RUNNING);
    });

    it('RUNNING → COMPLETED 应成功', async () => {
      const id = await TaskService.create({ title: '测试', status: TaskStatus.PENDING });
      await TaskService.updateStatus(id, TaskStatus.RUNNING);
      await TaskService.updateStatus(id, TaskStatus.COMPLETED);
      const task = await TaskService.getById(id);
      expect(task!.status).toBe(TaskStatus.COMPLETED);
    });

    it('DRAFT → RUNNING 应抛错（非法转换）', async () => {
      const id = await TaskService.create({ title: '测试' });
      await expect(
        TaskService.updateStatus(id, TaskStatus.RUNNING)
      ).rejects.toThrow('非法状态转换');
    });

    it('COMPLETED → RUNNING 应成功（支持重启任务）', async () => {
      const id = await TaskService.create({ title: '测试', status: TaskStatus.PENDING });
      await TaskService.updateStatus(id, TaskStatus.RUNNING);
      await TaskService.updateStatus(id, TaskStatus.COMPLETED);
      await TaskService.updateStatus(id, TaskStatus.RUNNING);
      const updated = await TaskService.getById(id);
      expect(updated?.status).toBe(TaskStatus.RUNNING);
    });

    it('EXPIRED 为终态不可转换', async () => {
      const id = await TaskService.create({ title: '测试', status: TaskStatus.PENDING });
      await TaskService.updateStatus(id, TaskStatus.EXPIRED);
      await expect(
        TaskService.updateStatus(id, TaskStatus.RUNNING)
      ).rejects.toThrow('非法状态转换');
    });
  });
  describe('expireOverdueTasks', () => {
    it('应将过去的未完成任务自动标记为 EXPIRED', async () => {
      // 创建昨日任务（应被过期）
      const id1 = await TaskService.create({ title: '昨日待办', date: '2026-03-25', status: TaskStatus.PENDING });
      const id2 = await TaskService.create({ title: '昨日执行中', date: '2026-03-25', status: TaskStatus.RUNNING });
      // 创建今日任务（不应被过期）
      const today = new Date().toISOString().slice(0, 10);
      const id3 = await TaskService.create({ title: '今日待办', date: today, status: TaskStatus.PENDING });
      // 创建昨日已完成任务（不应被过期）
      const id4 = await TaskService.create({ title: '昨日已完成', date: '2026-03-25', status: TaskStatus.COMPLETED });

      await db.tasks.update(id1, { status: TaskStatus.PENDING });
      await db.tasks.update(id2, { status: TaskStatus.RUNNING });
      await db.tasks.update(id3, { status: TaskStatus.PENDING });
      await db.tasks.update(id4, { status: TaskStatus.COMPLETED });

      const expiredCount = await TaskService.expireOverdueTasks();
      
      expect(expiredCount).toBe(2);
      
      const t1 = await TaskService.getById(id1);
      const t2 = await TaskService.getById(id2);
      const t3 = await TaskService.getById(id3);
      const t4 = await TaskService.getById(id4);
      
      expect(t1!.status).toBe(TaskStatus.EXPIRED);
      expect(t2!.status).toBe(TaskStatus.EXPIRED);
      expect(t3!.status).toBe(TaskStatus.PENDING); // 今日任务不受影响
      expect(t4!.status).toBe(TaskStatus.COMPLETED); // 已完成任务不受影响
    });
  });
});
