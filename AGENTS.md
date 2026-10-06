# AGENTS.md — 莫娜占卜铺项目交接与维护约定

状态快照：2026-10-06，**7.1.09 已正式发布 Windows EXE／ZIP 和 Android APK**，当前维护源码为 **7.1.09**，目录为 D:/Documents/ChatGPT/v7.1.09/source。按用户要求从已发布的 7.1.08 source-publish 源码新建副本；旧源码和成品保留。当前副本不是 Git 仓库。依赖目录 node_modules 为既有本地依赖的目录联接，不包含账号、UID 样本或签名资料。

## 已完成的 7.1.08 基线

7.1.08 已完成 Windows EXE／ZIP、Android APK 和 GitHub 正式发布，正式成品位于 D:/Documents/ChatGPT/v7.1.08，源码发布目录为该目录下的 source-publish。完整 44 项修复见 docs/release-7.1.08-final.md，发布及跨版本导入验证见 docs/release-validation-7.1.08.md。

已完成内容包括：Worker 和 WASM 调用／清理；莫娜、神里绫华等角色三个主动天赋的共用导入对应；DSL、无当前装备优化和已定位的 Unreachable；普通、月曜和保留星烁直伤的公式、条件与作用域；武器和角色 BUFF 消费及候选重算；Android 系统保存回调、URI 写入、完整文件回读和重新导入；图片补齐；角色喵喵评分及并列权重归一化；七七六命 DSL、沃雅妮莎旧角色星扩散支援；薇斯纳普通模式 C2；编译后通用星烁 BUFF 的旧原生消费。独立星／月反应、多人贡献、主C手填面板入口及自行添加的说明文案已按用户要求移除。

Astra 已完成 01–44 审查，沿用其通过证据，不重新跑已验证清单；随后评分并列权重遗留问题也已修复并进入正式版。7.1.07 圣遗物／角色 UID 导出已在 7.1.08 正常导入。旧 beta 排查文档中的“未打包”等只描述当轮状态，不是当前交付缺口。

## 7.1.09 本轮完成

计算器“锁定全部”改变评分的共性问题已复现并修复：已装备圣遗物的 WASM 转换不再按 omit 过滤。锁定只排除后续配装候选，不移除当前装备。可莉合成样例原本锁定后精通 302→0、评分 163.8→124.7；修复后维持精通 302、评分 163.8。公共计算链与真实计算器按钮核对通过，实际词条变化仍正常重算。记录及验证边界见 docs/artifact-lock-score-7109.md。

编号 2 软件内更新已完成源码接入：自动检查、线路检测选择、后台下载进度与取消、Windows 安装／便携覆盖衔接、Android 系统 APK 安装入口。五项针对性验证及剩余实机验证边界见 docs/auto-update-7109.md。2026-10-06 三种平台包已构建并正式发布；成品核对见 docs/release-validation-7.1.09.md。

编号 3 已完成预设菜单的元素筛选、最近更新／元素排序及保存时记录更新时间；角色 BUFF 筛选仅在原“选择 BUFF”弹窗的“角色引发的 BUFF”页签接入，保留 UID、角色及参数操作，其他 BUFF 类别未修改。预设菜单和 BUFF 弹窗分别提供组件预览，三项针对性验证通过，见 docs/preset-buff-filters-7109.md。

编号 1 GOODScanner 圣遗物导入已完成：GOOD v3／v1 转换、主词条成长值、原有锁定保留及五部位装备归属，空／缺类别导入不再删库。五项验证与来源见 docs/good-scanner-import-7109.md；扫描器工具页面已放置项目链接。

编号 4 锁定控件已完成：锁定蓝底白色闭锁、解锁默认开锁，仓库与计算器共用；一项组件核对及桌面／手机预览通过，见 docs/artifact-lock-control-7109.md。

2026-10-06 Astra 本轮审查的三项问题已修复：Android APK size 改用 JSONObject 的整数转换读取；Windows 便携更新前缀统一末尾分隔符；共享入库补入双向唯一的三→四副词条升级，复用原 ID 和 omit。前两项为本轮新增 P1，第三项为既有 P2。Android API 合同核对及三项定向回归验证完成，未进行实机安装，见 [Astra 审查修复记录](docs/astra-review-fixes-7109.md)。

package 版本为 7.1.9，显示版本为 7.1.09；Android 源码版本号已同步。2026-10-05 用户曾明确“额不需要构建，只修改源码”，当时以源码修改为交付并停止构建。此前生成的 dist、启动7.1.09.exe 和随附 runtime 已移出源码目录，暂存于 D:/Documents/ChatGPT/v7.1.09/.build-archive-20261005；保留源码修复与验证记录。当时没有修改 README。7.1.08 发布授权不自动延续到 7.1.09；当前采用 2026-10-06 的明确构建发布授权。

## 圣遗物评分补丁核查与修复（2026-10-06）

用户提供的“圣遗物评分补丁.md”已核查，三类遗留评分问题现已修复：具名流派恢复专武／绝缘／西风全局修正，玛薇卡复用已有上游角色规则，绝缘按原充能权重 +75 后截取最高权重。返回标题和最终运算顺序一并按固定上游对齐；没有修改权重来源、库存推荐、固定模板或产品说明。并列主词条取法沿用既有修复。

四项定向回归使用实际 scoreBuild／scoreDetails、默认排名和固定喵喵原始函数对照通过。心海＋西风秘典 24.4、琴输出＋绿剑 41.9、绫华绝缘杯 53.5，与上游一致；玛薇卡 0／39／40／49／50 精通分支及原充能 0 的绝缘路径正确，薇斯纳固定两模式保留。详见 [评分修复记录](docs/artifact-score-fix-7109.md)；首次核查、来源和修改前证据见 [补丁核查记录](docs/artifact-score-patch-review-7109.md)。

2026-10-06 用户明确要求构建 7.1.09 并发布 GitHub，随后指定先修评分；该修复现已完成，三种平台包构建及第五项编译评分验证也已完成，GitHub 正式发布完成。旧 2026-10-05 “只改源码”的限制被本次明确构建要求取代；Windows EXE／ZIP、Android APK、版本／签名／实际网页载荷核对完成；正式标签 v7.1.09、三项公开资产、README 及本版完整 15 条说明已回读确认，见 docs/release-validation-7.1.09.md。README 和更新日志按用户约定处理，保留旧成品和用户数据。

## 7.1.09 修复与功能计划（2026-10-06）

