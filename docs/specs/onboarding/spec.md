# 新手引导体系

Status: ready-for-agent

2026-11-25 与开发者确认按推荐方案落地。动手前先读根目录 `AGENTS.md`，它的规则优先于本规格。任务已拆到 `issues/`，按依赖顺序实现：01 → 02 → 03 → 04 → 05 → 06。

## 给执行者

- 一个任务一次本地提交，不推送、不建 PR、不修改 README。
- 新手引导不能改变任何伤害计算、配装逻辑，也不能改动现有本地存档结构（`mona_account_*`、导入导出格式等）。
- 不升级 `element-plus`（当前为 `^2.2.6`，无 `el-tour`），聚光灯引导层自研并复用项目现有的 `--cx-*` / `--sh-*` 主题变量。
- 界面文案已在本文「引导清单与文案」定稿（2026-11-25 开发者同意按推荐方案落地）；如需大幅修改文案，先向开发者确认。
- 每轮验证不超过五项，汇报时写清实际执行了哪些测试或构建，没在浏览器/手机上实测过就不说实测通过。

## Problem Statement

目前项目只有一个孤立的首次导入分流弹窗（`src/components/FirstUseDialog.vue` + `src/platform/first-use.mjs`）：
- 仅在设备无数据时弹一次，点击任意按钮（含跳过）即永久消失；
- 跳转到导入页面后没有任何后续指引，玩家面对「单次计算」「多人优化（四人轴）」「圣遗物套装组」「历史记录」等入口仍然不知道从哪里下手；
- 没有常驻入口可以回头查看某个模块的详细用法。

## Solution

用一套完整的「**引导中心 + 1 套快速引导 + 6 套按模块拆分的详细引导**」替换现有的 `FirstUseDialog.vue`：

1. **首次进入欢迎卡**（替代 `FirstUseDialog.vue`）：
   - 沿用现有触发条件：本机所有本地账号都没有圣遗物和预设、且未记录完成过首次欢迎、且等待用量统计提示关闭、不在 `/login`、`/setup#export-data`、`/import` 路由。
   - 兼容旧键 `mona.firstUseDone`：已为 `'true'` 的老用户不自动强弹欢迎卡，但随时可以手动打开引导中心。
   - 提供 3 个清晰出口：**快速了解（3 步）**、**先导入我的数据**（展开云端 / UID / 圣遗物文件三个快捷入口，承接原弹窗能力）、**先自己逛逛**（关闭并提示常驻入口位置）。
2. **常驻引导中心（Guide Hub）**：
   - 桌面端与手机端侧栏新增「使用引导」入口；设置页提供「打开使用引导」与「重置引导进度」；各核心页面顶栏提供低调的 `?` 按钮，点击直接启动**当前页面的详细引导**。
   - 引导中心集中展示「快速了解」大卡与 6 套「详细引导」列表，显示每套引导的简介、步数与已完成状态，支持随时重看。
3. **跨页聚光灯引导层（Overlay）**：
   - 纯数据驱动，业务页面仅添加稳定的 `data-tour="<key>"` 属性，不耦合引导状态逻辑。
   - 支持跨路由自动跳转、等待目标锚点渲染、自动滚动进视口、目标不可见时自动降级为居中卡片（永不卡死）。
   - 桌面端使用聚光灯遮罩 + 智能避让气泡卡片；手机端（`!geSmall`）使用高亮框 + 底部固定引导卡片，避免窄屏遮挡或裁切。

## 引导清单与文案

所有引导定义集中在 `src/onboarding/guides.mjs`，每条引导包含 `id`、`kind`（`'quick'` | `'detail'`）、`title`、`summary`、`pageRoutes`（用于核心页 `?` 按钮匹配）、`steps`。

### 首次欢迎卡文案
- 标题：`欢迎使用莫娜占卜铺`
- 导语：`还没有圣遗物和预设。可以先 3 步快速了解核心用法，或直接导入已有数据。`
- 主按钮：`快速了解（3 步）`
- 次按钮：`先导入我的数据`（点击后展开/显示：`从云端账号导入`（仅已登录时显示）、`通过 UID 导入`、`导入圣遗物文件`）
- 底部文字按钮：`先自己逛逛`
- 关闭提示（Toast 或卡片底部小字）：`随时可以从侧栏「使用引导」或设置页重新打开。`

### A. 快速引导：`quick-start`（3 步，不跨页）
- 标题：`快速了解`
- 简介：`3 步认识导航与使用流程，各模块可按需单独查看详细引导。`

