# 03: 首次欢迎卡与引导中心弹窗（替换 FirstUseDialog）

**What to build:** 新建 `src/onboarding/OnboardingHubDialog.vue`，合并首次欢迎卡与常驻引导中心，替换 `src/components/FirstUseDialog.vue` 挂入 `src/App.vue`。

**Blocked by:** 01, 02

**Status:** done

规格见 `docs/specs/onboarding/spec.md` 的「入口设计」「首次欢迎卡文案」「弹窗排队与不打扰规则」。

## 任务清单

- [x] 新建 `src/onboarding/OnboardingHubDialog.vue`：
  - **首次欢迎卡模式**：
    - 复用原 `FirstUseDialog.vue` 的数据检查与排队逻辑：进入非 `/login`、非 `/setup#export-data`、非 `/import` 路由后判断一次；等待 `usageStatsNotice` 关闭；检查本机所有本地账号的 `mona_account_artifacts_<id>` 和 `mona_account_presets_<id>`；调用 `shouldShowWelcome` 决定是否显示
    - 检查云端登录状态（沿用 `cloudApi('config')`），决定「从云端账号导入」按钮是否展示
    - 提供 3 个主动作：
      1. `开始快速上手（约 1 分钟）`：标记欢迎已关闭，关闭弹窗并 `startGuide('quick-start', router)`
      2. `先导入我的数据`：展开或切换显示 3 个导入按钮（云端 `/online-account`、UID `/uid-data`、圣遗物文件 `/artifacts?import=1`），点击后标记欢迎已关闭并跳转
      3. `先自己逛逛`：标记欢迎已关闭，关闭弹窗，提示可随时在侧栏「使用引导」或设置页重新打开
  - **引导中心模式**（由 `controller.hubOpen` 控制）：
    - 顶部展示「快速上手」卡片（标题、简介、预计 5 步、是否已完成标签、「开始 / 再看一遍」按钮）
    - 下方以卡片/列表展示 6 套详细引导（标题、简介、步数、已完成标记、点击立即关闭中心并启动对应引导）
    - 底部提供「重置引导进度」按钮（调用 `resetProgress()`，仅清空引导完成状态，不改动任何账号数据）
    - 桌面端与手机端宽度自适应（`min(680px, 94vw)`），支持浅色/深色主题
- [x] 更新 `src/App.vue`：用 `<OnboardingHubDialog />` 替换 `<FirstUseDialog />`
- [x] 删除已不再被引用的 `src/components/FirstUseDialog.vue`（保留 `src/platform/first-use.mjs` 供 `state.mjs` 和既有单测继续使用）
- [x] 验证：`node --test tests/onboarding.test.mjs tests/first-use.test.mjs` 与 `npm run build:local`

## Comments

已替换首次弹窗，按路由、统计提示和所有本地账号的数据排队；引导中心支持开始、重看与重置。旧弹窗的组件类型声明一并移除。指定 Node 测试 9 项通过，build:local 成功（有编译警告）。首次弹出、导入跳转与视觉效果待人工实测。

登录与备份导出沿用命名路由判定，兼容带尾斜杠的入口；读取账号后再次确认本机欢迎标记。欢迎卡与引导中心在减少动态效果模式下关闭进出动画。
