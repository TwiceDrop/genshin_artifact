# AGENTS.md — 莫娜占卜铺 7.1.10 项目交接与维护约定

状态快照：2026-10-11。当前项目为 **7.1.10**，源码目录为 **D:/Documents/ChatGPT/v7.1.10/source**。本副本从已正式发布的 7.1.09 当前源码复制，保留已完成修复、规则、WASM、资源及维护文档。7.1.09 原源码和成品保留。本副本不是 Git 仓库，node_modules 仅复用既有依赖目录联接；两份项目源码各自独立。

## 先按任务选择目录

| 任务 | 工作目录与指引 |
| --- | --- |
| 多人配装优化的开发、排查、测试，包括相关计算 BUG | [7.1.10Beta/source/AGENTS.md](../../v7.1.10Beta/source/AGENTS.md)，工作目录 D:/Documents/ChatGPT/v7.1.10Beta/source |
| 其他功能、通用 BUG、单次伤害和单人配装优化 | [7.1.10/source/AGENTS.md](../../v7.1.10/source/AGENTS.md)，工作目录 D:/Documents/ChatGPT/v7.1.10/source |

**7.1.10Beta 项目仅做多人优化测试用。** 多人优化请到 Beta 文件夹；其他功能和 BUG 改动请到 7.1.10 文件夹。接到任务先读取对应目录的 AGENTS.md，并把命令工作目录切到对应 source。不要在旧 genshin-artifact、7.1.09 或另一份副本代为修改。

**当前目录为常规开发副本。** 其他功能、通用 BUG、单次伤害和单人配装优化在这里修改；多人优化相关任务切到 7.1.10Beta，不在本目录开展实验。

这次复制只是建立分开的开发环境，没有实现或验证新的多人优化功能。两份副本都继承 7.1.09 行为，不能把旧包装函数或旧多人入口视为多人优化已完成。建立副本时仅复制源码、同步版本声明和交接指引，不构建、不发布、不修改 README；后续按用户具体任务推进，待办与进度统一见下方“当前版本 7.1.10 待办及完成状态”。

## 已完成并继承的内容

### 7.1.08 正式基线

- 已完成 Windows EXE／ZIP、Android APK 和 GitHub 正式发布；Astra 01–44 通过项沿用原证据，不重新跑全清单。
- 修复 Worker／WASM、莫娜和神里绫华等角色三个主动天赋对应、DSL 参数、无当前装备优化及已定位的 Unreachable；修复普通、月曜、保留星烁直伤公式和作用域、武器与角色 BUFF 消费。
- Android 系统保存回调、目标 URI 实际写入、完整回读及重新导入已验证；7.1.07 圣遗物／角色 UID 导出兼容已完成。
- 已完成角色／武器图片补齐、角色喵喵评分及并列主词条归一化、七七六命 DSL、沃雅妮莎旧角色星扩散支援、薇斯纳普通模式 C2、编译通用星烁 BUFF 的旧原生消费。
- 原独立星／月反应、多人贡献、主C手填面板入口和自行添加的说明已按用户要求移除。
- 完整记录：[44 项更新说明](docs/release-7.1.08-final.md)、[发布与跨版本导入验证](docs/release-validation-7.1.08.md)。

### 7.1.09 正式基线（2026-10-06 已发布）

1. GOODScanner GOOD v3／YAS GOOD v1 圣遗物导入：主词条、单位、套装及装备归属转换、五槽收藏夹、空／缺类别导入处理；游戏内 lock 不自动排除配装，原软件锁定保留。
2. 软件内更新：新版本检查、日志、下载线路检测与选择、进度与取消、Windows 安装／便携更新衔接、Android APK 系统安装入口。
3. 预设菜单元素筛选、最近更新／元素排序及更新时间；真实“选择 BUFF”弹窗中仅角色 BUFF 页签增加元素筛选，保留 UID 和参数。
4. 仓库与计算器共用蓝底白锁控件；“锁定全部”仍保留当前装备计算、评分、伤害和收益，只排除后续候选。
5. Astra 确认的 Android Integer APK 大小读取、Windows 默认目录末尾分隔符、三→四副词条升级丢失 ID／锁定／配装引用问题已修复。
6. 喵喵评分三类遗留偏差已修复：具名流派共用专武／绝缘／西风修正，玛薇卡复用上游精通分支，绝缘按原充能 +75 后截取最高权重。固定评分模板和库存推荐没有改变。
7. 已正式构建发布 Windows EXE／ZIP 和 Android APK，README 与本版 15 条更新说明已同步；五项评分验证含实际桌面／手机编译入口，包内网页回读、版本和 APK 签名核对完成。

[7.1.09 更新说明](docs/release-7.1.09-final.md) · [评分修复](docs/artifact-score-fix-7109.md) · [Astra 修复](docs/astra-review-fixes-7109.md) · [发布核对与边界](docs/release-validation-7.1.09.md)

## 当前版本 7.1.10 待办及完成状态

更新日期：2026-10-11。本节维护**常规版 7.1.10** 的当前事项；多人优化在 [7.1.10Beta 的 AGENTS.md](../../v7.1.10Beta/source/AGENTS.md) 维护。每次调研、实现或验证后及时更新本表及下方依据；完成的事项保留完成状态和证据，不因移出待做列表而丢失记录。

### 当前待办

