# shadcn-vue 前端迁移进度

截至 2026-11-28，多数页面的控件已换成 shadcn-vue。查还有哪里没改完，可以从这三处看。

- **[还能点到的旧控件和提示](#还能点到的旧控件和提示)**。主要在云端 Cookie 导入和角色导出失败时。
- **[样式未适配](#样式未适配)**。控件可能已经换了，但边框、文字颜色或错误提示还在用 Element Plus 的样式变量。
- **[全应用仍依赖的功能](#全应用仍依赖的功能)**。包括全局语言配置、多个弹层叠放时的显示顺序，以及组件自动注册和旧样式导入。

这份清单以 2026-11-28 的源码核查为基础，当时从 [路由](../../../src/router/router.js) 和 [应用入口](../../../src/App.vue) 追查了 216 个 Vue 组件。浏览器验证和测试结果见 [历次改动与验收](#历次改动与验收)。

## 当前迁移情况

### 还能点到的旧控件和提示

Playground 前端页面及 `/playground` 路由已移除。

| 页面 → 功能 | 当前实现 | 主要代码 |
| --- | --- | --- |
| 在线账户 → 云端 Cookie → 导入本机 | 列表、加密和解密、导入按钮已接入 shadcn-vue。导入仍用默认 `ElMessageBox` 处理多角色选 UID，以及需要刷新已有账户或新建本地账户的确认和命名。多选一的下拉为对话框内的原生 `select`。 | `CookieVaultPanel.vue` → `bindCookieRole` → `uid-import-session.js` |
| 角色 → 导出角色 → 导出失败 | 导出按钮是 `UiButton`，生成或下载失败时仍调用 `ElMessage.error`。 | `MiyousheImport.vue` → `exportAllPresets` → `export-presets.ts` |

计算器保存预设、多人轴保存与导入的提示已改用 Radix Toast，调用链为 `showCalculationNotice` → `CalculationToaster`。

### 样式未适配

这部分仍使用 Element Plus 的 CSS 变量（`--el-*`）。「界面仍使用」指当前入口可见的文字、边框和背景。「主题仍保留」指全局或页面依然加载的变量和旧样式。

| 页面 → 功能 | 样式状态 | 未适配项与位置 |
| --- | --- | --- |
| 全应用 → 主题与内容区配色 | **未适配 · 全局主题仍保留** | 仍声明背景、文字、边框、状态色、遮罩、按钮、开关和弹层等 Element Plus 变量。[mona-theme.css](../../../src/styles/mona-theme.css)、[content-theme.css](../../../src/styles/content-theme.css) |
| 计算器 → 页面布局与主题 | **未适配 · 页面主题仍保留** | 页面仍声明 `--el-component-size`，工作台仍把主题颜色映射到 `--el-*`，并保留旧按钮、表单及菜单选择器。页面中也保留旧预设筛选样式 `.preset-menu-filters`。[NewArtifactPlanPage.vue](../../../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue)、[calculation-workbench.css](../../../src/pages/NewArtifactPlanPage/calculation-workbench.css) |
| 计算器 → 计算设置 → 面板范围 / 计算器 → 配装目标 → 面板配装 | **未适配 · 界面仍使用** | 范围输入框的背景、边框及两处范围错误提示仍读取 `--el-bg-color`、`--el-border-color` 和 `--el-color-danger`。[PanelRangeFields.vue](../../../src/pages/NewArtifactPlanPage/PanelRangeFields.vue)、[NewArtifactPlanPage.vue](../../../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue) |
| 计算器 → 圣遗物 → 喵喵评分、新评分、装备对比 / 计算器 → 自动配装 → 评分进度 | **未适配 · 界面仍使用** | 评分摘要、单件评分、装备差异标记和评分失败提示仍读取 `--el-*` 的文字、背景、分隔线、主色及警告颜色。[NewArtifactPlanPage.vue](../../../src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue) |
| 计算器 → 圣遗物 → 新评分 → 评分依据 | **未适配 · 界面仍使用** | 评分结果正文、按钮焦点与悬停状态、表格分隔线及选中行仍读取 `--el-*`。[DynamicArtifactScoreResult.vue](../../../src/components/display/DynamicArtifactScoreResult.vue) |
| 角色 → 添加角色 → 识图导入 | **未适配 · 界面仍使用** | 核对表格的差异单元格和保存错误提示仍读取 `--el-color-danger`。[RosterScreenshotDialog.vue](../../../src/components/import/RosterScreenshotDialog.vue) |
| 多人优化 → 管理计算配置及结果弹窗 | **未适配 · 页面主题和旧样式仍保留** | 当前入口仍载入含 `--el-font-size-*`、`--el-component-size` 和旧表格、折叠样式覆盖的主题文件。战斗明细表当前走原生表格。[team-dps-theme.css](../../../src/pages/TeamOptimizationPage/team-dps-theme.css)、[team-dps-night.css](../../../src/pages/TeamOptimizationPage/team-dps-night.css) |

### 全应用仍依赖的功能

| 依赖 | 用在哪里 | 具体情况 |
| --- | --- | --- |
| `ElConfigProvider` | 全应用 → 根组件、页面路由及全局挂载组件 | [`App.vue`](../../../src/App.vue) 仍用 `<el-config-provider :locale="elementLocale">` 包裹整个应用。`src/i18n/element-locale.ts` 负责选择 Element Plus 的中文或英文语言包。 |
| `useZIndex()` / `nextZIndex()` | 全应用 → 弹窗、菜单、下拉、气泡、悬停详情与加载遮罩 | [`useOverlayZIndex`](../../../src/composables/overlay-z-index.ts) 借用 Element Plus 的层级编号，让新打开的弹层显示在之前的弹层上方，直接用于 `UiDialog`、`UiSelect`、`UiPopover`、`UiDropdownMenu`、`UiHoverDetails` 和 `UiLoadingOverlay`。`UiMultiSelect`、`UiConfirmPopover` 等会经由封装间接使用。 |
| `useZIndex()` / `nextZIndex()` | 计算器与角色计算设置 → 队友预设 / 计算器 → 配装目标 / 设置与本地账户 → 加载遮罩 | `TeamPresetSelect.vue` 与 `SelectTargetFunction.vue` 也直接调用同一工具。`UiLoadingOverlay` 用于语言加载与本地账户操作。 |
| 自动注册与样式导入 | 全应用、多人优化 | `vue.config.js` 保留 `ElementPlusResolver`，`main.ts` 仍导入 `theme-chalk/display.css`。`TeamOptimizationWrapper.vue` 仍导入 Element Plus 消息 CSS。`i-ep-*`、`~icons/ep/*` 属于 Iconify 图标入口。 |

## 已接入 shadcn-vue 的入口

下面按入口列控件进度。`Ui*` 是项目封装的控件，Radix 是这些控件底层用到的 Vue 组件。表中「样式未适配」对应上面的样式清单。原生按钮、表格、图表和编辑器按实际实现注明。

### 计算器

| 页面 → 功能 | 当前实现 | 主要代码 |
| --- | --- | --- |
| 计算器 → 角色卡 → 默认角色、我的角色与角色预设 | 选择弹窗、预设列表、圣遗物预览气泡、切换角色时的保留条件确认已接入 shadcn-vue。 | `NewArtifactPlanPage.vue`、`DefaultCharacterPicker.vue`、`MiyousheCharacterPicker.vue`、`CharacterPresetOptions.vue` |
| 计算器 → 角色卡 → 角色与武器设置 | 等级、命座、技能等级、武器选择、精炼与专属参数使用 `Ui*` 和自定义选择器。 | `NewArtifactPlanPage.vue`、`GroupedLevelSelect.vue`、`DslParamFields.vue` |
| 计算器 → 计算条件 → BUFF、添加 BUFF | 管理与选择弹窗、搜索和分类、已添加分组、极星辉域、来源选择、数值、开关和行操作已接入 shadcn-vue。重复添加用 `ArtifactPromptDialog`，成功提示用 Radix Toast。 | `NewArtifactPlanPage.vue`、`SelectBuff.vue`、`CharacterBuffGroups.vue`、`SelectedBuffGroups.vue`、`BuffItem.vue` |
| 计算器 → 计算条件 → 队友 | 队友预设、效果与反应机制、来源 ID、次数和数值、错误状态已接入 shadcn-vue。 | `TeamBuffSources.vue`、`TeamPresetSelect.vue`、`TeamTriggerSwitch.vue` |
| 计算器 → 计算条件 → 敌人 | 敌人弹窗、等级和抗性数值框、滑轨与附魔元素使用 `Ui*` 及自定义控件。 | `NewArtifactPlanPage.vue`、`EnemyConfig.vue`、`SelectElementType.vue` |
| 计算器 → 配装目标 → 普通目标、手法目标、面板配装 | 目标列表及参数、目标模式、保留套数和最低圣遗物等级等使用 `Ui*` 及 Radix Vue。面板配装的范围输入和错误提示**样式未适配**。 | `NewArtifactPlanPage.vue`、`SelectTargetFunction.vue`、`DslParamFields.vue`、`PanelRangeFields.vue` |
| 计算器 → 计算设置 → 配装约束、面板范围 | 弹窗、套装及主词条筛选、收藏夹约束和计算开关已接入 shadcn-vue。面板范围的原生数字输入框和错误提示**样式未适配**。 | `NewArtifactPlanPage.vue`、`PanelRangeFields.vue` |
| 计算器 → 圣遗物设置 → 保护圣遗物、自定义套装效果 | 保护列表、搜索、来源切换、自动与自定义模式、套装搜索和参数使用 `Ui*` 及自定义表单。 | `NewArtifactPlanPage.vue`、`ArtifactConfig.vue`、`DslParamFields.vue` |
| 计算器 → 圣遗物 → 选择、更换、移除、锁定、清空 | 选件弹窗、套装与主词条筛选、分页、空态和卡片操作使用 shadcn-vue。列表保留自定义果冻悬停预览。 | `NewArtifactPlanPage.vue`、`SelectArtifact.vue`、`ArtifactDisplay.vue`、`UiHoverPreview.vue` |
| 计算器 → 圣遗物 → 对比、词条分析、存为套装与应用套装 | 对比开关和模式、历史选择、词条分析弹窗及套装确认已接入 `Ui*`，应用套装使用 Radix 折叠树。装备差异标记**样式未适配**。 | `NewArtifactPlanPage.vue`、`ArtifactPromptDialog.vue` |
| 计算器 → 圣遗物 → 喵喵评分、新评分 | 评分模式、单件详情、评分设置与依据的弹窗、计算与取消入口使用 `Ui*`。评分摘要、单件评分、错误提示和「评分依据」内容**样式未适配**。 | `NewArtifactPlanPage.vue`、`ArtifactScoreDialog.vue`、`DynamicArtifactScore.vue`、`DynamicArtifactScoreResult.vue` |
| 计算器 → 顶栏 → 保存和分享预设 / 圣遗物 → 应用圣遗物到预设 | 保存分裂菜单、选择预设弹窗与筛选、空态、新建名称确认、本地保存通知和分享弹窗已接入 shadcn-vue。 | `NewArtifactPlanPage.vue`、`PresetPicker.vue`、`PresetBrowser.vue`、`ContentShareDialog.vue` |
| 计算器 → 角色面板 → 全部属性、词条收益曲线与最优收益曲线 | 属性提示、弹窗、曲线表单及操作控件已接入 shadcn-vue。曲线由 ECharts 绘制，表格使用原生语义。 | `NewArtifactPlanPage.vue`、`AttributePanel.vue`、`AttributeItem.vue`、收益曲线组件 |
| 计算器 → 伤害 → 伤害明细、技能设置、剧变反应 | 伤害构成弹窗、伤害类型切换、常规与月反应／星反应拆分的勾选和数值、技能参数及错误提示已接入 shadcn-vue。技能列表为自定义按钮，剧变表为原生表格。 | `NewArtifactPlanPage.vue`、`DamageAnalysis.vue`、`DamageAnalysisUtil.vue`、`LunarDamageDetail.vue` |
| 计算器 → 自动配装 → 计算进度、查看搭配、恢复上次计算 | 进度、取消、失败、恢复确认、伤害及面板候选弹窗、排序与应用控件已接入 `Ui*` 或 Radix。成功和错误反馈复用 Radix Toast 或页面错误弹窗。进度弹窗里的新评分失败提示**样式未适配**。 | `NewArtifactPlanPage.vue`、`OptimizationResultsDialog.vue`、`PanelResultsDialog.vue`、`CalcErrorDialog.vue` |

### 其他页面

| 页面 → 功能 | 当前实现 | 主要代码 |
| --- | --- | --- |
| 多人优化 → 管理计算配置 → 新建、选人、编辑、倍率预览、导入与导出 | 配置选择与列表操作、队伍筛选、动作与参数编辑、JSON 弹窗、倍率预览和外围操作已接入 `Ui*`、Radix 或共用控件。Windows 时间轴保留自定义拖拽。 | `TeamOptimizationWrapper.vue`、`TeamActionTimeline.vue`、`TeamMultiplierPreview.vue` |
| 多人优化 → 管理计算配置 → 保存、使用、分享和删除 | 保存与导入反馈走 Radix Toast，分享及涉及已分享轴的删除确认走 `TeamDialog`／`ArtifactPromptDialog`。其它删除走已有直接操作。 | `TeamOptimizationWrapper.vue`、`ShareAxisDialog.vue`、`CalculationToaster.vue` |
| 多人优化 → 敌人设置、队伍装备、配装设置 | 敌人等级与抗性、成员等级与预设、武器、精炼、套装和主词条约束已接入 shadcn-vue 及多人共用控件。 | `TeamDpsPage.vue`、`EnemyConfig.vue` |
| 多人优化 → 联合优化、当前配装计算、结果与战斗明细 | 计算操作、进度和取消、候选、折叠、事件类型切换、分页、状态与伤害构成使用 `Ui*`、Radix 和原生表格。 | `TeamDpsPage.vue`、`TeamDpsEvents.vue`、`TeamProgress.vue`、`DamageAnalysis.vue` |
| 角色 → 角色列表、详情、装备、天赋、命座与预设 | 列表、角色资料和装备的可操作控件使用 `Ui*`、Radix 与自定义卡片。预设分享使用共用 `UiDialog`。 | `MiyousheCharacterPicker.vue`、`CharacterRosterDetail.vue`、`RosterArtifactPicker.vue`、`ContentShareDialog.vue` |
| 角色 → 计算设置 | 弹窗和标签页、当前装备效果参数、BUFF 与队友、极星辉域、伤害与敌人参数走 shadcn-vue。实际入口带 `settingsPreset`，固定当前角色和装备。 | `CharacterRosterDetail.vue`、`PresetEditor.vue` |
| 角色 → 添加角色 → 手动添加、UID／Cookie／Enka／文件／识图导入 | 导入面板及选择使用 `Ui*`，选 UID、GOOD 补填、空／荧选择、刷新或新建本地账户和替换审查由该页传入 `ArtifactPromptDialog`。识图的文件选择、表格和部分按钮是原生控件，差异表格和错误提示**样式未适配**。 | `MiyousheImport.vue`、`RosterScreenshotDialog.vue`、`restore-character-file.mjs`、`uid-import-session.js` |
| 圣遗物 → 仓库 → 部位、筛选、显示设置、评分角色与分页 | 菜单、显示设置气泡、套装与主词条筛选、勾选及分页使用 `Ui*` 或 Radix。仓库卡片、果冻预览及详情布局为自定义组件。 | `ArtifactsPage.vue`、`SelectArtifactSet.vue`、`SelectArtifactMainStat.vue` |
| 圣遗物 → 新增、查看、编辑、锁定、清空、导入与导出 | 新增与编辑表单、详情弹窗、批量操作确认、导入选项与通知使用 `Ui*` 或 Radix。文件读取和下载使用平台能力。 | `ArtifactsPage.vue`、`AddArtifactDialog.vue`、`EditArtifact.vue`、`ArtifactPromptDialog.vue` |
| 圣遗物套装 → 收藏夹、套装及选件 | 搜索、更多与套装菜单、预览、空态、新建、重命名、清空和删除确认、套装与主词条筛选和分页均已接入 shadcn-vue。 | `KumiPage.vue`、`KumiItem.vue`、`SelectArtifact.vue` |
| 历史记录 → 单次计算／多人配装计算 → 列表、详情与查看计算 | 类型切换、搜索、清除、记录行、页码选择和详情操作使用 `Ui*`。详情卡为自定义内容，查看计算重新进入对应计算页面。 | `CalculationHistoryPage.vue` |
| DSL 管理 → 选角色、默认手法与手法列表 | 选人、自定义或在线手法操作使用 `Ui*` 和自定义选择器。默认及已有手法的命中与源码预览走 `DslEntryPreview`。 | `DslManagementPage.vue`、`DslEntryPreview.vue` |
| DSL 管理 → 新建、编辑、删除、文件／链接导入、导出、在线更新和分享 | 操作按钮、导入和编辑对话框、删除确认、分享使用 `Ui*`。编辑中的部分表单选项为原生控件。 | `DslManagementPage.vue`、`ContentShareDialog.vue` |
| 在线账户 → 在线服务、个人资料、我的分享、云档案及云端 Cookie 管理 | 服务配置、账户资料、用户名、邮箱、密码、头像、注销、云档案同步与删除、分享管理、Cookie 加解密和会话管理使用 `Ui*` 与自定义原生操作。云端 Cookie 导入本机的后续确认见 Element Plus 表。 | `OnlineAccountPage.vue`、`OnlineAccountCard.vue`、`CloudProfilesPanel.vue`、`MyAxisShares.vue`、`CookieVaultPanel.vue` |
| 登录 → 登录、注册、重设密码、补设用户名 | 输入、密码、验证码和提交等控件走 `Ui*`，错误与状态在页面内显示。 | `LoginPage.vue` |
| 本地账户 → 新建、切换、改名、删除 | 账户卡、切换和改名为自定义交互，删除确认和加载遮罩用 `UiConfirmPopover`、`UiLoadingOverlay`。 | `AccountPage.vue`、`ClickEditLabel.vue` |
| 设置／导出 → 外观、语言、内容补丁、使用统计、本地数据、手机互传 | 语言、开关、确认、导入预览、加载遮罩、手机互传选项走 `Ui*`。主题卡、引导及备份入口包含自定义原生操作。 | `SetupPage.vue`、`PhoneTransfer.vue` |
| 首页 → 快捷入口、检查更新和自动检查 | 快捷入口是自定义导航。检查更新按钮、自动检查开关及全局更新弹窗、来源选择和下载进度使用 `Ui*` 或 Radix。 | `IntroPage.vue`、`App.vue` |
| 导出工具 → 工具列表、外链和归档 | 内容使用自定义卡片、打开外链的原生按钮和原生折叠，并沿用共用的页面引导入口。 | `ExportToolPage.vue`、`ExportToolItem.vue`、`PageGuideButton.vue` |
| 全局 → 侧栏、使用引导、版本迁移与使用统计 | 侧栏使用项目 Sidebar 组件，手机侧栏使用 Radix Sheet。引导中心、版本迁移和使用统计提示使用 `UiDialog` 与自定义引导浮层。 | `SideBar.vue`、`OnboardingHubDialog.vue`、`OnboardingOverlay.vue`、`WebVersionNotice.vue`、`UsageStatsNotice.vue` |
| 旧圣遗物分享链接（`/import?type=artifact&code=…`） → 导入、库存确认和警告 | 路由传入 `legacyArtifactShareDialogs`，由应用挂载的 `ArtifactPromptDialog` 显示。 | `router.js`、`legacy-artifact-share-dialogs.ts`、`warehouse-file.js`、`App.vue` |

`/` 是首页别名，`/tomodachi` 和 `/presets` 分别重定向到首页与角色页。在线服务的分享落地页由服务端提供 HTML 和静态脚本，应用内分享操作使用上表所列弹窗。

## 源码中的旧分支与兜底

### 导入弹窗兜底

`warehouse-file.js`、`restore-character-file.mjs` 和 `uid-import-session.js` 仍把 `ElMessageBox` 设为默认值。未传会话时，`save-game-snapshot.mjs` 创建的默认会话也会沿用它。

- 圣遗物 → 文件导入。正常由 `ArtifactPromptDialog` 显示提示。弹窗引用为空时，会走默认的 `ElMessageBox`。
- 角色 → 文件恢复及快照写入。角色页显式传入弹窗或会话。旧圣遗物分享路由也传入了自己的弹窗控制器。
- 在线账户 → 云端 Cookie → 导入本机。该入口现在就走默认弹窗，具体触发条件见上面的旧控件表。

### 旧分支里的样式

这些样式也记为**未适配**。表里注明了目前页面走的分支。

| 页面 → 功能 | 样式状态 | 未适配项与位置 |
| --- | --- | --- |
| 计算器 → 伤害 → 月反应／星反应明细 / 多人优化 → 战斗明细 → 伤害构成 | **未适配 · 旧分支样式** | `--el-*` 仍用于旧 `.input` 的文字、背景和边框。两个现有入口均启用 `shadcn`，数值走 `UiNumberInput`。[LunarDamageDetail.vue](../../../src/components/display/DamageAnalysis/LunarDamageDetail.vue)、[StellarDamageDetail.vue](../../../src/components/display/DamageAnalysis/StellarDamageDetail.vue)、[DamageAnalysisUtil.vue](../../../src/components/display/DamageAnalysis/DamageAnalysisUtil.vue) |
| 计算器 → 圣遗物 → 动态评分的独立布局 | **未适配 · 旧分支样式** | 独立布局的容器、下拉、按钮、状态和错误提示仍读取 `--el-*`。计算器当前启用 `integrated`，使用「评分设置」和「评分依据」弹窗。[DynamicArtifactScore.vue](../../../src/components/display/DynamicArtifactScore.vue) |

### 其他旧组件与调用

- `/team-optimization` 实际加载 `TeamOptimizationWrapper.vue`。同目录的旧 `TeamOptimizationPage.vue` 仍有 Element Plus 表单和 `ElMessage`，本次核对未发现用户入口加载该旧组件。
- `AccountPage.vue` 的旧文件同步入口已整段注释，旧处理函数仍有一处 `ElMessage.error`。`main.ts` 的 `this.$message` 包装也仍存在，当前 `src/` 内未查到调用者。
- `PresetEditor.vue` 的无 `settingsPreset` 分支还引用旧角色级联和武器下拉。角色页当前的计算设置传入有效预设，该通用编辑分支未接到现有入口。`PresetPicker`／`PresetBrowser`、`TeamBuffSources`、角色预设预览、属性提示与伤害明细也保留兼容分支，当前对应页面显式选择新版。
- `SideDrawer`、`ArtifactsFilter`、`FilterPotentialResult`、`PresetItem`、`AttributeStatistics`、`InputWithAppend`、`SelectArtMainTagWithoutVal` 与首页旧 `ButtonItem` 等仍含旧标签，当前路由及其界面调用中未找到入口。Playground 移除后，`SelectArtifact`、`SelectBuff`、`ConfigItem` 等共享组件的旧分支仍保留在源码中。

## 历次改动与验收

### 已完成的七条迁移路径

同批迁移以原有排版、控件顺序和业务流程为基准。

| 入口 | 已写入的改动 | 主要代码 |
| --- | --- | --- |
| 多人优化 → 管理计算配置 → 新建、导入、编辑动作轴 | 换了配置列表和操作按钮、队伍选人和搜索、时间轴编辑控件、排序与 JSON 弹窗、倍率预览、分享及删除确认。Windows 自定义时间轴仍用原来的图形交互，外围控件接入新样式。 | `TeamOptimizationWrapper.vue`、`TeamActionTimeline.vue`、`TeamMultiplierPreview.vue`、`ShareAxisDialog.vue` |
| 多人优化 → 敌人设置、队伍装备和配装设置 | 改了敌人设置、成员等级、角色预设、武器和精炼、圣遗物约束等控件。敌人表单增加了沿用多人页原行布局的用法。 | `TeamDpsPage.vue`、`EnemyConfig.vue` |
| 多人优化 → 联合优化、计算进度和结果 | 优化入口、进度、候选结果和折叠区接入 shadcn-vue。战斗明细使用 Radix 标签页、可滚动的语义表格及共用分页，保留六类事件、状态明细和伤害构成。 | `TeamDpsPage.vue`、`TeamDpsEvents.vue`、`TeamDialog.vue`、`TeamProgress.vue`、`TeamDisclosure.vue`、`TeamTablePagination.vue` |
| 角色 → 计算设置 | 预设编辑器换了弹窗、标签页及角色、武器、圣遗物、BUFF、伤害表单控件。嵌套的圣遗物与 BUFF 选择器接上了 shadcn-vue 控件。 | `PresetEditor.vue`、`CharacterRosterDetail.vue` 及相关选择器 |
| 角色 → 添加角色 → 导入 | 导入流程中的 UID、刷新已有账户、新建账户和替换角色等提示接入 shadcn-vue 弹窗。GOOD v3 补填 UID 和空／荧选择共用这个弹窗入口，沿用原有校验和取消分支。 | `MiyousheImport.vue`、`uid-import-session.js`、`restore-character-file.mjs` |
| 圣遗物套装 → 收藏夹、套装和选件 | 换了搜索、更多菜单、卡片菜单、预览、空态、新建和重命名、清空和删除确认。选件弹窗接入新筛选和分页控件，保留每页 20 件。 | `KumiPage.vue`、`KumiItem.vue`、`SelectArtifact.vue` |
| 打开旧圣遗物分享链接 | 已有库存时的确认、导入后出现的警告接入应用层 shadcn-vue 弹窗。路由仍通过原有仓库导入入口处理数据。 | `router.js`、`warehouse-file.js`、`legacy-artifact-share-dialogs.ts`、`App.vue` |

### 后续修复

- 多人数字步进控件适配仓库当前的 Vue 3.2 编译器。保存、导入、取消计算及角色设置错误反馈复用现有的 Radix 通知。
- 角色计算设置中的队友选项挂到当前弹窗里，点击选项和关闭下拉时保留外层弹窗。390px 下保留单行标签及完整标题。
- 旧分享直链等待本地账户加载完成，再判断已有库存和是否需要确认。
- Neon 首次复审通过六条路径，要求修复多人敌人设置在 390px 下的抗性滑轨。多人行布局已接入可伸展的滑轨，敌人及配装设置弹窗关闭后恢复入口焦点。

### 浏览器验证、测试与 Neon 复核

- 用合成数据在 1440px 和 390px 的 Chrome 验证动作轴选人、JSON 编辑、倍率预览、保存启用、导出再导入、敌人与配装设置、CPU 联合优化、当前配装计算、候选搭配、34 条战斗事件翻页和伤害构成。
- 核对角色计算设置、队友预设、嵌套 BUFF、选件，GOOD 导入的 UID 校验、旅行者选择、替换与保留、新建本地账户、刷新已有 UID，以及模拟接口下的 Cookie 角色选择和 Enka 导入。
- 核对套装搜索、菜单、确认、预览和每页 20 件的选件流程。模拟旧分享直链验证了库存确认、取消、导入警告和返回仓库。
- 51 项针对性测试通过，覆盖多人结果、动作轴、角色导入、OCR 重试和登录回跳。在线接口使用模拟数据，识图验证覆盖重试逻辑。
- 多人倍率回归用例 `tests/team3-product.test.mjs` 已修复。测试夹具补齐了 `defaultTeamCharacter`，断言按当前预览口径核对基础倍率中的天赋修正，以及合计倍率中的 12 层极星辉域系数。4 个相关测试文件共 10 项全部通过，计算公式保持原样。
- Neon 通过 ai-memory 的 `shadcn-workflows-neon` 工作流复验了修正后的 390px 浅色和 1440px 深色敌人设置。最终结论为 **ACCEPT**，七条路径可整体交付。

### 更早一轮的计算器验收

计算设置、圣遗物设置（含保护和自定义套装效果）、自动配装进度、成功通知和失败弹窗已迁移到 shadcn-vue。那一轮已由 Neon 给出 **ACCEPT**，这次验收覆盖上面所列的计算器界面。
