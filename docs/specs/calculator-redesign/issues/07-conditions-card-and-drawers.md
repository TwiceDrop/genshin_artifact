# 07: 计算条件卡与 BUFF、队友、敌人抽屉

**What to build:** BUFF、队友、敌人三行摘要卡，以及对应的三个抽屉，替代原「BUFF」卡片和伤害卡上的「敌人设置」按钮。

**Blocked by:** 02

**Status:** ready-for-agent

规格见 `../spec.md` 实现决定 2、文案。

- [ ] `CalcConditionsCard.vue`：三行摘要，格式按规格「文案」一节
- [ ] `BuffDrawer.vue`：`selected-buff-groups` 列表、BUFF 项编辑、「添加 BUFF」（仍打开原弹窗）
- [ ] `TeammateDrawer.vue`：队友预设来源、触发开关、极星辉域及层数（原 `#character-controls` 插槽内容）
- [ ] `EnemyDrawer.vue`：原「敌人设置」弹窗的内容（敌人配置与附魔），弹窗删除
- [ ] `handleSelectBuff` 等函数留在页面脚本，`tests/buff-dialog-7110.test.mjs` 保持通过
- [ ] 验证：添加两个 BUFF、改敌人等级后摘要和伤害正确更新

## Comments
