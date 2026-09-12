# 莫娜占卜铺 · 本地增强版

**V7.0.11** · Windows 10 / 11（64 位）· Android 7.0+ · MIT

在莫娜占卜铺的伤害计算、圣遗物自动配装基础上，增加米游社扫码导入、多 UID 管理、装备评分、伤害与属性对比，以及词条收益曲线。计算和仓库管理在本机运行，扫码与同步角色时才需要连接米游社。无需自己部署服务器。

[下载安装包](https://github.com/TwiceDrop/genshin_artifact/releases/tag/V7.0.11) · [全部版本](https://github.com/TwiceDrop/genshin_artifact/releases) · [问题反馈](https://github.com/TwiceDrop/genshin_artifact/issues)

## 安装与启动

### Windows

1. 打开上面的发布页面，在 **Assets** 下载 `genshin_artifact_V7.0.11_windows_x64_setup.exe`。`Source code` 是源码压缩包，不是安装程序。
2. 运行安装程序，按提示安装。默认安装到当前用户的 `%LOCALAPPDATA%\Programs\MonaArtifact`，无需管理员权限。可勾选桌面快捷方式。
3. 从开始菜单或桌面打开“莫娜占卜铺”。程序会启动本地计算服务，并在默认浏览器打开 `http://127.0.0.1:4174/#/calculate`。
4. 使用期间保留系统托盘中的程序图标。关闭浏览器不会退出服务；右键托盘图标选择“退出”才会停止服务。双击图标可重新打开页面。

安装包已内置 Node.js 运行环境、网页资源和计算内核，**无需另装 Node.js、Rust 或开发工具**。扫码登录和米游社同步需要联网；已有数据的常规计算可离线使用。这是 Windows 本地安装版，界面由本机浏览器呈现，不连接他人部署的计算服务器。

安装包未使用商业代码签名证书，Windows 可能提示未知发布者。请只从本仓库 Release 获取文件；可用下面的命令核对页面随附的 `SHA256SUMS.txt`：

```powershell
Get-FileHash .\genshin_artifact_V7.0.11_windows_x64_setup.exe -Algorithm SHA256
```

### Android 手机安装

在同一个 Release 的 Assets 下载 **`genshin_artifact_V7.0.11_android.apk`**，传到手机并打开安装。按系统提示允许当前文件管理器安装应用；安装后打开“莫娜占卜铺”。建议保持 Android System WebView / Chrome 为该系统可用的最新版本。

- APK 包含计算内核、图片与全部正式版功能，**无需电脑开机、服务器地址或浏览器网页**。已有角色和装备可断网计算；米游社扫码和数据同步需要网络。
- 已安装之前提供的手机版时直接覆盖安装即可，包名和签名保持一致。不要先卸载；卸载或清除应用数据会删除手机本地仓库与 Cookie。升级前可导出 UID 文件备份。
- 底部“计算 / 圣遗物 / UID 数据 / 全部功能”切换页面。计算页按“角色与配置 / 圣遗物与伤害 / 面板与曲线”分区，支持全面屏状态栏、手势导航和键盘安全区域。
- 电脑导出所选 UID 的 JSON，传到手机后在“UID 数据”点击“导入 UID 数据包 / 角色快照”。UID 的已穿戴与闲置装备一同导入；导入记录可持久保存和撤销，去重复用的原有装备不会删除。手机也可通过系统文件保存对话框导出给电脑。
- 手机上扫码可先“保存登录二维码”，在米游社扫一扫里从相册识别，或用另一台设备扫码。手机凭据使用 Android Keystore 加密，独立保存在应用内，UID 数据包不携带 Cookie。
- Android 的独立校验文件为 `genshin_artifact_V7.0.11_android.apk.sha256`；`SHA256SUMS.txt` 对应 Windows 安装包。手机的大仓库优化耗时取决于设备性能，计算期间请保持应用在前台。

## 相较基础版莫娜的新增与改进

以下对比针对本项目基于的传统莫娜使用流程，不代表其他社区分支均不具备这些能力。

| 使用场景 | 本版新增或改进 |
| --- | --- |
| 角色配置需要逐项录入 | 米游社扫码登录，导入本人角色等级、命座、天赋、武器等级与精炼、已穿戴圣遗物；支持手动录入 Cookie |
| 多个账号来回切换 | Cookie 账号可长期保存、切换和手动删除；已保存角色按 UID 分组，新增 UID 不覆盖其他 UID |
| 只看到换装后的面板 | 属性显示“之前 → 当前（差值）”，增长红色、下降绿色；五个装备部位标记发生替换的装备 |
| 不易判断实际伤害提升 | 伤害表显示“之前 → 当前（差值，百分比）”；百分比只出现在伤害表，零基线不会除零 |
| 缺少对比基准选择 | 可切换游戏内穿戴、此次计算前和历史配置，并保存对比历史 |
| 不清楚副词条应该怎么提升 | 0–20 条最优收益曲线、各属性词条收益曲线，查看新增词条预算下的分配与伤害变化 |
| 不清楚装备适合谁 | 点击圣遗物查看详细词条、各角色评分排名；计算器显示单件与整套评分、S / SS / SSS / ACE 等档位 |
| BUFF 列表过长 | 按角色展开 BUFF 分组，读取所选 UID 的命座与天赋，可手动调整；支持按命座解锁、单独添加或批量添加 |
| 优化结果借用了其他角色的装备 | 提供“是否允许替换其他角色已穿戴的圣遗物”开关 |
| 跨设备搬运角色与装备 | 按 UID 导出角色和该 UID 的已穿戴、闲置圣遗物；可勾选附带归属未知的旧装备 |
| 导入后难以恢复 | 导入记录刷新后保留；可撤销。撤销只删除该次实际新增且未被后续修改或引用的装备，去重复用的原有装备不会删除 |

同时保留莫娜的基础能力：圣遗物仓库与套装管理、四件套约束、单人自动配装、队伍配装、伤害明细、敌人参数、预设、MONA-DSL 与圣遗物潜力分析。安卓 APK 与电脑版共用计算、导入、评分和仓库代码，包含相同的正式版功能；手机使用本地 WebView 和原生文件选择器，无需电脑或自建服务器。

## 第一次导入数据

### 米游社导入

在计算器点击“米游社导入”，选择扫码添加账号，在米游社确认登录。选中绑定的原神 UID，点击“同步全部角色”。同步后在“我的角色”中按 UID 选择角色，即可带入培养数据。

- 同步面向登录账号本人绑定的国服角色，不能任意查询他人的完整仓库。
- 米游社接口能提供**已穿戴**的圣遗物，不能获取整个背包的闲置圣遗物。闲置装备仍需使用兼容的 YAS / OCR JSON 导入。
- 首次完整同步可能需要一段时间；风控、验证要求或接口变更可能导致同步失败。已有本地数据仍可计算。
- Cookie 可在账号管理中手动删除；删除 Cookie 不会同时删除已导入的角色和装备。凭据失效时可重新扫码更新。

### UID 文件与撤销

在“UID 数据”选择 UID，点击“导出此 UID”。文件包含角色、武器、天赋和该 UID 所属的全部装备，包括闲置装备。旧数据没有 UID 归属时，按需要勾选附带；其他 UID 的装备不会作为该 UID 的库存导出。

另一台设备在同一页面导入该文件，之后可查看导入记录并撤销。重复装备会复用已有条目，**撤销不会清除导入前已经存在的重复装备**。已被后续编辑或引用的新增装备会受到保护；同一 UID 存在后续导入时，按记录提示先撤销较新的导入。请在批量整理数据前自行导出备份。

## 数据保存与升级

- **角色、圣遗物、预设、对比与导入历史**：Windows 版保存于当前浏览器针对 `http://127.0.0.1:4174` 的本地存储；Android 版保存在应用自己的本地存储内。更换浏览器、使用无痕窗口、改用 `localhost`、改变端口或清除站点数据，都会影响能否看到原数据。需要跨浏览器或设备时请导出 UID 文件。
- **Cookie**：Windows 安装版保存在 `%LOCALAPPDATA%\MonaArtifact\data`，使用 Windows 当前用户的 DPAPI 加密。源码运行默认使用项目内 `.local-data`，也可设置 `MONA_DATA_DIR`。不应上传、分享这些目录。
- **更新**：先从系统托盘退出旧版，再运行新版安装程序。安装和卸载均不会主动清理浏览器存储或上述 Cookie 目录。升级前建议导出备份。
- **端口被占用**：先退出其他正在使用 4174 端口的莫娜版本，再启动本版。不要同时运行源码版和安装版占用同一端口。
- 仓库与安装包不包含维护者的账号 Cookie、UID 仓库、私人导入文件或浏览器数据。测试数据为人工构造的测试样本。

## 计算与评分的适用范围

词条曲线针对当前角色、武器、BUFF、套装和目标函数计算，属于给定条件下的收益分析，不保证游戏中能实际刷出该配置。BUFF 解锁不等于触发条件已经满足，层数、覆盖率、队友面板和战斗状态仍需要核实。

装备评分是按角色权重计算的装备质量指标，不等于伤害排名，也不代表命座、武器、天赋等全部培养内容的“完成度”。不同流派可能有不同权重；缺少规则的角色明确显示待适配，不用通用分数冒充角色专属评分。发布版直接使用固定版本的 MIT 喵喵角色规则，保留本地评分展示与接口；规则来源和归一化约定见 [评分说明](src/algorithms/artifact-score/vendor/README.md)。

**V7.0.11 是本项目版本号，不代表已覆盖原神未来版本的全部内容。此正式发行版不含沃雅妮莎、薇斯纳的 beta 角色适配。** 核心内容以所带内核为准，未承诺每一项反应与角色公式均已逐一实机核验。

## 源码运行

建议 Node.js 22 LTS（本安装包使用 22.23.2）。

```bash
git clone https://github.com/TwiceDrop/genshin_artifact.git
cd genshin_artifact
npm ci
npm run test:local
npm run build:local
node script/start-local.mjs
```

Windows 上最后一条命令会打开浏览器；其他系统运行 `npm start` 后手动打开本机地址。源码运行的终端需要保持打开。

仓库包含前端、本地米游社服务、算法扩展、测试，以及可运行的 WASM/元数据。**随附 Rust 目录是上游公开源码快照，不等同于当前发布内核的完整新版本 Rust 源码**；直接重新编译这些旧 Rust 目录不能保证得到随附内核。当前运行内核来自上游 v5.33.58 发布物，来源、校验值与恢复方式见 [第三方说明](THIRD_PARTY_NOTICES.md)。常规构建已包含所需文件，不必运行 `setup:release`；该命令会按固定版本恢复内核及生成数据，开发前请先备份修改。

### 构建 Windows 安装包

准备 Inno Setup 6、Windows 自带的 .NET Framework C# 编译器，以及从 Node.js 官网取得并校验 SHA-256 的 Windows x64 ZIP，将 ZIP 解压至一个目录（需要包含 `node.exe` 和 `LICENSE`）。完成 `npm ci` 后运行：

```powershell
powershell -ExecutionPolicy Bypass -File script/build-windows.ps1 -NodeRuntime "C:\tools\node-v22.23.2-win-x64" -Iscc "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
```

输出在 `release-output`。脚本只装入明确定义的运行文件，不能把整个工作目录手动塞进安装包。重新打包前把已有 `release-stage` 移走，避免混入旧文件。

### 构建 Android APK

准备 Java 21、Android SDK（compileSdk 36）与 Node.js 22，安装依赖后运行：

```powershell
powershell -ExecutionPolicy Bypass -File script/build-android.ps1
```

输出为 `releases/genshin_artifact_V7.0.11_android.apk`。首次构建会在本地 `.local-data` 创建签名密钥，务必私下备份，切勿提交到 Git。以后升级必须使用同一签名；可通过 `-SigningDirectory "私有签名目录"` 复用自己的签名。自行生成的新密钥不能覆盖安装官方 Release 的签名版本。修改内容后，运行 `npm run test:local` 与连接测试设备时的 `android/gradlew.bat -p android connectedDebugAndroidTest` 验证。

## 来源与许可证

基于 [wormtql/genshin_artifact](https://github.com/wormtql/genshin_artifact) 和 [1803233552/genshin_artifact](https://github.com/1803233552/genshin_artifact)；装备评分规则来自 [miao-plugin](https://github.com/yoimiya-kokomi/miao-plugin)，扫码模块来自 [TwiceDrop/mhy-qdcode-to-cookie](https://github.com/TwiceDrop/mhy-qdcode-to-cookie)。感谢原项目及贡献者。

本项目自有代码按 [MIT](LICENSE) 发布，保留上游版权声明。扫码模块的版权所有者已授权本项目所含版本使用 MIT。第三方依赖保留各自许可证；游戏图片、名称和资料属于其相应权利人，不因本项目 MIT 许可而转让。详见 [第三方说明](THIRD_PARTY_NOTICES.md)。本项目为社区工具，与游戏官方无隶属关系。
