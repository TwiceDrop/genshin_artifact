# 11-27 推送代码的审查修复清单

Status: ready-for-agent

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

## Comments

### 复审 `cc134f1`（11-27）

方式：前端 Gemini 4 Neon，后端 Codex（`gpt-6.2-sol`）。Claude 跑了 4 个测试文件共 30 项，全部通过；在浏览器里实测了分享 DSL 弹窗、面板范围弹窗和 390px 宽的「保护圣遗物」。没有跑全量测试，Windows 托盘冒烟和 GPU 没有跑。本节行号对应 `cc134f1`。

#### 清单结果

| 编号 | 结果 |
| --- | --- |
| H1 | 修好（浏览器实测） |
| H2 | 草稿能保住了，回跳行为不一致，见 R3 |
| H3 | 只修了一部分，见 R1 |
| M1 | 修好（浏览器实测） |
| M2 | 修好（短预设名实测，长名只看了 CSS） |
| M3、M4 | 修好 |
| L1、L3、L5、L7 | 修好 |
| L2 | 只覆盖「伤害配装」，见 R6 |
| L4 | 已换成 `UiDialog`，带出 R2 |
| L6 | 断言又错了，见 R4 |

#### 还要改的

| 编号 | 级别 | 问题与改法 | 依据 |
| --- | --- | --- | --- |
| R1 | 高 | 剪枝只处理「生命上限且没有任何 BUFF」。换成攻击上限 1，或带一个只加攻击的 BUFF，仍然核对全部 1024 个组合；逐段 DSL 也还是逐组合检查。可先判下限大于上限，再用保守面板区间剪掉可证明无解的分支。`damage-panel-range-optimizer.mjs:22` | Codex 在 WASM 复现计数；Claude 核对了剪枝条件 |
| R2 | 中 | 「计算设置」（`el-dialog`）里打开「面板范围设置」（`UiDialog`），按一次 Esc 两层一起关。把外层也迁到 `UiDialog`，或内层打开时关掉外层的 `close-on-press-escape`。`NewArtifactPlanPage.vue:194` | 浏览器实测 |
| R3 | 中 | `LoginPage` 的 `returnToShare` 只在页面首次创建时取一次，而页面被 `keep-alive` 缓存。结果是登录后有时回分享页、有时进首页；进首页时 `contentShareReturnPath` 留着，可能让下一次登录或选离线跳回旧分享页。先定预期行为，再在 `leave()` 时判断。`LoginPage.vue:108`、`:133` | 源码确认，未实测 |
| R4 | 低 | 托盘日志每行带 `[HH:mm:ss] ` 前缀（`TrayLauncher.cs:146`），新断言要求整行等于裸消息，会把正常启动判为失败。改为匹配行尾。`tests/tray-launcher-7108.cs:99` | 源码确认 |
| R5 | 低 | 剪枝在候选检查之前：薇斯纳库存里有未适配的成套圣遗物时，生命上限 1 会直接返回空结果，原来的错误提示没了 | Codex 在 WASM 复现 |
| R6 | 低 | 「面板配装」里下限大于上限仍然没有提示 | 源码确认 |
| R7 | 低 | `Heuristic` 算法下，生命上限剪枝可能误删有效配装。页面会把它转成 `AStar`，只有直接调用后端才会触发 | Codex 在 WASM 复现 |
| R8 | 低 | `UiDialog` 固定 `z-index: 2400`，Element Plus 层级单调递增，长时间使用后内层弹窗可能被压到外层后面 | 读代码推断，未复现 |

另外请确认：新增文案「面板属性下限不能大于上限。」（中英文各一条）是否就是要用的措辞。

Gemini 还认为 R2 的两层弹窗会互相抢焦点导致无法输入。浏览器里实测输入和 Tab 切换正常，没有复现，所以没有列入。

### 审查 `5c26e09`、`ae248db`、`2c6e43c`（11-27）

