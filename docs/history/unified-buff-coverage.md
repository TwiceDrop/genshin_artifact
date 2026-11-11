# 统一 BUFF 覆盖清单

2026-09-27：本轮补齐剩余12项角色BUFF并构建v7.1.07，详见 [发布与实现说明](release-7.1.07.md)。统计仅表示每个目录名至少有一种接入路径；不表示任意旧角色、手动面板和优化入口均支持。

## 当前准确计数

此前装备批次：两套圣遗物和三把武器5项已接入，五项测试通过；见 [实现说明](lunar-equipment-adapters.md)。此前角色批次记录保留。

2026-09-26 更新：八项参数、两项共鸣之后，又接入九位角色的22项规则。见 [本批实现说明](lunar-character-adapters.md) 和 [前批十项说明](reaction-parameters-implementation.md)。名称覆盖不等于角色技能与优化全部支持。

| 项目 | 数量 |
|---|---:|
| 当前界面 BUFF 目录 | 257 |
| 原生扩展支持名单（含2个技术入口） | 124 |
| 其中界面目录中的原生 BUFF | 122 |
| 当前最终合并适配规则名 | 125 |
| shared-buff-rules.mjs 规则 | 46 |
| recovered-character-rules.mjs 规则 | 2 |
| 前一批接通的规则名（历史批次） | 45 |
| 历史批次追加角色规则 | 5 |
| 前批九位月曜角色规则 | 22 |
| 前批套装与武器规则 | 5 |
| 本批剩余角色规则 | 12 |
| 历史批次追加倍率规则 | 2 |
| 历史批次补掉原55项缺口 | 6 |
| 历史批次新增目录参数 | 1 |
| 当前剩余未接入目录项 | 0 |
| 至少存在一种扩展原生/适配/兼容入口的当前目录项 | 257 |
| 原256项目录中已接入的项目 | 256 |

去重口径：原生目录122项 + 最终规则125项 − 两者重叠3项（AlbedoC4/KleeC6/MonaC1）+ 既有特殊兼容入口13项 = 257项。支持名单中的 VesnaSupport、ExtensionEffect 是技术入口，不计作界面 BUFF。既有13项为七七2项、桑多涅2项、薇斯纳祝礼1项、柔风游弦1项、沃雅妮莎角色/队友武器7项。

上一批从旧55项缺口接通 IndependentDamageMultiplier、IansanTalent2、NicoleE、MonaMagusGlow、PruneTalent2、IllugaP2 共6项，当时剩余49项；本次八项参数和两项共鸣再接通10项，当时剩余39项；本批九位角色22项接入后剩余17项。另新增的 StellarSwirlDamageMultiplier 是单独的直接星扩散倍率参数，不属于旧缺口；目录因此由256增加至257，名称覆盖由201增加至208。

**257是名称覆盖数，不是所有模式、角色组合、星/月反应、优化和理论排行均已验证的数量。** 历史45项、7项以及本批22项均是规则名，不是新增的自动关联来源数量。既有特殊入口仍保留各自限制。

剩余命名缺口：角色BUFF0项、武器队友BUFF0项、套装队友BUFF0项。本轮新增12个规则名，不代表12位角色全部技能适配。

## 前一批新增45项（历史记录）


