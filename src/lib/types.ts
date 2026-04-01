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
  [TaskStatus.COMPLETED]: [TaskStatus.PENDING, TaskStatus.RUNNING],
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
  /** Markdown 描述/笔记 */
  description?: string;
  /** 难度星级 (1, 2, 3) */
  difficulty?: number;
  /** 信心指数 (true: 😎, false: 🤔) */
  confidence?: boolean;
  /** 首次设定的预估时长，作为快照不再更改 */
  initial_estimated_duration?: number;
  /** 评价/复盘内容 */
  comments?: string;
  /** 关联的习惯模板 ID */
  template_id?: string;
  /** 漏卡/跳过原因 (仅在 EXPIRED 状态时有意义) */
  skip_reason?: 'external' | 'voluntary';
  /** 长线目标 ID (Sprint 11) */
  goal_id?: string;
  /** 是否为目标的执行片段 (Sprint 11) */
  is_session?: boolean;
}

/** 创建任务时的输入参数（省略自动生成的字段） */
export interface CreateTaskInput {
  title: string;
  est_time?: number;
  act_time?: number;
  tags?: string[];
  is_school_done?: boolean;
  date?: string;
  status?: TaskStatus;
  description?: string;
  difficulty?: number;
  confidence?: boolean;
  initial_estimated_duration?: number;
  comments?: string;
  template_id?: string;
  goal_id?: string;
  is_session?: boolean;
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

/** 习惯模板表接口 */
export interface HabitTemplate {
  /** UUID 主键 */
  id: string;
  /** 标题 */
  title: string;
  /** 默认预估时长（分钟） */
  estimated_duration: number;
  /** 标签 */
  tags: string[];
  /** 频率类型：Weekly 或 Monthly */
  frequency_type: 'Weekly' | 'Monthly';
  /** 触发规则，如 [1, 3, 5] 代表周一三五 */
  frequency_rule: number[];
  /** 结束重复类型：无、按日期、按次数 (Sprint 10 后续补充) */
  end_type?: 'never' | 'date' | 'occurrences';
  /** 设定的结束日期 YYYY-MM-DD */
  end_date?: string;
  /** 设定的结束次数 */
  end_occurrences?: number;
  /** 已经生成的次数计数器 */
  generated_count?: number;
  /** 模板状态：活跃、暂停、已归档 */
  status: 'active' | 'paused' | 'archived';
  /** 任务 Markdown 详情 (指引) */
  description?: string;
  /** 难度预估 (1-5) */
  difficulty?: number;
  /** 信心指数 (成竹在胸/需要思考) */
  confidence?: boolean;
  /** 创建时间 (ISO 8601) */
  created_at: string;
}

/** 目标状态枚举 */
export enum GoalStatus {
  ACTIVE = 'ACTIVE',
  DONE = 'DONE',
  ARCHIVED = 'ARCHIVED',
}

/** 长线目标主表接口 */
export interface Goal {
  /** UUID 主键 */
  id: string;
  /** 目标标题 */
  title: string;
  /** Markdown 内容/项目说明 */
  description?: string;
  /** 总预估分钟数 */
  total_estimated_duration: number;
  /** 截止日期 YYYY-MM-DD 或 ISO */
  deadline?: string;
  /** 难度星级 (1, 2, 3) */
  difficulty?: number;
  /** 自信度 (把握度) */
  confidence?: boolean;
  /** 当前状态 */
  status: GoalStatus;
  /** 创建时间 (ISO 8601) */
  created_at: string;
  /** 更新时间 (ISO 8601) */
  updated_at?: string;
}

/** 目标评论表接口 */
export interface GoalComment {
  /** UUID 主键 */
  id: string;
  /** 关联的目标 ID */
  goal_id: string;
  /** 评论角色（孩子/家长） */
  user_role: string;
  /** 评论内容 */
  content: string;
  /** 创建时间 (ISO 8601) */
  created_at: string;
}
