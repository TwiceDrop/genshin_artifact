# 08: 精简快速引导为 3 步不跨页导览

**What to build:** 将 `quick-start` 从 5 步跨页串讲精简为 3 步不跨页的「快速了解」，去掉欢迎卡里的「1 分钟」字样；其余 6 套详细引导保持不变。

**Blocked by:** 07

**Status:** done

规格见更新后的 `docs/specs/onboarding/spec.md`「首次欢迎卡文案」和「A. 快速引导：`quick-start`」。

## 任务清单

- [x] 更新 `src/onboarding/guides.mjs` 的 `quick-start`：
  - `title` 改为 `'快速了解'`
  - `summary` 改为 `'3 步认识导航与使用流程，各模块可按需单独查看详细引导。'`
  - `steps` 改为 3 步，均不设置路由跳转（`route: null`）：
    1. `anchor: 'nav.sidebar'`、`mobileAnchor: 'nav.mobile-bottom'` · `认识主要功能区`
    2. `anchor: null`（无锚点，居中展示） · `常见使用流程`
    3. `anchor: 'nav.guide'`、`mobileAnchor: 'nav.mobile-menu'` · `按模块查看详细引导`
  - 正文严格按 `spec.md` 表格录入；其余 6 套详细引导不变
- [x] 更新 `src/onboarding/controller.mjs`：
  - 支持 `step.route` 为空（`null`/`undefined`）时不触发 `router.push`，留在当前页
  - 支持无 `anchor`（桌面和手机均无锚点）时直接居中展示（`fallbackCentered = true`，不必等待 600ms 轮询超时）
- [x] 更新 `src/onboarding/OnboardingHubDialog.vue`：
  - 欢迎卡导语改为：`还没有圣遗物和预设。可以先 3 步快速了解核心用法，或直接导入已有数据。`
  - 欢迎卡主按钮改为：`快速了解（3 步）`
- [x] 更新 `tests/onboarding.test.mjs`：
  - 允许步骤的 `route` 与 `anchor` 为 `null`（仅对非空 `route` 校验路由表存在，仅对非空 `anchor`/`mobileAnchor` 校验模板中存在 `data-tour`）
  - 断言 `quick-start` 为 3 步且均不强制跳转路由
- [x] 验证：运行 `node --test tests/onboarding.test.mjs tests/first-use.test.mjs` 与 `npm run build:local`（构建后如 `src/components.d.ts` 有自动生成改动，提交前还原）

## Comments
