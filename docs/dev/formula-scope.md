# 公式与属性作用域

改公式、乘区、BUFF 作用域或反应系数前先读本文件。内容整理自 `docs/history/handoff-7.1.10-20261014.md` 第 4、5 节，以及 `docs/history/` 下的 `independent-damage-scope.md`、`lunar-character-adapters.md`、`lunar-equipment-adapters.md`、`unified-buff-coverage.md`，以开发者最新确认的语义为准。各条的公式推导、等级表和查证来源见这些原文件。

## 乘区与作用域

- `IndependentDamageMultiplier` 是普通直伤的独立倍率，不自动作用于月曜直伤或星烁直伤。标准基础分支为 `技能基础 × 独立倍率 + 定额加值`，该倍率不乘定额加值。
- 月曜直伤使用 `MoonReactionDamageMultiplier`；星烁的「造成原本 X%」效果走明确的星烁专属属性和 tag。普通倍率或基础反应系数不能代替它们。
- **月伤擢升在最后作为独立乘区**，作用于本体和定额的合计，不并入普通增伤或精通区。
- 保留的月曜直伤使用伤害所有者自身的精通和双暴，走对应元素抗性，不走敌人防御区，也不自动吃普通元素增伤。直接月感电／月绽放／月结晶的基础系数分别为 3／1／1.6。
- 直接星扩散基础系数为 1；星超导基础系数按极星辉域的已实现规则处理。已删除的反应星扩散·冰系数不是直接星扩散的系数。
- 来源角色面板与受益角色面板分开；前台／后台、触发条件、命座、层数、覆盖率及同源不叠加都要明确建模。BUFF 只在条件满足时生效；手填的最终面板已包含的属性不再重复加。
- 技能等级的显示值与内部索引不一定一致，查数据定义后转换。最终普通／暴击／期望结果必须是有限数值；元数据不混入属性加总。
- 新效果的定额位置、倍率适用范围需要开发者单独确认，不凭相似的中文描述推断。

## 两个独立倍率 BUFF

| BUFF | 配置名 | 只作用于 |
| --- | --- | --- |
| 普通独立伤害倍率 | `IndependentDamageMultiplier` | 普通技能伤害本体 |
| 星扩散伤害倍率 | `StellarSwirlDamageMultiplier` | 直接星扩散本体 |

- 参数 `p` 是最终倍率百分数：100 为原倍率，150 为本体乘 1.5，0 为本体归零，省略时为 100。原发布内核内部按 `(p−100)/100` 编码，所以默认值是 100 不会让旧角色翻倍；旧配置显式填 `p=0` 仍是本体归零，不做迁移。
- 同名 BUFF 只取第一个未停用的副本。多个来源要先按已确认的规则合成一个最终倍率，不在这里猜叠加关系。
- 普通伤害：`[(ATK×M_atk + DEF×M_def + HP×M_hp + EM×M_em) × p/100 + F] × 增伤 × 暴击 × 防御 × 抗性`。激化额外基础伤害、普通定额、坠地定额都在倍率之后。
- 直接星扩散：`[ATK×M×K×p/100 × (1+B_base) × (1+6EM/(EM+2000)+B_stellar) + F] × C × R × (1+E)`。定额 F 不乘倍率，擢升 E 乘本体与 F 之和。
- 普通倍率不影响直接星扩散、星超导、月曜伤害、治疗和护盾。目前没有通用的星烁倍率或星超导倍率，不能只建一个没有消费者的属性就算已支持。
- 普通倍率的旧配置里 `scope` 省略、为 0 或 `ordinary` 时按普通倍率处理；其他值直接报错（`beta-data/buff-rule-registry.mjs`），要求改用单独的星扩散倍率 BUFF。

## 月曜角色与装备 BUFF

规则在 `beta-data/lunar-character-rules.mjs` 和 `lunar-equipment-rules.mjs`，经 `extension-buffs.mjs` 注册，由 `reaction-parameter-rules.mjs` 绑定到单个受益人，`lunar-damage.mjs`、`bloom-damage.mjs` 消费。

