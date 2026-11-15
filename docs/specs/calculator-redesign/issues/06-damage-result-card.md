# 06: 伤害卡

**What to build:** 分组技能列表 + 大字期望伤害的伤害卡，替代原「伤害计算」卡片。

**Blocked by:** 02

**Status:** ready-for-agent

规格见 `../spec.md` 解决方案 3。

- [ ] `DamageResultCard.vue`：技能列表分组和顺序与 `SelectCharacterSkill` 的 `skillMap` 一致，选中项绑定 `characterSkillIndex`
- [ ] 主数字是第一行（直伤或治疗）的期望值，下面暴击、不暴击；伤害类型标签沿用 `DamagePanel` 的反应标签
- [ ] 有多种反应行时依次列出；有基线时显示「之前 → 现在」、差值和百分比，涨跌颜色沿用现有约定
- [ ] 技能设置（`item-config`）、剧变反应伤害、「伤害明细 ›」放在下方
- [ ] 窄屏时技能列表改为横向滚动的分组标签
- [ ] `DamagePanel.vue` 的取数和对比计算抽成可复用的部分供两处使用，不复制一份（`tests/reaction-labels.test.mjs` 读它的组件选项，保持通过）
- [ ] 验证：同一技能的期望 / 暴击 / 不暴击与旧表格一致；有反应的角色（如胡桃蒸发）各行都在

## Comments
