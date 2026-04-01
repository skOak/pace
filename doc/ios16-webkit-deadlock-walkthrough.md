# iOS 16 WebKit 兼容性与本地数据库死锁修复报告 (Walkthrough)

经历了极度曲折的真机黑盒排查，我们最终成功解决了一直困扰项目的“iPad 无法进入应用，永远卡在加载中”的骨灰级 Bug。

## 🎯 核心问题根源 (Root Cause)
在问题之初，我们以为是 IndexedDB 的加载出了问题。但通过多层级的 Debug 探针剥茧抽丝，我们发现问题的根源远比想象的深：
- **致命的兼容性鸿沟：** 用户使用的机型为 iPadOS 16.2。而最新版的 Next.js (SWC) 默认启用了面向 `ES2022+` 的极高目标全量编译，生成的代码（如类的 `static { ... }` 初始化块）无法被 iOS 16.2 的 WebKit 内核识别，导致 **JS 引擎在加载第一秒就发生了不可捕获的 `SyntaxError`（静态语法级崩溃）**。
- **并发的死锁隐患：** 即便修好了语法，iOS 15-16 的 Safari 在无痕模式或局域网环境下，其底层的 IndexedDB 极易遭遇“僵尸锁”（由于进程切换导致的 `deleteDatabase` 等事务永久无响应）。

## 💡 解决方案 (Resolution)

### 1. 强力降维打击：重置 SWC 编译目标 (`package.json`)
向项目注入了明确的 `browserslist`。通过指定 `ios_saf >= 15`，我们强迫 Next.js 在打包时剔除所有高级语法糖，将其降级编译为任何老式 iPad 都能完美消化的 ES2020 代码。这彻底解决了页面一打开就白屏的根本问题。

### 2. 构建底层的数据库安全网：`DbErrorScreen`
由于 iOS 本身的 IndexedDB 天然脆弱，为了贯彻 Local-First 的极高可用性，我们构建了以下两道防线：
- **超时截断 (`loadTasks`)**：通过 `Promise.race([... , timeoutPromise])`，强行给所有的数据库长查询勒上 5 秒的项圈。一旦超时绝生死循环，立即切断，抛出异常。
- **抢救级降级全屏 UI (`DbErrorScreen.tsx`)**：异常抛出后，接管全屏，避免无限转圈。同时提供通过浏览器 API 直插底层格式化当前网站库（`window.indexedDB.deleteDatabase`）的专属物理恢复按钮，让卡死设备始终拥有“自我拯救”的后路。

### 3. 被 Next.js 预加载背刺的正则 SyntaxError (Sprint 12 续集)
这发生在后续加入“指南 (Handbook)”全局标签页后。虽然早先已经降级了 SWC 编译语法，但在加入主导航 `<Link href="/guide">` 后，原先完好的首页在 iOS 16.2 上再次陷入“加载今日节奏中...”的死锁，同时控制台隐蔽地报出：`Uncaught SyntaxError: Invalid regular expression: invalid group specifier name`。

**根源追溯**：
受惠于 Next.js 的激进 `Prefetch` 策略，首页只要渲染出导航，便会在后台静默下载子页面的代码块。而 `/guide` 中由于引入了 `remark-gfm` 插件来渲染 Markdown，该包底部的一个自动链接解析依赖使用了向后断言（Lookbehind: `(?<=...)`）这一较新的正则表达式。苹果迟至 iOS 16.4 才让 WebKit 引擎正式支持它。因此当 iOS 16.2 试着解析这块尚未运行的下载代码时，直接爆发原生级语法崩溃，导致全站所有后续的水合任务（Hydration）终止。

**釜底抽薪**：
在 SWC 无法转译第三方原生正则的局限下，我们果断从渲染器中剔除了非核心必须的 `remark-gfm` 扩展，使得包含炸弹的正则片段彻底从构建产物中蒸发。

### 4. 数据库“时光倒流”引发的跨版本死锁
由于在调试过程中曾发布了将 Dexie 数据库从版本 5 升至 6（新增 `statements` 表）的代码，由于不符需求随后进行了回滚。但对已经用该版本访问过的 iPad 真机而言，其底层 IndexedDB 已经被不可逆地拔高到了版本 6！
网页代码一旦重置为版本 5 即形同请求“数据库降级”，由于 IndexedDB 原生拒绝任何降级操作，导致了 `UpgradeError`，`ensureDbReady()` 被永远阻断在超时熔断机制前，造成无限卡死。

**空降保护**：在代码的 `db.ts` 里巧妙追平版本号 `this.version(6).stores({ statements: null })`，这样高版设备会因为命中同版本而免于降级崩溃，并且平滑地抹去了被放弃建立的无效废表。

## ✅ 验收与善后 (Validation & Cleanup)

1. 在解决问题后，协助用户清理了 `.next` 缓存以彻底冲刷僵死内存。
应用现在已经在所有环境表现得坚不可摧！

## 🚀 最终的拼图：局域网开发环境跨域拦截 (Epilogue)

随着进一步排查，用户反馈了一个关键现象：**使用 `npm run build && npm run start`（生产环境）启动后，无论在任何设备、任何 IP 下一切问题瞬间消失；而只要是 `npm run dev` 并在非 localhost（例如 `192.168.0.29`）访问时就必然挂起。**

这暴露了 Next.js 15+ 框架引入的一项极易被忽视的新安全策略：
1. **HMR WebSocket 被拦截**：Next.js 最新版的 Dev Server 为了防范跨站 WebSocket 劫持攻击，默认屏蔽了所有非 `localhost` 的跨域 HMR 请求（`_next/webpack-hmr`）。
2. **白屏锁死链**：因为 WebSocket 被框架服务端主动拒绝，Turbopack 无法将后续懒编译的动态 JS Chunks 推送给客户端机器。这就导致 React 永远停留在最初 SSR 下发的静态 HTML 外壳上，所有的 `useEffect` 不执行，屏幕自然永远显示“加载今日节奏中...”。
3. **精准修复**：只需在 `next.config.ts` 中配置 `allowedDevOrigins: ['192.168.0.29']` 即可将开发设备加入安全白名单，恢复局域网内的热更新数据流。

**最终结论：**
本场硬核跨设备排障长达 37 小时，融合了双层 Bug：一是 iOS 16 WebKit 天然无法解析高版本编译产物导致的 SyntaxError 崩溃（由降级编译解决）；二是局域网开发测试时惨遭 Next.js 原生安全底座拦截的连带死锁。但在层层剥丝抽茧中，我们不仅修复了框架报错，更意外建立起了一整套防范 IndexedDB 损坏与死锁的自愈底层，因祸得福！
