/**
 * Pace 核心类型定义
 * 所有时间戳统一使用 ISO 8601 格式字符串，便于后期迁移至云端数据库
 */

/** 任务状态枚举 */
export enum TaskStatus {
  /** 草稿：仅有内容，无时间属性 */
  DRAFT = 'DRAFT',
  /** 待执行：已分配日期与预估时长 */
  PENDING = 'PENDING',
  /** 执行中：计时器正在运行 */
  RUNNING = 'RUNNING',
  /** 已暂停：执行中断 */
  PAUSED = 'PAUSED',
  /** 已完成：任务准时或延时完成 */
  COMPLETED = 'COMPLETED',
  /** 已过期：到达截止日期仍未完成 */
  EXPIRED = 'EXPIRED',
}

/**
 * 合法的状态流转映射
 * key: 当前状态, value: 允许转换到的目标状态列表
 */
export const VALID_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.DRAFT]: [TaskStatus.PENDING],
  [TaskStatus.PENDING]: [TaskStatus.RUNNING, TaskStatus.EXPIRED],
  [TaskStatus.RUNNING]: [TaskStatus.PAUSED, TaskStatus.COMPLETED],
  [TaskStatus.PAUSED]: [TaskStatus.RUNNING, TaskStatus.COMPLETED, TaskStatus.EXPIRED],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.EXPIRED]: [],
};

/** 任务主表接口 */
export interface Task {
  /** 自增主键 */
  id?: number;
  /** 任务标题 */
  title: string;
  /** 预估时长（分钟） */
  est_time: number;
  /** 实际累计运行时间（分钟） */
  act_time: number;
  /** 当前状态 */
  status: TaskStatus;
  /** 标签数组，用于多维洞察分析 */
  tags: string[];
  /** 是否在校内完成 */
  is_school_done: boolean;
  /** 所属日期 (YYYY-MM-DD)，用于按日筛选 */
  date: string;
  /** 创建时间 (ISO 8601) */
  created_at: string;
  /** 更新时间 (ISO 8601) */
  updated_at: string;
}

/** 创建任务时的输入参数（省略自动生成的字段） */
export interface CreateTaskInput {
  title: string;
  est_time?: number;
  tags?: string[];
  is_school_done?: boolean;
  date?: string;
  status?: TaskStatus;
}

/** 更新任务时的可选字段 */
export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'created_at'>>;

/** 执行记录表接口：记录每次点击开始/暂停的片段 */
export interface ExecutionLog {
  /** 自增主键 */
  id?: number;
  /** 关联的任务 ID */
  taskId: number;
  /** 本次执行开始时间 (ISO 8601) */
  startTime: string;
  /** 本次执行结束时间 (ISO 8601)，运行中为 undefined */
  endTime?: string;
}

/** 每日行为锚点表接口 */
export interface DailyAnchor {
  /** 日期 (YYYY-MM-DD)，作为主键 */
  date: string;
  /** 当日首次任务启动时间 (ISO 8601) */
  start_anchor?: string;
  /** 当日末次任务结束时间 (ISO 8601) */
  end_anchor?: string;
}
