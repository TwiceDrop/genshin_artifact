# 7.1.10 构建与发布核对

日期：2026-10-11。用户要求“上传到 github，根据 agent.md 里的要求更改相关文件”。按既有正式发布方式准备 Windows EXE／ZIP、Android APK 和 GitHub 源码／Release，更新 README 的四部分及本版全部 12 项更新说明。

开发源码为 `D:/Documents/ChatGPT/v7.1.10/source`，独立 Git 发布目录为 `D:/Documents/ChatGPT/v7.1.10/source-publish`，从 GitHub 当前 main 建立。旧版、Beta 及其平台成品保留。

## 本轮五项定向验证目的

| 项 | 实际核对及结果 |
| --- | --- |
| 1 Windows 构建与版本同步 | 当前源码桌面前端、ZIP 便携包和 Inno Setup 安装包构建完成。通过 `build-tray-launcher.ps1` 重新编译 `启动7.1.10.exe`；标题“莫娜占卜铺 7.1.10”、产品显示版本 7.1.10、程序集／文件版本 7.1.10.0、安装器数字版本 7.1.10.0 一致 |
| 2 Android 构建、包身份与签名 | 当前源码手机前端及 release APK 构建完成，Gradle 记录 BUILD SUCCESSFUL。使用原升级签名目录；apksigner 验证通过，应用 ID `com.mona.artifact.local`、versionCode 70110、versionName 7.1.10，来源保持 `https://localhost` |
| 3 包内容与公开源码范围 | ZIP 中 417 个网页文件、APK 中 421 个网页文件逐文件回读，与本次 dist／dist-mobile 字节一致；ZIP 含新版启动器、Node 运行时、更新脚本及发布日志。包内未发现账号目录、Debug 导出、签名资料或私有构建目录；公开源码使用既有目录／文件允许清单，排除存档、导出、签名、缓存及用户附件 |
| 4 实际编译 Worker 消费 | 桌面和手机的真实编译 Worker／chunks／WASM 在 Node 模拟环境中执行。冰荧 C6、模式 2、8 层，6 件合成候选的默认目标与第二重击 DSL 均选中冠 ID 6，分别为 51234.28517497756／10472.37560855141，与公开单次独立参考一致 |
| 5 GitHub 发布回读 | 待完成上传后回读源码提交、标签、README、12 项正文和三项资产名称／公开状态／大小，未将上传准备写成正式发布完成 |

03／04／08／09 及组头像／荧导入的已完成定向验证沿用原证据，没有重新运行历史全量测试或扩展游戏组合。本轮验证脚本、日志和证据仅存于私有 `.build-target/release-7110/`。

Windows 第一次启动器构建使用旧 PowerShell，对 UTF-8 中文脚本解码错误，产生 C# 编译错误。保留失败 staging 后，改用现有 PowerShell 7 执行原构建脚本，新启动器与包构建通过；没有为此修改应用计算源码。现有 CSS 顺序、体积、Browserslist、Node 模块及 Gradle 弃用提示保留，没有更新依赖。

## 成品

产物位于 `D:/Documents/ChatGPT/v7.1.10`：

| 文件 | 大小 |
| --- | ---: |
| genshin_artifact_V7.1.10_windows_x64_setup.exe | 45034044 字节 |
| genshin_artifact_V7.1.10_web.zip | 60508193 字节 |
| genshin_artifact_V7.1.10_android.apk | 29220065 字节 |

EXE 与 ZIP 使用同一 `web` staging，未沿用旧版启动器。Android 使用当前手机网页和原升级签名；签名文件及密码仅在本地构建读取，不进入公开源码或发布包。未新增摘要、SHA256 或校验文件。

## 边界与状态

构建、包回读、版本及签名通过，不等同于真实账号同步、完整浏览器点击、Windows 覆盖安装或 Android 下载／授权／覆盖安装实机验证。本轮未安装应用、清理存储或修改原始导出。系统导出／回读及旧导出兼容保留原证据，未声称本轮重新验证。

当前平台成品已构建并完成上述核对；GitHub 上传进行中。库存原生静态权重继续暂缓，HoYoLAB 海外接入及面板排序未作为本版实现功能。
