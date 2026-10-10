# 女旅行者导入及计算适配（7.1.10）

2026-10-10 开始，2026-10-11 完成源码修复及三项定向验证。仅修改常规版 source，未修改 7.1.09、Beta、原始 WASM、用户存档或 README；未打包平台成品、发布或向 GitHub 发送消息。

## 已确认问题与身份保存

米游社转换器将角色 ID `10000007` 解析为 `Lumine＋元素`，但旧目录和发布内核只有 `Aether＋元素`。因此原转换在目录检查处报“未知角色：旅行者”，失败记录被选择器禁用。该路径在 7.1.09 已存在，属于遗留问题。原 issue 缺少复现步骤，不能断言报告者遇到的一定是此路径。

- `src/import/miyoushe.mjs` 共用 `travelerName` 解析男女身份和七种元素。保存的角色名为 `LumineAnemo` 等，原始 ID 仍为 `10000007`；条目增加身份／元素，`UID:角色ID:原始元素` 键不变。
- `character-summary.mjs` 根据保存角色或原始 ID／元素选择显示目录；荧显示“荧-草”等名称及女性头像／立绘，不显示为空。
- 新增七种荧的目录、中文／英文名称、草／冰专属目标与冰天赋／命座 BUFF 来源归属。水荧目录补齐真实第二段重击；未顺带改变旧水空的显示目录。
- 复用既有 `importSnapshot` 同键覆盖及 `mergeEquipped`：重新同步或导入已保存快照能清除旧失败状态、恢复预设；重复导入复用五件装备和同一预设，保留已保存的计算参数。无需清空仓库、修改原导出或新增迁移。

## 正式模型核对与差异

读取 Gachabase 镜像中的游戏正式数据，固定为 **release 7.1.0、设计／资源修订 48145775**，没有混用当前浮动 release 或预发布条目。逐元素对照男女的基础属性、突破属性、三个主动天赋 1～15 级参数和描述、固有天赋及六命座的名称／描述／参数。