| 编号 | 事项 | 调研／排查状态 | 实现状态 | 验证状态与下一步 |
| --- | --- | --- | --- | --- |
| 7.1.10-01 | HoYoLAB 海外角色 UID、天赋、武器及已穿戴圣遗物同步 | **调研完成**：已有海外角色列表／详情消费者，字段结构可参考现有共享转换 | **未实现** | 未进行真实海外同步／导入验证。下一步接海外路由、请求头、游戏区域、平台账号身份及两端导入链路；范围为已穿戴装备。详见 [HoYoLAB 调研](docs/hoyolab-research-7110.md) |
| 7.1.10-02 | HoYoLAB 登录便利性与海外扫码获取 Cookie | **调研完成，扫码协议仍未确认**：已有邮箱／密码和验证码登录参考；所读扫码实现限定国服 | **未实现** | 未进行海外认证或扫码验证。海外扫码仍需确认 app_id、创建／轮询端点、扫描应用、确认响应及 Cookie 获取方式；不能猜接口或仅换域名。详见 [登录调研](docs/hoyolab-research-7110.md) |
| 7.1.10-05 | 库存原生静态推荐权重缺项 | **已定位，用户要求暂缓** | **未实现，继续暂缓** | 部分角色／目标仍缺原生权重；原生静态接口也不接收 BUFF，需属性补偿的武器（含银釭）沿用已有接口限制。2026-10-04 用户要求“先暂时不管”。喵喵评分与实际伤害优化不替代库存推荐，不自动重启此项。依据：[暂未完成事项](docs/pending-items-20261004.md) |
| 7.1.10-06 | 计算器按面板属性筛选与配装排序，与 Fribbels HSR Optimizer 对照 | **调研完成**：已核对 Fribbels 搜索引擎、结果表控制器及当前官网脚本；它区分搜索目标与结果表列排序，并支持属性上下限、基本／战斗属性视图和已保留结果再筛选。现有项目缺暴击率／爆伤下拉目标及多属性结果表 | **未实现新增功能** | 未运行项目功能测试或浏览器点击实测。Fribbels 默认保留 1024 组，可选 64～65536 组；表列排序及计算后筛选仅作用于已保留方案。建议复用现有约束，补齐属性目标、上下限与结果表，并让所选搜索目标参与结果保留；面板口径及保留数量需在实施时确定。详见下方调研记录 |

### 当前已完成事项

| 事项 | 完成状态 | 实际完成内容与边界 |
| --- | --- | --- |
| 常规版 7.1.10 独立源码副本与版本声明 | **已完成** | 已从正式 7.1.09 建立独立源码、同步 package／Android 版本及任务分流；2026-10-11 发布任务已生成 7.1.10 启动器与平台包 |
| 7.1.10 正式构建与 GitHub 上传 | **已正式发布，五项定向验证目的通过** | README 按四部分更新，完整日志列出本版 12 项改动；Windows EXE／ZIP、原签名 Android APK 已上传，启动器版本同步。包内容／版本／签名、桌面／手机编译 Worker 及 GitHub 标签／正文／资产回读通过；[正式发布](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.10)，详见 [发布核对](docs/release-validation-7.1.10.md) |
| 7.1.10-03 过滤圣遗物组查找与保留本人 | **实现与针对性验证完成；Astra 头像问题已修复** | 增加名称搜索、中文拼音排序和准确匹配预设装备的角色头像；搜索及数据刷新保留勾选，组排除保留当前五件。补齐组恰好五件及仓库实际存在的匹配要求，仓库删除后头像响应更新；本轮一项头像回归通过，详见下方记录 |
| 7.1.10-04 银釭武器适配 | **正式数据核对、实现与针对性验证完成** | 接入正式 7.1.0 release 的等级／突破／精炼、有效层参数、目录／翻译／图标；公共面板、单次、单人优化、词条收益与 DSL 共用属性效果。两项针对性验证及编译 Worker 核对通过；库存静态接口边界归入继续暂缓的 05 |
| 7.1.10-09 BUFF 弹窗行为统一 | **实现与针对性验证完成** | 两个计算页面的五类 BUFF 添加后均保持弹窗打开，保留角色配置和其他分类默认配置；一项合成组件验证通过，连续选择与重复选择行为正常 |
| 7.1.10-08 Web 扫描移除及追加界面清理 | **实现与针对性验证完成** | 根据用户截图移除 YAS WebUI 扫描入口／组件和 Amenoma 条目，在首页开源地址区域加入 GOODScanner；追加移除页脚备案号及圣遗物潜力／最佳圣遗物／莫娜数据库三个独立功能的导航、路由与页面。两项既有定向验证及最终网页构建通过，详见下方实施记录 |
| 女旅行者导入与计算适配（Astra P2） | **实现与定向验证完成** | 保留原始 ID、性别、元素和身份键，补齐荧七元素目录、显示、图片及计算适配；纠正男女第二重击倍率差异，接通单次、DSL、默认目标、候选优化和词条收益，旧失败快照可通过重新同步／导入恢复且不重复增加装备。三项定向验证及最终隔离网页／编译 Worker 核对通过，详见下方记录 |
| HoYoLAB 接入调研与记录 | **调研完成** | 已核对当前扫码、公开海外消费者与官方账号静态代码并保存来源；7.1.10-01／02 的登录和同步尚未实现 |
| 面板属性排序与纯枚举对照 | **调研完成** | 已核对本项目设置、目标及结果区，并进一步核对 Fribbels 官方搜索／筛选／结果表逻辑及官网当前加载的脚本；仅完成能力与实现方向分析，未新增排序／筛选业务功能 |
| 7.1.08／7.1.09 已完成修复与功能继承 | **已继承已完成基线** | GOOD 导入、软件内更新、预设／角色 BUFF 筛选、蓝底锁、锁定评分、Astra 修复及评分修复等见上方基线与原证据；不记作 7.1.10 新实现或新验证 |

2026-10-10 已按用户要求由三个 sub-agent 分别完成 03、04、09，07 已删除；完成四项针对性测试和一项前端构建／编译 Worker 集成核对。当时未生成 Windows 启动器、EXE／ZIP 或 Android APK，未发布；其他待办按表维护。

随后按用户提供的新截图完成 08 及追加的页脚／三个独立功能移除；本轮运行两项既有定向验证和最终前端构建。剩余待办为 01、02、06，05 继续暂缓。

### 当前版本概况

已建立独立源码副本、同步项目版本声明并写明任务分流；源码目录各自独立，依赖为既有目录联接。2026-10-07 完成组过滤的修复前复核与 HoYoLAB 接入调研；2026-10-08 完成面板属性排序与纯枚举对照调研；2026-10-10 实现并验证 03、04、09，删除待办 07，随后完成 08 和用户追加的界面／独立功能清理。2026-10-11 完成 Astra 提出的组头像 P3 与荧导入 P2 修复，五项定向验证目的通过。修复期隔离网页保留在 [.build-target/7110-astra-fixes/web](.build-target/7110-astra-fixes/web)。后续按用户上传 GitHub 的要求构建当前 dist／dist-mobile 和三项平台成品，已完成 7.1.10 正式发布及回读，见下方记录。7.1.08／7.1.09 历史证据保持原归属。

