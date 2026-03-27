import { describe, it, expect } from 'vitest';
import { calculateRemainingTime, calculateForecastTime, calculateDeviationRatio } from '../lib/forecast-utils';
import { Task, TaskStatus } from '../lib/types';

describe('forecast-utils', () => {

  const baseTask: Task = {
    id: 1,
    title: 'Test',
    est_time: 30,
    act_time: 0,
    status: TaskStatus.PENDING,
    tags: [],
    is_school_done: false,
    date: '2026-03-27',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  describe('calculateRemainingTime', () => {
    it('对于 PENDING 任务，剩余时间等于预估时间', () => {
      expect(calculateRemainingTime({ ...baseTask, status: TaskStatus.PENDING })).toBe(30);
    });

    it('对于 PAUSED 任务，剩余时间等于预估时间减去实际已用时间', () => {
      expect(calculateRemainingTime({ ...baseTask, status: TaskStatus.PAUSED, act_time: 10 })).toBe(20);
    });

    it('如果实际用时超过预估用时，剩余时间应为 0', () => {
      expect(calculateRemainingTime({ ...baseTask, status: TaskStatus.PAUSED, act_time: 40 })).toBe(0);
    });

    it('对于 COMPLETED / EXPIRED / DRAFT 任务，剩余时间为 0', () => {
      expect(calculateRemainingTime({ ...baseTask, status: TaskStatus.COMPLETED, act_time: 10 })).toBe(0);
      expect(calculateRemainingTime({ ...baseTask, status: TaskStatus.EXPIRED, act_time: 10 })).toBe(0);
      expect(calculateRemainingTime({ ...baseTask, status: TaskStatus.DRAFT })).toBe(0);
    });
  });

  describe('calculateForecastTime', () => {
    it('根据未完成任务正确推算结束时间', () => {
      const tasks = [
        { ...baseTask, id: 1, status: TaskStatus.COMPLETED, est_time: 30, act_time: 30 }, // remaining 0
        { ...baseTask, id: 2, status: TaskStatus.PENDING, est_time: 45 },                 // remaining 45
        { ...baseTask, id: 3, status: TaskStatus.PAUSED, est_time: 30, act_time: 10 },    // remaining 20
      ];
      
      const currentTime = new Date('2026-03-27T10:00:00.000Z');
      const forecast = calculateForecastTime(tasks, currentTime);
      
      // 总计还需要 65 分钟
      const expectedTime = new Date('2026-03-27T11:05:00.000Z');
      expect(forecast.getTime()).toBe(expectedTime.getTime());
    });
  });

  describe('calculateDeviationRatio', () => {
    it('正确计算偏差率', () => {
      expect(calculateDeviationRatio({ ...baseTask, est_time: 30, act_time: 15 })).toBe(0.5);
      expect(calculateDeviationRatio({ ...baseTask, est_time: 30, act_time: 45 })).toBe(1.5);
      expect(calculateDeviationRatio({ ...baseTask, est_time: 30, act_time: 30 })).toBe(1.0);
    });

    it('处理除以 0 的情况', () => {
      expect(calculateDeviationRatio({ ...baseTask, est_time: 0, act_time: 15 })).toBe(Number.POSITIVE_INFINITY);
      expect(calculateDeviationRatio({ ...baseTask, est_time: 0, act_time: 0 })).toBe(0);
    });
  });

});
