# 11-27 推送代码的审查修复清单

Status: ready-for-human

## 范围与核对程度

- 审查的提交：`546280f`、`4f0ba89`、`985ad12`、`f1a5962`。文中行号对应 `f1a5962`。
- 审查方式：前端用 Gemini 4 Neon，后端用 Codex（`gpt-6.2-sol`），之后由 Claude 对照源码逐条核对。
- 全部问题都对照源码看过。浏览器、手机布局和 GPU 没有实测，界面类问题是按代码推断的。
- 标「Codex 复现」的问题，是 Codex 在 Node/WASM 里跑出来的，Claude 没有重跑。
- Codex 跑过逐段状态、玛薇卡减防、内核组合入口的 20 个定向测试，全部通过。没有跑全量测试。

修的时候按 `AGENTS.md`：每个问题单独改。要新增校验、拦截或兜底，以及新增界面文字，先和开发者确认。

## 总览

| 编号 | 级别 | 问题 |
| --- | --- | --- |
| H1 | 高 | 「配装设置」里的分享 DSL 弹窗被挡住 |
| H2 | 高 | 登录后预设和 DSL 分享草稿丢失 |
| H3 | 高 | 面板上限无解时配装近乎穷举 |
| M1 | 中 | 手机上「保护圣遗物」弹窗超出屏幕 |
| M2 | 中 | 窄屏预设按钮只占一半宽 |
| M3 | 中 | 薇斯纳加宽松上限后报「部位不足」 |
| M4 | 中 | 逐段语法下荧的旧旅者声明失效 |
| L1–L7 | 低 | 见「低优先级」 |

建议顺序：H1、H2、H3，然后 M3、M4，最后处理布局和低优先级项。

## 高优先级

### H1 分享 DSL 的弹窗被挡住

- 位置：`src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue:300`、`:343`、`:348`、`:1040`；`src/components/ui/UiDialog.vue:27`；`src/components/share/ContentShareDialog.vue:2`
- 操作：单次计算 → 配装目标 → MONA-DSL 或 DSL 生成器 → 点「分享 DSL」。
- 现状：「配装设置」是 `UiDialog`（radix 模态框，`z-index: 2400`）。分享弹窗仍是 Element Plus 的 `el-dialog`，默认层级从 2000 起。`shareDsl` 没有关闭「配装设置」。
- 后果：分享弹窗在后面，看不到，也点不到。
- 改法：`shareDsl` 里先设 `optimizeSettingsOpen.value = false`；或把 `ContentShareDialog` 也迁到 `UiDialog`。
- 验收：编辑器和生成器两个入口点分享，弹窗都在最前且可操作。

### H2 登录后分享草稿丢失

- 位置：`src/components/share/ContentShareDialog.vue:95-99`、`:128-132`；`src/pages/LoginPage/LoginPage.vue` 的 `leave()`；`src/pages/MainPage/SideBar.vue:102`
- 操作：未登录时打开角色预设分享或 DSL 分享，填标题和选项，点生成链接，完成登录。
- 现状：分享弹窗跳到 `/login?redirect=原页面`。`f1a5962` 让登录页忽略 `redirect`，固定进首页。弹窗监听到路径不是原页面，就执行 `close()` 清空草稿。
- 后果：标题、有效期、是否附带装备全部丢失，回到原页面也不会恢复。
- 说明：这是两边改动合在一起产生的问题。`f1a5962` 改规格和测试时只覆盖了四人轴分享；`docs/specs/share-links/spec.md` 的「DSL 和角色预设分享」一节验收过「登录返回」。
- 需要先定：登录后是进首页、再回原页时恢复草稿（和四人轴一致），还是预设和 DSL 分享仍然直接回原页。
- 改法：选前者时，`ContentShareDialog` 在离开登录页进首页时保留草稿，回到 `returnPath` 再显示；选后者时，登录页要继续认这条分享路径的 `redirect`。两种都要清掉不再生效的 `redirect` 参数（含 `SideBar.vue:102`）。
- 验收：未登录发起分享，登录后回到原页，标题和勾选还在，可以生成链接。

### H3 面板上限无解时近乎穷举

- 位置：`beta-data/damage-panel-range-optimizer.mjs:43-74`
- 操作：伤害配装里给面板设一个凑不出结果的上限，例如生命上限 1。设成下限大于上限也会走到这里。
- 现状：上限只在原生搜索返回之后检查。合格结果始终凑不满 100 个，按排名剪枝不会生效，只能一直二分候选。
- 后果：算很久才得到空结果。
- Codex 复现：凯亚、不限套装、每个部位 4 件，1024 个组合跑了 31 次原生优化和 2524 次面板计算。按每个部位 30 件估算，候选空间是 2430 万。
- 改法：把上限用于候选筛选，能证明无解的子域提前停止；已经算过的面板复用。
- 验收：同样的无解输入很快返回空结果；有解输入的前 100 名与改之前一致。

## 中优先级

### M1 手机上「保护圣遗物」弹窗超出屏幕