已登记五项计划，编号 1、2 调研完成；编号 1–4 已完成各自范围的源码实现及针对性核对，编号 3、4 已提供组件预览。第 5 项沿用既有修复。2026-10-06 按新授权完成 Windows EXE／ZIP 和 Android APK 构建及包内容核对，GitHub 正式发布已完成；此前只改源码的要求作为历史记录保留。

| 编号 | 事项 | 状态 |
| --- | --- | --- |
| 1 | GOODScanner 扫描器兼容 | 圣遗物源码适配及三→四词条升级修复已完成；首次五项及本轮两项入库验证通过，已添加项目链接 |
| 2 | 软件内自动更新与下载源测速 | 源码及 Astra 确认的两项 P1 已修复；默认目录 ZIP 验证通过，Android API 合同已核对，三种包已构建并正式发布 |
| 3 | 预设二级菜单、筛选排序与角色 BUFF 元素筛选 | 源码已实现；三项组件验证与独立预览通过，三种包已构建并正式发布 |
| 4 | 锁定控件的蓝色底状态 | 源码已实现；一项组件核对与桌面／手机预览通过 |
| 5 | 计算器“锁定全部”导致圣遗物评分变化 | 已修复（源码） |

### 1. GOODScanner 扫描器兼容

**状态：2026-10-06 圣遗物适配实现完成，五项针对性验证通过。** GOODScanner GOOD v3、YAS GOOD v1 已接入原圣遗物文件导入入口，原 Mona 格式保留。按用户选择，游戏内 lock 不自动排除配装，已有莫娜锁定保留。已加入 GOODScanner 项目链接；实现阶段只改源码，现已按后续授权完成构建、README 更新及发布。具体改动、证据及验证环境见 [GOODScanner 导入记录](docs/good-scanner-import-7109.md)。下文格式与 YAS 对比保留此前调研结论。

#### GOODScanner 实际格式

- 原神根标识为 format: "GOOD"、version: 3、source: "yas-GOODScanner"；characters、weapons、artifacts 是可选数组。扫描器允许只导出其中一类，未扫描的类别会省略，省略 artifacts 不代表空圣遗物仓库。
- 圣遗物包含 setKey、slotKey、rarity、level、mainStatKey、substats、location、lock。百分比副词条 value 使用百分数，例如 critRate_ 的 7.0 表示 7%；固定数值保持原值。mainStatKey 只有类型，需要按星级、强化等级和类型补出主词条数值。
- 角色包含 key、level、ascension、constellation、talent.auto／skill／burst；多元素角色可含 element。OCR 导出已处理命座天赋加级，后续接角色导入时应核对基础等级语义，避免重复减级。武器包含 key、level、ascension、refinement、location、lock。该导出结构没有 UID，不能直接作为莫娜的角色 UID 存档。
- 可附带 astralMark、elixirCrafted、unactivatedSubstats、totalRolls，以及副词条 initialValue／rolls；GOODCapture 还可附带 achievements。待激活副词条不能计入有效副词条。其另行支持的星穹铁道 HSR-Scanner v4 属于另一种格式。
- README 仍提及 GOODv3.json；当前 CLI 实际命名为 good_export_<时间戳>.json，抓包前缀为 genshin_export_。格式识别应依据文件内容。

#### 与 YAS 的区别

YAS 是扫描器，不是唯一文件格式。莫娜页面链接的 1803233552/yas 支持 Mona、GOOD、MingyuLab、CSV 和 All，默认选择 Mona。现有兼容方式应比较其 mona.json 与 GOODScanner 的 GOOD 文件：

| 内容 | GOODScanner 原神导出 | YAS 的 Mona 导出 |
| --- | --- | --- |
| 根结构 | GOOD v3；单个 artifacts 数组 | version: "1"；flower／feather／sand／cup／head 五组 |
| 部位 | flower／plume／sands／goblet／circlet | flower／feather／sand／cup／head |
| 套装 | setKey，例如 GladiatorsFinale | setName，例如 gladiatorFinale |
| 星级 | rarity | star |
| 主词条 | mainStatKey，例如 critRate_；没有数值 | mainTag.name／value，例如 critical 和 0.311 |
| 副词条 | substats 的 key／value；7% 写 7.0 | normalTags 的 name／value；7% 写 0.07 |
| 装备归属 | location 使用 GOOD 角色键，例如 KamisatoAyaka | equip 使用识别出的角色名称 |
| 锁定 | lock 是游戏内锁定，防止消耗 | 此 Mona 导出把 omit 写 false；莫娜应用内 omit 排除配装候选 |
| 数据范围 | 可同文件含角色、武器和附加元数据 | 此 Mona 导出只有圣遗物 |

YAS 选择 GOOD 时，核对分支输出 good.json，标识为 GOOD version: 1、source: "yas"，使用同样的基本圣遗物字段和百分数单位，修复前同样不能直接导入；本轮接入与 GOODScanner 共用的转换。不能笼统写成“YAS 格式都兼容”。

#### 修复前的问题（调研留档）

- 修复前，src/pages/ArtifactsPage/ArtifactsPage.vue 的 importJson 直接 JSON.parse 后调用 src/utils/artifacts.ts 的 importMonaJson，没有 GOOD 转换。importMonaJson 只拼接五个部位数组，缺失时取空数组，因而把原始 GOOD 文件当作 0 件导入。
- 按源码调用链确认：默认不会新增圣遗物；勾选“删除不存在的圣遗物”时，空导入集合会进入删除现有圣遗物的分支；默认不备份时，“游戏中导入”收藏夹也会被清空。本轮没有在用户存档执行该路径。
- src/utils/checkImportJson.js 有 Mona 条目检查，但当时文件导入入口未调用，它本身也不转换 GOOD。
- src/utils/converter.ts 的 convertArtifactNameBack 已覆盖旧套装别名和生成元数据 name2，可复用，例如 GladiatorsFinale→gladiatorFinale、CrimsonWitchOfFlames→crimsonWitch；仅改首字母大小写不足以转换。

#### 实现与验证结果