| 序号 | 所属角色/武器/套装 | 界面中文名称 | 内部标识 |
|---:|---|---|---|
| 1 | 欧洛伦 | 欧洛伦-C6「致深泉的颂赞」 | OroronC6 |
| 2 | 莱依拉 | 莱依拉-「星示昭明」 | LaylaC4 |
| 3 | 艾梅莉埃 | 艾梅莉埃-「湖光顶调」 | EmilieC2 |
| 4 | 夏沃蕾 | 夏沃蕾-「尖兵协同战法」 | ChevreuseTalent1 |
| 5 | 夏沃蕾 | 夏沃蕾-「纵阵武力统筹」 | ChevreuseTalent2 |
| 6 | 夏沃蕾 | 夏沃蕾-「终结罪恶的追缉」 | ChevreuseC6 |
| 7 | 莫娜 | 莫娜-「星月的连珠」 | MonaC2 |
| 8 | 砂糖 | 砂糖-「魔导·秘仪」（小型风灵） | SucroseTalentMagusE |
| 9 | 砂糖 | 砂糖-「魔导·秘仪」（大型风灵） | SucroseTalentMagusQ |
| 10 | 温迪 | 温迪-「魔女的前夜礼·颂时风若」 | VentiSongOfTime |
| 11 | 温迪 | 温迪-「自由的凛风」（魔导·秘仪） | VentiTalentFreedom |
| 12 | 玛薇卡 | 玛薇卡-「基扬戈兹」 | MavuikaTalent2 |
| 13 | 玛薇卡 | 玛薇卡-「焚曜之环·灼象」 | MavuikaC6 |
| 14 | 阿贝多 | 阿贝多-「魔女的前夜礼·白芒之书」 | AlbedoWitchEve |
| 15 | 菲谢尔 | 菲谢尔-「魔女的前夜礼·宵世幻奏」 | FischlWitchEve |
| 16 | 梦见月瑞希 | 梦见月瑞希-「廓然梦生」 | YumemizukiMizukiEnhancedEM |
| 17 | 北斗 | 北斗-「辛映·星超导」 | BeidouC6StellarConduct |
| 18 | 赛诺 | 赛诺-「立仪·俯览昼冥」偕日共升（辉映·星超导） | CynoC1StellarConduct |
| 19 | 爱诺 | 爱诺-C1「灰与力场的平衡理论」 | AinoC1 |
| 20 | 伊涅芙 | 伊涅芙-「全相重构协议」 | IneffaTalent3 |
| 21 | 八重神子 | 八重神子-「望月吼哕声」 | YaeMikoC2 |
| 22 | 空-冰 | 冰旅行者-二命「嗡鸣的陨冰」 | AetherCryoC2 |
| 23 | 杜林 | 杜林-「红土之逆」 | DurinC1 |
| 24 | 杜林 | 杜林-「双重诞生」 | DurinC6 |
| 25 | 莉奈娅 | 莉奈娅-「野外观察手记」 | LinneaTalent2 |
| 26 | 莉奈娅 | 莉奈娅-「万类博物图鉴」 | LinneaTalent3 |
| 27 | 莉奈娅 | 莉奈娅-「喜或悲的谕告」 | LinneaC2 |
| 28 | 雅珂达 | 雅珂达-「蜜莓的嘉赏」 | JahodaTalent2 |
| 29 | 雅珂达 | 雅珂达-「最渺小的幸运」 | JahodaC6 |
| 30 | 叶洛亚 | 叶洛亚-「逐日之狼」 | IllugaC4 |
| 31 | 布伦妮 | 布伦妮-「魔女的前夜礼·寻魔之誓」 | PruneTalent1 |
| 32 | 布伦妮 | 布伦妮-「故事结尾在这儿」 | PruneC6 |
| 33 | 洛恩 | 洛恩-「戏言的杰作」 | LohenTalent2 |
| 34 | 洛恩 | 洛恩-「凡飞翔者，皆为靶标」 | LohenC2 |
| 35 | 尼可 | 尼可-「我要教导你，指引你应走的路」 | NicoleC2 |
| 36 | 尼可 | 尼可-「向左或向右，无论你行往何方」 | NicoleC4 |
| 37 | 尼可 | 尼可-「这便是正确的道路，莫要彷徨」 | NicoleC6 |
| 38 | 黑蚀 | 黑蚀-白昼之刃 | AthameArtis |
| 39 | 祭星者之望 | 祭星者之望-「照夜之镜」 | StarcallersWatch |
| 40 | 鹤鸣余音 | 鹤鸣余音-「永续韵声」 | CranesEchoingCall |
| 41 | 尘光七谕 | 尘光七谕-「先导之光」 | AngelosHeptades |
| 42 | 香韵奏者 | 香韵奏者-「甘美回奏」 | SymphonistOfScents |
| 43 | 天之美赐 | 天之美赐4 | HeavensGift4 |
| 44 | 梦见月瑞希 | 梦见月瑞希-「秋沙歌枕巡礼」 | YumemizukiMizukiE |
| 45 | 梦见月瑞希 | 梦见月瑞希-「慕念萦心间」 | YumemizukiMizukiC6 |

