# 公式与属性作用域

改公式、乘区、BUFF 作用域或反应系数前先读本文件。内容整理自 `docs/handoff-7.1.10-20261014.md` 第 4、5 节，以开发者最新确认的语义为准。

## 乘区与作用域

- `IndependentDamageMultiplier` 是普通直伤的独立倍率，不自动作用于月曜直伤或星烁直伤。标准基础分支为 `技能基础 × 独立倍率 + 定额加值`，该倍率不乘定额加值。
- 月曜直伤使用 `MoonReactionDamageMultiplier`；星烁的「造成原本 X%」效果走明确的星烁专属属性和 tag。普通倍率或基础反应系数不能代替它们。
- **月伤擢升在最后作为独立乘区**，作用于本体和定额的合计，不并入普通增伤或精通区。
- 保留的月曜直伤使用伤害所有者自身的精通和双暴，走对应元素抗性，不走敌人防御区，也不自动吃普通元素增伤。直接月感电／月绽放／月结晶的基础系数分别为 3／1／1.6。
- 直接星扩散基础系数为 1；星超导基础系数按极星辉域的已实现规则处理。已删除的反应星扩散·冰系数不是直接星扩散的系数。
- 来源角色面板与受益角色面板分开；前台／后台、触发条件、命座、层数、覆盖率及同源不叠加都要明确建模。BUFF 只在条件满足时生效；手填的最终面板已包含的属性不再重复加。
- 技能等级的显示值与内部索引不一定一致，查数据定义后转换。最终普通／暴击／期望结果必须是有限数值；元数据不混入属性加总。
- 新效果的定额位置、倍率适用范围需要开发者单独确认，不凭相似的中文描述推断。

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