1. src/import/good.ts 在共享 importMonaJson 边界将 GOOD 圣遗物转成五部位结构，复用现有套装转换、入库去重、升级合并和装备分组。主词条从固定 Genshin Optimizer 成长表按星级／等级取值，保留 MIT 许可证；穹境／纺月／天之美赐三个标准 GOOD 键已核对并映射。
2. 只有有效 substats 进入属性；location 按实际角色目录转换名称，不推断旅行者元素或目录外角色。用户已决定游戏内 lock 不映射为 omit，新导入不自动排除，升级保留原锁定。Astra 发现的既有三→四词条升级缺陷已补齐：原三条名称／数值不变、套装／部位／星级／主词条相同且库存与输入双向唯一时，复用原 ID 和 omit；不猜有歧义的配对。GOOD／Mona、删除选项、保存配装引用及歧义不合并两项定向验证通过。
3. 类别省略、仅角色／仅武器文件、空导入及未知套装在修改仓库前报错，阻止空导入删库和清空收藏夹。页面显示具体错误并记录控制台，文件回调等待导入完成。部分装备按五部位留空分组，修复原先的槽位挤占。
4. 五项验证通过：转换与单位／别名；实际仓库去重升级与锁定／分组；失败不修改库存和收藏夹；公共 WASM 与喵喵评分实际消费；真实 FileReader 和页面回调。合成五件首次 add=5，重复 add=0，杯子升级 upgrade=1；可莉普攻期望 2087.780878395502、喵喵总分 125，与手填对照一致。未使用用户数据，浏览器采用真实组件的隔离环境，未构建成品。
5. 已在 src/pages/helps/ExportToolPage/ExportToolPage.vue 添加 GOODScanner 项目入口，没有新增说明小字。当前范围是圣遗物及装备收藏夹；角色／武器存档导入尚未接入，GOOD 文件没有 UID，不能直接当作莫娜角色 UID 包。
#### 调研来源

核对源码快照：GOODScanner c612298be6c5870e2ba0da58b0013ad7ad58052e；1803233552/yas 614245fde088667216b80ff2133a7a44ebeb4d1f。

