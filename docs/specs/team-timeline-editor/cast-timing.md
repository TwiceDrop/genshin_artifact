# 施放动画时间

目的：积木长度使用施放动画数据，与命中时刻、召唤物寿命和BUFF覆盖分开，防止把持续效果误作前台占用时间。

以60FPS换算，编辑器使用 `round(帧数 / 6) × 0.1秒`，保留一位小数。这里只表示完整动画长度；接不同动作时的取消帧并不相同，因此不拦截重叠，也不自动顺延其他动作。接近已有积木末尾0.1秒内时吸附，左右方向键移动所选积木0.1秒。

| 角色 | 动作 | 完整动画帧数 | 编辑器秒数 |
| --- | --- | --- | --- |
| 丝柯克 | 点按战技 | 43 | 0.7 |
| 丝柯克 | 普通爆发 | 151 | 2.5 |
| 丝柯克 | 七相状态爆发 | 41 | 0.7 |
| 芙宁娜 | 荒性战技 | 54 | 0.9 |
| 芙宁娜 | 芒性战技 | 57 | 1.0 |
| 芙宁娜 | 爆发 | 121 | 2.0 |
| 爱可菲 | 战技 | 35 | 0.6 |
| 爱可菲 | 爆发 | 110 | 1.8 |

来源：gcsim 固定提交 `b107b5dc5cb88977bed5270e5d83e64934730d4d` 的 AnimationLength / InvalidAction；2026-11-14与公开main内容交叉核对。

- [丝柯克战技](https://github.com/genshinsim/gcsim/blob/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/skirk/skill.go)、[爆发](https://github.com/genshinsim/gcsim/blob/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/skirk/burst.go)
- [芙宁娜战技](https://github.com/genshinsim/gcsim/blob/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/furina/skill.go)、[爆发](https://github.com/genshinsim/gcsim/blob/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/furina/burst.go)、[KQM实测帧数](https://library.keqingmains.com/characters/hydro/furina#frames)
- [爱可菲战技](https://github.com/genshinsim/gcsim/blob/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/escoffier/skill.go)、[爆发](https://github.com/genshinsim/gcsim/blob/b107b5dc5cb88977bed5270e5d83e64934730d4d/internal/characters/escoffier/burst.go)

## 未闭合的数据

沃雅妮莎：[KQM角色页](https://library.keqingmains.com/characters/hydro/vodyanitsa#frames)的Frames为空，[证据页](https://library.keqingmains.com/evidence/characters/hydro/vodyanitsa)没有动作测试；gcsim公开main无对应角色实现。已检索中文与英文动画时长/帧数资料，未找到可核对的数值。现有公开角色配置没有提供动画片段长度，不可用技能状态或BUFF寿命代替。需要能确认起始输入及可接下一动作的原速录像或测帧表。

丝柯克长按由玩家持续输入决定，当前轴没有保存按住时长，不能把最低18帧当成实际持续时间。普通攻击、重击和下落时长尚未在本次E/Q数据接入中校准。未校准动作保留原有标签宽度，不参与末尾时长吸附；不将标签宽度输出为计算数据。

数据由各自角色包提供；预览通过已有引擎识别丝柯克状态和芙宁娜荒芒。原始动作时间、命中时刻、伤害公式不变。
