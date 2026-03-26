# Pace MVP 开发计划 (Local-First 架构版)

## 1. 核心技术栈 (Tech Stack)
* **框架:** Next.js (React) + Tailwind CSS + shadcn/ui
* **存储:** **Dexie.js** (IndexedDB 封装，本地优先)
* **部署:** 静态托管于 Ubuntu (Nginx)

---

## Sprint 1: 浏览器数据库与存储服务 (The Brain)
**目标：** 在浏览器中建立可靠的结构化存储，支持后续所有状态流转。

* **核心任务：**
  1. 使用 Dexie.js 初始化 `PaceDB`。
  2. **表结构定义：**
     * `tasks`: id, title, est_time, act_time, status (DRAFT/PENDING/RUNNING/PAUSED/COMPLETED/EXPIRED), tags, is_school_done。
     * `execution_logs`: id, taskId, startTime, endTime (记录计时的物理片段)。
     * `daily_anchors`: date (YYYY-MM-DD), start_anchor, end_anchor。
  3. 封装基础 CRUD 方法供 UI 调用。

* **给 Agent 的指令：**
  > "请使用 Dexie.js 创建一个名为 PaceDB 的数据库类。定义 Tasks, ExecutionLogs 和 DailyAnchors 三个表。请确保字段支持任务的状态流转和累计时长计算。提供基本的增删改查 API 接口。"

* **验收标准：** 在浏览器开发者工具的 IndexedDB 面板中能看到创建的表，且刷新页面数据不丢失。

---

## Sprint 2: 任务看板与基础交互 (The Body)
**目标：** 构建用户界面，实现任务的视觉管理。

* **核心任务：**
  1. **Today 视图：** 渲染任务卡片列表，区分“执行中”、“待办”和“已完成”。
  2. **创建任务：** 实现一个 Dialog 弹窗，支持录入任务名、预估时间（分钟）和标签。
  3. **Inbox 视图：** 简单列表展示状态为 `DRAFT` 的任务。
  4. 响应式适配：确保在手机端浏览器也能顺畅操作。

* **给 Agent 的指令：**
  > "请基于 Next.js 和 shadcn/ui 创建首页布局。实现 Today 页面，能够从 Dexie 读取并展示今日任务。提供一个浮动按钮，点击后弹出 Dialog 录入新任务，并持久化到本地数据库。"

* **验收标准：** 能够手动录入 3 条作业，并在“今天”清单中准确显示。

---

## Sprint 3: 计时引擎与排他逻辑 (The Heart)
**目标：** 实现最核心的“单任务运行”与“锚点记录”。

* **核心任务：**
  1. **排他执行逻辑：** 点击“开始”任务 A 时，如果任务 B 正在 `RUNNING`，弹出二次确认弹窗。确认后，任务 B 设为 `PAUSED` 并记录 `endTime`，任务 A 设为 `RUNNING`。
  2. **时长累加：** 每次暂停或结束时，自动计算本次 `startTime` 到 `endTime` 的差值，累加到该任务的 `act_time`。
  3. **锚点记录：** 每天第一个任务进入 `RUNNING` 时，自动写入 `daily_anchors.start_anchor`。

* **给 Agent 的指令：**
  > "请实现任务的状态机转换逻辑。关键点：同一时间只能有一个任务处于 RUNNING 状态。开启新任务必须暂停旧任务并准确计算已用时长。同时，请在用户开启每日首个任务时，记录 start_anchor 时间点。"

* **验收标准：** 切换任务时会有弹窗确认；多次暂停/恢复后，任务的总实际用时计算正确。

---

## Sprint 4: 数据迁移与生命周期 (Security)
**目标：** 确保数据可备份，并处理任务的“过期”状态。

* **核心任务：**
  1. **备份功能：** 实现一键导出 `pace_backup.json`（包含库内所有表数据）。
  2. **恢复功能：** 支持上传 JSON 文件并全量覆盖本地 IndexedDB。
  3. **自动过期：** 每次应用启动时，检查非当日且未完成的任务，将其状态更新为 `EXPIRED`。
  4. **校内补录：** 实现“在校已完成”勾选逻辑，仅录入实际用时，不触发计时器。

* **给 Agent 的指令：**
  > "请为应用增加数据备份功能。编写一个 exportService 将所有 Dexie 表转为 JSON 文件下载。同时实现 importService。此外，请实现一个生命周期钩子，在每日首次加载时将昨天的未完成任务标记为 EXPIRED。"

* **验收标准：** 导出的 JSON 文件可以成功在另一个浏览器中恢复数据。

---

## Sprint 5: 效率洞察与收尾预测 (The Spirit)
**目标：** 将捕获的数据转化为对小朋友有用的“节奏感”反馈。

* **核心任务：**
  1. **偏差分析：** 在任务卡片上显示 `实际/预估` 的效率百分比。
  2. **收尾预测 (Pace Forecast)：** 实时计算：`当前时间 + 所有待办任务预估总时长 = 预计结束时间`。
  3. **简单复盘：** 在页面顶部显示今日已坚持的总时长和启动积极度（start_anchor）。

* **给 Agent 的指令：**
  > "请在 Today 页面顶部添加一个‘预计收尾时间’的显示。该时间需要根据当前剩余任务的预估量动态刷新。同时，请在 Insight 页面展示一个简单的列表，对比每项任务的预估和实际时长偏差。"

* **验收标准：** 首页能实时看到“还要多久能做完作业”的预测数值；完成任务后能直观看到自己预估得准不准。