### 7.1.10 正式发布（2026-10-11）

用户要求“上传到 github，根据 agent.md 里的要求更改相关文件”。按既有正式发布方式交付源码、Windows EXE／ZIP 和 Android APK；该授权用于本次 7.1.10，不自动延续到后续版本。

当前：源码及三项成品已在 [GitHub 7.1.10 正式发布](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.10)，不是草稿或预发布。标签 `v7.1.10` 指向源码提交 `2cc19373ecf4767d5cea8c1adad20313ccf18ea8`；独立 Git 发布目录为 `D:/Documents/ChatGPT/v7.1.10/source-publish`。README 已按软件名称、项目特色、安装说明、其他四部分更新版本、实际功能及下载链接；[更新说明](docs/release-7.1.10-final.md) 完整列出 12 项改动。`build-tray-launcher.ps1` 已重新编译启动器，标题／显示版本 7.1.10、程序集／文件版本 7.1.10.0；安装器同版本。APK 沿用原升级签名，应用 ID、来源及用户存储约定不变。

本轮五项明确验证目的为 Windows 构建／版本、Android 构建／身份／签名、包回读与公开源码范围、桌面／手机编译 Worker、GitHub 发布回读，全部通过。GitHub 标签、README、12 项正文及三项资产名称／上传状态／大小与准备内容一致；未重跑历史全量测试。具体命令、大小、数值及未实机验证边界见 [发布核对](docs/release-validation-7.1.10.md)。旧版、Beta、真实存档和原始发布 WASM 保留，未新增摘要或 SHA256。

### 过滤圣遗物组历史复核（2026-10-07，修复前）

历史状态：**修复前调研与一项合成链路验证完成，当时未修改业务代码。** 以下保留原问题依据；2026-10-10 的修复见下一节。本项只在 D:/Documents/ChatGPT/v7.1.10/source 复核，未操作 Beta、用户存档、README 或平台成品。

- “过滤圣遗物组”勾选收藏夹后，Element Plus 树默认联动勾选其所有子组。`getAllArtifactsFiltered()` 将每个勾选组的全部圣遗物 ID 加入排除集合，没有跳过目标角色自己的组。因此全选包含本人组时，本人装备也会从配装候选中移除。
- 该弹窗没有关键词搜索、中文拼音／首字母排序、角色头像或“全选保留本人”开关。目录按 store 顺序，组按目录 `children` 顺序显示，并非按角色名排序。收藏夹管理页已有搜索，但不用于此计算设置弹窗。
- 已有“是否允许替换其他角色已穿戴的圣遗物”开关，默认关闭。它根据当前 UID 的导入／同步穿戴记录排除其他角色、保留当前角色；无需全选组即可保护他人装备。手动组过滤与此开关叠加，仍能排除本人。没有对应 UID／角色穿戴记录时，此开关不能识别其装备归属。
- 来源：`src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue:178`（组过滤界面）、`:429`（既有穿戴保护开关）、`:1567`（树顺序）、`:1664`（目标角色与 UID 记录）、`:1780`（实际候选过滤）；`src/algorithms/artifact-ownership.mjs:3`（他人装备排除）；`src/store/pinia/kumi.ts:187`、`src/types/kumi.ts:3`（组结构与保存顺序）。
- 一项验证使用源码中真实的树数据、目标角色记录选择和候选过滤函数（TypeScript 转译执行），配合已安装 Element Plus 的真实 TreeStore、Vue computed/ref 及穿戴归属函数；仅合成莫娜、钟离、安柏组，不读取账号或仓库。结果：本人 ID 1–5、他人 ID 6–10、闲置 ID 11–15；默认保护且不勾组时保留 1–5／11–15；勾选整个收藏夹后仅保留 11–15；开启借用仍仅保留 11–15；取消本人组勾选后恢复 1–5／11–15。显示顺序为“钟离、莫娜、安柏”，与保存顺序一致。
- 实际消费链：`getAllArtifactsFiltered()` → `convertArtifact` → 等级至少 16 筛选 → `wasmSingleOptimize` → Worker → `OptimizeSingleWasm.optimize`，没有将被组过滤掉的本人装备重新加入候选。
- 建议：已有 UID 穿戴记录时可使用默认关闭的穿戴保护开关，无需全选组；若后续改进该弹窗，搜索或名称排序能直接减少查找成本。若要求全选自动保留本人，应先明确“本人组”依据当前五件装备还是游戏导入记录；现有组只有自由标题和五件 ID，没有角色绑定字段，不能把所有同名组视作唯一归属。
- 验证边界：本轮验证实际源码筛选及树模型，未进行完整页面点击、WASM 伤害重算、构建或发布。这里只确认候选排除与列表行为，不将本轮写成锁定评分回归或伤害公式失败。

### Astra 复核后修复（2026-10-10 开始，2026-10-11 完成，常规版）

用户提供两份审查报告并要求两个 sub-agent 分别处理。只修改常规版 source，使用合成数据验证，未修改旧版、Beta、README 或真实账号存储。

- **P3：不完整／已删除装备的圣遗物组误显示角色头像，已修复。** 原逻辑仅检查预设长度，空数组 `every` 或短数组前缀可误匹配；也不订阅仓库。`NewArtifactPlanPage.vue` 的头像 computed 现在要求组长度恰好 5、每个 ID 非空且非负并存在于响应式 `artifactStore.artifacts.value`，再沿用预设五槽精确匹配。候选过滤、树勾选逻辑未改。`node --test --test-name-pattern='filter group avatars require' tests/filter-kumi-7110.test.mjs` 返回 0，1 项通过：空／四件／六件组、无效及缺失 ID 不显示头像，完整组多角色头像去重，删除／恢复仓库记录后头像更新。此验证执行真实页面 computed 和 Vue 响应式合成仓库，不是完整浏览器操作。
- **P2：女旅行者导入“未知角色”，实现与定向验证完成。** 属于 7.1.09 已有问题。共享旅行者解析保留原始角色 ID 10000007、性别、元素及 `UID:角色ID:元素` 键；新增荧七元素目录、名称／图片、草／冰专属目标和冰 BUFF 归属。正式 7.1.0 数据核对确认第二重击倍率存在性别差异，适配只在计算边界复用已核对的空模型，按男女第一／第二段差值修正倍率、保持定额加值。单次、DSL、候选优化和词条收益共用适配，冰默认目标按原发布内核权重构造实时 DSL；浏览器和 Node 注册一致。旧失败记录保留原身份键，通过已有重新同步／重新导入链路恢复预设并清除错误，不清空仓库。合法 DSL 对象复制及赋值保持原语义，原 DSL 禁止的重复 `dmg` 声明保留具体报错。详细修改、来源与边界见 [荧导入修复](docs/lumine-import-fix-7110.md)。