- 位置：`src/pages/NewArtifactPlanPage/PresetExclusionFilter.vue` 的样式块；`src/styles/mobile.scss:8`
- 现状：全局规则 `.el-dialog:not(.condition-settings-dialog)` 带 `margin: 8px auto 76px !important`，盖掉了弹窗自己的 `margin: 0`。宽度不超过 600px 时，高度是 `100dvh - 24px`，加上外边距超出屏幕。
- 改法：在 `mobile.scss` 里排除 `.preset-protection-dialog`，或把弹窗迁到 `UiDialog`。
- 验收：390px 宽打开弹窗，头部和确定按钮都在屏幕内。

### M2 窄屏预设按钮只占一半宽

- 位置：`src/pages/NewArtifactPlanPage/calculation-workbench.css:103-105`；`src/pages/NewArtifactPlanPage/CalcTopBar.vue`
- 现状：预设原来独占一行，`.preset-actions { max-width: 50% }` 取整行的一半。现在预设和标题同排，50% 取的是剩余宽度的一半。
- 后果：预设名被严重截断，旁边留白。
- 改法：窄屏下把 `max-width` 改为 `100%`。
- 验收：375px 宽查看长预设名。

### M3 薇斯纳加宽松上限后报「部位不足」

- 位置：`beta-data/damage-panel-range-optimizer.mjs:26-29`；`beta-data/vesna-facade.mjs`（`OptimizeSingleWasm` 的五部位检查）
- 操作：仓库五个部位齐全，但头只有攻击头；主词条筛选选暴击头；再加一个不会淘汰任何结果的面板上限。
- 现状：有上限时，范围优化器先按主词条筛掉攻击头，薇斯纳适配层只收到四个部位，抛错。没有上限时，适配层看到的是原仓库，筛选由内核做。
- 改法：有无上限两条路径用同样的筛选顺序和缺部位处理。
- 验收：同一组输入加上宽松上限前后，结果一致。

### M4 逐段语法下荧的旧旅者声明失效

- 位置：`beta-data/dsl-segment-target.mjs:57`；参照 `beta-data/lumine-traveler-facade.mjs` 的 `travelerModelName`
- 现状：旧 DSL 里荧可以写 `dmg hit = AetherDendro.Normal1`。同一份源码只要加一行 `state` 声明，就报「声明角色与当前角色不一致」。
- 原因：逐段入口按角色名精确比较，没有用旅者的等效模型映射。
- Codex 复现：草元素荧的合成夹具，旧写法得 `782.47`，加 `state` 后报错。
- 改法：复用这层映射，仍按荧自己的配置结算，保留荧专属修正。
- 验收：加 `state` 前后，未标状态的声明结果相同。

## 低优先级

| 编号 | 位置 | 问题与改法 |
| --- | --- | --- |
| L1 | `PanelRangeFields.vue:32` | 输入非法数字时直接 `return`，框里留着错值，计算仍用旧值。把显示值还原 |
| L2 | `PanelRangeFields.vue`、配装入口 | 下限大于上限没有提示，会走进 H3 的慢路径。要加报错，文案先确认 |
| L3 | `TeamOptimizationWrapper.vue:112` | 四人轴分享时放弃登录、选离线，再进多人优化，分享弹窗会闪一下再关。恢复前先判断是否已登录；草稿恢复本身要保留 |
| L4 | `NewArtifactPlanPage.vue:194` | 新增的「面板范围设置」仍用 `el-dialog`，与 `AGENTS.md` 的 `shadcn-vue` 约定不一致 |
| L5 | `dsl-segment-facade.mjs:69`、`dsl-segment-target.mjs:156` | 逐段入口接受手填反应面板，绕过了「仅限单次计算」的限制，配装时各候选得到同一个值。在逐段分流前套用同一限制。`src/` 的页面没找到发送这类字段的地方，所以定为低 |
| L6 | `tests/tray-launcher-7108.cs:99`、`:124` | 启动地址已改为 `/#/`，断言仍要求 `/#/calculate`。同步断言。Windows 冒烟测试没有实际跑过 |
| L7 | `dsl-segment-search.mjs:79` | 目标为负时，次优结果的比例超过 100%（Codex 复现：`result = -atk` 时为 1.073）。需要先定非正目标怎么显示 |

## 本地修复记录

- 已按 H1、H2、H3、M3、M4、M1、M2、L1–L7 的顺序修复。首次登录进入首页。从离线模式发起预设或 DSL 分享时，离开登录页后回到原页恢复表单。
- 凯亚无解复现原需逐候选读取 2,524 次面板，现只读取一次空装备面板。生命剪枝适用于无配置 BUFF、无自定义 DSL、五部位齐全且装备生命词条非负的输入。其他情形按实际面板筛选，并复用递归搜索中的面板判定。AStar、Naive 的有解对照分别验证了前 100 名。
- 伤害配装下限大于上限时，显示「面板属性下限不能大于上限。」并阻止计算。逐段 DSL 在最优分数不大于 0 时保留原始分数和排名，省略相对百分比。
- Chrome 使用生产构建核对了两个 DSL 分享入口、离线返回后的标题恢复、390px 保护弹窗、375px 长预设名，以及面板范围弹窗和计算拦截。
- Windows 托盘断言已同步且测试源码已通过编译。完整冒烟需要脚本指定的旧版启动器。
