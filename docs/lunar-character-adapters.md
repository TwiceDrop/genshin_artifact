# 九位月曜角色：22项源码接入

> 后续装备批次已接入5项队友BUFF，当前名称入口245/257、剩余12个角色BUFF。见 [lunar-equipment-adapters.md](lunar-equipment-adapters.md)。下文为此前批次记录。


更新：2026-09-26。实际目录 D:/Documents/ChatGPT/unified-kernel-work，基于 ce2fda9，工作树未提交。本批在已有八项通用参数、两项共鸣之上添加22项规则；没有构建、打包、提交或发布，原发布 WASM 不变。

## 已接入项目

|角色|规则|本次消费|
|---|---|---|
|菈乌玛|LaumaTalent1、LaumaTalent2、LaumaSkillResMinus、LaumaBurst、LaumaC6|月绽放基础提升、类型专属双暴、等级减抗、两套定额及命座、最终擢升|
|菲林斯|FlinsTalent1、FlinsC6|攻击转月感电基础提升，满辉团队擢升10%|
|少女/哥伦比娅|ColumbinaP1、ColumbinaQ、ColumbinaC2、ColumbinaConstellation、ColumbinaC6|生命基础转换、Q等级表、C2身份/分支、命座累计擢升、元素暴伤|
|伊涅芙|IneffaMoonelectroRelay|攻击转月感电基础提升|
|爱诺|AinoC6|场上角色普通感电/绽放及三种月曜增伤|
|兹白|ZibaiTalent1、ZibaiC2|防御转月结晶基础提升，月转状态增伤|
|莉奈娅|LinneaTalent1、LinneaC1、LinneaC4、LinneaC6|基础转换、编录定额与C6消耗、防御受益身份、最终擢升|
|叶洛亚/叶落亚|IllugaQ|来源精通转普通岩伤和直伤月结晶双定额|
|奈芙尔|NeferTalent1|精通转月绽放基础提升|

规则主体在 beta-data/lunar-character-rules.mjs；extension-buffs.mjs 注册为 ExtensionEffect。reaction-parameter-rules.mjs 收集类型属性并绑定单个受益人；lunar-damage.mjs 消费月曜部分，bloom-damage.mjs 消费普通绽放系。原生属性与普通绽放、月曜消费者也有源码修改，未编译验收。

## 公式和输入约定

- 月感电来源基础提升 min(ATK×0.00007,0.14)；月绽放 min(EM×0.000175,0.14)；月结晶 min(DEF×0.00007,0.14)。面板属于BUFF来源角色。少女三类基础提升 min(HP×0.000002,0.07)。开启标志只表示来源赋予资格，不是自动元素事件转换器。
- 爱诺只作用于场上受益者：0.15 + 满辉0.20，进入普通感电、普通绽放、三种月曜的增伤；不扩大到超绽放和烈绽放。
- 菈乌玛减抗读取1～15级表；debuff_active 控制本次命中。Q两套表分别给普通绽放系与月绽放后加定额，C2在系数上分别加5和4，再乘来源精通；不是整表翻倍。C2满辉40%进入月绽放精通/增伤加算区。stacks_available=0 时无定额；C2满辉增伤仍可生效。
- 菈乌玛初辉赋予普通绽放/超绽放/烈绽放固定15%暴击、100%暴伤，忽略角色面板双暴；满辉只给月绽放10%暴击、20%暴伤。普通草原核独立结算，不因有月绽放资格而替换为直伤月绽放。
- 月曜定额在本体及其独立倍率之后加入，再一起乘暴击、抗性、最终擢升。擢升在最终区，各已确认来源相加。
- 莉奈娅编录普通模式：每层0.75来源DEF；C6一次消耗2层，对应2.25DEF。自身百万吨重锤模式每层1.5DEF，最多5个消耗单位；C6单位成本2层并有1.5倍率，按可用层数限制，要求伤害所有者Linnea。四命给自身25%防御及当前场上角色25%，自身在场时共50%。mode显式声明自身前后台分支。
- 叶洛亚Q为来源EM×等级系数，另外按其他水/岩人数0～3加入普通系数[0,.07,.14,.24]和月结晶系数[0,.48,.96,1.6]。只给当前场上受益者；月结晶定额仅直伤，不能进入月笼谐奏多人贡献。
- 少女Q 1～15级为[.13,.16,.19,.22,.25,.28,.31,.34,.37,.40,.43,.46,.49,.52,.55]。domain_active表示场上角色处于领域，增益覆盖队伍，包括后台伤害所有者。
- 少女C2辉光状态给自身40%生命；满辉按选定引力类型给场上角色来源HP×1%攻击、0.35%精通或1%防御。hp须填写已含40%加成的最终来源生命，不能再次乘1.4。命座总擢升C0～C6为[0,.015,.085,.100,.115,.130,.200]；C6对应水/雷/草/岩元素暴伤80%，不再重复加一次命座擢升。
- full_moon、recipient_on_field、domain_active、lunar_brilliance_active、lunar_phase_active 等控制本次适用状态；明确的伤害所有者前后台输入优先于BUFF默认值。已编译 ExtensionEffect 保留编译时资格和来源去重，不再次套用默认资格。
- 显式反应面板应填最终普通攻击/生命/防御/精通；普通面板增益不在反应公式里再加一次。反应专属增益可由选中的BUFF注入，手填同一反应增益或同一元素暴伤会重复计算。最终抗性倍率和BUFF前原始抗性二选一；选择前者时不再重复扣BUFF减抗。

