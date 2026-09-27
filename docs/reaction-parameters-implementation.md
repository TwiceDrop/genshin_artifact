# 八项反应参数与两项共鸣：源码接入说明

> 最新追加（2026-09-26）：九位月曜角色22项规则已接入源码，五个JS案例通过，未构建。当前名称覆盖240/257、剩余17项；完整范围见 [lunar-character-adapters.md](lunar-character-adapters.md)。下文其他批次数字保留为历史快照。


2026-09-26，工作目录 `D:/Documents/ChatGPT/unified-kernel-work`。只更新源码，未构建 Rust/WASM/网页，未发布新版本。原发布内核未改动。

## 已实现的十项

| 标识 | 输入与公式 | 消费范围 |
|---|---|---|
| `ElevateMoonelectro` | `p/100` 加到月感电最终 E | 显式月感电贡献/直伤；扩展现有月感电消费者 |
| `ElevateMoonbloom` | `p/100` 加到月绽放最终 E | 月绽放直伤，含后加定额 |
| `ElevateMoonCrystallize` | `p/100` 加到月结晶最终 E | 月结晶反应贡献/直伤，含后加定额 |
| `CriticalMoonReaction` | `p/100` 加到伤害所有者月曜暴击率，合并后限制 0～1 | 各类月曜，队伍中逐参与者归属 |
| `CriticalDamageMoonReaction` | `p/100` 加到所有者月曜暴伤 | 各类月曜，普通/星伤不继承 |
| `MoonReactionDamageMultiplier` | 默认 100%；原生存 `p/100−1`，计算时取 1+增量 | 月曜本体分支，不乘后加定额；显式 0% 保留 |
| `StellarConductBaseMultiplier` | `value` 为 K 增量，如 0.70 表示 +0.70 | 直接星超导显式入口及原生公共消费者 |
| `StellarSwirlReactionCryoBaseMultiplier` | `value` 加到风涡冰系数 2/3 上 | 仅反应星扩散冰贡献，不改风系数 0.75 和直伤星扩散系数 1 |
| `ResonanceMoonOmen` | 按来源元素/面板转换为通用月曜反应增伤，上限 36% | 与精通反应增益相加，不当作基础提升或最终擢升 |
| `ResonancePolestarField` | 0～12 次整数记录转 K、普通冰雷增伤、40%物理减抗 | 三类属性分开；普通冰雷增伤不额外乘入星超导 |

月兆：火/雷/冰按攻击 ×0.00009，水按生命 ×0.000006，岩按防御 ×0.0001，风/草按精通 ×0.000225，各自封顶 0.36。禁止物理元素来源；来源面板仍显式填写，不宣称自动推断或随队友配装联动。

极星辉域：记录 0 时 K=1、冰雷加成 0.20；记录 n=1～12 时 K=1.4+0.05n、冰雷加成=0.28+0.01n；启用共鸣时物理减抗 0.40。写原生 K 属性的是 K−1，因此显式计算的基础 K 应填写未叠加本共鸣的值，通常为 1；不能先填完整 K 又勾共鸣。记录必须为整数，不对次数插值。

两种共鸣同名不叠加，采用现有注册器的首个启用来源；关闭/锁定条目跳过。原始条目和由其编译的 `ExtensionEffect` 通过 `source_buff` 去重。此策略不等于自动模拟多来源时间轴或选取最高面板。

## 代码接线

- `beta-data/reaction-parameter-rules.mjs`：十项规则、显式反应参数汇总、受益人绑定。
- `beta-data/extension-buffs.mjs`：加入正式适配注册器，编译到原生 `ExtensionEffect`，不只是加入支持名称。
- `mona_core/src/attribute/attribute_name.rs` 与 `beta-data/buff-rule-schema.mjs`：八项原生属性与配置 schema。
- `mona_core/src/damage/reaction_parameters.rs`、`damage_builder.rs`：原生共享消费者；复杂月感电与伊涅芙旧目标函数接入月曜倍率/双暴/擢升。月感电读取雷元素减抗，专属双暴加入后才限制暴击率。
- `beta-data/lunar-damage.mjs`：各类月曜显式直伤，以及月感电/月结晶多人贡献；月结晶各自判暴后排序，保留定额权重。
- `beta-data/direct-stellar-conduct.mjs`：星超导显式单次计算。
- `beta-data/stellar-swirl-reaction.mjs`、`facade.mjs`：冰风涡系数逐参与者应用。3～4 人近似期望标记保留。
- `beta-data/lunar-context-facade.mjs`：`lunar_crystallize_context`、`lunar_electro_context`、`direct_lunar_context`、`direct_stellar_context`；单次只能选择一种。
- `src/pages/NewArtifactPlanPage/LunarDamagePanel.vue`：直伤月感电/星超导入口；显式勾选当前 BUFF 给指定伤害所有者/参与者。手填数值不得已包含同一 BUFF，否则重复计算。

外层 API 的 `input.buffs` 默认仅绑定到 ID 与 `input.character.name` 相同的伤害所有者/参与者；也可用 `buffRecipientId` 明确指定。其他参与者须在自己的 `buffs` 中配置，不能将受益者 BUFF 自动广播到全队。

## 验证

执行 `node --test tests/reaction-parameters.test.mjs`，**5 个案例全部通过**，未加第 6 个：

1. 三类月曜擢升/双暴、倍率只乘本体、月兆七元素斜率和封顶、0%/默认倍率。
2. 月结晶暴击翻转排序、逐参与者 BUFF 归属、月感电贡献系数。
3. 星超导 K、定额隔离；极星辉域全部 0～12 次记录值、复合属性、去重和非法次数。
4. 反应星扩散冰系数仅影响指定参与者，风伤与近似标记保持。
5. 十项实际规则编译、原始/编译后条目一致、锁定条目排除、单次 API 接入与优化拦截；Vue SFC 语法解析。

测试为 JS 公式、注册器、以替身底层接口验证的适配层以及 Vue 语法检查；**没有编译或运行最新 Rust/WASM，没有做浏览器交互测试**。

## 保留的边界

- 公共公式/属性完成，不等于所有角色技能、全部目标函数和队友自动来源都接通。菈乌玛等角色 BUFF 仍按交接清单继续实现。
- 原生公共月绽放/月结晶/星超导消费者为角色映射提供入口；尚未映射的角色不会因枚举存在而自动产生伤害。伊涅芙现有目标仍是单主贡献者模型，不冒称完整多人优化。
- 显式手填反应面板仍拒绝进入配装、DSL、收益曲线和队伍优化，避免候选装备变化却保持手填伤害不变。
- `ResonanceMoonOmen` 的来源面板不是队伍自动联动；极星辉域次数不是自动战斗事件计数。
- 名称覆盖现为 218/257，仍有 39 项未接入；其中角色 34（已知主体公式 28、缺来源细则 6）、武器 3、套装 2。该统计不是完整模式兼容数。
