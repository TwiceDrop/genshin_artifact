# 编写前端 UI 与样式开发指南

Status: done

## 目标

新增常青文档 `docs/dev/frontend-ui.md`，沉淀前端双端布局、路由约定与夜空/浅色配色体系，避免后续改 UI 时踩坑或重复翻历史 spec。

## 需对照源码核实的内容

编写前必须先读取对应源码，确保所有变量名、断点和文件名准确无误：
- `src/pages/MainPage/MainPage.vue`、`SideBar.vue`、`useFeatureLinks.ts`
- `src/router/router.js`
- `src/composables/screen.js`（或实际响应式 composable 文件）
- `src/styles/welcome-palette.css`、`src/styles/content-theme.css`（及 `src/styles/` 下相关主题文件）
- `script/postcss-mona-colors.cjs`
- `src/pages/about/IntroPage/IntroPage.vue`、`src/pages/LoginPage/LoginPage.vue`

## 文档大纲

顶部写明一行「何时更新」（例如：调整全局主题变量、端侧断点、路由外框约定或配色构建插件时更新）。

1. **桌面与手机双端共用布局**
   - 断点判定方式（`useScreen` / `767px` 媒体查询）、外框结构（桌面可折叠侧栏 vs 手机顶栏 + 抽屉 + 底部导航）、`.main` 内边距与安全区（`env(safe-area-inset-bottom)`）约定。
2. **路由与页面生命周期约定**
   - `meta.title`、`meta.bare`（整屏无外框，如登录页）、`MainPage.vue` 中 `<keep-alive>` 的影响（`onMounted` vs `onActivated`）、登录门与 `/import` 守卫边界。
3. **三套配色变量与 PostCSS 避坑**
   - `.wl-palette`（`--wl-*`，星空欢迎页与登录页共用）
   - 外框配色（`--sh-*`，侧栏、顶栏、抽屉、底栏）
   - 内容区配色（`--cx-*`，`content-theme.css`）
   - 深色/浅色切换机制（`html[data-color-mode="dark" | "light"]`）
   - **重点避坑**：`script/postcss-mona-colors.cjs` 会对哪些角色词（如 `background`、`text`、`line`、`edge`、`accent` 等，以脚本源码为准）做自动映射，新增自定义 CSS 变量如何命名避开二次改写。
4. **动效与无障碍基线**
   - `prefers-reduced-motion: reduce` 约定、原生 `<button>` 与 `focus-visible` 金色描边规范。
5. **新增页面 / 入口接线清单**
   - 路由（`router.js`）→ 导航/快速入口（`SideBar.vue`、`useFeatureLinks.ts`）→ i18n（`src/i18n/locales/`）→ 主题变量复用。

## 收尾

- 在 `docs/README.md` 的开发者文档目录中链接 `docs/dev/frontend-ui.md`。
- 完成后将本文件改为 `Status: done`。
