# 07: 计算条件卡与 BUFF、队友、敌人抽屉

**What to build:** BUFF、队友、敌人三行摘要卡，以及对应的三个抽屉，替代原「BUFF」卡片和伤害卡上的「敌人设置」按钮。

**Blocked by:** 02

**Status:** done

规格见 `../spec.md` 实现决定 2、文案。

- [x] `CalcConditionsCard.vue`：三行摘要，格式按规格「文案」一节
- [x] `BuffDrawer.vue`：`selected-buff-groups` 列表、BUFF 项编辑、「添加 BUFF」（仍打开原弹窗）
- [x] `TeammateDrawer.vue`：队友预设来源、触发开关、极星辉域及层数（原 `#character-controls` 插槽内容）
- [x] `EnemyDrawer.vue`：原「敌人设置」弹窗的内容（敌人配置与附魔），弹窗删除
- [x] `handleSelectBuff` 等函数留在页面脚本，`tests/buff-dialog-7110.test.mjs` 保持通过
- [x] 验证：添加两个 BUFF、改敌人等级后摘要和伤害正确更新

## Comments

- 2026-11-15：三个抽屉的内容是原模板原样搬入（按规格决定 1），敌人设置弹窗已删。条件卡和伤害卡并排，容器宽度 1100px 以下上下排。BUFF 分栏规则（共鸣算角色、未知归自定义）抽成 `buffColumnKey` / `BUFF_COLUMNS`，放在 `src/algorithms/buff-groups/index.mjs`，已选 BUFF 列表和条件卡摘要共用。敌人抗性不统一时摘要显示「抗性 最小%～最大%」，这句是新文字，待开发者确认。
- 验证：DOM 检查三个抽屉内容齐全、摘要正确；敌人等级改 100 后期望伤害 341 → 332、摘要变 Lv 100，改回 90 恢复。`direct-reactions-only-7108` 通过；`buff-groups` 测试在还原本次改动后同样失败（读取文件时把 `export default` 当 JSON 解析），原来就有，已告知开发者；分栏函数另用 node 直接调用核对过。
