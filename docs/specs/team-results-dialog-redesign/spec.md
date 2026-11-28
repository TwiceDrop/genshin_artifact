# 四人圣遗物搭配结果弹窗优化（方案 A）

Status: done

2026-11-28 开发者选定 **方案 A（全宽对齐行表型）**，用于优化「多人优化 → 查看搭配结果」弹窗（`src/pages/TeamOptimizationPage/TeamDpsPage.vue` 中的 `四人圣遗物搭配结果` `el-dialog`）。

动手前先读根目录 `AGENTS.md`。视觉严格沿用 `src/styles/content-theme.css` 的 `--cx-*` 色板与 `src/pages/TeamOptimizationPage/team-dps-night.css` 的夜空风格，同时兼容深色和浅色模式。

> 配套离线可交互示意图：[prototype.html](./prototype.html)（无外链依赖，直接在浏览器打开可切换桌面/手机、夜空深色/日间浅色、排序指标、与第 1 套差异高亮以及「优化前对照」）。

## Problem Statement

当前 `TeamDpsPage.vue`（约 L130–L139、L358）中的搭配结果弹窗存在以下问题：

1. **视觉缺乏层级**：排名（`第N套`）、期望/暴击/非暴击伤害、DPS、角色名与 5 件圣遗物全部使用 `--cx-dim` 同色灰，字号接近，关键数值不突出。
2. **右侧大片留白**：弹窗宽度为 `94%`，但所有内容左对齐挤在左半边，`查看详情` 按钮悬浮在顶栏中段，版面失衡。
3. **圣遗物列表重复冗长**：当前用 `Object.values(row.result.artifacts[r])` 顺序输出 5 段「套装全名 +等级」（例如连续出现 4 次 `纺月的夜歌 +20`），无法一眼看出生效套装（4 件 / 2+2 / 散件）、固定部位顺序（花/羽/沙/杯/头）、沙杯头主词条，也难以察觉混入的 `+0` 未满级件。
4. **跨套对比效率低**：100 套方案间往往仅差 1~2 件圣遗物和不到 1% 伤害，当前缺少相对第 1 套的百分比差值、角色伤害占比可视化，以及与第 1 套不同槽位的高亮提示。

## Solution（方案 A：全宽对齐行表型）

弹窗继续保留原有 `el-dialog`（`width="94%"`，`custom-class="team-dps-dialog team-dps-results cx-scope viewport-dialog"`），重构内部工具栏与结果列表卡片：

### 1. 顶部工具栏（`.sort-bar`）

- **左侧**：
  - `排序` 下拉框（沿用现有 `sortMetric` 与 `damageModes`：`期望伤害` / `暴击伤害` / `非暴击伤害`）。
  - 轻量开关（勾选框）：`高亮与第1套差异`（默认开启；当结果不足 2 套时自动隐藏或置灰）。
  - 紧凑图例（宽屏显示，窄屏可折叠/隐藏）：
    - 暖色徽标：`未满级（< +20）`
    - 蓝色/强调描边：`与第1套不同`（跟随差异开关显隐）
- **右侧**：
  - `共 N 套`（如 `共100套`），以及当前选中提示（如 `当前选中：第2套`）。

### 2. 单套结果卡片（`.team-row`）

- 卡片铺满列表宽度，去掉粗糙细边框，用 `--cx-step` 底色与弹窗背景 `--cx-card` 区分层次，hover 微提亮至 `--cx-step` 与 `--cx-step-2` 过渡态。
- **选中态（`chosen`）**：左侧 `3px` 金色指示条（`inset 3px 0 0 0 var(--cx-gold)`）+ 柔和金边 + 极淡金色底色混合，并显示 `当前已选` 胶囊（不靠刺眼的纯黄细线框）。
- 点击整张卡片或点击右侧按钮仍触发原有 `selectResult(row.index)`，保留键盘 `tabindex="0"` 与 `@keydown.enter`。