- [GOODScanner 导出结构与根标识](https://github.com/Anyrainel/GOODScanner/blob/c612298be6c5870e2ba0da58b0013ad7ad58052e/genshin/src/scanner/common/models.rs)
- [GOODScanner CLI 导出与文件命名](https://github.com/Anyrainel/GOODScanner/blob/c612298be6c5870e2ba0da58b0013ad7ad58052e/genshin/src/cli.rs)
- [GOODScanner 功能与格式说明](https://github.com/Anyrainel/GOODScanner/blob/c612298be6c5870e2ba0da58b0013ad7ad58052e/README.md)
- [GOODScanner 角色天赋等级处理](https://github.com/Anyrainel/GOODScanner/blob/c612298be6c5870e2ba0da58b0013ad7ad58052e/genshin/src/scanner/character/scanner.rs)
- [YAS 的 Mona 序列化](https://github.com/1803233552/yas/blob/614245fde088667216b80ff2133a7a44ebeb4d1f/yas-genshin/src/export/artifact/mona_uranai.rs)
- [YAS 的 GOOD 序列化](https://github.com/1803233552/yas/blob/614245fde088667216b80ff2133a7a44ebeb4d1f/yas-genshin/src/export/artifact/good.rs)
- [YAS 格式选项及默认 Mona](https://github.com/1803233552/yas/blob/614245fde088667216b80ff2133a7a44ebeb4d1f/yas-genshin/src/export/artifact/export_format.rs)
- [YAS 各格式文件导出](https://github.com/1803233552/yas/blob/614245fde088667216b80ff2133a7a44ebeb4d1f/yas-genshin/src/export/artifact/exporter.rs)

### 2. 软件内自动更新

**状态：2026-10-06 实现及源码定向验证完成，已随 7.1.09 正式构建发布。** 已保留既有打包方式，参考 FufuLauncher 接入下载线路检测与安装流程。具体修改、网络快照和验证边界见 [软件内更新实现记录](docs/auto-update-7109.md)。

#### 方案选择依据

| 项目 | 调研确认的流程 | 本轮采用部分 |
| --- | --- | --- |
| BetterGI | 多渠道选择后启动独立更新器并退出主程序；Kachina 支持在线安装及增量更新 | 主程序退出衔接；保留莫娜既有发布包体系 |
| FufuLauncher | 第三方加速开关、并发节点检测、排序选择、直连、进度和安装 | 线路选择、后台下载及独立安装流程 |

FufuLauncher 检测固定 raw 小文件，莫娜改为检测所选实际 Release 包的前 256 KiB。小样本用于本次线路选择，不能等同于整个包的持续速度；未迁移 Kachina 安装或增量发布体系。

#### 本轮已实现

1. 启动及运行期间每小时检查新版本，保留手动检查和提示偏好；更新窗口显示既有发布日志。
2. 第三方下载加速可开关，候选为 GitHub、ghfast.top、ghproxy.net、gh-proxy.com；对实际更新包前 256 KiB 并发检测，按片段速度排序并默认选择最快有效线路，支持手动选择及直连。
3. Windows 后台流式写入、Android DownloadManager 后台下载；软件内显示进度和速度，支持取消及具体错误。不完整或取消下载不进入安装，包括完成下载后界面尚未刷新时的取消。
4. Windows 安装版／便携版使用对应 EXE／ZIP。HTTP 回复后通知托盘正常退出，停止守护和 Node；独立 PowerShell 更新脚本等待进程退出，再安装／覆盖程序文件和打开新版启动器。保留本地数据、其他用户文件和原端口。Astra 确认的默认根目录末尾分隔符误判已修复；真实默认路径和带末尾分隔符的临时 ZIP 覆盖验证通过，兄弟目录仍被拒绝。
5. Android 接入 APK 下载、未知应用安装授权返回回调及系统安装界面，保留系统确认、原包名和账号库。Astra 确认的 Integer 大小被 PluginCall.getLong 读成 0 已修复，改为 call.getData().getLong 读取一次，并共用于持久化及进度；按实际依赖和 Android 源码核对，不记为实机下载通过。
6. 新启动器构建到发布目录时随包复制更新脚本，实现阶段只修改源码；随后已按新授权编译启动器及三种平台包。

#### 接入位置

- src/App.vue、src/platform/release-update.mjs：窗口、检查、下载、取消与安装操作。
- server/update-sources.mjs、server/updates.mjs、server/local.mjs：公共线路、元数据、发布资产及本机后台服务；更新接口沿用既有本机来源限制，不要求米游社登录。
- installer/TrayLauncher.cs、script/install-update.ps1、script/build-tray-launcher.ps1：退出守护、安装／便携覆盖、重启与随包携带更新脚本。
- android/app/src/main/java/com/mona/artifact/local/MonaLocalPlugin.java、android/app/src/main/AndroidManifest.xml：原生更新方法及安装权限。

本轮真实网络片段验证四条线路均返回 206 和 262144 字节；元数据 GitHub／gh-proxy.com 返回 v7.1.08，ghfast.top／ghproxy.net 的 API 地址返回 403。运行时按实际响应检测，不把本轮速度写成永久结论。

#### 验证与交付边界

四项合成验证涵盖版本／平台资产、真实本机 HTTP 与完整文件回读、截断／取消及安装时序、合成 ZIP 替换保留数据、真实更新组件的隔离运行。发现的 PowerShell 5.1 中文脚本编码问题已修正为 UTF-8 BOM 并复验。第五项为上述有限网络片段验证，见 tests/auto-update-7109.test.mjs 及实现记录。

尚未执行真实 Windows 安装 EXE 覆盖、Android 后台下载／安装授权／覆盖安装。本次已完成三种正式平台包及包内评分、网页载荷、版本和签名核对，不将源码核对记成实机安装通过。7.1.08 成品保留；按 2026-10-06 的明确要求更新 README 并发布 7.1.09，详见 docs/release-validation-7.1.09.md。

#### 调研来源

- [BetterGI 更新窗口与独立更新器衔接](https://github.com/babalae/better-genshin-impact/blob/d1967477d2524c02ca6395b619afa4308a7fc56b/BetterGenshinImpact/View/Windows/CheckUpdateWindow.xaml.cs)
- [BetterGI 下载渠道配置](https://github.com/babalae/better-genshin-impact/blob/d1967477d2524c02ca6395b619afa4308a7fc56b/Build/kachina.config.json)
- [FufuLauncher 节点检测、下载和安装](https://github.com/FufuLauncher/FufuLauncher/blob/cb3fe65fc217a8db8ea199efa47ddae5b398f9dd/UpdateFufuLauncher/MainWindow.xaml.cs)
- [Kachina 在线安装与更新](https://github.com/YuehaiTeam/kachina-installer/tree/05a14107fc024645e1ad350fd3b4dffa62ae1368)
- [Android DownloadManager](https://developer.android.com/reference/android/app/DownloadManager)
- [Android 安装授权接口](https://developer.android.com/reference/android/content/pm/PackageManager#canRequestPackageInstalls())


### 3. 预设菜单与角色 BUFF 筛选

**状态：2026-10-06 源码实现完成，三项针对性验证及预览通过；未构建或发布。** 记录见 [预设与 BUFF 筛选实现](docs/preset-buff-filters-7109.md)。

- 点击现有预设按钮的下拉箭头显示二级菜单，提供全部元素／七元素筛选、最近更新／元素属性排序；默认按最近更新，同元素内也按更新时间排列。
- 保留主按钮保存、另存为预设和应用预设；菜单列表可滚动，筛选控件适配手机宽度。
- src/store/pinia/preset.ts 的 addOrOverwrite 记录 updatedAt，既有账号持久化保存整个条目；初始化保留已有时间，旧预设不补虚构日期，未记录时间的条目在最近更新排序中保留原有顺序并排在有记录条目之后。
- 按用户截图在原“选择 BUFF”弹窗的“角色引发的 BUFF”页签增加元素筛选，保留 UID 入口在前；角色选项和列表共用来源角色元数据，并可与搜索组合。切换元素清除聚焦角色／展开项，保留参数与已选 BUFF。旅行者通用、未分类来源只在全部元素下显示。其他 BUFF 页签及其筛选逻辑未修改。
- 修改 src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue、src/store/pinia/preset.ts、src/components/select/CharacterBuffGroups.vue；没有新增说明小字或修改计算规则。
- 独立浏览器使用实际组件和合成数据，三项验证覆盖预设筛选排序与保存／另存／应用、BUFF 元素＋搜索与实际添加、SFC 及桌面／390px 布局。预设菜单和真实 SelectBuff 父组件的选择弹窗分开截图，已查看；见 .preview/plan3-7109/preset-menu.png、character-buff-dialog.png、character-buff-dialog-mobile.png。
- 验证为组件隔离运行，未读取用户存档、未构建整页或平台成品；未重跑 Astra 历史清单。

### 4. 锁定状态显示

**状态：2026-10-06 源码实现完成，一项真实组件核对及桌面／手机预览通过；未构建或发布。** 见 [锁定控件记录](docs/artifact-lock-control-7109.md)。

- src/components/display/ArtifactDisplay.vue 的锁控件按 omit 状态显示：锁定时蓝底白色闭锁图标，解锁后恢复默认文字按钮与开锁图标；仅锁控件使用 primary 填充。
- 保留既有 toggle 操作与停止冒泡，aria-pressed 对应实际锁定标记。仓库和计算器复用同一组件，未修改锁定业务或计算规则。
- src/i18n/locales/zh-cn.js 修正仅用于该控件的既有中文提示为“锁定／解锁”，没有新增说明小字。
- 一项隔离组件核对通过：实际蓝底范围、鼠标／空格状态切换、每次一次 toggle、未触发卡片评分点击、桌面／390px 手机布局，无页面错误。使用合成数据，不读取用户存档，不重跑历史计算清单。
- 预览已查看：.preview/plan4-7109/lock-controls.png、lock-controls-mobile.png。
### 5. 锁定导致评分变化：已修复

- 用户反馈入口为计算器页面的“锁定全部”。
- 原因：当前装备转换同时按 omit 过滤，锁定后传给内核的装备减少，面板属性变化，进而切换条件评分规则。
- 已在 src/composables/artifact.ts 修复当前装备转换；锁定件继续参与当前评分、面板、伤害与收益计算，仍从后续配装候选中排除。
- 既有合成可莉样例原本总分 163.8→124.7；修复后全部／单件锁定和解锁保持 163.8。沿用既有公共调用链及实际计算器按钮证据，本次不重复测试。
- 记录：[锁定评分排查与修复](docs/artifact-lock-score-7109.md)。此项为源码修复完成，7.1.09 尚未构建发布。

本文件交代项目方向、用户要求和修改流程，不要求接手模型立即重构、测试、构建或发布。用户后续明确指令优先；状态快照随实际工作更新。

## 1. 先确认工作目录和版本

- 当前开发源码：`D:/Documents/ChatGPT/v7.1.09/source`，也就是本文件所在目录。
- 会话默认目录可能是 `D:/Documents/ChatGPT/genshin-artifact`。它是旧 Git 工作区，当前 `package.json` 仍写 `5.30.0`，且有大量已有改动；**不要在那里继续修改 7.1.09 功能，也不要重置、清理或提交那些已有改动**。
- 当前源码 `package.json` 为 `version: 7.1.9`、`displayVersion: 7.1.09`。此源码副本不是 Git 仓库，不要假设默认目录的 Git 状态就是它的状态。7.1.08 的正式发布源码位于 `D:/Documents/ChatGPT/v7.1.08/source-publish`；7.1.09 尚未创建发布 Git 工作区，不在旧目录代为提交。
- 以下未写绝对路径的源码位置均相对于本文件所在目录。移到其他电脑后，以实际包含这些文件的源码根目录为准，不要照抄失效的本机路径。
- 开始工作先确认目录、版本、相关文档及已有改动；保留用户已经完成的修改。当前任务没有要求的历史事项，不自动恢复执行。

## 2. 项目方向和最新功能范围

目标是减少每次新角色、新武器、新机制上线时重复接 BUFF 的工作：**用统一参数、规则数据和明确的伤害作用域表达效果，让单次伤害与单人配装共用实现**。新效果优先写入规则表；只有现有规则语言无法表达的新机制才扩展引擎。不要为每个角色另造一套公式或只把名字加入支持名单。

当前适配目标是 **单次伤害计算、单人圣遗物配装优化**。完整轮转 DPS、多人联合优化、理论排行不在本轮承诺范围。已有其他功能不能因为出现在界面里就宣称全部适配。

### 保留

- 角色技能、天赋、命座直接造成的星／月伤害，包括梦见月瑞希天赋和一命这类计算。
- 直接星超导、直接星扩散、直接月感电、直接月绽放、直接月结晶，以及适用于它们的 BUFF、武器、圣遗物和共鸣。
- 普通扩散、感电、绽放、结晶等原有反应体系。

### 已按用户要求删除，不再作为待适配项目

- 2026-10-01：所有角色共用的「单次伤害 · 主C手填面板」界面入口及组件。只移除手填 UI，不删除角色技能／天赋／命座自身的星／月直伤。底层公式检查与显式接口仍有依赖。

- 独立反应星扩散·风／冰、反应星超导、反应月感电、反应月结晶，以及旧月绽放预览。
- 相应多人贡献、独立判暴排序、参与者加权计算，独立星／月反应页面、菜单和配装选项。
- 原先询问用户的“3～4 人反应星扩散排序”已不属于当前范围，不要再追问或恢复近似算法。

公开结果中删除的键为 `moonfall`、`moonelectro`、`mooncrystallize`、`stellarconduct`、`stellarswirl_anemo`、`stellarswirl_cryo`；保留的技能直伤键为 `direct_moonelectro`、`direct_moonbloom`、`direct_mooncrystallize`、`direct_stellarconduct`、`direct_stellarswirl`。

旧预设或 DSL 明确要求已删除功能时，应说明“已移除”，不能偷偷换算别的伤害，也不能批量删除用户保存的预设。已删除功能不要出现在伤害表中，也不要继续显示“待校准”或“暂无伤害”占位行。

瑞希星扩散目标只保留模式 0（天赋）和 1（一命）；旧模式 2／3 明确拒绝。伊涅芙默认目标目前只算一次薇尔琪塔放电和一次频率超限回路直伤，不再加入独立反应月感电贡献。

当前范围以 `docs/direct-reactions-only-7108.md` 为准。其他旧文档中关于独立星／月反应的实现、测试及资料需求，均是历史记录。

## 3. 用户已明确的要求

1. **优先修共性问题。** 主动核对公共接口、实际调用链和错误原因，不要只给当前报错角色补一个特例，然后继续让其他角色遇到相同问题。
2. **按实现判断适配。** “公式存在”“界面可选”“BUFF 已传入”“内核实际消费”“配装候选会重算”是不同进度。公式、参数单位、作用域、触发条件及实际接口消费已核对正确，即可记录相应实现完成；不要求穷举所有角色、武器、BUFF 条件与组合，也不要求逐一游戏内实测。不得仅因没有全部实测而列为“待适配／待校准”；已发现的漏算、错误映射、缺失规则或接口限制仍按具体问题记录。不得删拦截、静默丢弃效果或填假数值来声称支持。
3. **资料先自行查。** 用户允许通过网络补充公式和实测资料。优先可追溯来源，记录适用版本、触发条件、公式作用域和链接；来源冲突时标明分歧。确实找不到再向用户列出具体缺哪条规则、需要什么样本，不要求用户重新收集全部角色资料。
4. **少测，最多 5 个。** 每轮只选最多 5 项有明确目的的针对性验证，说明实际核对内容，避免无关全量、重复跑测试。公式及相关条件、接口已经核对正确时，不为补齐全组合实测覆盖而追加测试。不能把无限制的大扫描藏在一个“测试”名称里。用户明确说不测试时不自行加测；单纯写文档不构建、不跑功能测试。
5. **保护已保存数据。** 不上传、打包或提交账号、UID 样本、仓库／圣遗物／预设导出、用户 Debug JSON、浏览器存储、密钥、签名资料或令牌。测试使用合成数据。用户提供的调试包只用于本次排查，不复制进公开源码、固定测试样本或发布包。
6. **保留 Debug。** 保留开关、具体报错和本地 JSON 导出；调试数据不自动上传。异常不能只被吞成“计算发生错误”，应保留阶段、原因和可定位信息。
7. **README 不擅自改。** 仅在用户明确要求时修改。主页 README 如被要求更新，按用户指定四部分：软件名称、相对其他项目的特色、安装说明、其他需要说明的内容。“其他项目”不是要求罗列别的软件或仓库。
8. **发布以当次授权为准。** 2026-10-04 用户明确授权 7.1.08 正式版 Windows EXE／ZIP、Android APK 和 GitHub 发布，更新说明完整列出 44 项修复，README 只改下载链接，并要求先验证 7.1.07 圣遗物／角色 UID 导出兼容。此前 beta 不发布的限制不适用于本次明确授权；这个授权不自动延续到下一版本。
9. **输出新版本到新位置。** 使用新的目录或修订后缀，保留已验证的旧包，不覆盖旧版成品。若任务只是改正式版名称，不顺便改业务代码；若只要源码，不额外构建。
10. **不动本地存档来“修复”。** 不清空浏览器存储、不改用户原始导出；不要随意改变端口、主机名、应用 ID 或签名。它们会影响数据来源或安装升级。
11. **结果要贴合当前技能。** 对仍保留且能计算的相关直伤，显示真实算出的数值；缺项与验证边界在 Codex 说明，未经同意不加界面说明或小字。不要无故藏掉。对无关伤害类型不要硬加空行，更不能用 0 假装已算出。这个要求不意味着恢复已经删除的独立反应。
12. **直接完成授权工作。** 常规可逆修改不要反复让用户确认；遇到真正缺资料或超出授权的步骤再明确说明原因。清理旧文件前先查依赖，不能误删用户文件、许可证或仍在使用的工具。

13. **每次更新版本必须自动同步 EXE 版本。** 每次更新软件版本时，必须自动同步启动 EXE 的版本，不需要用户再次提醒或确认，不能只改网页、`package.json` 或发行包名称。以 `package.json` 的 `displayVersion` 和 `version` 为版本来源，通过 `script/build-tray-launcher.ps1` 自动生成并重新编译对应版本的 EXE；同时同步 EXE 文件名、托盘名称、日志窗口标题、程序集标题／产品显示版本（`AssemblyTitle`、`AssemblyInformationalVersion`）及数值程序集／文件版本（`AssemblyVersion`、`AssemblyFileVersion`）。交付新版本时不能继续携带旧版本启动器，也不能在启动器源码中另行硬编码显示版本。保留旧版成品，版本同步不改变既有端口、账号路径或用户存档。

14. **调研完成后及时写入 AGENTS.md（2026-10-06 用户明确要求）。** 每个事项调研完成后，在当前项目 AGENTS.md 更新事项状态、结论、来源、建议方案和仍待确定的具体问题；区分“调研完成”“实现完成”“验证完成”。不要只在 Codex 回复中报告后仍让文档停留在“待调研”。纯调研或文档更新不自动开始实现、测试、构建或发布。

**2026-10-06 最新授权：构建 7.1.09 并发布 GitHub，先修评分。** 评分修复及五项针对性验证已完成；本次按授权生成新启动器和 Windows EXE／ZIP、Android APK。2026-10-05 的只改源码要求描述此前任务，不限制这次明确发布。

### 界面文案与编程方式（2026-10-04 更新）

- **禁止不必要防御性编程（2026-10-04 用户明确要求）。** 不要假设，主动暴露不确定；没有证据的风险不作为新增代码或待办的依据。
- 只写解决当前问题的最小代码，只改必须改的地方；信任内部代码，不为“不可能发生”的场景加防御，不反复为基本不可能出现的情况补分支。
- **禁止吞错误，禁止一次性抽象，禁止写哈希和 SHA256。** 不新增或生成摘要校验，也不将其列为维护、测试或交付的必做步骤。
- 未经用户在 Codex 明确同意，不新增额外校验、拦截、兜底、兼容回退、降级或猜测默认值。确有新增需要，先说明已知问题与具体拟改内容，得到明确同意后再写。
- **自行撰写的产品说明一律先获同意。** 不擅自添加说明条、帮助段落、小字、免责声明、适配／校准状态解释、操作教程或解释性悬浮提示。能不写小字就不写小字；不准用缩短、折叠或移动位置代替用户要求的清空。
- 开发过程、验证范围、残余问题和实施建议在 Codex 中说明，不自动写进应用界面。新增上述文案必须先把具体文案发到 Codex，获得用户明确同意后才能写入。
- 本次已授权清空既有自行撰写的说明。保留正常功能名称、参数标签、实际数值、游戏原始技能／装备描述，以及已有真实错误和 Debug 信息；这不授权顺便删除计算规则或已有必要错误处理。

## 4. 架构：目前是内核互通，不是完整合并

前端使用 Vue 3、TypeScript、Element Plus、Vue CLI／webpack。计算由原始发布 WASM、桥接层、Rust 扩展内核与统一 JS 适配层组合完成。

- `mona_wasm/pkg/mona_wasm_bg.wasm`：保留的原始发布内核，不能拿当前 Rust 源码编译物直接覆盖。现有 Rust 源码与该二进制的角色覆盖并不相同。
- `mona_wasm/pkg/mona_effect_bridge.wasm`：实际使用的旧角色桥接内核，由 `script/build-effect-bridge.py` 基于原始内核生成。修改脚本时按当前问题核对相关函数结构和调用签名，不能猜内存地址或属性槽位。
- `mona_core`、`mona_wasm/src`、`mona_dsl`：Rust 源码。扩展输出到 `mona_wasm/extension`；沃雅妮莎、薇斯纳等走扩展适配，其他角色通常仍依赖旧内核及桥接。
- 未经明确任务不要更换原始发布内核。

### 两个入口必须保持一致

| 位置 | 用途 |
| --- | --- |
| `mona_wasm/pkg/index.js` | 浏览器公共计算接口 |
| `beta-tools/runtime-7106.mjs` | Node 排查／验证公共计算接口；文件名虽含 7106，仍是当前运行入口 |
| `src/workers/optimize_artifact.js`、`vue.config.js` | 实际网页配装 Worker 及打包方式 |

当前包装顺序是旧内核敌人桥接、效果桥接，再接角色／武器适配；最外侧依次收口到 `withLunarDamageContexts`、`withDirectReactionScope`、`withInterfaceContracts`。变更注册或包装顺序时阅读两处入口，不要只改 Node 侧导致网页失效。

`withLunarDamageContexts` 是历史命名，目前保留直伤／单次计算相关入口，不代表独立多人月反应仍可用。`withHybridTeamOptimization` 等历史包装仍存在，也不代表多人功能已被本轮完整校准。

### 核心文件导航

| 修改内容 | 主要位置 |
| --- | --- |
| 通用角色 BUFF 规则入口 | `beta-data/character-effect-rules.mjs` |
| 规则数据 | `classic-static-effect-rules.mjs`、`classic-effect-rule-book.mjs`、`character-rule-book.mjs`、`lunar-effect-rule-book.mjs`，均在 `beta-data/` |
| 规则表达、执行和参数校验 | `beta-data/rule-dsl.mjs`、`effect-rule-engine.mjs`、`buff-rule-registry.mjs`、`buff-rule-schema.mjs` |
| 特殊作用域／旧内核效果映射 | `beta-data/scoped-character-effect-rules.mjs`、`extension-buffs.mjs`、`legacy-effect-bridge.mjs`、`legacy-effect-slots.mjs` |
| 角色、武器及套装的专用适配 | `beta-data/facade.mjs`、`vesna-facade.mjs`、`stellar-support-facade.mjs`、`limited-weapon-facade.mjs`、`expanded-weapons.mjs`、`lunar-equipment-rules.mjs` |
| 单次公式和反应参数消费 | `beta-data/single-hit-damage.mjs`、`lunar-damage.mjs`、`direct-stellar-conduct.mjs`、`reaction-parameter-rules.mjs` |
| 当前功能边界、旧输入拒绝 | `beta-data/direct-reaction-scope.mjs`、`dsl-tokens.mjs` |
| 参数别名、默认值、敌人及停用 BUFF | `beta-data/interface-contracts.mjs`、`enemy-interface.mjs` |
| 界面目录／翻译 | `src/assets/_gen_buff.js`、`_gen_character.js`、`_gen_tf.js`、`_gen_weapon.js`、`_gen_artifact.js`，以及 `src/i18n/generated/` |
| 技能伤害表、BUFF | `src/pages/NewArtifactPlanPage/` 下的 `DamagePanel.vue`、`TransformativeDamage.vue`、`BuffItem.vue` |
| 伤害明细和词条收益 | `src/components/display/DamageAnalysis/DamageAnalysis.vue`、`src/algorithms/reaction-labels.mjs`、`src/algorithms/stat-gain/curve.mjs` |

`_gen_*` 及生成翻译之间可能使用数字索引关联；不要随意重新排序。生成前先读生成器和实际输出范围，避免覆盖已经补充的本地数据。

原始 WASM 内部的某些反应系数仍被桑多涅／瑞希的技能直伤借用。删除公开独立反应入口并不等于可以全文搜索后删除所有同名私有字段；那会破坏保留的角色直伤。

## 5. 公式与属性作用域不能混用

- `IndependentDamageMultiplier` 是普通直伤的独立倍率，不自动作用于月曜直伤或星烁直伤。标准基础分支为 `技能基础 × 独立倍率 + 定额加值`，不是让该倍率再乘定额加值。
- 月曜直伤使用 `MoonReactionDamageMultiplier`；星烁的“造成原本 X%”效果走明确的星烁专属属性和 tag。不要拿普通倍率或基础反应系数代替。
- **月伤擢升在最后作为独立乘区**，作用于本体和定额的合计。不要并入普通增伤或精通区。
- 保留的月曜直伤使用伤害所有者自身的精通和双暴，走对应元素抗性，不走敌人防御区，也不自动吃普通元素增伤。直接月感电／月绽放／月结晶的基础系数分别为 3／1／1.6。
- 直接星扩散基础系数为 1；星超导基础系数按极星辉域的已实现规则处理。已删除的反应星扩散·冰系数不是直接星扩散的系数。
- 来源角色面板与受益角色面板分开；前台／后台、触发条件、命座、层数、覆盖率及同源不叠加都必须明确建模。不能默认所有 BUFF 永远生效，也不能把手填最终面板重复加上已包含的属性。
- 技能等级的显示值与内部索引不一定一致，查数据定义后转换。最终普通／暴击／期望结果必须是有限数值；元数据不能混入属性加总。
- 用户已经确认的语义以最新指令为准；涉及新效果的定额位置、倍率适用范围仍需单独确认，不凭相似中文描述推断。

## 6. 推荐修改流程

1. **确定问题与范围。** 先读实际入口和最新范围文档，检查目标角色、技能、状态、BUFF、敌人、目标函数及错误阶段。优先查公共参数转换和共享逻辑，再查角色特例。
2. **使用最小合成复现。** 不依赖用户仓库作为固定测试。核对技能配置、辉映／辉域状态与目标函数是否一致；纯单次对比不能意外带入会改写伤害目标的配装参数。
3. **先写清数据合同。** 明确来源、受益者、伤害类型、触发／退出条件、参数单位／默认值／边界、是否叠加及各乘区位置。
4. **优先修改共享规则。** 在现有 rule book 中表达新效果，让公共引擎编译到实际消费的属性。必要时扩展属性或桥接，不用名称白名单替代实现，不让优化器使用只在页面当前装备上算过一次的固定结果。
5. **接完整调用链。** 根据任务核对 `CalculatorInterface.get_damage_analysis`、`CommonInterface.get_attribute`、`OptimizeSingleWasm.optimize`、`BonusPerStat.bonus_per_stat`；支持 DSL 的路径还需核对 `DSLInterface.run` 的真实签名。套装参数别名、敌人、停用 BUFF、默认参数在共用入口处理。
6. **同步界面。** 更新目录、参数、翻译和可见伤害分支；不显示与当前技能无关的结果。已有真实错误与 Debug 保留；新增说明、校验或拦截须遵守上一节的 Codex 同意规则。适配限制与缺项在 Codex 报告，不自行增加界面说明。
7. **按本次影响选少量验证。** 优先一项公式／条件边界、一项单次与候选优化一致性、一项公共入口或真实 Worker 检查；不要求每次都跑满 5 项。只验证源代码时不要声称浏览器实测通过。
8. **仅在需要时构建并交付。** 修改 Rust 才重编译扩展；修改桥接才重生成桥接；网页代码改动要在交付新网页包前重新构建。记录实际验证结果、未解决限制、产物位置，更新相关维护文档，不擅自改 README。

特别注意：`lock`／停用的 BUFF 要在校验与原生调用前过滤；自定义敌人必须同时影响单次、配装和词条收益；候选装备变化时转换类 BUFF 要重新计算。曾经修复过这些共性问题，不能为了新效果绕过公共入口。

## 7. 验证与构建参考（按需执行）

所有命令在本文件所在源码根目录运行；下列内容不是每个任务都必须执行的清单。本次已按 2026-10-06 明确授权完成构建，以下保留使用的构建参考。每轮最多 5 项有明确目的的验证，不默认跑全量或重复 Astra 已通过的清单。

### 本轮锁定问题

- node beta-tools/artifact-lock-7109.mjs：加载实际 store、装备转换、页面锁定／筛选函数及评分响应链，调用真实 WASM；核对全部／单件锁定、解锁、面板、伤害、收益、候选排除及真实词条变化。
- node beta-tools/artifact-lock-browser-7109.mjs：需要本次源码构建的 dist 及本机 Playwright／Chrome；使用独立空白浏览器和合成 UID，实际点击计算器锁定全部／解锁全部，核对逐件得分、总分及伤害区域。不会读取用户浏览器存档。
- --baseline 使用相邻 7.1.08/source-publish 的旧转换入口复现故障；迁移电脑后没有该路径时，不默认执行这个参数。

### 软件内更新验证

node --test tests/auto-update-7109.test.mjs：四项合成验证分别覆盖版本与平台资产、实际本机 HTTP／完整文件回读／截断和取消／安装时序、合成 ZIP 覆盖保留数据、真实 Vue 更新组件的隔离执行。第五项为公开发布文件的有限网络片段检查，结果见 docs/auto-update-7109.md。修正已发现问题后只重跑相应检查，没有超过五项，也未执行真实安装。

本次已构建网页、启动器和 Android。包内实际评分入口及网页载荷已核对；真实覆盖安装和 Android 实际系统安装尚未重测，见 docs/release-validation-7.1.09.md。

### 网页和启动器

使用 Node.js 20 或更新版本，沿用既有锁文件和依赖，不为常规修复升级依赖。

```powershell
Set-Location -LiteralPath 'D:/Documents/ChatGPT/v7.1.09/source'
$env:NODE_OPTIONS = '--max-old-space-size=6144'
npm.cmd run build:local
```

更新版本后，用 script/build-tray-launcher.ps1 重新生成启动器。NodeRuntime 指向含 node.exe 和 LICENSE 的既有运行时；当前可用 D:/Documents/ChatGPT/v7.1.08/web/runtime。脚本拒绝覆盖同名启动器，保留已验证旧产物。

```powershell
& ./script/build-tray-launcher.ps1 -NodeRuntime 'D:/Documents/ChatGPT/v7.1.08/web/runtime'
```

启动器显示版本取自 package，后续构建时文件名应为启动7.1.09.exe，内部文件／程序集版本应为 7.1.9.0；本次新启动器位于 D:/Documents/ChatGPT/v7.1.09/web/启动7.1.09.exe，文件版本 7.1.9.0。启动日志与默认浏览器界面后，关日志窗口仍驻留；托盘提供打开界面和关闭软件。既有地址为 http://127.0.0.1:4184/#/calculate；旧 7.1.07 常用 4183。端口或 localhost／127.0.0.1 变化会改变浏览器存储来源，不自动更换、不清空存储。

需要交付网页包时再按当次授权选择新目录；不要把旧版脚本名、产物名或旧 dist 当作新版本交付证据。

### Android

当前源码 versionCode 70109、versionName 7.1.09；保持 com.mona.artifact.local、原签名及 https://localhost 来源，不卸载、不清数据。本次已按用户明确授权构建签名 APK；签名资料不进入源码和公开包。

公共保存入口为 android/app/src/main/java/com/mona/artifact/local/MonaLocalPlugin.java。7.1.08 已修复大载荷进入系统 Activity 状态导致崩溃的问题：先写私有临时文件，移除 PluginCall 中的内容载荷，仅保留 token，再在主线程启动保存页面；回调在后台打开目标 URI、流式写入，关闭后才报告成功。不得仅凭保存界面打开或编译通过认定保存修复。既有系统保存、完整文件回读及重新导入证据见 docs/android-export-7108.md 和 docs/release-validation-7.1.08.md。

如后续明确要求 Android 验证，只选择 :app:connectedDebugAndroidTest 的 ExportRegressionTest，用合成数据和独立 .debug 包；不要触发依赖库全量测试，不使用用户存档作为固定样本。

### Rust 扩展与旧内核桥接

扩展使用 nightly-2024-10-10-x86_64-pc-windows-gnu、wasm32-unknown-unknown 和 wasm-bindgen 0.2.92；先确认工具和锁文件，输出到 mona_wasm/extension。beta-tools/build-extension.ps1 默认会追加多套 smoke，不能不加判断直接执行。不要使用 npm run build:wasm 覆盖原始发布内核。

旧桥接来源为 script/build-effect-bridge.py，需要 WABT；先读相关函数结构与签名，不手改 WASM、不猜属性槽位。新增 Rust 属性时检查枚举、图容量、序列化、JS 映射和消费分支；历史 Unreachable 曾由固定属性容量越界引发。

其他历史测试可能依赖未复制的私有基线或旧功能范围；先核对预期，不能为使旧测试通过恢复已删除功能，也不能用修改后输出替换旧基线。

## 8. 当前仍存在的边界

角色圣遗物评分：2026-10-06 三类遗留计算偏差已完成共享源码修复，四项上游函数对照验证通过，详见 docs/artifact-score-fix-7109.md。首次核查中的待修状态为历史记录；并列主词条沿用既有修复，未复现的 0.1 分舍入反例不另列为计算 bug。



库存原生静态推荐权重：部分角色／目标仍缺原生权重，用户要求“先暂时不管”，继续暂缓。角色喵喵得分与实际伤害优化是不同功能，不能替代库存推荐。依据见 docs/pending-items-20261004.md。

7.1.08 已完成的实现、交付与 Astra 审查沿用历史证据。没有全角色实号同步、逐张在线图片点击或全组合实测，不自动成为未完成事项；杜林另一反应元素属于已有配置条件。已删除的独立星／月反应和多人贡献不恢复，也不列为待校准。

2026-10-05 已完成锁定与当前装备计算的源码修复；2026-10-06 编号 1–4 均已完成源码实现和各自定向验证，第 5 项沿用既有修复。Astra 随后确认的两项新增 P1（Android APK size、Windows 默认更新目录）及一项既有 P2（三→四词条升级）已修复，详见 docs/astra-review-fixes-7109.md。编号 2 尚未执行真实 Windows 安装 EXE 覆盖、Android 后台下载／授权／覆盖安装或成品界面验证；本轮 Windows 便携 ZIP 为临时合成目录的实际覆盖，Android 为依赖和 API 合同核对。编号 3、4 的界面验证为隔离组件；本次已构建完整前端和平台成品，未把包内评分验证称为界面点击实测。未重新执行 Astra 的 44 项清单；这些是具体验证边界，不是已证实的新缺陷。后续构建与发布按用户当次授权执行。

## 9. 当前产物和继续阅读顺序

- 当前源码：D:/Documents/ChatGPT/v7.1.09/source。
- 已正式发布 7.1.09：[GitHub 下载页](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.09)。Windows EXE／ZIP、Android APK 及新启动器位于 D:/Documents/ChatGPT/v7.1.09，构建／发布核对见 docs/release-validation-7.1.09.md。此前临时构建仍保留于 .build-archive-20261005。
- 已发布 7.1.08：D:/Documents/ChatGPT/v7.1.08 下的 Windows 安装 EXE、web ZIP、Android APK 及 web/启动7.1.08.exe。保持旧成品和源码不变。

建议阅读顺序（本轮预设／BUFF 筛选先读 docs/preset-buff-filters-7109.md；软件内更新见 docs/auto-update-7109.md）：

1. docs/artifact-lock-score-7109.md：本轮原因、最小修复和验证结果。
2. docs/release-7.1.08-final.md、docs/release-validation-7.1.08.md：已完成 44 项与正式交付基线。
3. docs/pending-items-20261004.md：已知库存推荐暂缓事项。
4. docs/direct-reactions-only-7108.md：保留和删除的功能范围。
5. docs/interface-parameters-7108.md、docs/shared-buff-rules.md：公共接口与规则约定；其他 beta 架构文档按当前范围筛选阅读。

交付时用中文说明实际修改、原因、验证及具体限制，给出准确路径。不要只说“全部修好”。改变工作目录、功能范围或关键限制时同步更新本文件。