本轮最多五项明确验证目的，全部使用合成数据，没有运行历史全量清单：

| 项 | 命令／证据 | 结果 |
| --- | --- | --- |
| 1 完整组头像及仓库响应 | `node --test --test-name-pattern='filter group avatars require' tests/filter-kumi-7110.test.mjs` | 1 项通过；范围见上方 P3 说明 |
| 2 导入身份与旧失败记录恢复 | `node --test --test-name-pattern='1 original traveler' tests/lumine-import-7110.test.mjs` | 男女七元素转换保留身份及输入；真实 store 合成失败快照恢复，重复导入复用 5 件装备、保持 1 个预设与已保存参数 |
| 3 真实计算消费者与倍率差异 | 同一脚本 `2 female skill ratios`；[数值证据](.build-target/lumine-import-7110/consumer-evidence.json) | 七元素面板／第二重击索引正确；普通、融化、冰直接星扩散的单次、DSL、6 件候选及攻击词条收益一致。冰默认目标三模式与独立单次加权和一致；DSL 对象复制及赋值边界修正后重跑本项通过 |
| 4 目录、目标与 BUFF 来源 | 同一脚本 `3 UI catalog` | 荧目录、草／冰专属目标、保存角色 BUFF 参数、冰来源 BUFF 实际效果、旅行者武器识别和浏览器／Node 注册一致 |
| 5 最终网页与编译 Worker | `npm.cmd run build:local -- --dest .build-target/7110-astra-fixes/web`；[Worker 脚本](.build-target/7110-astra-fixes/compiled-worker-check.mjs)／[证据](.build-target/7110-astra-fixes/compiled-worker-evidence.json) | 构建及 Worker 命令均返回 0，荧两张本地图片已复制进新网页。编译 Worker 加载真实 chunks／WASM，6 件合成候选中两条路径均选中冠 ID 6；冰默认目标 51234.28517497756，显式重击 DSL 10472.37560855141，均与公开单次独立参考一致 |

最终构建日志为 [.build-target/7110-astra-fixes/build.log](.build-target/7110-astra-fixes/build.log)。验证保留已有工具 warning，不为此更新依赖。编译 Worker 在 Node 模拟浏览器 Worker 环境执行；没有完成真实浏览器同步／页面点击、真实存量账号兼容、系统导出回读或 EXE／APK 实机验证。未修改原始发布 WASM、旧版、Beta、README 或真实用户存储，未生成平台包或发布。已修复可复现的女旅行者导入路径；issue #4 缺少操作步骤，不能据此断言其所有可能路径均已复现。

### 03／04／09 实施（2026-10-10，常规版）

状态：**三项实现完成，五项针对性验证目的完成。** 用户要求“完成03 04 09，07删掉”，并明确要求使用 sub-agent 分别解决三项。所有业务修改位于常规版 source；未修改 Beta、旧版本、README、用户存档或 WASM 二进制。

