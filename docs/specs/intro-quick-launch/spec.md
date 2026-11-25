# 欢迎页开屏收束与功能快速入口

Status: done

## 背景与目标

当前欢迎页（`src/pages/about/IntroPage/IntroPage.vue`）只展示全屏星盘、莫娜头像、「莫娜占卜铺」标题、GitHub 链接与版本/更新区。

本次改造目标：
1. **阶段一（开屏亮相）**：进入欢迎页先完整展示当前的星空、星盘、居中的莫娜头像与「莫娜占卜铺」大标题。
2. **阶段二（向上收束 + 功能入口浮现）**：短暂停留后，莫娜头像与「莫娜占卜铺」**作为一个整体同步向上平移并缩小**停靠在页面上方，同时页面中央浮现**功能快速前往入口**卡片，点击可直接跳转到对应功能页。

## 交互与动画设计

### 1. 两阶段状态机

在 `IntroPage.vue` 中维护阶段状态 `phase: 'splash' | 'ready'`：

- **冷启动进入（`onMounted`）**：
  - 若系统开启 `prefers-reduced-motion: reduce`，跳过阶段一，初始直接为 `'ready'`。
  - 否则初始为 `'splash'`，等待约 `950ms`（等原有入场动画 `wl-rise` 完成并停留片刻）后自动切换到 `'ready'`。
  - 处于 `'splash'` 期间，允许用户点击欢迎页任意空白处或按 `Enter` / `Space` 立即提前切换到 `'ready'`（避免熟练用户被迫等待）。
  - 组件卸载（`onBeforeUnmount`）时清理定时器。
- **同会话切回首页**：
  - `MainPage.vue` 对 `<router-view>` 包了 `<keep-alive>`，切去其他页面再回到 `/intro` 时不会重新触发 `onMounted`，保持在 `'ready'` 状态，直接显示功能入口，不重复播放开屏等待。

### 2. 视觉与动效方案（避免字号动画抖动和模糊）

核心原则：**只对 `transform` 和 `opacity` 做过渡**，不做 `font-size` 动画，也不做「小图放大」（放大文字会发虚），而是以**开屏大尺寸渲染，收束时向下 `scale` 缩小**：

- **品牌区 `.welcome-hero`（头像 + 店名同一容器）**：
  - 将 `MonaPortrait` 与 `<h1 class="welcome-name">` 放入同一个 `.welcome-hero` 容器内，保证二者同步运动、相对比例不变。
  - 设置 `transform-origin: center top`。
  - `splash` 状态：居中停在视口中部（`scale(1)`）。
  - `ready` 状态：使用 `transition: transform 0.72s cubic-bezier(0.22, 1, 0.36, 1)` 平滑上移到顶部停靠区并缩小（桌面端约 `scale(0.46)`，移动端约 `scale(0.56)`，具体按容器尺寸通过 CSS 变量 `--wl-hero-scale` 微调，保证收束后不裁切、不与卡片重叠）。
- **星盘 `.welcome-dial`**：
  - `splash` 状态：保持当前居中展示。
  - `ready` 状态：同步随品牌区小幅上移并降低透明度（如 `opacity: 0.42`），保留星空氛围同时不干扰中间卡片文字可读性。
- **功能快速入口 `.welcome-launch`**：
  - 放在正常文档流中，顶部通过 `padding-top: var(--wl-hero-dock-height)` 为收束后的品牌区预留空间。
  - `splash` 状态：`opacity: 0; transform: translateY(24px) scale(0.97); pointer-events: none;`。
  - `ready` 状态：在品牌开始收束约 `160ms` 后浮现（`opacity: 1; transform: translateY(0) scale(1); pointer-events: auto;`），每张卡片按索引做 `40ms` 递增的错峰入场（`transition-delay: calc(160ms + var(--i) * 40ms)`），时长 `0.48s cubic-bezier(0.22, 1, 0.36, 1)`。
- **底部信息区（GitHub 链接、版本号、检查更新）**：
  - 保持在页面底部，不与功能入口重叠。
  - 桌面端：GitHub 链接可随入口下方居中排布或留在底部居中，版本号与更新开关保持左右底角；当视口较矮时页面可自然纵向滚动，不截断内容。
  - 移动端（`max-width: 767px`）：保持现有纵向排布并避开底部 60px 导航栏。

## 功能快速入口配置

