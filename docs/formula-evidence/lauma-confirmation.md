# 菈乌玛两项缺失数据确认

用户补充原文已保存为 user-lauma-confirmation.txt。数值、状态规则、命座复合分别存入 beta-data/lauma-formula-data.mjs，本批已在 lunar-character-rules.mjs 接入两项的单次状态与公式消费，见 ../lunar-character-adapters.md。

- LaumaSkillResMinus：Lv1–15 水/草减抗表已记录；使用含C5后的实际等级。目标敌人减抗10秒，命中刷新，不逐次叠加。
- LaumaBurst：普通绽放系与月绽放分别用两套等级定额倍率。C2分别加5.0、4.0，不是把技能表乘2。Q13对应10.902×来源精通与8.723×来源精通。
- 状态：18基础层，每层月咏换6层，最多3层月咏；每次Q至多转换一次、窗口15秒；苍色祷歌各层15秒，按符合条件的敌人数消费。未来状态机须记录获得时间，不能只存总层数。
- C2满辉的40%与C6满辉25%分别存放。用户原文最后的整体乘1.4表达需要修正：C2加入月绽放反应增益，与精通增益相加；不单独放大后加定额。C6属于最终擢升，放大本体与定额总和。多个擢升来源按已确认口径相加后取1+E，不把各个擢升逐个连乘。

对应月绽放结构：

D = [A×M×(1+Bbase)×I×(1+6EM/(EM+2000)+其他月绽放增伤+0.40)×G+F]×C×R×(1+其他擢升+0.25)

0.40与0.25分别要求C2/C6及满辉；F还要求本次确实消费苍色祷歌。天赋的基础伤害提升另算，不并入大招。

## 核对与边界

[KQM完整天赋表](https://library.keqingmains.com/characters/dendro/lauma) 的Lv1–13与用户表一致；Lv14–15本次按用户确认记录，未冒称已从该页面核到。[KQM菈乌玛指南](https://keqingmains.com/q/lauma-quickguide/) 支持层数、命座与减抗持续规则。[Meropide伤害公式](https://meropide.cn/chs/reference/伤害公式/) 将月曜增伤放在精通加算区、苍色祷歌放在后加定额区、擢升放在最终乘区。

两项已按显式debuff_active与stacks_available接入减抗和定额消费者；没有实现敌人Debuff时间轴或苍色祷歌逐击扣层状态机。调用者须提供当前有效状态，不能用重复单次计算宣称完整循环。
