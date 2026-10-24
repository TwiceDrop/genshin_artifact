# 描述恢复与星伤明细同步（2026-10-23）

## 范围与根因

用户截图中的蝶变、沃雅妮莎BUFF等描述缺失，在7.2.01EA与7.1.12均存在。目录保留描述索引，但对应翻译字符串为空；EA新增米提亚/瓦列里BUFF还使用空描述索引0。显示组件本身会渲染非空描述。历史清空自行撰写说明时未留下对应游戏原文，本次恢复的是游戏技能/命座/装备特效文本，不恢复旧的适配说明或操作教程。

伤害明细显示ScarletProof2/4源于扩展属性图使用英文套装键。共用DamageAnalysisUtil现在按已有圣遗物目录将精确的套装键+件数转为中文名称，原计算键、来源值与勾选状态不变。

## 已实现

- 两版恢复蝶变、漩流颂歌的完整特效，合并精炼1～5的数值；补齐沃雅妮莎6项角色BUFF、漩流颂歌队友BUFF、薇斯纳星耀祝礼、七七2项星伤BUFF、桑多涅2项BUFF、柔风游弦队友BUFF，共15项描述。
- EA另补米提亚支援、瓦列里攻斥指令/二命/六命，共19项。游戏术语的LINK标记剥离，沃雅妮莎领唱参数按原始被动参数表展开，保留重唱定义。七七六命使用含星伤强化的buffed_description。
- 使用新增翻译条目并修改对应目录引用，未改动既有翻译索引或通用自定义BUFF的空说明。英文目录沿用现有新增数据的中文文本策略。
- 7.1.12同步EA的直伤星扩散/星超导详细来源、可编辑乘区和本地重算；扩展原生输出薇斯纳真实来源，并拆出沃雅妮莎等队友来源。原发布内核的七七/瑞希等使用已有来源字段。仅合入相关文件与页面角色名/弹窗宽度，排除米提亚原生方法，未引入EA角色、秘星典谕、DSL生成器或版本改动。
- 7.1.12仅重新编译自身扩展到mona_wasm/extension，原发布WASM与桥接未替换。EA不需要重编译内核。

## 原文来源

沃雅妮莎、薇斯纳、蝶变与漩流颂歌使用项目已保存的7.1.0 D48145775中文数据：beta-data/characters-release-71.json及sources-release-71中的10000140、10000143、11522、14524页面。柔风游弦使用weapons-release-71.json的五档refinementDetails。

- [沃雅妮莎](https://gi.gachabase.net/characters/10000140/vodyanitsa/release?lang=chs)
- [薇斯纳](https://gi.gachabase.net/characters/10000143/vesna/release?lang=chs)
- [蝶变](https://gi.gachabase.net/weapons/11522/beyond-the-chrysalis/release?lang=chs)
- [漩流颂歌](https://gi.gachabase.net/weapons/14524/hymn-of-the-maelstrom/release?lang=chs)
- [七七中文原文](https://gi.gachabase.net/characters/10000035/qiqi/release?lang=chs)、[桑多涅中文原文](https://gi.gachabase.net/characters/10000133/sandrone/release?lang=chs)：本次静态提取网页字面量，不执行网站代码；对应文字与原适配规则核对。
- 米提亚/瓦列里继续使用既有固定V4 7.1.53/48845164数据，见character-adaptation-7201.md（仅EA）。

## 四个针对性验证目的

1. 两版元数据：19/15项描述非空且与提取文本一致，无残留LINK/PARAM或undefined；中英目录等长；实际共用来源显示函数将ScarletProof2/4转换为正确中文；7.1.12未引入EA角色和武器，版本保持7.1.12。
2. 7.1.12原/新扩展与明细公式：薇斯纳17307.899480090025、七七9698.353343382858、瑞希3590.3011061935663期望伤害前后相同；普通/暴击/期望均与明细计算一致；倍率来源取消后按公式下降，沃雅妮莎来源存在。
3. 构建：7.1.12自身Rust扩展编译与wasm-bindgen通过；两个版本build:local通过，保留资源体积警告。构建自动修改的components.d.ts已恢复构建前内容。
4. 两版实际构建页面：隔离Chrome与临时本地端口，从各自launcher/dist加载；检查两把专武原文、沃雅妮莎六项BUFF、EA瓦列里三项BUFF；将公共内核产生的合成样本送入实际DamageAnalysis组件，确认中文来源、倍率翻倍、套装来源取消/重勾及结果恢复。两版薇斯纳69136、七七9698（界面取整）均通过，未捕获页面异常为0。生产构建通过Suspense组件树定位明细后验证通过；未访问用户浏览器存储。

证据：EA的.build-target/description-fix-7201包含metadata-check.log、build.log、browser.log/json及weapon/buffs/direct_stellar*.png；7.1.12的.build-target/description-stellar-7112包含before.json、kernel-build.log、web-build.log、browser.log/json和截图。浏览器验证脚本位于EA同名证据目录browser.mjs。

## 本地交付

EA原launcher/dist已更新，正在运行的页面刷新即可取得修复。7.1.12的原launcher目录同时补齐dist、server、start-local.mjs及许可文件，原启动EXE不变。两个启动器沿用同一4184端口和单实例规则，切换版本时应先从托盘退出当前版本，再启动另一版本；未修改端口、存档路径、UID、预设或仓库。

未生成安装包、ZIP或APK，未发布、未改README。未重跑历史全量验证，不声称手机实机或全角色全组合实测。此前EA自动更新检查的版本识别问题不在本轮范围。
