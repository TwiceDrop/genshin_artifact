# 01: 引导清单与状态存储纯模块

**What to build:** 新建不依赖 Vue/DOM 的引导清单 `src/onboarding/guides.mjs` 和状态持久化模块 `src/onboarding/state.mjs`，并补齐单元测试。

**Blocked by:** None (can start immediately)

**Status:** done

规格见 `docs/specs/onboarding/spec.md` 的「引导清单与文案」和「模块边界」。

## 任务清单

- [x] 新建 `src/onboarding/guides.mjs`：
  - 导出 `ONBOARDING_GUIDES`（1 套 `quick-start` + 6 套 `detail-*`，文案与步骤按 `spec.md` 表格完整录入）
  - 导出纯查询函数：`getGuideById(id)`、`getQuickGuide()`、`getDetailGuides()`、`getGuideForRoute(path)`（按 `pageRoutes` 匹配当前页面对应的详细引导）
  - 模块不依赖 Vue、浏览器 API 或 Node 专有 API，浏览器与 Node 测试均可直接导入
- [x] 新建 `src/onboarding/state.mjs`：
  - 定义存储键 `ONBOARDING_STORAGE_KEY = 'mona.onboarding.v1'`
  - 导出 `loadOnboardingState(storage)`、`saveOnboardingState(state, storage)`、`markWelcomeDismissed(storage)`、`markGuideCompleted(guideId, storage)`、`resetOnboardingState(storage)`、`shouldShowWelcome({ state, firstUseDone, accountData })`
  - 复用 `src/platform/first-use.mjs` 的 `FIRST_USE_KEY`、`needsFirstUse`：当 `firstUseDone === true` 或 `state.welcomeDismissed === true` 时返回 `false`；按本次开发者确认，`markWelcomeDismissed` 只写入 `mona.onboarding.v1`，`mona.firstUseDone` 仅用于读取旧标记
  - `localStorage` 读写异常时记日志但不抛错阻塞
- [x] 新建 `tests/onboarding.test.mjs`：
  - 校验 `ONBOARDING_GUIDES`：ID 唯一、每个 guide 至少 1 步、所有步骤都有非空 `id`/`route`/`title`/`body`
  - 读真实的 `src/router/router.js`，校验所有步骤的 `route` 与 `pageRoutes` 均在路由表中存在
  - 测试 `state.mjs` 的读写、完成去重、重置进度、`mona.firstUseDone` 兼容、存储抛错降级
- [x] 验证：运行 `node --test tests/onboarding.test.mjs tests/first-use.test.mjs`

## Comments

已按定稿录入 7 套引导并实现设备进度存储。按开发者本次要求，旧键只读，关闭欢迎卡只写新键。指定两份 Node 测试共 9 项通过，覆盖路由、去重、重置及存储异常。

复核后按开发者确认，在引导存储入口校验 v1 结构。读取异常会记录原因并沿用会话进度；读取本身不改写异常内容。增加了结构异常、写入失败时保留会话进度、读取其他窗口最新状态的用例，最终指定两份测试共 12 项通过。
