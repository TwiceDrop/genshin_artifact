# GOODScanner 圣遗物导入适配 — 7.1.09

状态：2026-10-06，源码实现与五项针对性验证完成。未构建、打包或发布，未读取或修改用户存档。

## 实现

圣遗物页面继续使用原有文件选择／拖拽入口，按 JSON 内容识别 GOOD，不依赖文件名。共享 importMonaJson 在入库前调用 src/import/good.ts，GOODScanner 的 GOOD v3 和 YAS 的 GOOD v1 都转成现有 Mona 五部位结构；原 Mona 文件继续使用既有入库逻辑。

- 对应 flower／plume／sands／goblet／circlet；转换套装、主副词条及百分比单位。副词条 7% 转为 0.07，固定数值不变。
- 主词条从固定成长表按星级、等级和类型取得，固定数值取游戏显示整数，例如五星满级精通 187；百分比表本身使用小数比例，不再次除以 100。
- 复用 convertArtifactNameBack，并补上经中文名称确认的三个 GOOD 套装键：NightOfTheSkysUnveiling→RealmMirrorNight、SilkenMoonsSerenade→SpinMoonSerenade、CelestialGift→HeavensGift。未改伤害内核的套装名称。
- 已知角色 location 转成当前语言的角色名称，旅行者／奇偶保留对应名称；目录未收录的角色键原样保留为收藏夹名称，不推断角色或元素。
- 只计入有效 substats，不把 unactivatedSubstats、rolls、initialValue 等额外数据重复计入属性。
- 按用户选择，游戏内 lock 不映射为莫娜 omit；新导入不自动排除，重复导入及升级合并保留原有莫娜锁定。
- 缺失 artifacts、空导入或未知套装／属性在修改库存前报错，阻止原先的空导入删库／清空收藏夹路径。页面保留具体错误及控制台日志。
- 装备收藏夹固定为五部位，缺失部位留空；修复原来只装备部分圣遗物时向前挤占槽位的问题。
- 文件读取回调返回并等待 importJson，导入结束后关闭加载状态。
- 兼容验证后，在“圣遗物导出工具”页面加入 GOODScanner 项目按钮，没有新增说明小字。

本项只接圣遗物库存和装备收藏夹。同文件中的 characters／weapons／achievements 不写入角色 UID、账号或武器存档；GOODScanner 导出没有 UID。

## 五项验证

执行：node --test tests/good-import.test.mjs，5 项通过，0 项失败。所有文件与库存均为合成数据。

| 项目 | 核对内容与结果 |
| --- | --- |
| 1. 转换数值 | 五部位主词条 4780／311／46.6%／46.6%／62.2%，副词条单位和未激活词条不计入；另取五星 +0 生命 717、四星 +16 攻击 232、五星 +20 精通 187、四星 +8 暴击率 13.7% 的具体样例。三个套装别名、角色名称、输入未被修改和 YAS GOOD v1 对照通过。 |
| 2. 实际仓库和分组 | 使用源码的 artifact／kumi store 和共享导入函数。首次新增 5 件，重复导入 skip=5／add=0；单个冰伤杯升级 upgrade=1／add=0，原 omit 保留。只有杯子时分组为 [空, 空, 空, 杯子 ID, 空]。Mona 对照正常去重。 |
| 3. 失败不修改存档 | 仅角色、仅武器、GOOD 空数组、Mona 空数组、其他游戏格式和第 5 件未知套装，均在勾选删除未出现装备时拒绝导入；库存与装备收藏夹前后相同。 |
| 4. 实际计算消费 | 合成可莉五件装备从真实 store 经 convertArtifact 输入公共 WASM Calculator。普攻期望伤害 2087.780878395502，喵喵总分 125；分别与明确主副词条的手填对照一致，带装备伤害高于无装备。 |
| 5. 实际文件回调 | 隔离浏览器加载真实 ImportBlock 的模板／脚本及圣遗物页面导入回调，FileReader 读取任意名称 JSON 文件，连接同一共享导入函数及实际 store；新增 5 件，导入完成后才关闭加载，无页面错误。另核对改动页面的组件解析和项目链接。 |

第 5 项在隔离浏览器中通过受控接口调用 Node 的实际共享入库函数，以保护用户存储；没有启动完整网页成品或 Android 成品。这是验证环境边界，不把源码适配标记为未完成。

## 数据来源

- [GOODScanner 数据结构](https://github.com/Anyrainel/GOODScanner/blob/c612298be6c5870e2ba0da58b0013ad7ad58052e/genshin/src/scanner/common/models.rs)：固定源码快照 c612298be6c5870e2ba0da58b0013ad7ad58052e。
- [GOODScanner 名称映射加载](https://github.com/Anyrainel/GOODScanner/blob/c612298be6c5870e2ba0da58b0013ad7ad58052e/genshin/src/scanner/common/mappings.rs)与其实际使用的[公开映射](https://ggartifact.com/good/mappings.json)：2026-10-06 核对穹境示现之夜、纺月的夜歌、天之美赐及旅行者／奇偶名称。
- [Genshin Optimizer 主词条成长表](https://github.com/frzyc/genshin-optimizer/blob/d517a2562e770f056960ffeac8bc686fd3452892/libs/gi/stats/Data/Artifacts/artifact_main.json)：固定快照 d517a2562e770f056960ffeac8bc686fd3452892；覆盖 1–5 星的合法等级，保存于 src/import/data/good-main-stat.json。
- [主词条生成来源](https://github.com/frzyc/genshin-optimizer/blob/d517a2562e770f056960ffeac8bc686fd3452892/libs/gi/dm/src/dm/artifact/artifactMainstat.ts)：读取游戏 ReliquaryLevelExcelConfigData，按星级和等级生成表。
- 表来源采用 MIT 许可证，保留于 src/import/data/LICENSE.genshin-optimizer；没有添加哈希或 SHA256 校验。

## Astra 审查后的共享升级修复（2026-10-06）

首次五项验证中的升级样例原本已有四副词条，没有覆盖三→四副词条。Astra 复现了 7.1.08 已存在的共享缺陷：旧三条名称列表与新增第四条后的列表不同，原升级匹配失败，导致新增／删除旧件并丢失原 ID 和 omit。

已在共享 importMonaJson 补入双向唯一的升级匹配：旧件低于 +4、三副词条，新件至少 +4、四副词条；套装、部位、星级、主词条类型以及原三条名称／数值保持一致。匹配表先于入库修改计算；库存或输入存在歧义时不合并。确认升级后保留原 ID 和 omit，Mona 输入显式 omit=false 也不覆盖原锁定；没有修改 artifactHash.ts 或新增摘要。

本轮执行 node --test --test-name-pattern '^review:' tests/good-import.test.mjs，2 项通过。真实转换与内存 store 证实 GOOD／Mona、开启／关闭删除选项均得到 upgrade=1、add=0、remove=0，原 ID、锁定和自建配装引用不变；重复导入及后续四词条升级正常。多个旧件、多个新件及同时出现旧／新件的两种顺序均不猜测配对。

完整最小复现和验证边界见 [Astra 审查修复记录](astra-review-fixes-7109.md)。本项为既有共享缺陷修复，不计为 GOOD 接入新引入回归。未读取用户存档、构建或发布。
