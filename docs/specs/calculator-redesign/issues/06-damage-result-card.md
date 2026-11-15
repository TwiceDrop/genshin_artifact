# 06: 伤害卡

**What to build:** 分组技能列表 + 大字期望伤害的伤害卡，替代原「伤害计算」卡片。

**Blocked by:** 02

**Status:** done

规格见 `../spec.md` 解决方案 3。

- [x] `DamageResultCard.vue`：技能列表分组和顺序与 `SelectCharacterSkill` 的 `skillMap` 一致，选中项绑定 `characterSkillIndex`
- [x] 主数字是第一行（直伤或治疗）的期望值，下面暴击、不暴击；伤害类型标签沿用 `DamagePanel` 的反应标签
- [x] 有多种反应行时依次列出；有基线时显示「之前 → 现在」、差值和百分比，涨跌颜色沿用现有约定
- [x] 技能设置（`item-config`）、剧变反应伤害、「伤害明细 ›」放在下方
- [x] 窄屏时技能列表改为横向滚动的分组标签
- [x] `DamagePanel.vue` 的取数和对比计算抽成可复用的部分供两处使用，不复制一份（`tests/reaction-labels.test.mjs` 读它的组件选项，保持通过）
- [x] 验证：同一技能的期望 / 暴击 / 不暴击与旧表格一致；有反应的角色（如胡桃蒸发）各行都在

## Comments

- 2026-11-15：没有另抽取数逻辑，而是给 `DamagePanel` 加了 `layout` 属性（`table` 原表格，配装结果弹窗继续用；`feature` 大字布局，伤害卡用），两种布局共用同一个 `tableData`。技能分组抽成 `src/utils/character-skill-groups.ts`，技能下拉框和伤害卡共用。「敌人设置」暂时放在伤害卡标题栏，07 移到条件卡。涨跌颜色改成涨红跌绿，与现有约定一致。
- 验证：DOM 检查。一段伤害 341 / 429 / 286 与旧表格一致；切到「爆炸伤害」显示 1219、火元素伤害。`direct-reactions-only-7108` 通过；`reaction-labels` 有 2 项失败（`sameHitBaseline is not defined` 等），不带本次改动的 `DamagePanel` 也同样失败，是测试本身没注入依赖，已告知开发者。