#### 2.1 卡片顶栏（横跨全宽，`justify-content: space-between`）

- **左侧信息组**：
  1. **排名徽章**：`第N套`；第 1 套使用金色实底（`--cx-gold` / `--cx-gold-on`），其余套使用 `--cx-step-2` 底色 + `--cx-letter` 文字。
  2. **选中标识**（仅当前已选卡片显示）：`当前已选` 柔和金色胶囊。
  3. **当前排序主指标**（跟随 `sortMetric` 动态切换）：标签用 `--cx-dim`，数值放大加粗（`19px–20px`、`--cx-letter`、`font-variant-numeric: tabular-nums`），紧跟相对当前排序第 1 套的差值胶囊：
     - 第 1 套显示 `最高`（金色软底胶囊）；
     - 其余套显示相对差值百分比，如 `-0.36%`（`((val - topVal) / topVal * 100).toFixed(2) + '%'`；若 `topVal <= 0` 不显示差值，避免除以 0）。
  4. **DPS 指标**：左分隔线区隔，标签 `DPS`（`--cx-dim`），数值使用 `--cx-gold` 加粗（`row.result[sortMetric] / row.result.duration`）。
  5. **其余两项次要伤害指标**：以较轻字号列出另外两个伤害维度（标签 `--cx-dim`，数值 `--cx-letter`），避免与主指标重复。
- **右侧操作区**：
  - 按钮右对齐固定在卡片最右侧：未选中套显示 `查看详情`（次按钮），当前已选套可显示 `当前详情` 或沿用 `查看详情`（金色主按钮样式强调当前项）。点击时 `@click.stop="selectResult(row.index)"`。

#### 2.2 四角色对齐行表（卡片主体）

4 位成员纵向排布为 4 行，桌面端采用**固定列宽 + 弹性装备列**的 CSS Grid，使跨卡片的同一角色严格纵向对齐：

```text
grid-template-columns: 120px 168px 160px minmax(0, 1fr)
```

每行包含 4 列，偶数行叠加极浅 `--cx-card` 斑马底提升扫视效率：

1. **角色列（120px）**：
   - `28px` 圆形头像（`characterData[role].avatar`）+ 对应元素色边框（`elementColors[characterData[role].element]`）；
   - 角色名（`labels[r]`，`--cx-letter`，半粗体，单行省略）。
2. **伤害与占比列（168px）**：
   - 上行：该角色在当前 `sortMetric` 下的伤害值（`--cx-letter`，`tabular-nums`）与队伍占比百分比（如 `51.9%`，`--cx-dim`；总伤为 0 时显示 `0%`）；
   - 下行：`5px–6px` 圆角进度条，填充色使用 `elementColors[characterData[role].element]`，直观反映各成员输出占比。
3. **生效套装列（160px）**：
   - 统计该成员 5 件圣遗物各套装数量，仅展示触发效果的套装：
     - `≥ 4 件`：展示金色软底胶囊 `<套装名> 4件`；
     - `2~3 件`：展示中性胶囊 `<套装名> 2件`（2+2 时并排/换行显示两个胶囊）；
     - 无任何 `≥ 2 件`：展示虚线灰胶囊 `散件`。
   - 悬停 `title` 显示完整套装统计。