该历史批次的43项来自 shared-buff-rules.mjs；瑞希E/C6两项来自 extension-buffs.mjs。瑞希六命使用普通扩散期望暴击与星扩散专用暴击属性，不是普通面板暴击。当前 shared 文件另追加下表中的莫娜、布伦妮、叶洛亚3项，共46项。普通规则公式及静态证据见 shared-buff-rules.md。

## 历史追加：5项角色规则、2项倍率参数

| 分类 | 界面中文名称 | 内部标识 | 已接入的效果与范围 |
|---|---|---|---|
| 角色 | 伊安珊-「动能标示」 | IansanTalent2 | 来源攻击按夜魂分支换算并按技能等级封顶；显式开关分别增加30%攻击、25%普通增伤；限定场上受益者 |
| 角色 | 尼可-「虚己之赐」 | NicoleE | 按E等级倍率与上限转换来源攻击，升变和二命各自另加300固定攻击 |
| 角色 | 莫娜-「水星天的辉光」（魔导·秘仪） | MonaMagusGlow | 每层增加0.05蒸发反应提升，0～3层；排除莫娜自身；不自动模拟逐次消耗 |
| 角色 | 布伦妮-「振铃同心」 | PruneTalent2 | 来源攻击超过2000部分每点增加0.00025普通增伤，上限0.5，再乘适用比例；原发布核写入BonusBase |
| 角色 | 叶洛亚-「铸灯者的盟约」 | IllugaP2 | 岩双暴5%/10%，六命为10%/30%；满辉精通50，六命满辉80 |
| 通用参数 | 普通独立伤害倍率 | IndependentDamageMultiplier | 只乘普通技能本体的属性×倍率分支，定额附加在后；不继承给星/月反应 |
| 新增专属参数 | 星扩散伤害倍率 | StellarSwirlDamageMultiplier | 只乘直接星扩散本体分支，定额值不乘此倍率；擢升仍乘本体与定额之和 |

前两项的等级表和静态证据见 recovered-character-rules.md；随后三项见 recovered-additional-characters.md；两项倍率的单位、旧配置处理及范围见 independent-damage-scope.md。本表5项角色规则均从已有缺口恢复，倍率规则中只有 IndependentDamageMultiplier 属于原55项缺口。

## 本批九位角色：22项已注册

`AinoC6`、`IneffaMoonelectroRelay`、`FlinsTalent1`、`FlinsC6`、`LaumaTalent1`、`LaumaTalent2`、`LaumaSkillResMinus`、`LaumaBurst`、`LaumaC6`、`NeferTalent1`、`ZibaiTalent1`、`ZibaiC2`、`LinneaTalent1`、`LinneaC1`、`LinneaC4`、`LinneaC6`、`IllugaQ`、`ColumbinaP1`、`ColumbinaQ`、`ColumbinaC2`、`ColumbinaConstellation`、`ColumbinaC6`。详见 [公式、输入状态及验证边界](lunar-character-adapters.md)。这些规则按显式来源面板和单次状态消费，不代表自动生成角色技能轴。

## 本轮完成的12项

CynoC2StellarConduct、KleeC1、TravelerElements、TravelerEnhancedAttribute、AetherCryoTalent1、AetherCryoC6、YaeMikoC1、NahidaC2、DurinTalent2、DurinC2、IfaTalent2、AlyoshaHunterPrecision。具体公式、触发条件、阿罗夏完整等级表与验证范围见 [v7.1.07实现说明](release-7.1.07.md)。

### 武器与套装缺口已移出

纺夜天镜、霜结的誓金枝、支离轮光、纺月的夜歌、穹境示现之夜已接入队友BUFF路径。公式、同类去重、自身套装配置冲突及覆盖范围见 [本批说明](lunar-equipment-adapters.md)。