| 步 | 路由 | 桌面锚点 / 手机锚点 | 标题 | 正文 |
| --- | --- | --- | --- | --- |
| 1 | 当前页（不跳转） | `nav.sidebar` / `nav.mobile-bottom` | 认识主要功能区 | 左侧栏（手机端为底部导航）汇总了角色（UID）、单次计算、多人优化和圣遗物仓库，常用功能都能在这里直达。 |
| 2 | 当前页（不跳转） | 无（居中展示） | 常见使用流程 | 一般先在「圣遗物」或「角色」页导入已有数据，再去「单次计算」自动配装；需要四人互不抢装备或算循环总伤时，再进「多人优化」。 |
| 3 | 当前页（不跳转） | `nav.guide` / `nav.mobile-menu` | 按模块查看详细引导 | 每个核心页面顶栏都有「？」按钮，侧栏里也可以随时打开「使用引导」，需要哪一块再单独看哪一块的详细步骤。 |

### B. 详细引导（6 套）

#### 1. `detail-import`：导入圣遗物与角色（4 步）
- 匹配页面：`/artifacts`、`/uid-data`、`/help/export-tools`
- 简介：`理清 JSON 导入、截图录入、UID 展柜与导出工具该怎么选。`
- 步骤：
  1. `/help/export-tools` · `export-tools.list` · `全仓库导入：先用导出工具` — 想一次性导入全部圣遗物，先在这里选一款常用扫描器导出 JSON（支持莫娜格式与 GOOD v3）。
  2. `/artifacts` · `artifacts.import`（手机 `artifacts.more`） · `导入圣遗物文件` — 点「导入」上传 JSON。导入弹窗里，「删除未出现的圣遗物」适合全量同步，「备份现有套装」可保留旧套装组合。
  3. `/artifacts` · `artifacts.screenshot`（手机 `artifacts.add`） · `单件补充：截图或手动新增` — 只想临时补几件新圣遗物，可以直接用「截图导入」或点「＋ 新增圣遗物」手动录入。
  4. `/uid-data` · `uid.import-entry` · `通过 UID 导入角色与预设` — 在「角色」页输入 UID 或登录米游社，可导入角色等级、武器与当前穿戴圣遗物，并一键生成角色预设。

#### 2. `detail-calculate`：单人配装与伤害计算（6 步）
- 匹配页面：`/calculate`
- 简介：`从载入预设、设置目标与过滤条件，到自动配装和对比结果。`
- 步骤：
  1. `/calculate` · `calc.preset` · `载入与保存预设` — 在这里选择已导入的角色预设快速填好面板，调整完毕后也可以随时保存回预设。
  2. `/calculate` · `calc.character-gear` · `调整角色、武器与圣遗物` — 可以手动更换武器、命座、天赋或单个部位的圣遗物，点击圣遗物还可查看单件评分与替换建议。
  3. `/calculate` · `calc.conditions` · `配置队友 BUFF 与敌人` — 在条件区域添加队友 BUFF、调整敌人等级与抗性，并可随时展开伤害构成查看各乘区明细。
  4. `/calculate` · `calc.target` · `选择配装目标` — 点「配装目标」决定优化方向：单技能最高伤害、指定面板阈值，或使用自定义 DSL 表达式。
  5. `/calculate` · `calc.settings` · `设置充能下限与圣遗物过滤` — 「计算设置」可设充能/暴击等约束与搜索算法；「圣遗物设置」可限定套装或排除已被其他预设占用的圣遗物组。
  6. `/calculate` · `calc.run` · `运行自动配装并对比提升` — 点击「自动配装」开始搜索，完成后可在结果弹窗里与当前穿戴对比伤害变化，并一键应用或存为套装。

#### 3. `detail-artifacts`：圣遗物仓库与套装组（4 步）
- 匹配页面：`/artifacts`、`/artifacts-kumi`
- 简介：`高效筛选、锁定、评分圣遗物，并用套装组防止抢装备。`
- 步骤：
  1. `/artifacts` · `artifacts.slots` · `按部位与词条快速筛选` — 用顶部的部位栏和筛选条件，快速找出指定套装、主词条或双暴副词条的圣遗物。
  2. `/artifacts` · `artifacts.grid` · `查看详情、锁定与评分` — 点击任意圣遗物可查看角色适配评分、编辑词条或加锁；加锁后可在配装设置里按需排除或保留。
  3. `/artifacts` · `artifacts.more` · `批量操作与推荐` — 在「更多」菜单里可以一键全部解锁、查看系统推荐的高潜力圣遗物，或清空当前仓库。
  4. `/artifacts-kumi` · `kumi.header` · `用圣遗物套装组固定搭配` — 在「圣遗物套装」把常用的 5 件保存成组，既方便一键换装，也能在单人配装里勾选组过滤避免被其他角色抢走。