4. **5 件圣遗物槽位列（`minmax(0, 1fr)`，内分 5 等分 `repeat(5, minmax(0, 1fr))`）**：
   - **固定按部位顺序展示**：`['flower', 'feather', 'sand', 'goblet', 'head']`（不再用 `Object.values`，保证花/羽/沙/杯/头顺序稳定）。
   - 每个槽位为一张紧凑芯片（`.slot-chip`），包含：
     - 圣遗物真实图标（`artifactsData[a.setName][a.position].url`，`24px–26px` 圆角底）；
     - 上行：套装名（单行省略，空间不足时自然截断）+ 右侧 `+等级`（`tabular-nums`）；
     - 下行：部位简称（`花`/`羽`/`沙`/`杯`/`头`）；对于 `sand` / `goblet` / `head` 追加主词条名称（如 `沙 · 充能` / `杯 · 防御%` / `头 · 暴伤`，数据直接来自 `displayedTagParts(a.mainTag.name, a.mainTag.value)`）。
   - **未满级提示**：当 `a.level < 20`（或 4 星 `< 16`、更简单统一按 `< 20` 且 5 星满级为 20，或按 `a.level < maxLevelForStar(a.star)`；建议统一 `a.level < (a.star >= 5 ? 20 : a.star === 4 ? 16 : 12)`，对截图中的 5 星 `+0` 即触发）时，等级文字与芯片边框/底色采用暖琥珀色强调，一眼识别未强化圣遗物。
   - **与第 1 套差异高亮**：当「高亮与第1套差异」开启且 `row.rank > 1` 时，若该成员该部位的圣遗物 `id` 不等于当前排序第 1 套对应成员同部位的 `id`，给槽位芯片叠加蓝色微高亮描边与浅底。若同时未满级且有差异，保留差异描边并在等级数字保持暖色。
   - **悬停/轻点词条预览**：悬停单个圣遗物槽位时展示完整信息（套装全名、`+等级`、部位、主词条、副词条及强次、若开启差异高亮则注明「与第1套此部位装备不同」）。

### 3. 响应式规则

项目桌面与手机共用同一套页面（见 `AGENTS.md`）：

- **宽屏（`> 1200px`）**：完整 4 列对齐行表，5 个槽位一行排开。
- **中等宽度（`851px – 1200px`）**：缩减前三列宽度（如 `108px 146px 136px minmax(0, 1fr)`）并减小间距；如单槽位过窄（`< 108px`），允许 5 槽位折为两行（`repeat(3, minmax(0, 1fr))`）或卡片内容自适应换行，避免文字挤成单字。
- **平板/手机（`≤ 850px`）**：
  - 卡片顶栏自动折行，按钮靠右或独立成行；
  - 每位成员行转为堆叠小卡（上行：头像 + 名字 + 伤害/占比 + 生效套装；中行：占比条；下行：5 个槽位 `repeat(2, minmax(0, 1fr))` 网格，第 5 件自然排在第 3 行左列）；
  - 顶部工具栏允许换行，图例可缩减或隐藏以节省纵向空间。

## Implementation Decisions

合入 `main` 时沿用主线的 shadcn-vue `TeamDialog` 和排序下拉，方案 A 的行表和共享词条预览接入该弹窗。

1. **组件拆分（单一职责）**：
   - `TeamDpsPage.vue` 目前已有大量页面状态与多个弹窗，建议将「四人圣遗物搭配结果」弹窗抽为同目录独立组件 `src/pages/TeamOptimizationPage/TeamResultsDialog.vue`（通过 `v-model:visible`、`v-model:sortMetric`、`results`、`selectedIndex`、`roles`、`labels`、`items`、`elementColors` 与 `@select` 通信），保持 `TeamDpsPage.vue` 简洁并便于单独维护和单测。
   - 配套纯函数（如套装聚合、与第 1 套差异计算、相对差值计算、槽位顺序提取）可放在同目录小模块或组件脚本内；若抽取纯函数模块，可方便用 `node --test` 覆盖边界情况。
