# Pace 开发计划 - Sprint 11: 长线目标与进度管理 (Goals & Sessions)

## 1. 产品核心原则 (First Principles)
* **拆解认知偏差：** 大任务必须通过“认领片段 (Session)”来执行。严禁直接对一个跨度超 24 小时的模糊目标进行计时。
* **信息对齐：** 目标详情是行动的指引。通过 Markdown 存储背景资料，确保每次执行片段都有据可依。
* **反馈长效化：** 评论交互不仅是沟通工具，更是对长线执行过程的心理建设和进度微调。

---

## 2. 功能清单 (Task List)

### 2.1 长线目标看板与编辑器 (Goal Editor)
* **独立看板：** 增加「目标」TAB，展示所有活跃的长线项目。
* **深度属性编辑器：** 为 Goal 增加与任务/习惯一致的编辑组件。
    * **基础信息：** 标题、总预估时长、截止日期、优先级、难度。
    * **富文本详情：** 支持 Markdown 格式，用于存储项目说明、参考链接（支持视频嵌入）、图片附件。
    * **把握度 (Confidence)：** 记录创建初期对达成目标的信心。

### 2.2 任务片段认领逻辑 (Session Pulling)
* **拉取执行：** 在「今天」页面，用户可以从活跃目标中“提取”一个片段。
* **自动化关联：** 片段 Task 完成后，其实际用时自动核销 Goal 的剩余工作量。
* **进度同步：** 修改 Goal 的总时长或截止日期时，系统需实时更新其下所有 Session 的进度背景。

### 2.3 进度评论与交互 (Comment Interaction)
* **进度日记：** 目标详情页下方增加评论区。
* **交互场景：** * **反馈：** 家长对阶段性进度进行点评（如：“这周进度过半了，节奏控制得很好”）。
    * **自省：** 孩子记录遇到的瓶颈（如：“查资料花了太多时间，总时长可能需要增加”）。
* **记录追溯：** 所有的评论按时间线排列，形成该目标的执行全记录。

### 2.4 燃尽图与预警系统 (Pace Warning)
* **视觉反馈：** 在目标卡片展示“时间流逝”与“任务完成度”的双轨对比。
* **动态修正：** 若剩余工作量在剩余时间内无法按当前 Pace 完成，系统在目标详情页显著位置显示“节奏修正建议”。

---

## 3. UI 布局规划 (UI Layouts)

### 3.1 目标详情页 (Goal Detail Page)
采用类似 Sprint 9 的分栏布局，但侧重于**进度管理**：
* **顶栏：** 巨大的进度条（已耗时 vs 剩余量）和倒计时。
* **左侧区域：** Markdown 项目说明、嵌入的学习资源（视频/文档）。
* **右侧区域：** * **执行记录：** 列表展示已完成的各个 Session 片段及耗时。
    * **评论区：** 底部固定的输入框，展示家长与孩子的交互对话。

### 3.2 目标编辑弹窗 (Goal Editor Modal)
* **复用组件：** 复用任务编辑器的 UI 逻辑。
* **特有项：** 增加“截止日期选择器”和“总工作量预估”。

---

## 4. 数据库 Schema 变更建议 (For Agent Reference)

### 新增 Goals 表：
* `id`: UUID
* `title`: String
* `description`: String (Markdown 内容)
* `total_estimated_duration`: Integer (总预估分钟)
* `deadline`: Timestamp (截止日期)
* `difficulty`: Integer (1-3 星)
* `confidence`: Boolean (把握度)
* `status`: Enum (ACTIVE, DONE, ARCHIVED)
* `created_at`: Timestamp

### 新增 GoalComments 表：
* `id`: UUID
* `goal_id`: String (关联目标)
* `user_role`: String (孩子/家长)
* `content`: String (评论内容)
* `created_at`: Timestamp

### Tasks 表更新：
* `goal_id`: String (外键，关联所属目标)
* `is_session`: Boolean (标记是否为目标的执行片段)