入口列表复用 `src/pages/MainPage/SideBar.vue` 的路由、图标与已有 i18n 文案（**不新增未经确认的说明小字**）：

| 顺序 | 路由 | 文案来源 | 图标（与侧栏一致） |
| --- | --- | --- | --- |
| 1 | `/calculate` | `t('nav.calculate')`（计算器） | `~icons/ep/data-analysis` |
| 2 | `/team-optimization` | `t('nav.teamOptimize')`（多人优化） | `~icons/ep/connection` |
| 3 | `/uid-data` | `t('misc.character')`（角色） | `~icons/ep/user-filled` |
| 4 | `/artifacts` | `t('nav.artifact')`（圣遗物） | `~icons/ep/box` |
| 5 | `/artifacts-kumi` | `t('nav.kumi')`（圣遗物套装） | `~icons/ep/collection` |
| 6 | `/calculation-history` | `历史记录` | `~icons/ep/clock` |

布局与交互：
- 桌面端：3 列 × 2 行网格（居中，`max-width: 760px`），卡片内包含图标 + 标题 + 右侧轻箭头或悬停金边高亮。
- 窄屏 / 手机端：2 列 × 3 行网格，触控区域高度不小于 `56px`。
- 使用原生 `<button type="button">` 实现卡片，支持键盘 `Tab` 聚焦、`Enter`/`Space` 跳转，并保留 `focus-visible` 金色描边。
- 点击卡片调用 `router.push(item.path)`。

> 说明：若开发者后续希望在每张卡片标题下方增加一句简介小字，或增删入口（如加入「导出工具 `/help/export-tools`」「本地账户 `/account`」「设置 `/setup`」），需先确认具体文案后再补入。

## 配色与主题约定

颜色变量统一追加在 `src/styles/welcome-palette.css` 的 `.wl-palette` 与 `html[data-color-mode="dark"] .wl-palette` 中（登录页共用 `.wl-palette`，只增不改原有变量）：

- **变量命名避坑**：不要使用 `script/postcss-mona-colors.cjs` 会改写的角色词（`background`、`text`、`line`、`edge`、`accent` 等），沿用 `--wl-*` 命名：
  - `--wl-card`：卡片常态填充（半透明磨砂感，兼顾浅色与深色）
  - `--wl-card-hover`：卡片悬停填充
  - `--wl-card-ring`：卡片常态描边（微弱金色或冷色）
  - `--wl-card-ring-hover`：卡片悬停描边（`var(--wl-gold)` 体系）
  - `--wl-card-glow`：悬停时的轻微阴影/辉光

## 模块拆分建议

1. `src/styles/welcome-palette.css`
   - 补充浅色 / 深色模式下的 `--wl-card*` 变量。
2. `src/pages/about/IntroPage/QuickLaunchGrid.vue`（新建）
   - 职责单一：渲染功能快速入口网格、处理点击跳转与错峰入场样式（接收 `visible: boolean` prop）。
3. `src/pages/about/IntroPage/IntroPage.vue`
   - 维护 `phase` 状态机、定时切换、点击跳过、`prefers-reduced-motion` 判断；
   - 重构 `.welcome-hero`（头像 + 标题合入同一动画容器）与 `.welcome-dial` 的两阶段样式；
   - 挂载 `QuickLaunchGrid` 并处理桌面端 / 移动端 / 矮屏的布局与底部元素定位。

## 验收与测试

1. **构建检查**：执行前端构建命令确认无 TypeScript / Vite / PostCSS 报错。
2. **浏览器实测**：
   - **桌面深色 & 浅色**：打开 `/intro`，先看到居中头像与大标题，约 1 秒后头像和「莫娜占卜铺」同时向上平滑缩小，中间 6 个入口卡片依次浮现；文字与头像无发虚、无重叠、无跳动。
   - **点击跳转与返回**：点击任意入口能正常跳转到对应页面；从侧栏点回「首页」时直接展示入口区，不强制重播开屏等待。
   - **提前跳过**：刷新进入开屏阶段时立即点击页面，立刻进入入口状态。
   - **手机端宽度（如 `390×844`）**：2×3 网格排布完整，不与顶栏、底部导航栏或版本号/更新开关重叠。
   - **减少动态效果**：开启 `prefers-reduced-motion: reduce` 时无动画闪烁，直接呈现最终布局。
