# 月曜伤害的两种归属模型

`beta-data/lunar-damage.mjs` 将反应型月结晶和角色技能直伤分成两个入口。它是独立的公式模块；接入角色面板、技能倍率、队伍事件记录或优化器，需要调用方显式提供数据，不能因为数学模块已经存在就标记所有角色与 BUFF 全部适配。

公式按用户提供的 7.1 实测口径实现。基础系数、伤害分区和月结晶权重已与 [Meropide 伤害公式](https://meropide.cn/chs/reference/伤害公式/) 及 [强度研究院](https://www.gensri.wiki/wiki/) 当前资料核对。每个角色先独立判暴、再按实际伤害排序的细节按用户补充口径实现；没有把尚未独立复核的该项描述成已验证的游戏机制。

## 反应型月结晶

入口：`calculateLunarCrystallizeTeam(input)`。

```js
{
  baseBonus: 0,                // 全体共享的月曜反应基础提升 Bbase
  resistanceMultiplier: 0.9,   // 已经分段计算好的岩抗性倍率，不能填敌人的原始抗性
  participants: [{
    id: 'hydro-owner',
    element: 'Hydro',          // Hydro 或 Geo；必须是实际被记录的贡献者
    levelBase: 1446.85,        // 自己等级对应的反应基础值；示例为用户给出的 90 级值
    em: 0,
    critRate: 0.05,            // 0～1；调用方先合并适用的反应暴击加成并封顶
    critDamage: 0.5,
    lunarBonus: 0,
    lunarIndependentMultiplier: 1, // G，只乘本体分支
    lunarIndependentTags: [],
    flatBonus: 0,              // F，在 G 之后加入
    elevation: 0              // E，放大整个本体与 F
  }, {
    id: 'geo-owner', element: 'Geo', levelBase: 1446.85,
    em: 0, critRate: 0.05, critDamage: 0.5
  }]
}
```

实际输入必须含 2～4 名独立的水/岩贡献者，并同时包含水与岩，不能直接把任意四人队都当成贡献者。来源 id 必须非空且不重复。`levelBase` 由调用方从等级表取值，模块没有杜撰其余等级数据。共享 `baseBonus` 只允许在顶层提供，逐角色覆盖会报错。

角色自己的非暴击贡献为：

```
N_i = [L_i × 1.6 × (1 + Bbase)
       × (1 + 6 × EM_i / (EM_i + 2000) + Blunar_i) × G_i + F_i]
      × Rgeo × (1 + E_i)
```

暴击贡献为 `N_i × (1 + CD_i)`。模块枚举 `2^n` 种独立暴击状态，对每一状态按当次实际贡献从高到低排序，再乘 `0.6 / 0.3 / 0.05 / 0.05`。人数不足四人时保留相同名次权重，不重新归一化。各状态概率为每人 `CR_i` 或 `1−CR_i` 的乘积；最终期望是状态伤害乘概率的总和。

非 1 的 `lunarIndependentMultiplier` 必须显式提供 `lunarIndependentTags: ['reaction-lunar-crystallize']`。直伤标签不能用来证明反应型适用。

返回值包括：

- `non_critical` / `n`：所有人不暴击时，按实际伤害重排后的伤害。
- `critical` / `c`：所有人暴击时，按实际伤害重排后的假设伤害；不是必定暴击伤害。
- `expectation` / `e`：所有暴击状态的准确期望。
- `participants`：每人使用自己的精通与暴击得到的贡献，便于核查；其个人期望不用于固定团队排序。
- `critical_states`：每种状态的概率、排序和加权贡献，包含概率为零的假设状态。
- `three_hit_expectation`：`3 × expectation`。仅适用于三枚月笼使用相同边际面板和贡献者集合、每次独立判暴的假设；不表示三次共享一次暴击结果，也没有乘入三次之外的触发次数。

## 角色技能直接造成的月曜伤害

入口：`calculateDirectLunarDamage(input)`。

```js
{
  kind: 'lunar-crystallize', // 或 lunar-bloom
  owner: {id: 'skill-owner', em: 0, critRate: 0.05, critDamage: 0.5},
  scalingStat: 1000,        // 此伤害所有者的技能指定属性 A
  skillMultiplier: 2,      // 倍率 M；200% 写作 2
  baseBonus: 0,
  lunarBonus: 0,
  skillIndependentMultiplier: 1, // I
  skillIndependentTags: [],
  lunarIndependentMultiplier: 1, // G
  lunarIndependentTags: [],
  flatBonus: 0,
  elevation: 0,
  resistanceMultiplier: 0.9
}
```

公式：

```
N = [A × M × coefficient × I × (1 + Bbase)
     × (1 + 6 × EM / (EM + 2000) + Blunar) × G + F]
    × R × (1 + E)
```

月结晶的 `coefficient = 1.6`，使用岩抗性；月绽放为 `1`，使用草抗性。`A / EM / CR / CD` 都必须属于 `owner`。接口只有一个 owner，不能传参与者数组并混合他人的精通或暴击。普通水草反应产生的草原核属于普通绽放，不传入此接口。

`I` 或 `G` 不是 1 时，对应的标签数组必须包含当前直伤类型 `direct-lunar-crystallize` 或 `direct-lunar-bloom`。普通技能独立倍率不会自动继承。`F` 位于两种独立倍率之后，擢升和抗性会放大 F。模块不存在普通元素伤害加成或防御区参数，避免误乘。

返回 `non_critical / critical / expectation` 及 `n / c / e` 别名，期望为 `N × (1 + CR × CD)`；同时返回所有者、元素和基础系数，便于调用方展示归属。

## 校验与接入边界

所有输入数字必须有限；倍率、基础面板、定额值、暴击伤害和抗性倍率不能为负，暴击率必须在 0～1；基础增益、反应增伤和擢升最低为 −1。输出溢出会报错。未识别的参数会报错，避免把 `damageBonus` 或防御减免悄悄忽略成已经适配。

本模块不自动构造实际参与反应的事件队列、不推断队友 BUFF 覆盖与状态重叠，也不推断武器或命座是否解锁。调用方必须先确定这些条件及效果标签，再调用公式。该模块本身没有将仍未校准的角色专属效果标为支持。
