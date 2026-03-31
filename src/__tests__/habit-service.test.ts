import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { HabitService } from '@/services/habit-service';
import { TaskService } from '@/services/task-service';
import { TaskStatus } from '@/lib/types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('HabitService', () => {
  beforeEach(async () => {
    await db.habit_templates.clear();
    await db.tasks.clear();
    // 清除 localStorage 模拟
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CRUD operations', () => {
    it('should create and retrieve a habit template', async () => {
      const id = await HabitService.create({
        title: 'Morning Read',
        estimated_duration: 30,
        tags: ['Reading'],
        frequency_type: 'Weekly',
        frequency_rule: [1, 2, 3, 4, 5],
        status: 'active'
      });

      expect(id).toBeDefined();

      const habits = await HabitService.getAll();
      expect(habits).toHaveLength(1);
      expect(habits[0].title).toBe('Morning Read');
      
      const habit = await HabitService.getById(id);
      expect(habit).toBeDefined();
      expect(habit!.title).toBe('Morning Read');
    });

    it('should get only active habits', async () => {
      await HabitService.create({ title: 'A', frequency_type: 'Weekly', frequency_rule: [], status: 'active', estimated_duration: 10, tags: [] });
      await HabitService.create({ title: 'B', frequency_type: 'Weekly', frequency_rule: [], status: 'paused', estimated_duration: 10, tags: [] });

      const activeHabits = await HabitService.getActive();
      expect(activeHabits).toHaveLength(1);
      expect(activeHabits[0].title).toBe('A');
    });
  });

  describe('shouldGenerateToday', () => {
    // 假设某天是周一: 2026-03-30 是一周的周一
    const monday = new Date('2026-03-30T10:00:00.000Z');
    const tuesday = new Date('2026-03-31T10:00:00.000Z');

    it('should return true if weekly rule matches', () => {
      const template = {
        id: '1', title: 'Test', estimated_duration: 10, tags: [],
        frequency_type: 'Weekly' as const, frequency_rule: [1, 3], status: 'active' as const, created_at: new Date().toISOString()
      };
      // 周一
      expect(HabitService.shouldGenerateToday(template, monday)).toBe(true);
      // 周二
      expect(HabitService.shouldGenerateToday(template, tuesday)).toBe(false);
    });

    it('should return true if monthly rule matches', () => {
      const template = {
        id: '1', title: 'Test', estimated_duration: 10, tags: [],
        frequency_type: 'Monthly' as const, frequency_rule: [30, 31], status: 'active' as const, created_at: new Date().toISOString()
      };
      
      expect(HabitService.shouldGenerateToday(template, monday)).toBe(true);  // 30th
      expect(HabitService.shouldGenerateToday(template, tuesday)).toBe(true); // 31st
    });

    it('should return false if inactive', () => {
      const template = {
        id: '1', title: 'Test', estimated_duration: 10, tags: [],
        frequency_type: 'Weekly' as const, frequency_rule: [1, 2, 3], status: 'paused' as const, created_at: new Date().toISOString()
      };
      expect(HabitService.shouldGenerateToday(template, monday)).toBe(false);
    });

    it('should return false if end_type is occurrences and generated_count >= end_occurrences', () => {
      const template = {
        id: '1', title: 'Test', estimated_duration: 10, tags: [],
        frequency_type: 'Weekly' as const, frequency_rule: [1], status: 'active' as const, created_at: new Date().toISOString(),
        end_type: 'occurrences' as const, end_occurrences: 5, generated_count: 5
      };
      expect(HabitService.shouldGenerateToday(template, monday)).toBe(false);

      template.generated_count = 4;
      expect(HabitService.shouldGenerateToday(template, monday)).toBe(true);
    });

    it('should return false if end_type is date and date is passed', () => {
      const template = {
        id: '1', title: 'Test', estimated_duration: 10, tags: [],
        frequency_type: 'Weekly' as const, frequency_rule: [1], status: 'active' as const, created_at: new Date().toISOString(),
        end_type: 'date' as const, end_date: '2026-03-29'
      };
      // Today is 30th => already passed
      expect(HabitService.shouldGenerateToday(template, monday)).toBe(false);

      template.end_date = '2026-03-31';
      // Today is 30th => still valid
      expect(HabitService.shouldGenerateToday(template, monday)).toBe(true);
    });
  });

  describe('generateTaskForDay', () => {
    it('should create a task and increment generated_count', async () => {
      const templateId = await HabitService.create({
        title: 'Run', estimated_duration: 20, tags: ['Sport'],
        frequency_type: 'Weekly', frequency_rule: [1], status: 'active',
        generated_count: 2
      });

      const template = await HabitService.getById(templateId);
      const taskId = await HabitService.generateTaskForDay(template!, '2026-03-30');

      // 验证 Task 被创建
      const task = await TaskService.getById(taskId);
      expect(task).toBeDefined();
      expect(task!.title).toBe('Run');
      expect(task!.date).toBe('2026-03-30');
      expect(task!.template_id).toBe(templateId);

      // 验证 generated_count 增加了
      const updatedTemplate = await HabitService.getById(templateId);
      expect(updatedTemplate!.generated_count).toBe(3);
    });
  });

  describe('bootstrapSync', () => {
    it('should not sync twice in the same day', async () => {
      localStorage.setItem('last_habit_sync_date', '2026-03-30');
      const spy = vi.spyOn(HabitService, 'getActive');
      
      const result = await HabitService.bootstrapSync('2026-03-30');
      expect(result).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('should sync if last sync is empty or different day', async () => {
      // Create a habit that should fire today (Wednesday, e.g. Day 3)
      // fake target date: 2026-04-01 is a Wednesday (3)
      const targetDate = '2026-04-01';
      
      const templateId = await HabitService.create({
        title: 'Wed Read', estimated_duration: 10, tags: [],
        frequency_type: 'Weekly', frequency_rule: [3], status: 'active'
      });

      const result = await HabitService.bootstrapSync(targetDate);
      expect(result).toBe(true);

      // Verify task creation
      const tasks = await TaskService.getByDate(targetDate);
      expect(tasks).toHaveLength(1);
      expect(tasks[0].template_id).toBe(templateId);
      
      // Verify localstorage updated
      expect(localStorage.getItem('last_habit_sync_date')).toBe(targetDate);
    });
  });
});
