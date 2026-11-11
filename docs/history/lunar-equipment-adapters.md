# 两套圣遗物与三把武器：队友BUFF源码适配

更新：2026-09-26。工作目录 D:/Documents/ChatGPT/unified-kernel-work。基于原有角色规则，本批接入5个目录BUFF；只改源码，未构建、未修改原发布WASM、未提交或发布GitHub。

## 五项规则

|目录标识|中文名称|适用公式与条件|
|---|---|---|
|NightweaversLookingGlass|纺夜天镜|双状态同时有效时，R1～R5普通绽放增伤120%～240%，超/烈绽放80%～160%，月绽放40%～80%；乘明确填写的交集覆盖率|
|GoldenFrostboundOath|霜结的誓金枝|恩情有效且附近有月笼，其他队友岩伤及月结晶增伤各20%～40%，乘覆盖率；排除来源武器装备者|
|FracturedHalo|支离轮光|流电圣敕有效时，全队月感电反应增伤40%～80%，乘覆盖率；不把武器自身攻击加成发给队友|
|SpinMoonSerenade|纺月的夜歌|有效月辉的初辉/满辉提供60/120精通，按不同月辉类型提供团队月曜增伤|
|RealmMirrorNight|穹境示现之夜|提供月辉明光·蓄念类型的团队月曜增伤，不把装备者个人暴击率发给队友|

武器精炼为1～5；以上线性档位每级分别递增30%、20%、10%、5%、10%。所有反应增伤加入精通/反应增伤加算区，不进入擢升。普通岩伤只进入普通元素增伤，不能在月结晶里再次相乘。纺夜天镜不会给队友添加武器装备者自身的精通。

## 月辉共享总数

当前确认的类型为崇信、蓄念，每种10%，两种合计20%。同名重复不叠加；两个目录项各自填写20%也只计算一次20%。默认各10%的两套同时有效时合计20%。纺月精通同样不因重复来源而相加。

旧字段 rate 在这两个套装中表示团队不同月辉类型的总增伤，不是覆盖率，允许0、0.1、0.2；旧0.3/0.4或0.15等配置明确报错，要求重新按类型填写。某一条填写0.2即显式声明另一种有效月辉也存在，不代表程序已经扫描全队装备。effect_active声明该次伤害时状态有效；不会自动模拟8秒/4秒计时。

合并器 prepareLunarEquipmentBuffs 同时处理具名BUFF和已编译 ExtensionEffect，保留月辉原始声明，重复调用不再次叠加。普通面板得到纺月精通；手填反应面板仍填写最终精通，不再次从BUFF加一次普通面板属性。

自身四件套原生配置已经有月曜增伤/纺月精通时，另填队友套装BUFF可能造成重复。当前保留明确校验：将自身套装配置的 moon_reaction_bonus 设为0，由队友BUFF统一声明总数；若同时使用纺月队友BUFF，自身对应 moon_state 也设0，将精通只填在一处。穹境自身 moon_state 控制个人暴击，可保留。此校验也会检查已保存但尚未穿戴的非零配置，避免它在候选配装中激活；没有用固定数值抵消可能变化的候选套装。

## 触发状态与范围

纺夜天镜沿用 northernmost_runo_active / crescent_verse_active，新增 overlap_rate，必须填写两状态的真实重叠覆盖率。两个开关有一个关闭即无团队反应增伤；不会拿两个独立覆盖率相乘猜交集。旧武器装备者运行模块的未知交集提示仍保留，新增队友BUFF的显式交集输入不等于自动时间轴已完成。

誓金枝新增 favor_active、moondrift_present、recipient_is_wielder。最后一项为true时该队友BUFF不生效，装备者自身40%～80%另属于其武器本体效果。支离轮光的 edict_active 表示盾已在合法触发窗口内产生且20秒圣敕仍有效，不要求当前攻击加成窗口仍存在。开启BUFF即声明其他触发和距离资格满足；身份和时间不会从队伍事件自动推断。

本批接入的是这5条队友BUFF，不是重写武器基础面板、装备者个人被动或套装2件套。旧角色仍走原发布核；扩展普通属性路径和显式反应API已接入，固定手填反应仍不能用于配装、收益曲线或混合DSL。没有新增自动队友来源联动。

## 代码与验证

- beta-data/lunar-equipment-rules.mjs：5条规则和共享月辉合并。
- beta-data/extension-buffs.mjs：注册并在原生转换前合并。
- beta-data/reaction-parameter-rules.mjs：具名/编译属性消费与受益者绑定。
- src/assets/_gen_buff.js、src/i18n/generated/zh-cn.json、beta-data/buff-rule-schema.mjs：状态参数、说明、校验。
- tests/lunar-equipment.test.mjs：恰好5项，5/5通过。覆盖武器状态和精炼、普通与月曜类型、月辉同类/异类去重、原始/编译混用、单次API及优化拦截。底层API使用桩，未运行Rust/WASM构建或浏览器测试。

目录入口覆盖245/257，适配器113条，剩余12项均为角色BUFF；其中11项主体公式已知，阿罗夏1项来源细则尚缺。名称入口数量不是所有角色技能或优化完成数量。

## 查证来源

- [KQM法器表：纺夜天镜](https://library.keqingmains.com/equipment/weapons/catalysts#nightweavers-looking-glass)：双状态、四类反应精炼值和不叠加。
- [KQM弓表：誓金枝](https://library.keqingmains.com/equipment/weapons/bows#golden-frostbound-oath)：自身与其他队友范围、月笼条件。
- [KQM长柄表：支离轮光](https://library.keqingmains.com/equipment/weapons/polearms#fractured-halo)：两段触发窗口与团队月感电增伤。
- [KQM圣遗物表](https://library.keqingmains.com/equipment/artifacts) 及 [版本机制整理](https://keqingmains.com/misc/nod-krai-guide/)：初辉/满辉、月辉持续条件、同类不叠加及两种类型共存。对照项目原始中文目录和 mona_core 内既有装备效果源码。