2. **100 套结果性能保护（重要）**：
   - 100 套 × 4 人 × 5 槽位 = **2,000 个圣遗物槽位**。
   - **禁止**在每个槽位上各挂载一个独立的 Radix `UiHoverDetails` / `el-popover` 实例（同时创建 2,000 个弹窗/Tooltip Provider 会导致打开弹窗卡顿）。
   - 推荐实现方式（二选一）：
     - **推荐**：弹窗内只维护**一个共享浮层状态**（记录当前 hover/focus 的 `{ artifact, slotKey, isDiff, anchorRect }`），监听槽位 `mouseenter` / `mouseleave`（或事件委托）定位展示，零额外组件实例开销，也可复用 `ArtifactCard`（`readonly`）或轻量预览面板渲染详情；移动端点击卡片直接进详情页即可，不在列表里阻塞点选。
     - 或结合列表分页/分批渲染（例如默认首屏渲染 20 套 + 滚动加载更多），同时仍保留单一共享浮层。
3. **样式与主题兼容**：
   - 所有颜色通过 `src/styles/content-theme.css` 的 `--cx-*` 读取，弹窗已带 `cx-scope`，深色与浅色模式自动联动。
   - 注意 `script/postcss-mona-colors.cjs` 会对包含 `background`、`text`、`line`、`edge`、`accent`、`color` 等角色词的自定义 CSS 变量做二次映射（见 `content-theme.css` 与 `ArtifactIcon.vue` 注释），新增局部 CSS 变量名需避开这些词（例如用 `--tr-warn`、`--tr-diff-ring`、`--tr-gold-tint`）。
   - 检查 `src/pages/TeamOptimizationPage/team-dps-night.css` 是否对 `.team-row` 或弹窗内按钮/边框有额外覆盖，保持深浅两套主题对比度清晰。
4. **严格不改业务逻辑**：
   - 排序规则仍调用现有 `teamDpsObjectiveValue(b.result, target, sortMetric)`；
   - 点击方案仍调用现有 `selectResult(row.index)`，关闭弹窗并加载逐段明细；
   - 不改动计算输入、存档结构、`output` 数据格式或 `TeamDpsPage.vue` 其他区域。

## Edge Cases

- `output?.results` 为空：保留空态提示，不报错。
- 只有 1 套结果：不显示差异开关的差异态；第 1 套正常显示 `最高`。
- `row.result[sortMetric]` 或 `topVal` 为 `0`：伤害占比显示 `0%`，不显示 `NaN%` / `Infinity%` 差值。
- 某槽位圣遗物在 `resultContext.value.items` 中查不到（极端历史快照缺项）：按真实缺项显示占位（如「缺失」），不抛未捕获异常阻塞整个列表渲染。
- 切换 `sortMetric`（期望伤害 / 暴击伤害 / 非暴击伤害）时：排名、主指标、相对第 1 套差值、DPS、各角色伤害与占比条、以及「第 1 套差异基准」均同步更新。

## Verification

按 `AGENTS.md` 控制每轮最多 5 项针对性验证：

1. **构建 / SFC 编译检查**：确认新增/修改的 Vue 组件无模板错误、TypeScript 类型错误和未解析组件标签。
2. **纯逻辑单测（若抽出辅助函数）**：覆盖套装聚合（4 件、2+2、3+1+1 归为 2 件、全散件）、相对第 1 套百分比差值（含 `topVal === 0`）、差异槽位比对、部位固定顺序。
3. **浏览器实测（桌面宽屏 1440px，夜空深色 + 日间浅色）**：使用合成多人优化结果打开「四人圣遗物搭配结果」弹窗，检查顶栏对齐、4 列纵向对齐、生效套装胶囊、5 槽位图标/+等级/主词条、未满级提示、与第 1 套差异高亮、悬停词条浮层，以及切换排序和点击选中态。
4. **浏览器实测（窄屏 390px 手机宽度）**：确认不出现横向溢出、卡片与槽位折行可读、点击切换方案正常。

## Out of Scope

- 不改动四人轴计算引擎、Worker、优化算法或结果导出结构。
- 不改动 `TeamDpsPage.vue` 主页面的「计算结果」「四人装备」「逐段伤害」区域。
- 不在结果弹窗里新增过滤/筛选器（如按套装筛 100 套）或一键锁装备功能；如有需要后续单开规格。