方式：界面给 Gemini 4 Neon，数据与逻辑给 Codex（`gpt-6.2-sol`）。Claude 跑了 `tests/dsl-library.test.mjs`（4 项通过）和 `tests/usage-stats-features.test.mjs`（2 项失败），在浏览器里看过 DSL 管理页的桌面和 390px 宽布局。没有做多窗口、云档案和 GPU 实测，没有跑全量测试。本节行号对应 `2c6e43c`。

| 编号 | 级别 | 问题与改法 | 依据 |
| --- | --- | --- | --- |
| N1 | 高 | 完整备份不含 DSL 手法库，换机恢复后手法全部丢失，导入仍提示成功。备份和恢复只遍历 `profile-domains.mjs`。给离线备份加可选的手法库字段，旧备份缺字段时照常导入。`account-backup.mjs:58`、`:98` | Codex 用合成数据复现；Claude 核对源码 |
| N2 | 中 | 两份默认参数相同的同名 BUFF 分别绑到两个状态，只改其中一份，另一份跟着变，保存的源码也变。`updateBuff` 按名称加参数匹配。给每份 BUFF 独立标识。`useDslManagement.ts:297` | Codex 复现；Claude 核对源码 |
| N3 | 中 | 选中已保存手法后切到「MONA-DSL」看源码，再切本地账户，旧账户的手法源码仍是当前配装目标，还能存进新账户的预设。切标签时保留来源归属。`useSavedDslTarget.ts:34` | Codex 复现；Claude 核对源码 |
| N4 | 中 | 新页面 `/dsl-management` 没有登记使用统计功能 ID，控制台报错，`usage-stats-features.test.mjs` 失败。在 `server/usage-stats-features.mjs` 登记 | 测试和浏览器实测 |
| N5 | 中 | 删除账号后编号会被复用。另一个窗口里没关的手法草稿保存时，会写进复用该编号的新账户。给账户一个不复用的身份。`account.ts:56`、`backend.ts:100`。Codex 定为高，这里因需要多窗口按特定顺序操作而降级 | 源码推断，未实测 |
| N6 | 中 | 账户删除的事务失败时，内存里的账户列表已经改了，数据没清完，加载遮罩不关闭。`backend.ts:26`、`account.ts:186` | Codex 读源码，Claude 未复核 |
| N7 | 中 | 手机上圣遗物页吸顶区约 330px，列表几乎看不到。小屏取消整块吸顶或只留部位条。`ArtifactsPage.vue:771` | Gemini 按代码估算，未实测 |
| N8 | 中 | 「已保存手法」列表项的样式权重低于 `UiButton` 的 scoped 规则，两行布局、内边距和 44px 触控高度都不生效。`NewArtifactPlanPage.vue:2695` | 源码确认，未实测 |
| N9 | 中 | `UiSelect` 是多根节点，`DslInputs.vue` 传的 `class` 不会落到触发器上，下拉框宽度异常。用 `:deep(.select-trigger)`。`DslInputs.vue:23`、`:35` | 源码确认，未实测 |
| N10 | 低 | 编辑器把来源从生成器切到 MONA-DSL 时不带过生成结果，输入框空白或是旧源码，保存会丢掉这次修改和生成器结构。`useDslManagement.ts:243` | 源码确认 |
| N11 | 低 | `source` 为 `result =` 这类残缺源码也能导入，到配装时才报错。`dsl-library.mjs:85` | Codex 复现 |
| N12 | 低 | 旧库首次迁移若中途中断，默认账户能用但保存手法会误报账户已删除。`account.ts:205` | Codex 读源码，Claude 未复核 |
| N13 | 低 | 480px 以下武器卡片不再上下排，长武器名折成多行。`RosterWeaponCard.vue:70` | Gemini 读代码，未实测 |

另外两点：

- `ElMessage` 和 Element Plus 弹窗可能被固定层级的 `UiDialog` 盖住，和 R8 是同一个根因，一起改。
- 手法库不进云档案同步，「下载为新本地账号」不会带手法。规格本期只要求本地管理和文件交换，是否纳入需要开发者决定。

`usage-stats-features.test.mjs` 的另一项失败（`/presets`）不是这 3 个提交引入的。