#### 4. `detail-team-dps`：多人优化与四人轴 DPS（4 步）
- 匹配页面：`/team-optimization`
- 简介：`给四名角色同时分配不冲突的圣遗物，计算完整循环总伤。`
- 步骤：
  1. `/team-optimization` · `team.toolbar` · `新建或导入四人动作轴` — 多人优化以「动作轴」为单位：可以直接导入现成的动作轴 JSON，或新建一条动作轴并选定 4 名角色。
  2. `/team-optimization` · `team.config-select` · `切换计算配置` — 已保存的动作轴都会列在这里，随时可以切换不同队伍循环，或点「管理计算配置」进入编辑。
  3. `/team-optimization` · `team.manage-btn` · `编辑时间轴与预览倍率` — 在「管理计算配置」中可编辑角色出手顺序、初始前台、轴尾命中，并打开倍率预览核对循环。
  4. `/team-optimization` · `team.workspace` · `运行整队计算与查看明细` — 选好动作轴后即可评估整队 DPS 或运行整队配装。当前四人轴按初始满能、无循环充能限制计算，可在事件明细中查看每一跳伤害。

#### 5. `detail-history`：历史记录与方案对比（3 步）
- 匹配页面：`/calculation-history`
- 简介：`回看以往自动配装结果，对比不同方案的面板与伤害。`
- 步骤：
  1. `/calculation-history` · `history.header` · `自动留存配装记录` — 每次完成自动配装后，结果会自动记录在这里，不用担心切角色后找不回之前的方案。
  2. `/calculation-history` · `history.filters` · `筛选与定位历史方案` — 可以按角色或记录类型快速筛选，找到想回看的那次配装。
  3. `/calculation-history` · `history.list` · `查看详情与再次载入` — 点开记录可复盘当时的面板、词条收益与搭配，并重新载入计算器做进一步对比。

#### 6. `detail-account-sync`：多账号、备份与跨设备迁移（3 步）
- 匹配页面：`/account`、`/setup`、`/online-account`
- 简介：`管理本地多账号、整包备份还原以及手机电脑互传。`
- 步骤：
  1. `/account` · `account.header` · `本地多账号隔离` — 可以在「账号」页新建和切换多个本地账号，大小号或好友的圣遗物仓库与预设彼此独立。
  2. `/setup` · `setup.migration` · `整包导出与导入备份` — 在设置页可一键将所有本地账号（含 UID、圣遗物、四人轴与历史记录）导出为备份文件，换设备时直接导入。
  3. `/setup` · `setup.phone-transfer` · `手机互传与云端同步` — 同一局域网下可用「手机互传」快速迁移数据；若已登录在线账号，也可以在「账户管理与同步」开启云端同步。

## Implementation Decisions

### 1. 模块边界（`src/onboarding/`）
- `src/onboarding/guides.mjs`：纯数据模块，不依赖 Vue、DOM 或浏览器 API，便于 Node 测试直接导入并校验。
- `src/onboarding/state.mjs`：纯状态与持久化逻辑，负责读取/写入 `localStorage` 键 `mona.onboarding.v1`（格式 `{ version: 1, welcomeDismissed: boolean, completedIds: string[] }`），读取旧键 `mona.firstUseDone`，关闭欢迎卡时向同一存储写入该键为 `'true'`（`src/platform/first-use.mjs` 中的 `FIRST_USE_KEY` 和 `needsFirstUse` 复用，不删除 `first-use.mjs` 以保持现有单测和模块清晰）。
- `src/onboarding/controller.mjs`：响应式引导控制器（单例 composable / reactive store），管理：
  - `hubOpen`（引导中心弹窗开关）
  - `welcomeOpen`（首次欢迎卡开关）
  - `activeGuideId`、`activeStepIndex`、`activeRect`、`fallbackCentered`
  - `startGuide(guideId, router)`、`nextStep()`、`prevStep()`、`finishGuide()`、`stopGuide()`、`openHub()`、`openGuideForRoute(path)`
- `src/onboarding/OnboardingOverlay.vue`：全局聚光灯遮罩与步骤气泡/底部卡片，挂在 `src/App.vue`。
- `src/onboarding/OnboardingHubDialog.vue`：首次欢迎卡 + 引导中心弹窗，替代 `FirstUseDialog.vue` 挂在 `src/App.vue`。
- `src/onboarding/PageGuideButton.vue`：轻量 `?` 按钮组件，接收 `guideId`，供各核心页顶栏直接复用（避免在每个页面复制按钮样式与事件逻辑）。