- 来源面板属于 BUFF 来源角色。月感电／月绽放／月结晶的基础提升分别为 `min(ATK×0.00007, 0.14)`、`min(EM×0.000175, 0.14)`、`min(DEF×0.00007, 0.14)`。开启标志只表示来源有资格，不会自动转换元素事件。
- 月曜定额加在本体及其独立倍率之后，再一起乘暴击、抗性和最终擢升。擢升在最后一个乘区，各已确认来源相加。
- `full_moon`、`recipient_on_field`、`domain_active` 等字段声明本次命中的状态。显式填写的伤害所有者前后台优先于 BUFF 的默认值；已编译的 `ExtensionEffect` 保留编译时的资格和来源去重，不再套一次默认资格。
- 手填反应面板要填最终的攻击／生命／防御／精通，普通面板增益不会在反应公式里再加一次。手填与 BUFF 注入的同一反应增益或同一元素暴伤会重复计算。最终抗性倍率和 BUFF 前的原始抗性二选一，选前者时不再扣 BUFF 减抗。
- 叶洛亚 Q 的月结晶定额只给直伤月结晶，不进入月笼谐奏的多人贡献。
- 菈乌玛初辉给普通绽放／超绽放／烈绽放固定 15% 暴击、100% 暴伤，忽略角色面板双暴；满辉只给月绽放 10% 暴击、20% 暴伤。普通草原核独立结算。
- 装备队友 BUFF 的反应增伤进入精通／反应增伤加算区，不进入擢升；普通岩伤只进入普通元素增伤，不在月结晶里再乘一次。
- 月辉明光按不同类型计数，目前确认崇信、蓄念两种，每种 10%，合计最多 20%，同类型重复不叠加。纺月的夜歌、穹境示现之夜的旧字段 `rate` 表示不同类型的总增伤，只接受 0、0.1、0.2，其他值报错。自身四件套配置了月曜增伤或纺月精通、又添加了队友套装 BUFF 时会报错，要求只在一处填写。
- 纺夜天镜队友 BUFF 需要两个状态都开启，乘的是 `overlap_rate`（两状态的交集覆盖率），不用两个独立覆盖率相乘去猜交集。誓金枝的 `recipient_is_wielder` 为真时队友 BUFF 不生效，装备者自身的加成属于武器本体效果。
- 资格、层数、触发次数都由调用者声明，没有自动技能轴、自动逐击扣层或持续时间状态机。

## 已知的精度限制

- 极星辉域 0～12 次记录：星超导系数 K 为 1、1.45、1.50 … 1.95、2（第 1 次起每次加 0.05），冰／雷元素增伤为 20%、29%、30% … 39%、40%，物理抗性降低 40%。来源是 KeqingMains 星反应指南。
- 3～4 人反应星扩散按各人期望伤害排序后合成，是近似期望，开发者已同意保留并标注为近似，不能称为严格期望。月结晶多人期望用的是开发者提供的独立判暴、重排和 60%／30%／5%／5% 权重，不能据此推断星扩散也是同样的重排。
- 自动读取队友面板的来源只有 `beta-data/hybrid-team-optimizer.mjs` 的 `TEAM_BUFF_SOURCES`，其余来源要手动添加 BUFF 并填写来源数值。手填的来源面板不会随来源角色的候选装备重算。
- 阿贝多 `AlbedoWitchEve` 在 `def=0` 且任一覆盖率大于 0 时报错，要求填写来源防御。
- 257 个 BUFF 目录项都至少有一条接入路径，但这只是名称覆盖，不代表所有角色、模式和优化入口都已验证。

## 容易踩的坑

- 原始 WASM 内部的部分反应系数仍被桑多涅／瑞希的技能直伤借用。删除公开的独立反应入口，不等于可以全文搜索后删除所有同名私有字段，那会破坏保留的角色直伤。
- 停用（`lock`）的 BUFF 要在校验与原生调用之前过滤。
- 自定义敌人必须同时影响单次、配装和词条收益。
- 候选装备变化时，转换类 BUFF 要重新计算。优化器不能使用只在页面当前装备上算过一次的固定结果。

## 规则文件导航

| 修改内容 | 主要位置 |
| --- | --- |
| 通用角色 BUFF 规则入口 | `beta-data/character-effect-rules.mjs` |
| 规则数据 | `beta-data/` 下的 `classic-static-effect-rules.mjs`、`classic-effect-rule-book.mjs`、`character-rule-book.mjs`、`lunar-effect-rule-book.mjs` |
| 规则表达、执行和参数校验 | `beta-data/rule-dsl.mjs`、`effect-rule-engine.mjs`、`buff-rule-registry.mjs`、`buff-rule-schema.mjs` |
| 特殊作用域／旧内核效果映射 | `beta-data/scoped-character-effect-rules.mjs`、`extension-buffs.mjs`、`legacy-effect-bridge.mjs`、`legacy-effect-slots.mjs` |
| 角色、武器及套装的专用适配 | `beta-data/facade.mjs`、`stellar-support-facade.mjs`、`limited-weapon-facade.mjs`、`expanded-weapons.mjs`、`lunar-equipment-rules.mjs` |
| 单次公式和反应参数消费 | `beta-data/single-hit-damage.mjs`、`lunar-damage.mjs`、`direct-stellar-conduct.mjs`、`reaction-parameter-rules.mjs` |
| 当前功能边界、旧输入拒绝 | `beta-data/direct-reaction-scope.mjs`、`dsl-tokens.mjs` |
| 参数别名、默认值、敌人及停用 BUFF | `beta-data/interface-contracts.mjs`、`enemy-interface.mjs` |
| 技能伤害表、BUFF 界面 | `src/pages/NewArtifactPlanPage/` 下的 `DamagePanel.vue`、`TransformativeDamage.vue`、`BuffItem.vue` |
| 伤害明细和词条收益 | `src/components/display/DamageAnalysis/DamageAnalysis.vue`、`src/algorithms/reaction-labels.mjs`、`src/algorithms/stat-gain/curve.mjs` |
