import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../lib/db';
import { GoalService } from '../services/goal-service';
import { TaskStatus } from '../lib/types';
import { TaskService } from '../services/task-service';

describe('GoalService', () => {
  beforeEach(async () => {
    await db.goals.clear();
    await db.goal_comments.clear();
    await db.tasks.clear();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('should create and retrieve a goal', async () => {
    const goalId = await GoalService.create({
      title: 'Test Goal',
      total_estimated_duration: 300,
      difficulty: 2,
    });
    expect(goalId).toBeDefined();

    const goal = await GoalService.getById(goalId);
    expect(goal).toBeDefined();
    expect(goal?.title).toBe('Test Goal');
    expect(goal?.total_estimated_duration).toBe(300);
    expect(goal?.difficulty).toBe(2);
  });

  it('should calc progress based on completed session tasks', async () => {
    const goalId = await GoalService.create({
      title: 'Progress Goal',
      total_estimated_duration: 100,
    });

    // Create session task 1 (completed, act_time 30)
    await TaskService.create({
      title: 'Session 1',
      est_time: 30,
      act_time: 30,
      goal_id: goalId,
      is_session: true,
      status: TaskStatus.COMPLETED
    });

    // Create session task 2 (pending, act_time 0)
    await TaskService.create({
      title: 'Session 2',
      est_time: 20,
      act_time: 0,
      goal_id: goalId,
      is_session: true,
      status: TaskStatus.PENDING
    });

    // Create session task 3 (completed, act_time 45)
    await TaskService.create({
      title: 'Session 3',
      est_time: 40,
      act_time: 45,
      goal_id: goalId,
      is_session: true,
      status: TaskStatus.COMPLETED
    });

    const progress = await GoalService.getGoalProgress(goalId);
    expect(progress).toBe(75); // 30 + 45
  });

  it('should add and retrieve comments', async () => {
    const goalId = await GoalService.create({
      title: 'Comment Goal',
      total_estimated_duration: 100,
    });

    await GoalService.addComment(goalId, 'child', 'Started');
    await new Promise(resolve => setTimeout(resolve, 5));
    await GoalService.addComment(goalId, 'parent', 'Good job');

    const comments = await GoalService.getComments(goalId);
    expect(comments).toHaveLength(2);
    // ordered by created_at desc if we want, but getComments returns asc in db usually unless specified
    // GoalService.getComments should return them
    expect(comments[0].content).toBe('Started');
    expect(comments[1].content).toBe('Good job');
  });
});