| 元素 | 男角色数据 | 女角色数据 |
| --- | --- | --- |
| 风 | [空](https://gi.gachabase.net/characters/10000005/aether-anemo/release/7.1.0/48145775?lang=en) | [荧](https://gi.gachabase.net/characters/10000007/lumine-anemo/release/7.1.0/48145775?lang=en) |
| 岩 | [空](https://gi.gachabase.net/characters/10000005/aether-geo/release/7.1.0/48145775?lang=en) | [荧](https://gi.gachabase.net/characters/10000007/lumine-geo/release/7.1.0/48145775?lang=en) |
| 雷 | [空](https://gi.gachabase.net/characters/10000005/aether-electro/release/7.1.0/48145775?lang=en) | [荧](https://gi.gachabase.net/characters/10000007/lumine-electro/release/7.1.0/48145775?lang=en) |
| 草 | [空](https://gi.gachabase.net/characters/10000005/aether-dendro/release/7.1.0/48145775?lang=en) | [荧](https://gi.gachabase.net/characters/10000007/lumine-dendro/release/7.1.0/48145775?lang=en) |
| 水 | [空](https://gi.gachabase.net/characters/10000005/aether-hydro/release/7.1.0/48145775?lang=en) | [荧](https://gi.gachabase.net/characters/10000007/lumine-hydro/release/7.1.0/48145775?lang=en) |
| 火 | [空](https://gi.gachabase.net/characters/10000005/aether-pyro/release/7.1.0/48145775?lang=en) | [荧](https://gi.gachabase.net/characters/10000007/lumine-pyro/release/7.1.0/48145775?lang=en) |
| 冰 | [空](https://gi.gachabase.net/characters/10000005/aether-cryo/release/7.1.0/48145775?lang=en) | [荧](https://gi.gachabase.net/characters/10000007/lumine-cryo/release/7.1.0/48145775?lang=en) |

结果：上述计算数据只有**普通攻击天赋的第二段重击倍率**存在男女差异，七元素一致。例如 10 级第一段均为 110.5%，第二段荧为 142.8%，空的发布内核采用现有四位小数精度 120.02%。其他所比较的属性、主动天赋参数、被动和命座一致。动画耗时、配音、剧情身份不作为本计算器单次／既有固定次数目标的倍率数据；没有据此宣称男女游戏内 DPS 或动画完全相同。

系数存于 `beta-data/traveler-model.mjs`。原始男女页面及解析 DTO、比较脚本保存在 `.build-target/lumine-import-7110/research/`，使用合成数据，不包含用户账号快照。

## 公共计算边界

浏览器 `mona_wasm/pkg/index.js` 与 Node `beta-tools/runtime-7106.mjs` 注册同一 `withLumineTraveler`。只有交给旧计算内核的角色／目标／BUFF 枚举及参数键映射为对应 Aether；调用者、保存预设、原始 ID 和显示目录保持 Lumine，不改成 Manekina。

第二段索引按真实枚举处理：岩为 **7**，其余普通重击为 **6**；冰增强重击为 **16**。风／火 DSL 使用 `Charged11/Charged12`，其他元素为 `Charged1/Charged2`，冰增强为 `ChargedIceCondensation1/2`。

两段同类重击具有相同定额加值和后续乘区，故使用：

`荧第二段 = 空第二段 + (空第二段 - 第一段) × (荧第二段倍率 - 空第二段倍率) / (空第二段倍率 - 第一段倍率)`

相减会抵消相同定额加值，仅补偿倍率差；不能直接将完整伤害乘以男女倍率比。单次的非暴击／暴击／期望和伤害分析倍率明细同步补偿，额外伤害明细保留。DSL 以实际两段原生伤害实时计算标量差，优化的每个候选仍消费自己的攻击、精通、暴击和装备效果；没有用初始面板给所有候选填固定伤害。

DSL 仅转换 `dmg`／`prop` 声明中的角色枚举及对应伤害标量，保留注释、字符串和普通变量名。支持已验证的对象别名、括号、同一行赋值以及后续变量重赋值；唯一原生 Damage 快照保留对象复制语义。发布 DSL 自身禁止重复 `dmg` 名称，仍返回“damage name must be unique”。它自身的对象字面量遍历／带引号方括号访问限制没有在本次改写或静默降级。

银釭及旅行者专属武器仍走共用武器效果；`expandedWeaponEffects` 的旅行者识别增加 Lumine。公共元素目录同步补齐。冰 BUFF 来源映射进入原规则，保留来源参数和既有自作用排除。

## 草／冰默认目标

草默认目标可直接复用：发布 WAT 中 `aether_dendro_default.rs` 错误标签地址 2032560 对应 `$f2786`；其 vtable（data `$d1247`，方法地址 1769692／1769696／1769700）指向实际评价方法 **`$f628`**。该方法只根据爆发天赋表生成草灯莲的一次普通／蔓激化伤害并按 `spread_rate` 混合，未消费第二段重击。现有界面描述“最大化草灯莲攻击伤害，可设置蔓激化反应比例”与其一致。

冰默认目标包含重击，不能只改名复用男角色原目标。发布评价方法 **`$f312`** 的实际权重为：

`3 × (普通第1段 + 普通第2段) + 低空下落 + 重击第1段 + 重击第2段 + 爆发 × (寒辉层数≥8 ? 5 : 3)`

技能启用 `e_infusion=true`；模式 0 用索引 5／6／12 的普通期望，模式 1 用 15／16／13 的直接星超导期望，模式 2 用 15／16／14 的直接星扩散期望。女角色默认目标在边界转为等权重的 DSL，再补偿第二段倍率，保存的目标仍为 `LumineCryoDefault`。

私有状态来源已只读核对：`$f1248` 检查冰旅行者配置枚举 64，将配置 `cold_glow_stacks`／`radiance_mode`（上限 8／2）存入 effect[0]／[4]；角色分发 `$f145/$f144` 构造该 effect。writer `$f915/$f934`（表索引 778／779、vtable 1330928／1330944、邻接 `traveller/aether_cryo.rs` 路径）分别将其写入属性 **134／135**。通用效果桥接白名单不允许写这两个私有槽。因此 DSL 可使用角色已配置的固定模式和层数确定分支；其余候选属性仍动态计算。摘要见 `.build-target/lumine-import-7110/research/cryo-default-formula.json`，原始 WASM 未修改。

## 本任务的三项定向验证

命令：`node --test tests/lumine-import-7110.test.mjs`；三个目的通过。后续针对同一目的的修正只重跑相应项，没有另开全量测试。

| 目的 | 实际内容 |
| --- | --- |
| 1 身份、显示和失败恢复 | 七元素男女转换保留原 ID／身份键；真实 store 与合成旧失败快照重新导入成功，女性名称／目标正确，重复同步复用 5 件和同一预设，保留保存参数 |
| 2 男女差异和实际数值消费者 | 七元素第二段索引／倍率、1／15 级系数边界；风普通、岩普通、冰融化、冰直接星扩散的定额保留、单次、DSL、候选优化、词条收益一致；对象复制与重赋值正确，重复声明维持原错误；冰默认三个分支与公开单次独立求和一致，男原生默认也与相同权重一致 |
| 3 目录和公共接入 | 女性 BUFF 归属及保存的 9 级配置、C2 向队友实际增加 120 精通；草／冰目标可选，水重击两段齐全；银釭 2 层向荧实际增加 104 精通，旅行者专属武器效果与男模型一致；两公共入口注册一致，女性图像存在 |

消费者数值：`.build-target/lumine-import-7110/consumer-evidence.json`。供根代理最终编译 Worker 集成使用的合成冰荧 mode2／8 层／6 命输入及默认参考值为 `.build-target/lumine-import-7110/worker-input.json`（36292.86008987498）；新增强冠后的期望应由公开单次按上述权重独立重算。

根代理随后完成隔离网页构建和编译 Worker 集成，均退出 0。6 件合成候选的两条路径均选 `head=6`：`LumineCryoDefault` 为 **51234.28517497756**，显式第二段重击 DSL 为 **10472.37560855141**，与公开单次独立参考一致。网页及证据分别位于 `.build-target/7110-astra-fixes/web`、`.build-target/7110-astra-fixes/compiled-worker-evidence.json`；该集成为本轮第五项验证目的（另一代理的头像回归为第一项，本任务三项居中）。

头像来源：[HoYo 女性角色图标](https://upload-bbs.mihoyo.com/game_record/genshin/character_icon/UI_AvatarIcon_PlayerGirl.png)；立绘：[Enka 游戏资源镜像](https://enka.network/ui/UI_Gacha_AvatarImg_PlayerGirl.png)。两张图片已查看确认女性角色，保存在 `public/characters/lumine-avatar.png` 与 `lumine-splash.png`。

验证边界：未进行真实账号同步、浏览器完整同步点击链、EXE／APK 实机或系统导出回读。编译 Worker 验证在 Node 模拟浏览器 Worker 环境加载真实 chunks／WASM，不等同于实际页面点击配装。暂停中的库存静态权重缺项及银釭无 BUFF 静态接口限制不在此任务扩展或声称解决。