- **03：过滤圣遗物组。** [NewArtifactPlanPage.vue](src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue) 增加搜索输入及独立过滤树，收藏夹和组按中文拼音／名称排序；组的五槽 ID 与已有预设完全一致且无空槽时显示对应角色头像，多角色匹配显示多个头像，不从自由标题推断归属。勾选 ID 独立于搜索可见性保存，搜索隐藏／清空及树刷新不丢勾选。手动组排除跳过当前已选五件，锁定、主词条、其他角色与队友占用约束继续生效。“使用圣遗物组”树和存档格式保持原逻辑。
- **04：银釭（Silver Light，ID 11438）。** 核对 [中文正式数据](https://gi.gachabase.net/weapons/11438/silver-light/release?lang=chs)、[英文正式数据](https://gi.gachabase.net/weapons/11438/silver-light/release?lang=en)，均为 release 7.1.0，设计／资源修订 48145775。数据保存在 [silver-light-release-71.json](beta-data/silver-light-release-71.json) 和 [silver-light-runtime.mjs](beta-data/silver-light-runtime.mjs)：96 行等级／突破数据，R1～R5 每层精通 52／65／78／91／104，施放元素战技后每层持续 12 秒、最多 2 层且独立计时。界面参数表示当前有效层，默认 0，范围 0～2；不自动模拟时间轴。90 级基础攻击 510，攻击副属性按现有 expanded 精度策略由原始 .41346 取 .4135（界面 41.3%）。[expanded-weapons.mjs](beta-data/expanded-weapons.mjs) 通过同属性族的 TheFlute 与已有属性效果桥接，为旧内核和扩展内核统一注入等级差值、副属性差值和精通；接入目录、中文／英文游戏描述及[正式本地图标](public/weapons/silver-light.png)，选择器和详情通过 `/weapons/silver-light.png` 实际消费。实际面板、单次、单人优化、词条收益、DSL 和喵喵评分已核对；原生库存静态推荐的无 BUFF 接口限制继续由 05 维护。
- **09：选择 BUFF。** 原因是角色分类已有 `keepOpen:true`，其他分类没有发送。[SelectBuff.vue](src/components/select/SelectBuff.vue) 为其他分类同样发送 `keepOpen:true`；两个父页面的事件参数将 `config` 同步为可选，保留角色配置和其他分类默认配置的创建。角色／武器／圣遗物／共鸣／自定义添加后保持弹窗打开，搜索和分类不重置；沿用已有去重处理。

本轮验证使用合成数据，共五项明确目的，没有运行全量测试：

| 项 | 命令／证据 | 核对结果 |
| --- | --- | --- |
| 1 组过滤交互与候选约束 | `node --test tests/filter-kumi-7110.test.mjs` | 1 项通过；真实页面函数、Vue 与 Element Plus TreeStore，覆盖名称排序、搜索、头像精确匹配、勾选保留、当前装备保留及其他约束优先级 |
| 2 BUFF 连续添加 | `node --test tests/buff-dialog-7110.test.mjs` | 1 项通过；真实 SelectBuff／CharacterBuffGroups 组件与两个父页面处理函数，覆盖五分类、连续添加、角色配置、默认配置、重复选择和搜索／分类保留 |
| 3 银釭正式数据与参数 | `node --test tests/silver-light-7110.test.mjs` 第一项 | 正式快照、等级／突破、精炼／有效层、公共面板、目录／翻译／图标通过 |
| 4 银釭实际消费者一致性 | 同一脚本第二项；[证据](.build-target/silver-light-7110/evidence.json) | 凯亚 E 融化、薇斯纳直接星扩散的单次、Naive／AStar 候选排序、精通词条收益、DSL 和等值属性 BUFF 一致；喵喵合成样本正常评分 22.9 |
| 5 编译网页与 Worker 集成 | `npm.cmd run build:local -- --dest .build-target/7110-items-03-04-09/web`；[Worker 脚本](.build-target/7110-items-03-04-09/compiled-worker-check.mjs)／[证据](.build-target/7110-items-03-04-09/compiled-worker-evidence.json) | 构建完成，包内本地图标存在；编译 Worker 加载真实 chunks／WASM，在 6 件合成候选中选中杯 ID 4，结果 6781.281351637214，与 Node 公共接口一致 |

构建日志为 [.build-target/7110-items-03-04-09/build.log](.build-target/7110-items-03-04-09/build.log)。webpack 记录 CSS 顺序、体积及 Browserslist 旧数据等 warning，无编译错误；最终构建命令与编译 Worker 核对命令均返回 0。图标引用修正后仅重跑已有资源验证和构建集成项，未追加验证目的。未进行浏览器页面点击实测或 EXE／APK 实机安装验证，不将合成验证写成上述实测。

### 08 与追加界面清理（2026-10-10，常规版）

状态：**实现完成，两项既有定向验证与最终构建通过。** 用户明确以截图指定移除 YAS WebUI 扫描和「天目」Amenoma，在首页“开源地址”区域放置 GOODScanner 链接；工作期间又要求删除页脚备案号及“圣遗物潜力”“最佳圣遗物”“莫娜数据库”三个独立功能。

- [ArtifactsPage.vue](src/pages/ArtifactsPage/ArtifactsPage.vue) 删除桌面“扫描”按钮、弹窗挂载、导入、状态和点击处理；核对仅此页面消费后删除 `YasUIDialog` 的四个专用文件，包括辅助插件连接与控制实现。
- [ExportToolPage.vue](src/pages/helps/ExportToolPage/ExportToolPage.vue) 删除 Amenoma 卡片；[IntroPage.vue](src/pages/about/IntroPage/IntroPage.vue) 的开源区域新增 GOODScanner GitHub 卡片，地址为已在线核实的 [Anyrainel/GOODScanner](https://github.com/Anyrainel/GOODScanner)。沿用现有卡片交互，不新增产品说明。
- [Footer.vue](src/pages/MainPage/Footer.vue) 删除备案号显示块和对应的未使用组件参数。
- [SideBar.vue](src/pages/MainPage/SideBar.vue) 和 [router.js](src/router/router.js) 移除 `/potential`、`/best-set`、`/character` 及其角色子路由；首页移除潜力功能卡片，将剩余三张功能卡片排为三列。核对没有其他页面消费后删除三个页面目录及专用 Worker／JS 封装、潜力选择器与旧潜力算法文件，清除对应导出和组件类型声明。计算器仍使用的角色／武器／圣遗物元数据及公共计算内核保持既有实现。

本轮仅运行以下三个定向核对，没有新增测试或运行全量清单：

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 1 实际文件读取与页面导入回调 | `node --test --test-name-pattern='actual file reader' tests/good-import.test.mjs` | 1 项通过；合成文件选择／导入、共享转换及等待完成的回调正常 |
| 2 导入装备进入公共计算与评分 | `node --test --test-name-pattern='imported equipment crosses' tests/good-import.test.mjs` | 1 项通过；合成可莉伤害 2087.780878395502、评分 125，与等值参考一致 |
| 3 最终网页构建 | `npm.cmd run build:local -- --dest .build-target/7110-item-08/web` | 构建命令返回 0；包含用户追加的页脚和三个独立功能移除，日志为 [.build-target/7110-item-08/build.log](.build-target/7110-item-08/build.log) |

追加需求后重构建同一构建项，最终输出包含本节所有源码修改。构建仍记录 CSS 顺序、体积及依赖工具提示等 warning，无编译错误。未进行完整新页面浏览器点击实测，未生成 EXE／ZIP／APK 或发布；README、Beta、旧版本及用户存档未修改。

### HoYoLAB 扫码与角色数据调研（2026-10-07，常规版）

状态：**调研完成；尚未实现或实测 HoYoLAB 登录／同步。** 记录见 [HoYoLAB 接入调研](docs/hoyolab-research-7110.md)。本轮只读当前源码与公开开源／官方静态脚本，没有登录、获取票据或读取用户账号库，不构建、不发布、不修改 README。

- 当前扫码实际来源为 [TwiceDrop/mhy-qdcode-to-cookie](https://github.com/TwiceDrop/mhy-qdcode-to-cookie)，使用国服 `ma-cn-passport/app` 创建／轮询，再由 SToken 换 Cookie；当前角色业务与游戏区域均限定国服。桌面与 Android 复用 `server/mys.mjs`，不能只接桌面端。
- HoYoLAB 数据读取已有 genshin.py 海外消费者：海外绑定账号、`hk4e_global`、四个 os 游戏区域、`sg-public-api.hoyolab.com/event/game_record/genshin/api` 的 POST `character/list`／`character/detail`。详细角色模型与现有转换字段对应，适合复用共享角色／圣遗物转换和入库；实际返回与导入尚未验证。
- 没有找到已确认完整可用的海外扫码链路。genshin.py 的扫码限定 `Region.CHINESE`；UIGF 当前扫码定义也标注 CN；已读 HoYoLAB 官方账号 SDK／账号页没有发现创建／轮询扫码登录端点。这是本轮证据边界，不能断言所有海外客户端都没有扫码，也不能将国服端点换域名冒充完成。
- 已有海外参考实现是邮箱／密码登录、验证码及 Set-Cookie 获取；官网最新账号 SDK还包含 SG／US／EU 通行证分区。网页登录与海外 App 登录、游戏 GameToken 不能混用。
- 后续最小方案：先在现有客户端明确平台／海外路由与请求头，复用已有 Cookie 输入验证海外 UID 和已穿戴装备同步；再单独落实方便的官方登录方式。两端账号凭据存储目前只以数字 ID 匹配，新增海外需保留平台身份；手机 `src/platform/native.mjs` 只允许国服域名；快照 source／标题和中文天赋对应也需同步。全部背包未装备圣遗物不在已查战绩接口范围。
- 来源／固定参考及具体未决事项见调研记录。海外扫码仍缺明确 app_id、端点、扫描应用、确认响应与可用 Cookie 取得方式，不猜测、不写假兼容，不因本轮只调研而新增拦截／回退／哈希逻辑。

### 面板属性排序与纯枚举对照（2026-10-08，常规版）

状态：**调研完成；未新增业务实现、项目功能测试、构建或发布。** 用户本次询问计算器里的纯枚举模式，与限定四件套／主词条后按暴击率、爆伤、攻击、生命等属性筛选排序有什么区别，并进一步要求核实 Fribbels 实际功能。本项阅读常规版源码、Fribbels 官方搜索及结果控制逻辑，以及当前官网 HTML／JS；浏览器工具没有可用会话，未做页面点击实测。不操作 Beta、账号存档或 README。

- “纯枚举”是算法选择，排序依据来自目标函数；将算法改为 `Naive` 不会自动把当前伤害目标换成爆伤／暴击率，也不表示保存并展示所有合法搭配。现有 `algorithm.rs:54` 将 `Naive` 映射到 `AStarCutoff`，该源码仍使用分组属性上界剪枝（`cutoff_a_star.rs:292`）；因此不能仅凭界面名称宣称每个组合均逐一计算。网页实际加载的是保留的旧桥接 WASM 和扩展，当前 Rust 源码与旧二进制并不完全一致，本次没有反编译或运行二进制验证搜索完整性。
- 已有约束：选择一个套装转换为四件套，两个套装转换为二加二；沙／杯／冠可限定多个主词条；已有充能、精通、暴击率、爆伤下限。攻击／生命／防御下限虽然存在 Rust 接口字段，前端当前传 `null`，界面未开放；当前也没有这些属性的通用上限输入。来源：`src/composables/constraint.ts:15`、`:31`；`src/pages/NewArtifactPlanPage/NewArtifactPlanPage.vue:79`、`:129`。
- 普通目标下拉已有 `MaxATK`、`MaxDEF`、`MaxHP`、`MaxEM`、`MaxRecharge`；未发现普通暴击率／爆伤最大化目标。目标源码实际返回对应面板属性，例如 `max_atk.rs:91` 与 `max_hp.rs:88`；这不是五件副词条的简单加总，角色、武器、套装和已选 BUFF 都参与属性计算。DSL 属性读取支持 `crit0`／`cd0`（`mona_dsl/src/object/prop.rs:38`），可作为手动表达目标的基础，但本次未运行该目标，不能据此声明所有角色路径均可用。薇斯纳扩展还限制普通目标名称（`beta-data/vesna-facade.mjs:22`），实施时必须核对实际消费者。
- 结果区目前通过序号逐组切换，展示目标值及相对最优值，没有多属性配装表、属性列排序或计算后属性范围筛选（`NewArtifactPlanPage.vue:509`）。Rust 单人接口将结果数设为 `100`（`interface_wasm.rs:66`），结果记录器只保留有限数量并按 `value` 降序排列（`cutoff_a_star.rs:174`、`:610`）；旧 Worker 历史返回 100 组的证据见 `docs/entry-repair-7108.md:22`、`:35`。不能将“共计算 N 组”理解为总共只搜索了 N 组，也不能将返回结果当作全部合法组合。
- Fribbels 的搜索前设置：四件套／二件套组合与主属性过滤先缩小候选，装备归属、强化、稀有度和副词条权重门槛也可排除单件；CPU Worker 遍历六槽候选组合，检查套装、属性上下限及所选目标的门槛，再把通过者送入按目标保留前 N 名的队列。它的“穷举”仍受用户候选过滤条件约束，不是无限保存仓库所有组合。来源：[官方 optimizer.ts](https://github.com/fribbels/hsr-optimizer/blob/2140153da4d4b8fd212c9420f2ccf123daa5dc6b/src/lib/optimization/optimizer.ts)、[optimizerWorker.ts](https://github.com/fribbels/hsr-optimizer/blob/2140153da4d4b8fd212c9420f2ccf123daa5dc6b/src/lib/worker/optimizerWorker.ts) 与 `src/lib/relics/relicFilters.ts`。
- Fribbels 的属性目标和结果数量：`CharacterSelectorDisplay.tsx` 的真实选择器提供 HP／ATK／DEF／SPD／CR／CD 等优化目标；`optimizer.ts` 将 `resultSort` 映射到基本或战斗属性字段，用 `FixedSizeMinQueue(resultsLimit)` 保留目标值最大的方案。默认结果数为 1024；选择器按 `64 * 2^i` 生成 64～65536 的选项。可按暴击率、爆伤、攻击或生命直接搜索前 N 名，不必先按伤害找结果。来源：[CharacterSelectorDisplay.tsx](https://github.com/fribbels/hsr-optimizer/blob/2140153da4d4b8fd212c9420f2ccf123daa5dc6b/src/lib/tabs/tabOptimizer/optimizerForm/components/CharacterSelectorDisplay.tsx)、`src/lib/optimization/defaultForm.ts` 和 `src/lib/dataStructures/fixedSizeMinQueue.ts`。
- Fribbels 的计算后操作：结果表列定义设 `sortable: true`、降序／升序，表头点击调用 `optimizerTabController.ts` 的 `sort()`，仅重排 `controllerState.rows`；“Filter”按钮调用 `applyRowFilters()`，再按当前属性上下限遍历相同已保留结果，并分页展示，不重新执行搜索。切换表头到另一属性不会取回被初始目标淘汰的组合；放宽后筛选也不能恢复初始搜索排除的方案。要寻找另一属性在候选范围内的最高方案，应更换优化目标并重新运行。来源：[optimizerTabController.ts](https://github.com/fribbels/hsr-optimizer/blob/2140153da4d4b8fd212c9420f2ccf123daa5dc6b/src/lib/tabs/tabOptimizer/optimizerTabController.ts)、`optimizerForm/grid/optimizerGridColumns.ts` 与 `sidebar/ResultsSection.tsx`。
- Fribbels 的面板口径：基本／战斗属性是明确视图，搜索排序分别用 `CD`／`xCD`、`CR`／`xCR` 等字段；属性筛选也分别在基础属性或条件／BUFF 计算后执行，结果表能切换同一方案的两种属性。`ResultFilters.tsx` 和 `FilterRow.tsx` 确认攻击、生命、防御、速度、暴击率、爆伤等都有独立最小／最大输入。来源：`src/lib/optimization/sortOptions.ts`、`optimizerWorker.ts`、`sidebar/StatsViewSelect.tsx` 和 `optimizerForm/components/ResultFilters.tsx`。
- 本次固定官方仓库提交为 `2140153da4d4b8fd212c9420f2ccf123daa5dc6b`。同时从[当前官网](https://fribbels.github.io/hsr-optimizer/)取得实际加载的 [index-AX9h356A.js](https://fribbels.github.io/hsr-optimizer/assets/index-AX9h356A.js)，核对到 `resultsLimit ?? 1024`、64～65536 选项、目标队列门槛、列升降序与 `applyRowFilters`，与上述关键源码行为一致。下载的只读源码放在系统临时目录 `C:/Users/Admin/AppData/Local/Temp/codex-fribbels-audit-20261008`；未运行 Fribbels 代码或对其全部计算公式做审计。
- 建议最小实现：复用现有套装／主词条与下限约束，补齐最高暴击率／最高爆伤等优化目标，并添加能查看各方案面板属性的结果表。所选排序属性必须参与搜索评分／结果保留；先取伤害前 100 再按爆伤重排，无法保证找到全局爆伤最高方案。若只保留前 N 名，改变优化目标应重新搜索；真正要求计算一次后对全部合法组合任意排序／放宽筛选，则需另行设计全结果存储与分页，并评估组合数量和内存成本。
- 实施前需确定的具体语义：属性依据无外部 BUFF 面板还是当前配置的含 BUFF 面板；保留前 N 名还是要求全部结果；结果表换列排序仅作用于已返回方案，还是需要该属性的全局最优排序。本次只解释差异并登记结论，不自动恢复历史已移除功能。

2026-10-10 用户要求删除 07，已从待办移除，不继续该项排查。

### 群反馈登记（2026-10-10，常规版）

原始登记来源为用户提供的三张群聊／“选择 BUFF”弹窗截图；没有复制其中 UID、账号资料或图片文件到项目。**08、09 均已按后续授权完成实现和针对性验证。**

- **7.1.10-08：移除 Web 扫描，现已完成。** 原建议为“群主该把web扫描删了”；后续用户截图明确对应 YAS WebUI 扫描，并要求移除 Amenoma、增加 GOODScanner 首页开源链接及追加界面清理。具体修改和证据见上方 08 实施记录。
- **7.1.10-09：添加 BUFF 后弹窗关闭行为不一致，现已完成。** 原反馈称添加队友后不关闭，添加其他分类后关闭；已定位各分类 `keepOpen` 事件差异并统一为添加后保持打开，源码及运行验证见上方实施记录。截图保留为原始反馈依据。

## 1. 先确认工作目录和版本

- 本项目源码：D:/Documents/ChatGPT/v7.1.10/source，即本文件所在目录；项目用途以本文件顶部的分流约定为准。
- package version 为 7.1.10，displayVersion 为 7.1.10；Android 源码 versionCode 为 70110、versionName 为 7.1.10。建立副本时仅同步源码声明；2026-10-11 发布任务已构建新版启动器和三项成品。
- 会话默认 D:/Documents/ChatGPT/genshin-artifact 是旧 Git 工作区，package 仍为 5.30.0 且有大量已有改动；不要重置、清理、自动提交或把这些改动当成当前源码。
- 7.1.09 正式基线为 D:/Documents/ChatGPT/v7.1.09/source，独立发布工作区为 D:/Documents/ChatGPT/v7.1.09/source-publish；这次不操作其 Git 或成品。
- 开始工作确认对应目录、版本及已有改动，保留用户修改；没有要求的历史事项不自动恢复执行。

## 2. 项目方向和功能范围

目标仍是通过统一参数、共享规则和明确伤害作用域减少角色／武器／机制的重复适配，单次伤害与单人配装共用实现。常规适配范围为单次伤害和单人圣遗物配装优化；多人优化实验全部交由 Beta 副本。

7.1.09 保留角色技能、天赋、命座的星／月直伤，以及普通反应体系。公开保留键为 direct_moonelectro、direct_moonbloom、direct_mooncrystallize、direct_stellarconduct、direct_stellarswirl；移除键为 moonfall、moonelectro、mooncrystallize、stellarconduct、stellarswirl_anemo、stellarswirl_cryo。

复制源码不自动恢复独立星／月反应、多人贡献、独立判暴排序、手填主C面板或旧近似算法。这些历史功能不在常规副本恢复；需要多人优化时先转到 Beta。 旧预设明确要求已移除功能时保留具体错误，不偷换伤害或批量删除用户预设。

2026-10-10 用户另行要求移除 YAS WebUI 扫描、Amenoma 条目、页脚备案号，以及圣遗物潜力／最佳圣遗物／莫娜数据库三个独立功能；这些页面和入口已移除，不因遗留翻译、数据或底层内核接口存在而自动恢复。

瑞希星扩散保留天赋／一命模式 0／1；伊涅芙默认目标保留薇尔琪塔放电和频率超限回路直伤。历史基线范围见 docs/direct-reactions-only-7108.md；其他多人／独立反应旧文档作为资料，不作为当前实现完成的证据。



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

14. **调研完成后及时写入 AGENTS.md（2026-10-06 用户明确要求）。** 每个事项调研完成后，在当前项目 AGENTS.md 更新事项状态、结论、来源、建议方案和仍待确定的具体问题；区分“调研完成”“实现完成”“验证完成”。不要只在 Codex 回复中报告后仍让文档停留在“待调研”。纯调研或文档更新不自动开始实现、测试、构建或发布。 待办统一维护在本文件“当前版本 7.1.10 待办及完成状态”大标题下，每轮同步调研、实现、验证和暂缓状态；已经调研但未实现的事项必须保留，不能只写在分散的调研段落。

**2026-10-10 功能任务已完成：03、04、08、09 实施完成，07 删除。** 03／04／09 由三个 sub-agent 分别完成；后续按用户新截图完成 08、页脚备案号和三个独立功能移除，各轮定向验证及构建证据见上方记录。未修改 Beta 或旧平台包。建立副本时仅同步源码版本声明；2026-10-11 用户要求上传 GitHub，已按第 13 条生成本版启动器，当前发布进度见上方记录。7.1.09 的发布授权不作为本版依据。多人优化只去 Beta，其他功能与 BUG 只去 7.1.10。

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

建立副本时没有运行功能测试、构建或发布；2026-10-10 完成 03／04／09 的四项定向测试和一项构建／Worker 集成核对，随后完成 08／追加清理的两项既有定向验证与最终网页构建；2026-10-11 完成组头像／荧导入修复的五项定向验证目的，其中第五项为新网页构建与编译 Worker。修复任务当时只输出隔离网页；后续按用户发布要求完成当前桌面／手机网页、Windows EXE／ZIP、Android APK 和 GitHub 正式版，发布轮次五项目的见上方记录。每轮最多五项针对性验证，7.1.08／7.1.09 已通过证据保留，不重跑历史全清单。调研和纯文档任务不构建。

7.1.09 的锁定、更新、GOOD 导入及评分验证脚本仍保留原文件名；按修改范围选择，不能把它们全部作为默认启动任务。现有 --baseline 或私有上游对照可能依赖历史目录，先确认实际路径，不修改基线来迎合新输出。

需要交付成品时再从本文件所在 source 构建。Node.js 20 或更新版本，沿用锁文件和既有依赖，常用 NODE_OPTIONS 为 --max-old-space-size=6144；网页命令 npm.cmd run build:local，手机前端 npm.cmd run build:mobile。只复制源码不沿用旧 dist 冒充新产物。

启动器由 script/build-tray-launcher.ps1 读取 package.version／displayVersion 生成；2026-10-11 已生成 启动7.1.10.exe，数值程序集／文件版本为 7.1.10.0，托盘、日志和产品显示版本共用本版声明。复用 D:/Documents/ChatGPT/v7.1.09/web/runtime，7.1.09 旧成品保留。Windows 构建脚本使用 PowerShell 7，避免旧 PowerShell 将 UTF-8 中文脚本误按系统编码读取。

Android 当前源码 versionCode 为 70110、versionName 为 7.1.10；保持 com.mona.artifact.local 及 https://localhost，不改应用 ID、端口或签名，不安装、不卸载、不清数据。2026-10-11 已构建原签名 APK 并核对版本、签名及包内网页；未进行实机安装。测试多人优化时使用合成数据和隔离测试环境，不共享或修改用户实际存档。

Android 公共保存入口仍为 MonaLocalPlugin.java；已有系统保存、目标 URI 实际写入、完整回读与导入证据见 docs/android-export-7108.md、docs/release-validation-7.1.08.md。不能仅凭界面或编译通过宣称系统流程修复。明确要求系统导出验证时，使用独立 .debug 包和 ExportRegressionTest，不触发依赖库全量测试。

Rust 扩展沿用 nightly-2024-10-10-x86_64-pc-windows-gnu、wasm32-unknown-unknown 和 wasm-bindgen 0.2.92。beta-tools/build-extension.ps1 会追加多套 smoke，按实际范围选择；不运行 npm run build:wasm 覆盖原始内核。桥接脚本 script/build-effect-bridge.py 需要 WABT，先核对函数签名、槽位、图容量和内存生命周期；不手改 WASM。

## 8. 验证与交付边界

- 7.1.09 的真实 Windows 覆盖安装、Android 更新下载／授权／覆盖安装未实机重测；源码、合成路径和正式包核对各自按原记录保留，不混写。
- 复制副本本身没有新增计算验证；本轮新增的银釭公共计算及编译 Worker 证据只覆盖上述定向输入。多人优化是否支持、支持哪些目标与组合，必须在 Beta 根据具体任务和实际消费者说明，不因复制或本轮单人验证而写“已完成”。
- 未穷举游戏组合不是自动待适配事项；明确漏算、错误映射或缺失规则才按具体问题记录。基线已删除的功能不自动作为缺项。

## 9. 当前目录与继续阅读

- 当前源码：D:/Documents/ChatGPT/v7.1.10/source。
- 当前正式版：[GitHub 7.1.10](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.10)；成品位于 D:/Documents/ChatGPT/v7.1.10，Git 发布目录为 D:/Documents/ChatGPT/v7.1.10/source-publish。
- 多人优化专用：[7.1.10Beta](../../v7.1.10Beta/source/AGENTS.md)。
- 其他功能与 BUG：[7.1.10](../../v7.1.10/source/AGENTS.md)。
- 已发布 7.1.09：D:/Documents/ChatGPT/v7.1.09，源码基线、正式成品及 source-publish 保留不变；[GitHub 正式版](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.09)。

先阅读本文件顶部的任务分流，再按实际问题读取 docs/release-7.1.09-final.md、docs/release-validation-7.1.09.md、docs/astra-review-fixes-7109.md、docs/artifact-score-fix-7109.md。计算层工作继续读 docs/interface-parameters-7108.md 和 docs/shared-buff-rules.md；多人历史文档仅作资料，不自动恢复旧范围。

交付用中文说明实际修改、原因、少量验证与边界，给出当前路径。调研或状态变化及时更新对应项目的 AGENTS.md；不要把 Beta 实验、常规开发和已发布版本混写。
