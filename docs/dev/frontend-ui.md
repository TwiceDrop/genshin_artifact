# 前端布局、路由与配色

调整外框断点、路由守卫、主题变量或配色构建插件时更新。

## 同一页面如何适配桌面和手机

[useScreen](../../src/composables/screen.ts) 监听窗口 resize，取视口宽度 `clientWidth` 与 `innerWidth` 的较大值。外框使用 `geSmall`（宽度 ≥ 768px），页面 CSS 的手机侧对应 `@media (max-width: 767px)`。另一个标志 `geMedium` 从 992px 起生效。

| | 桌面 | 手机 |
| --- | --- | --- |
| 导航 | 左侧固定可折叠侧栏 | 48px 顶栏显示页面标题，菜单键打开全部功能抽屉。底栏直达计算、圣遗物、角色，也能打开同一个抽屉。 |
| 内容占位 | `.main.notMobile` 左侧让出侧栏宽度，内容四周留 24px | `.main.mobile` 顶部让出 48px，内边距为 `14px 12px calc(80px + env(safe-area-inset-bottom))`。底栏自身也保留系统安全区。 |
| 滚动 | 内容按页面布局滚动 | 外框使用文档滚动。给内容再套滚动容器会改变计算器吸顶标签的位置。 |

桌面侧栏和手机抽屉复用同一份导航。手机切换路由或跨断点时收起抽屉。需要铺满内容区时可参考欢迎页如何抵消内边距。[页面外框](../../src/pages/MainPage/MainPage.vue) · [欢迎页](../../src/pages/about/IntroPage/IntroPage.vue)

## 路由与页面生命周期

- 路由的 `meta.title` 用于浏览器标题和手机顶栏。`/login` 设置 `meta.bare: true`，隐藏侧栏、顶栏、底栏和页脚，将主区内边距置零。`/intro`（别名 `/`）保留导航，自行显示页脚内容。[路由表与守卫](../../src/router/router.js)
- 外框的 `<keep-alive>` 包裹整个路由组件，部分路由上的 `meta.keepAlive` 并不控制这个缓存。一次性初始化放在 `onMounted`；每次切回要刷新的信息放在 `onActivated`。例如欢迎页仅在初次挂载时启动开屏计时，离开时在 `onDeactivated` 收束动画，回来时刷新自动更新开关。[欢迎页](../../src/pages/about/IntroPage/IntroPage.vue)
- 首次需要检查的导航会判断登录或离线选择；需要登录时进入登录页并尽可能保留原目标。`/login`、分享导入 `/import` 和备份入口 `/setup#export-data` 跳过本次检查。独立的导入守卫识别 `type=artifact` 和 `code`，已有库存时询问是否导入，处理后前往仓库，参数不匹配则回首页。[登录判断](../../src/platform/login-gate.mjs) · [路由守卫](../../src/router/router.js)

## 主题变量与构建时改色

外观偏好支持浅色、深色和跟随系统。初始化时临时预览参数 `theme` 优先于保存的 `mona_color_mode`，默认深色。最终结果写到根元素的 `data-color-mode="light"` 或 `"dark"`，同时切换 `dark` 类。[外观状态](../../src/styles/color-mode.mjs)

| 在哪里用 | 取哪些变量 |
| --- | --- |
| 欢迎页、登录页、星盘 | 根容器挂 `.wl-palette`，复用 `--wl-ground`、`--wl-letter`、`--wl-gold`。浅色基础值由深色选择器覆盖。[共享色板](../../src/styles/welcome-palette.css) · [登录页](../../src/pages/LoginPage/LoginPage.vue) |
| 侧栏、抽屉、手机顶栏和底栏 | `--sh-night`、`--sh-raised`、`--sh-letter`、`--sh-gold` 等位于外框的全局样式，默认深色，浅色在根元素覆盖。[外框](../../src/pages/MainPage/MainPage.vue) |
| 内容页、控件和弹层 | `--cx-ground`、`--cx-card`、`--cx-letter` 等在根元素、`.cx-scope` 和抽屉上定义。传送至 body 的弹层仍可取得根元素的变量。[内容主题](../../src/styles/content-theme.css) |

PostCSS 插件根据**声明属性名**决定是否替换其中的颜色字面量。普通的 color、背景、边框、阴影等声明会参与映射；自定义属性也会按名称中的子串依次匹配：

| 优先顺序 | 名称中任一子串 |
| --- | --- |
| 阴影 | `shadow` |
| 边框 | `border`、`line`、`rule`、`edge`、`focus` |
| 背景 | `background`、`canvas`、`surface`、`inset`、`tint`、`profile`、`portrait`、`fill`、`bg` |
| 前景 | `ink`、`text`、`muted`、`quiet`、`foreground`、`accent`、`blue`、`color`、`action` |

例如自定义属性名含 `line`，即使以 `--wl-` 开头，十六进制颜色也会被包装为 `var(--mona-border-…, 原值)`，并在深色模式套用生成值。手工给定两套色值时，沿用 `ground`、`letter`、`ring`、`gold` 等不命中上述子串的名字；使用处写 `background: var(--wl-ground)`。插件跳过 `var()` 和 `url()` 内部，按文件跳过 Element Plus 的 dark/css-vars 和 mona-theme.css。[插件实现](../../script/postcss-mona-colors.cjs)

## 新增页面或入口

1. 在[路由表](../../src/router/router.js)注册路径、页面组件和标题，按页面是否自带整屏布局决定是否设置 bare。
2. 侧栏与首页共用的入口在 [useFeatureLinks](../../src/pages/MainPage/useFeatureLinks.ts)定义路径、标签、图标和简介，将条目加入[侧栏分组](../../src/pages/MainPage/SideBar.vue)；[首页快捷入口](../../src/pages/about/IntroPage/QuickLaunchGrid.vue)会按共享集合顺序自动渲染。手机底栏由外框单独维护。
3. 导航标签使用[语言包](../../src/i18n/locales/)中的对应键，颜色从所在区域的色板取值。
4. 可点击卡片使用原生 `<button type="button">`，保留键盘激活行为。快捷卡片用 `:focus-visible` 绘制 2px 金色轮廓并外移 3px，尚不可用时禁用按钮。为动效提供 `prefers-reduced-motion: reduce` 分支；欢迎页在该模式直接显示入口，切页也取消淡入。[快捷卡片](../../src/pages/about/IntroPage/QuickLaunchGrid.vue) · [页面外框](../../src/pages/MainPage/MainPage.vue)
