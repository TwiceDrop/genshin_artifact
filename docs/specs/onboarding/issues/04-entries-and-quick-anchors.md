# 04: 常驻入口与全局导航锚点

**What to build:** 在侧栏、设置页与各核心页顶栏接入常驻引导入口，并补齐快速引导所需的全局导航锚点。

**Blocked by:** 02, 03

**Status:** done

规格见 `docs/specs/onboarding/spec.md` 的「入口设计」和「快速引导：`quick-start`」。

## 任务清单

- [x] 新建 `src/onboarding/PageGuideButton.vue`：
  - 接收 `guideId: string`（可选 `label`，默认 `aria-label="查看本页引导"`、`title="查看本页引导"`）
  - 渲染与当前页面顶栏风格一致的低调 `?` 图标按钮（浅色/深色主题清晰可见），点击调用 `startGuide(props.guideId, router)`
- [x] 更新 `src/pages/MainPage/SideBar.vue`：
  - 给侧栏容器加 `data-tour="nav.sidebar"`
  - 在「其他」分组（导出工具汇总下方）新增「使用引导」按钮（加 `data-tour="nav.guide"`），点击关闭手机抽屉（如在抽屉内）并调用 `openHub()`
- [x] 更新 `src/pages/MainPage/MainPage.vue`：
  - 给手机端顶部菜单按钮加 `data-tour="nav.mobile-menu"`
  - 给手机端底部导航栏加 `data-tour="nav.mobile-bottom"`
- [x] 更新 `src/pages/SetupPage/SetupPage.vue`：
  - 在设置列表卡片中新增「使用引导」一行，提供「打开引导中心」与「重置引导进度」按钮
- [x] 在核心页面顶栏放置 `<PageGuideButton />`：
  - `src/pages/NewArtifactPlanPage/CalcTopBar.vue`（`detail-calculate`）
  - `src/pages/ArtifactsPage/ArtifactsPage.vue`（`detail-artifacts`）
  - `src/components/import/MiyousheImport.vue`（`detail-import`）
  - `src/pages/TeamOptimizationPage/TeamOptimizationWrapper.vue`（`detail-team-dps`）
  - `src/pages/CalculationHistoryPage.vue`（`detail-history`）
  - `src/pages/KumiPage/KumiPage.vue`（`detail-artifacts`）
- [x] 验证：`npm run build:local`

## Comments

已接入桌面侧栏、手机抽屉和设置页，引导清单中有详细引导的页面均有独立问号入口。圣遗物页打开仓库引导，角色页和导出工具页打开导入引导。build:local 成功，有编译警告。实际点击入口、关闭抽屉与窄屏布局待手测。
