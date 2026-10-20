# 7.1.10 手机界面试验版（shadcn-vue）

日期：2026-10-14。用户要求以常规版 7.1.10 为基础尝试重建手机端，功能与电脑保持一致，改善操作与阅读。本轮已实现手机界面并完成五项定向验证，提供独立网页试验版；没有生成 APK、安装应用或发布。

## 调研与实现

基线使用 Vue 3.2.41、Vue CLI 5、Element Plus，手机与电脑共用路由、Pinia、计算和存储。手机原来沿用桌面组件的小图标、密集工具栏和表格布局。

手机构建采用源代码形式的 shadcn-vue / Radix 组件。依据为 [Button](https://radix.shadcn-vue.com/docs/components/button)、[Sheet](https://radix.shadcn-vue.com/docs/components/sheet) 和 [安装说明](https://radix.shadcn-vue.com/docs/installation)。使用 radix-vue **1.8.4**、Tailwind **3.4.17**、CVA **0.7.1**；首次尝试的 Radix 1.9.17 导入 Vue `useId`，现有 Vue 3.2 编译不支持，已改用本轮编译和交互核对通过的版本。未升级共享 Vue 或改原 node_modules 联接，新依赖位于 `mobile/node_modules`。

手机复用全部业务页面及 v-model、事件、插槽和既有接口。桌面构建保持 Element Plus；`MONA_MOBILE=false` 时排除手机入口和 CSS。11 个实际导航页面全部保留：首页、设置、账号、UID 数据、圣遗物、圣遗物组、计算预设、计算器、整队优化、Playground、导出工具。原已有多人页面仅保留入口和当前行为，没有在常规版修改多人算法，也没有恢复已删除的功能。

已完成的界面调整：

- 独立手机导航、底部快捷入口、安全区域、单列布局和明确的分类名称。
- shadcn 按钮、Sheet、Checkbox、Switch、Radio、Slider、Tabs 和 Accordion；数值保留步进、精度、边界及可见读数，大量选项可搜索，多选保留完成和清空操作。
- 弹窗保持原关闭策略和编辑内容状态；确认、命名、加载、真实错误及 Debug 服务保留。表格在手机显示为带完整字段的卡片，保留选择和数据刷新后的选择清理。
- 树形勾选保留文件夹联动、半选、搜索、隐藏勾选和节点选择。BUFF 五分类和连续添加保持原行为。
- 仓库保留五槽筛选、评分、锁定、编辑、删除、导入、导出、推荐及分享。五槽同时显示图标和名称，空装备入口提供正常操作名称及键盘焦点。
- 手机收藏夹接回原桌面清空函数；重命名和删除显示条件与桌面一致。词条收益曲线接回已有图片导出工具。
- 修复迁移中发现的技能数值布局、旧等级值显示、Vue 3.2 路由缓存、槽位图标 padding 及 DSL 立绘溢出。仅采用正常名称、标签、已有游戏描述和错误，没有新增教程或解释条。

## 五项针对性验证

输出均位于 `.build-target/7110-shadcn-mobile`；使用合成数据和全新浏览器，没有加载、清空或修改用户正式存档。

| 项 | 命令与证据 | 结果 |
| --- | --- | --- |
| 1 手机编译 | `node script/mobile-build-check.cjs mobile`；`build-mobile.log`、`web/` | legacy 和 module 构建完成，手机组件及 Tailwind CSS 接通；保留工具、体积等既有 warning |
| 2 公共控件合同 | `npm.cmd run test:mobile-ui`；`controls.log` | 1 个定向用例通过：布尔单选、多选、精度、搜索树勾选、表格选择及刷新、分类 DOM 保留、弹窗编辑内容保留、命名确认及 Error.message / 通知标题 |
| 3 小屏操作与视觉 | `node script/mobile-browser-check.cjs`；`browser-evidence.json` 和页面 PNG | 11 个页面可切换；360 / 390 / 768 像素布局检查通过；五槽切换、角色和武器搜索、BUFF 连续添加、配置缓存正常。最终浏览器没有页面或控制台错误，390px 全部页面没有横向溢出 |
| 4 合成导入、导出与计算 | 同一浏览器证据；`compiled-worker-check.mjs`、`compiled-worker-evidence.json` | 实际文件选择导入 5 件 GOOD，实际浏览器导出 JSON 回读 5 件；实际配装 Worker 返回 1 组并按原行为切换装备区，保存预设成功。额外固定的同一 Worker 核对使用凯亚、R5 两层银釭及 6 件合成候选，目标值 6781.281351637214、杯 ID 4，与 Node 公共接口一致 |
| 5 桌面隔离 | `node script/mobile-build-check.cjs desktop`、`node script/mobile-browser-check.cjs --desktop`；`build-desktop.log`、`desktop-evidence.json`、`desktop-1280.png` | 1280×900 仍为原导航和 Element Plus，网页构建完成，浏览器无错误；桌面 CSS 不含手机 Sheet 或 Tailwind 组件样式 |

过程中修复实际编译、交互和视觉问题后重跑对应项，没有运行历史全量测试或穷举计算组合。

## 试用与继续开发

- 手机源代码：`src/mobile/`；构建组件清单：`script/mobile-components.cjs`。
- 安装独立依赖：在 source 执行 `npm.cmd --prefix mobile ci --ignore-scripts --legacy-peer-deps`。
- 常规手机构建：`npm.cmd run build:mobile`。本轮隔离构建使用上表脚本，保留正式 `dist` / `dist-mobile`。
- 交互预览：`npm.cmd run preview:mobile`，启动后显示临时本机地址。使用 `.build-target/7110-shadcn-mobile/preview-data` 的独立凭据目录和新来源存储；不更改正式端口、应用 ID 或签名。当前会话预览地址为 `http://127.0.0.1:10044/#/calculate`。
- 视觉产物包括 `calculate-390-viewport.png`、`artifacts-390.png`、`buff-390.png`、`navigation-390.png`、`uid-390.png` 及 360 / 768px 计算器截图。截图数据来自合成仓库。

本轮确认的是界面实现、指定浏览器流程和共享计算链路。未验证真实账号同步、Android 系统保存 / 图片导出、升级安装、手机键盘或 WebView 实机体验；不能把浏览器检查写成 APK 实机通过。已发布 EXE / ZIP / APK、README、旧版和 Beta 未修改，版本仍为 7.1.10，未重编译启动器或发布新版本。