## 已确认的极星辉域系数

作者原文的极星辉域表已确认下列0～12次记录系数；来源为 [KeqingMains 星反应指南](https://keqingmains.com/misc/stellar-reaction-guide/)。

| 记录次数 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 星超导系数 K | 1 | 1.45 | 1.50 | 1.55 | 1.60 | 1.65 | 1.70 | 1.75 | 1.80 | 1.85 | 1.90 | 1.95 | 2 |
| 冰／雷元素伤害加成 | 20% | 29% | 30% | 31% | 32% | 33% | 34% | 35% | 36% | 37% | 38% | 39% | 40% |

物理抗性降低为40%。ResonancePolestarField 已接入复合属性及显式星超导消费者，从未适配名单移出；不代表自动事件计数或全部角色优化已完成。

## 清单外：反应星扩散多人期望的近似

反应星扩散在3～4名参与者时，目前按各人的期望伤害排序后合成，属于近似期望。各参与者独立暴击后如何重排的完整规则尚未确认；用户本轮已选择保留该近似并明确标记。不能将这一结果描述为逐暴击状态枚举所得的严格期望。

这是一项反应结算精度限制，独立于命名BUFF入口统计，不增加或减少名称覆盖计数。月结晶多人期望使用用户提供的独立判暴、实际伤害重排及60%／30%／5%／5%权重规则，不应据此自动推断星扩散也采用同一重排机制。

## 自动来源与已接入项目的条件限制

- 自动读取队友面板并关联来源的 TEAM_BUFF_SOURCES 仍只有：沃雅妮莎、薇斯纳、奥黛塔、七七、桑多涅。前批规则及本批22项角色规则未整体加入自动来源选择器；其余来源要手动添加对应BUFF并填写来源数值/触发状态。
- 阿贝多 AlbedoWitchEve：防御def=0且任一阳华/瑰银覆盖率大于0时明确报错，要求填写来源防御。原发布内核在def=0时有动态防御依赖，本批共享数值规则尚未恢复；不能把它当作零增伤静默继续。def>0的普通转换已接入。
- 魔导受益资格、黑蚀非装备者身份等仍依赖手动适用声明或显式参数；注册表不会从“添加了BUFF”自动证明队伍满足所有前置机制。夏沃蕾天赋2与莉奈娅二命按实际受益角色元素过滤；明确后台输入会限制只作用于场上的效果。
- 具名来源同名BUFF在转换前去重；自定义元素增伤及通用数值增伤条目仍可组合。去重不等于自动模拟层数、触发次数或重叠时间。
- 来源属性使用手填来源面板时不会随来源角色的候选装备自动重算；只有现有自动来源路径提供联动面板。本批解决规则的接入与共享，不声称已完成任意队伍联合优化。
- 旧角色原内核、星/月反应校准、多参与者归属、混合DSL和理论排行仍是独立兼容范围；不能用此名称覆盖表代替这些功能的验收。

## 静态核对来源

- src/assets/_gen_buff.js：当前257项界面名称、归类与配置，含新增的直接星扩散倍率参数。
- src/i18n/generated/zh-cn.json：中文名称与描述。
- beta-data/extension-support.json：124项原生支持标识。
- beta-data/shared-buff-rules.mjs：46项共享普通规则（前批43项、本批3项）。
- beta-data/recovered-character-rules.mjs：2项恢复的来源攻击转换规则。
- beta-data/extension-buffs.mjs：当前最终125项规则合并及转换前去重。
- beta-data/lunar-damage.mjs、src/pages/NewArtifactPlanPage/LunarDamagePanel.vue：独立手填月曜结算，可按受益人消费十项参数/共鸣及22项角色规则；新增12项已经接通对应的反应消费。
- beta-data/stellar-support-facade.mjs、limited-weapon-facade.mjs、facade.mjs、vesna-facade.mjs：既有特殊兼容入口。
- beta-data/hybrid-team-optimizer.mjs：现有5个自动来源。

本轮已构建v7.1.07，未发布GitHub。测试与构建记录见 release-7.1.07.md。