### 2. 弹窗排队与不打扰规则
- 首次欢迎卡的展示条件沿用原 `FirstUseDialog`：
  - 不在 `/login`、`/setup#export-data`、`/import`；
  - `!(usageStatsAvailable && usageStatsConsent.value === null)`（等用量统计弹窗先回答）；
  - 本机所有本地账号都没有圣遗物和预设（复用 `needsFirstUse`）；
  - `welcomeDismissed` 为 `false` 且旧键 `mona.firstUseDone !== 'true'`。
- 关闭首次欢迎卡（无论点击「快速了解（3 步）」「先导入我的数据」还是「先自己逛逛」），都同时标记 `welcomeDismissed = true`（并写入 `mona.firstUseDone = 'true'` 保持旧逻辑一致）。

### 3. 跨页跳转、锚点定位与降级策略
- 切换步骤时，仅当 `step.route` 有值且不同于当前路由，才执行 `await router.push(step.route)`。
- 步骤未声明桌面或手机锚点时，直接设 `fallbackCentered = true` 并居中显示卡片。声明了锚点的步骤等待 `nextTick` 后轮询查询 `[data-tour="<anchor>"]`（移动端 `!geSmall` 优先查 `step.mobileAnchor`，桌面端查 `step.anchor`，最多等 600ms，每 50ms 检查一次，且要求元素 `getBoundingClientRect()` 宽高均大于 0）。
- 若找到可见元素：调用 `scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })`，等待一帧后计算高亮框矩形并监听 `resize` / `scroll` 实时更新。
- 若超时仍未找到可见元素：设 `fallbackCentered = true`，不渲染挖孔高亮，直接居中显示步骤卡片，用户依然可以点「下一步 / 上一步 / 结束」，不会卡死。
- 键盘支持：引导激活时监听 `ArrowRight` / `Enter`（下一步）、`ArrowLeft`（上一步）、`Escape`（退出引导）。

### 4. 双端与主题适配
- 主题色统一使用 `--cx-card` / `--cx-ground` / `--cx-letter` / `--cx-dim` / `--cx-gold`（若未在 `.cx-scope` 内，提供合理 fallback 或给组件根节点加 `cx-scope`），同时在浅色和深色模式下清晰可读。
- 桌面端（`geSmall`）：半透明深色遮罩 + 目标高亮边框 + 气泡卡片（自动根据目标位置在上下左右择优摆放并约束在视口内）。
- 手机端（`!geSmall`）：半透明遮罩 + 目标高亮边框 + 底部固定卡片（带安全区 `env(safe-area-inset-bottom)`），保证按钮易点、内容不被裁切。
- 尊重 `prefers-reduced-motion: reduce`，关闭平滑滚动与过渡动画。

## Out of Scope

- 不做后端云端同步引导进度（仅存本机 `localStorage`）。
- 不做交互式强制操作校验（例如不强制用户必须点中某个表单控件才能进入下一步，始终允许点「下一步」或随时退出）。
- 不为引导单独新增英文翻译文件（先沿用项目中文界面文案，与 `FirstUseDialog.vue` 保持一致）。
- 不新增第三方引导库依赖（如 `driver.js`、`intro.js`），也不升级 `element-plus`。

## Verification Plan

- 单元测试（`node --test tests/onboarding.test.mjs`）：
  1. 清单完整性校验：ID 唯一、步骤非空、已声明的 `route` 均在 `src/router/router.js` 中存在、无空标题/空正文，以及快速引导共 3 步且均无指定路由。
  2. 状态与持久化测试：`mona.onboarding.v1` 读写、完成状态去重、重置进度、读取旧标记、关闭欢迎卡时双写新旧键、旧键写入失败时保留返回值和会话进度。
  3. 锚点一致性测试：扫描 `src/` 下所有 `.vue` 文件，确认 `guides.mjs` 中声明的每一个 `anchor` 与 `mobileAnchor` 在源码中至少出现一次 `data-tour="<key>"`。
- 兼容测试：`node --test tests/first-use.test.mjs` 保持通过。
- 构建验证：`npm run build:local` 通过。
- 人工验收（见 `issues/06-build-and-acceptance.md`）：桌面宽屏 + 手机窄屏、浅色 + 深色模式下的首次弹出、快速引导三步留在当前页且第二步直接居中、6 套详细引导与降级表现。