## 本次查证和旧记录修正

- [KQM少女完整天赋表](https://library.keqingmains.com/characters/hydro/columbina) 与 [少女指南](https://keqingmains.com/q/columbina-quickguide/) 补齐生命转换、Q范围、C2分支、命座擢升与C6暴伤。Q等级1～13有网页表；14～15与本地原发布WASM中六份相同15值序列表的后两项0.52/0.55一致。静态序列命中不是已定位到少女Q函数，证据强度应区别记录。
- 上述WASM为 D:/Documents/ChatGPT/kernel-recovery-lab/artifacts/published.wasm；序列起点字节偏移2604665、2724333、2990308、3108583、3419023、3440487。仅读取，无修改或重新构建。
- [KQM叶洛亚](https://library.keqingmains.com/characters/geo/illuga) 和 [月曜机制](https://keqingmains.com/misc/lunar-reactions/) 明确其定额只作用直伤月结晶；旧静态记录把公用属性的消费者范围当作技能作用范围，已纠正。
- [KQM莉奈娅](https://library.keqingmains.com/characters/geo/linnea) 确认编录消耗、C6以及四命同时给自身和当前场上角色防御；此前“只有自身”描述不完整。
- [KQM菲林斯](https://keqingmains.com/q/flins-quickguide/) 区分六命自身35%与满辉团队10%擢升。本项目 FlinsC6 目录项为后者，自身额外35%不在该队友BUFF中补算。
- 菈乌玛等级及状态采用用户提供资料，核对范围见 [菈乌玛证据记录](formula-evidence/lauma-confirmation.md)；[Meropide伤害公式](https://meropide.cn/chs/reference/伤害公式/) 用于核对增伤、定额与最终擢升位置。

## 范围和验证

单次显式面板可以消费上述BUFF；普通攻击/防御等属性部分通过适配器进入原生属性图。没有新增这九人的完整技能轴、自动队友面板来源、自动逐击扣层或持续时间状态机。资格/层数由调用者声明；多次独立计算不能冒充有状态循环。不同来源同类基础转换的自动互斥/择优事件不在此批模拟范围。

两个内核仍然分开。旧角色原发布核保留既有路径；固定手填反应上下文仍拒绝优化、词条收益和混合DSL。3～4人反应星扩散继续保留用户接受的近似标记。名称入口覆盖240/257，剩余17项见 [当前覆盖清单](unified-buff-coverage.md)，后续角色任务见 [交接MD](已知公式未实现角色BUFF交接.md)。

本批只用 tests/lunar-characters.test.mjs 的5个案例：注册/边界、菈乌玛组合、月结晶三角色组合、少女分支、实际JS封装与Vue语法。5/5通过；修正前后台绑定后只重跑原有第3和第5项，2/2通过，未新增测试案例。底层原生API使用桩，不等于Rust/WASM或浏览器已实测；未进行任何构建。
