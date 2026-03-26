# Pace 技术选型与架构演进方案 (v1.0)

## 1. 核心架构理念
* **本地优先 (Local-First)：** 前期数据完全存储在用户浏览器，实现零服务器成本、极致隐私。
* **逻辑与存储分离：** 业务逻辑（Service 层）不直接绑定存储实现，确保后期从浏览器存储迁移到云端数据库时“无痛”。
* **跨端一致性：** 保持一份 Web 代码，通过工具链（Tauri/Capacitor）快速转化为桌面和移动端应用。

---

## 2. 第一阶段：本地优先 Web 版 (MVP)
**目标：** 利用用户浏览器资源，实现零后端运维。

### 2.1 技术栈
* **前端框架：** Next.js (React) + Tailwind CSS + shadcn/ui。
  * *理由：* 响应式布局完美，Agent 对此技术栈的代码生成质量最高。
* **浏览器数据库：** **Dexie.js** (IndexedDB 的高级封装)。
  * *理由：* 提供了类似 ORM 的 API，支持事务和结构化查询，后期迁移至 SQL 数据库时逻辑改动最小。
* **服务器部署：** 静态托管 (Nginx/Ubuntu)。
  * *理由：* 服务器仅下发 HTML/JS/CSS，不处理业务数据，压力几乎为零。

### 2.2 数据备份机制
* **JSON 导出：** 一键将 Dexie 数据库序列化为 `.json` 文件下载到本地。
* **JSON 导入：** 支持上传备份文件，解析并覆盖本地数据库，实现“手动同步”。

---

## 3. 第二阶段：跨端 CS 架构演进
**目标：** 从网页应用进化为拥有原生体验的桌面/移动客户端。

### 3.1 跨端工具链
* **桌面端 (macOS/Windows)：Tauri**。
  * *理由：* 比 Electron 更轻量，直接打包现有 Web 代码，支持系统通知、开机自启和原生窗口控制。
* **移动端 (iOS/Android)：Capacitor**。
  * *理由：* 将 Web App 快速封装为原生 App，支持调用摄像头（用于 OCR）和推送。

### 3.2 存储升级 (云端同步)
* **后端服务：** Hono 或 Next.js API Routes (部署在 Ubuntu 服务器)。
* **ORM 映射：Prisma**。
  * *理由：* 定义一份 `schema.prisma`，即可同时适配本地开发的 SQLite 和生产环境的 PostgreSQL。
* **云端数据库：** PostgreSQL。
* **数据迁移路径：** 1. 开发一个“同步”功能，将本地 Dexie 数据通过 API 推送至服务器。
  2. 服务器校验并写入 PostgreSQL。
  3. 客户端切换为“云端优先”模式，使用 TanStack Query 处理数据缓存。

---

## 4. 核心数据表结构 (Schema)
无论是在浏览器还是服务器，均维持以下逻辑结构：

| 表名 | 关键字段 | 说明 |
| :--- | :--- | :--- |
| **Tasks** | `id`, `title`, `est_time`, `act_time`, `status`, `tags`, `is_school_done` | 任务主表 |
| **ExecutionLogs** | `id`, `taskId`, `startTime`, `endTime` | 记录每次点击开始/暂停的片段，计算总用时 |
| **DailyAnchors** | `date`, `start_anchor`, `end_anchor` | 记录每日行为锚点 |

---

## 5. 给 Agent 的开发指令建议 (Prompt Strategy)

### 第一步：初始化本地数据库 (Storage Service)
> "请使用 Dexie.js 为 Pace 应用创建一个本地存储 Service。定义 Tasks, ExecutionLogs 和 DailyAnchors 三个表。实现基础的 CRUD 方法，并预留出后期接入 API 接口的抽象层。"

### 第二步：实现导入导出逻辑
> "基于 Dexie.js 的 Service，编写两个工具函数：`exportToJSON` 将所有数据导出为本地文件；`importFromJSON` 接受用户上传的文件并恢复数据库。确保导入前有备份提示。"

### 第三步：UI 与 Service 绑定
> "请使用 Next.js 和 shadcn/ui 创建 Today 页面。所有的状态修改（如开始/暂停任务）必须通过之前定义的 Dexie Service 进行，确保数据持久化在 IndexedDB 中。"

---

## 6. 无痛迁移 Checklist
1. **统一数据格式：** 所有时间戳统一使用 ISO 8601 格式字符串。
2. **逻辑下沉：** 不要把计时逻辑写在 React 组件里，全部写在独立的 Service 类中。
3. **版本控制：** 在数据库中增加一个 `version` 字段，防止未来数据结构升级时发生冲突。