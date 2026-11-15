# 08: 配装结果并入角色卡

**What to build:** 去掉编辑 / 审阅双模式，配装结果直接在角色卡上翻看、对比和恢复。

**Blocked by:** 03, 04, 05, 06

**Status:** needs-info

规格见 `../spec.md` 实现决定 7。开工前把结果条的样稿给开发者看一次，确认后改为 `ready-for-agent`。

- [ ] 角色卡顶部结果条：「配装结果 第 n / N 套」、上一套 / 下一套、「对比候选」、「恢复原装备」
- [ ] 翻看候选调用现有的 `applyReviewCandidate` / `handleUseNthOptimizationResult`；「恢复原装备」回到配装前的五件
- [ ] 面板和伤害显示相对配装前的变化；被换掉的槽位标「新」
- [ ] `SingleResultWorkbench` 的功能逐项在新视图找到位置后，删除该组件、`single-result-workbench.css`、`editorOpen` 和「返回配装结果」
- [ ] 新评分开启时配装完成自动评分的行为保持；`?history=` 恢复历史记录照旧
- [ ] 验证：用合成圣遗物仓库跑一次配装，翻看第 1、2 套，恢复原装备，数值与改版前同一输入一致

## Comments
