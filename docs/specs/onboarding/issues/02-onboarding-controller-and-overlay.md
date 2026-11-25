# 02: 引导控制器与聚光灯遮罩组件

**What to build:** 实现跨页引导状态机 `src/onboarding/controller.mjs` 和双端适配的聚光灯遮罩组件 `src/onboarding/OnboardingOverlay.vue`，并在 `src/App.vue` 挂载。

**Blocked by:** 01

**Status:** done

规格见 `docs/specs/onboarding/spec.md` 的「跨页跳转、锚点定位与降级策略」和「双端与主题适配」。

## 任务清单

- [x] 新建 `src/onboarding/controller.mjs`：
  - 管理响应式状态：`hubOpen`、`welcomeOpen`、`activeGuideId`、`activeStepIndex`、`completedIds`、`locating`、`targetRect`、`fallbackCentered`
  - 导出操作方法：`openHub()`、`closeHub()`、`startGuide(guideId, router)`、`startGuideForRoute(path, router)`、`nextStep(router)`、`prevStep(router)`、`finishGuide()`、`stopGuide()`、`resetProgress()`
  - 切步骤时若目标路由与当前路由不同，先 `await router.push(step.route)`，再等待 `[data-tour="<anchor>"]` 渲染并可见（移动端 `!geSmall` 优先用 `step.mobileAnchor`，桌面端用 `step.anchor`，轮询上限 600ms）；找不到时设 `fallbackCentered = true`
  - 监听 `window` 的 `resize` 与 `scroll`（捕获阶段）动态刷新高亮框位置
  - 走完最后一步点击「完成」时调用 `markGuideCompleted` 并刷新 `completedIds`
- [x] 新建 `src/onboarding/OnboardingOverlay.vue`：
  - 激活时渲染全屏高 `z-index` 遮罩（高于侧栏 `1800` 和手机顶栏 `2000`，例如 `z-index: 3000`）
  - 有 `targetRect` 时绘制高亮框（带内边距）+ 周围暗色遮罩；`fallbackCentered` 为 `true` 时居中显示步骤卡片
  - 桌面端（`geSmall`）：卡片自动按目标周围剩余空间择优定位并限制在视口内；手机端（`!geSmall`）：卡片固定在底部并适配 `env(safe-area-inset-bottom)`
  - 卡片展示：所属引导名、步数进度（如 `2 / 5`）、步骤标题、正文、操作区（「上一步」「下一步 / 完成」「退出引导」）
  - 键盘支持：`ArrowRight` 下一步、`ArrowLeft` 上一步、`Escape` 退出；尊重 `prefers-reduced-motion: reduce`
  - 样式使用 `cx-scope` 与 `--cx-*` 变量，浅色/深色模式下均清晰可读
- [x] 在 `src/App.vue` 挂载 `<OnboardingOverlay />`
- [x] 验证：`node --test tests/onboarding.test.mjs` 与 `npm run build:local`

## Comments

已接入跨页控制器、可取消的锚点定位和双端聚光灯，支持键盘、滚动刷新及居中降级。指定 Node 测试 9 项通过，build:local 双包构建成功，均有 15 条编译警告。定位和键盘交互待浏览器实测。

复核后将跨页跳转排队，快速前进后回退会等待在途导航并定位最新步骤。控制器也会读取设备最新进度并响应其他窗口的写入。指定 Node 测试 12 项通过，真实浏览器中的快速切步与多标签页联动待手测。
