# 施放动画时间

Windows 四人轴按 60 FPS 把基础动画帧数换算为秒，积木宽度和末尾吸附使用同一个值，精度为 0.1 秒。换算公式为 `round(帧数 / 6) × 0.1 秒`。例如沃雅妮莎战技 59 帧，占 1.0 秒，爆发 102 帧，占 1.7 秒。

## 已接入的动作

下表单位为帧。普攻按段号排列。基础时长取各角色 `attack.go`、`charge.go`、`aimed.go`、`skill.go` 和 `burst.go` 中对应的 `AnimationLength`。普攻第一段、重击按独立起手计入前摇。实际连招可以取消前摇或后摇，攻速和命中卡肉也会影响操作间隔。积木允许手动重叠；命中、召唤、BUFF 与计算结束时间由各自的规则决定。[gcsim 测帧方法](https://docs.gcsim.app/mechanics/frames/)

| 角色与帧数来源 | 战技 | 爆发 | 普攻各段 | 重击或瞄准 |
| --- | --- | --- | --- | --- |
| [丝柯克](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/skirk) | 43 | 151／41 | 27、25、43、23、72／30、43、42、60、72 | 53／54 |
| [芙宁娜](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/furina) | 54／57 | 121 | 34、28、48、58 | 253 |
| [爱可菲](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/escoffier) | 35 | 110 | 22、30、62 | 65 |
| [沃雅妮莎](https://github.com/Charlie-Zheng/gcsim/tree/5fb8aa64d7fe59c74485352207da5550f0440578/internal/characters/vodyanitsa) | 59 | 102 | 26、34、48、105 | 75 |
| [莫娜](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/mona) | 50／80 | 127 | 29、30、54、67 | 113 |
| [八重神子](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/yaemiko) | 37 | 114 | 28、40、79 | 96 |
| [七七](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/qiqi) | 58 | 115 | 21、22、33、28、53 | 76 |
| [砂糖](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/sucrose) | 68 | 65 | 28、38、46、65 | 71 |
| [珐露珊](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/faruzan) | 35 | 71 | 26、21、39、86 | 瞄准 26、满蓄力 96、快速飓烈箭 60 |
| [阿罗夏](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/alyosha) | 31／142 | 55 | 34、38、65、62 | 63 |
| [奥黛塔](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/odette) | 42／76 | 126 | 25、23、69、85、70 | 83 |
| [桑多涅](https://github.com/genshinsim/gcsim/tree/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/sandrone) | 46 | 128 | 53、46、87 | 随引导变化 |

- 丝柯克的两组数值依次对应普通形态和七相一闪。芙宁娜的战技依次对应荒性和芒性。拖动到形态变化前后即可改变积木宽度。
- 莫娜、阿罗夏的两种战技依次为点按、长按。奥黛塔的 42 帧为「夜中独舞」，76 帧为再施放「破晓终奏」。珐露珊的快速蓄力使用当前天赋与剩余飓烈箭次数，箭矢飞行时间单独计算命中。
- 沃雅妮莎取自尚未合入 gcsim 主线的角色实现。作者同时公开了计数表与原始录像。[实现及审查记录](https://github.com/genshinsim/gcsim/pull/3274) · [测帧表](https://docs.google.com/spreadsheets/d/1l-rgH3cR58AQ55MbxoUK-yTPeN-QriJUDSho1E6rIPc/edit) · [录像一](https://youtu.be/n2-Kmdb2H8Y) · [录像二](https://youtu.be/vGzXHpPYsoY)

## 仍缺少固定时长的动作

- 薇斯纳、米提亚、瓦列里暂未查到能核对起止帧的完整施放表。已有的命中延迟和动画事件的归一化位置不足以确定动作长度。[薇斯纳 KQM 资料](https://library.keqingmains.com/characters/anemo/vesna#frames) · [米提亚命中时序核对](../elemental-reactions/mitya-resource-findings.md) · [瓦列里动画事件核对](../elemental-reactions/core-and-state-findings.md)
- 丝柯克长按战技、桑多涅引导重击取决于玩家持续输入。下落攻击取决于起跳条件和高度，目前轴上没有对应的完整轨迹；下落期间伤害只代表碰撞事件。
- 这些动作保留可拖拽、可吸附的标签宽度；帧数预览只输出有资料的动作。
