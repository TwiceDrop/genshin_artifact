# 本机服务、在线服务与多端打包

增删服务接口、调整监听地址、打包输入或覆盖升级条件时更新。

## 本机服务与联调

在仓库根目录执行 `npm run build:local` 后运行 `npm start`，可用浏览器打开 `http://127.0.0.1:4183/#/calculate`。Node 提供 dist 静态页面和同源 API。开发界面时用 `npm run serve`，从终端显示的本机地址进入；开发中间件将下表接口交给同一请求处理器，并检查客户端是回环地址。[本机入口](../../server/local.mjs) · [开发服务配置](../../vue.config.js) · [首次准备](build-and-test.md)

独立服务监听 127.0.0.1，按实际端口校验 Host，只接受 127.0.0.1 或 localhost。API 要求 `X-Mona-Local: 1`；请求带 Origin 时必须与当前 HTTP 来源一致。Windows 用当前用户的 DPAPI 保护游戏凭据，云会话另存。数据目录可由 `MONA_DATA_DIR` 指定；迁移浏览器库存用设置页的备份，复制凭据文件到另一 Windows 用户无法代替迁移。[凭据存储](../../server/credentials.mjs) · [云代理](../../server/cloud.mjs)

| 本机路径 | 用途 |
| --- | --- |
| `/api/enka/<UID>` | GET 读取公开展柜，供客户端导入角色与穿戴装备。 |
| `/api/mys/` | 两种社区账号共用的本机会话，包括登录、验证、账号选择、绑定角色、导入和进度。HoYoLAB 走网页登录；发行版米游社扫码状态见[当前版本状态](current-state.md)。 |
| `/api/cloud/` | 读取或保存服务地址，代理允许的账号、加密 Cookie、云档案和历史修订请求。 |
| `/api/patch/` | info、status、check、overlay 分别用于读取信息、查看进度、检查补丁和加载数据覆盖。 |
| `/api/update/` | 查询版本和状态，探测下载源、下载、取消及安装程序更新。 |
| `/api/calculation/session`、`/api/usage-stats` | 前者返回本次计算会话标识，后者接收客户端统计并转发。 |

## 在线服务与地址选择

[在线服务](../../online-service/)提供注册、密码或邮箱验证码登录、云档案及修订、客户端加密的 Cookie 保管和使用统计。伤害计算和游戏数据拉取在客户端完成。仓库包含 API、数据库迁移、清理任务和部署配置；项目公共账号服务的部署和实机验收仍列在[在线账号规格](../specs/online-accounts/spec.md)的待办中。联调需要可达的服务实例。部署、邮件、备份恢复和本机健康检查见[部署说明](../../online-service/DEPLOY.md)，启用统计另见[上报配置](usage-stats-rollout.md)。

- Windows 本机代理先读本地已保存的非空服务地址，再取运行环境 `VUE_APP_MONA_CLOUD_URL`，最后读随包的 `server/desktop-cloud-url.local.json`。这个可选文件只放一个 JSON 字符串，内容是服务根地址。远程地址要求 HTTPS，本机联调可用回环 HTTP。[取值顺序](../../server/cloud-config.mjs) · [随包配置读取](../../server/desktop-cloud-url.cjs)
- Android 先读原生云凭据库中保存的地址，再取前端构建时注入的默认值。构建时同名环境变量优先于上述 JSON；两者都未配置时默认地址为空。[移动端云配置](../../src/platform/cloud-mobile.mjs) · [前端构建配置](../../vue.config.js)

## 启动方式决定存档位置

| 入口 | 地址和存储边界 |
| --- | --- |
| 源码 `npm start` | 默认 4183，读取 `MONA_PORT`。 |
| Windows 网页便携包、安装器 | [现行托盘启动器](../../installer/TrayLauncher.cs)在默认浏览器打开 127.0.0.1:4184。仓内的[旧启动器](../../installer/Launcher.cs)用 4174。 |
| Windows Tauri | [独立窗口](../../tauri-exe/src/main.rs)内嵌 WebView2，连接 127.0.0.1:47504；使用自己的应用数据目录。 |
| Android | Capacitor WebView 的来源为 `https://localhost`，存储按安装包的应用 ID 隔离。[Capacitor 配置](../../capacitor.config.json) |

升级后看到空仓库，先核对原来使用的浏览器及其配置、主机名、端口和应用形态。同一个浏览器配置打开同一来源时，安装包和便携包可读到同一份网页存储。回到有数据的入口，在「设置 → 导出数据」备份所有本地账号，再从目标端导入为新账号。保留旧存储直到核对迁移结果。

## 从网页产物到各端成品

| 目标 | 构建入口与产出 | 缺失依赖或升级失败时核对 |
| --- | --- | --- |
| Windows 网页便携包 | [build-web-package.ps1](../../script/build-web-package.ps1) 必传 `-NodeRuntime`，可传 `-OutputDirectory`。生成 web 暂存目录和以 `_web.zip` 结尾的包。脚本会构建网页、调用[托盘编译脚本](../../script/build-tray-launcher.ps1)及 [HoYoLAB 窗口编译脚本](../../script/build-hoyolab-login.ps1)。 | Node 运行时目录须有 node.exe 和 LICENSE。托盘需 .NET Framework x64 C# 编译器，登录窗口需对应 WebView2 SDK。选用尚无同名暂存目录和 ZIP 的输出位置。 |
| Windows 安装器 | 将上一步的 web 暂存目录传给 [build-windows.ps1](../../script/build-windows.ps1) 的 `-StageDirectory`，指定 `-OutputDirectory`，由 [Inno Setup 配置](../../installer/mona.iss)生成 `_windows_x64_setup.exe`。 | 需 Inno Setup 6，可用 `-Iscc` 指向编译器。安装器和 ZIP 使用同一套网页和启动器。 |
| Tauri 实验封装 | 准备网页 dist、Node 运行时和 HoYoLAB 登录辅助程序，再从仓库根目录运行 `python tauri-exe/prepare-payload.py --web dist --node <运行时目录>`。脚本生成 payload.tar.gz 和清单。用 Windows Rust 工具链从仓库根目录运行 `cargo +stable build --release --manifest-path tauri-exe/Cargo.toml` 构建 mona-tauri.exe。构建时嵌入载荷，启动时按载荷哈希解包并拉起 Node。[载荷脚本](../../tauri-exe/prepare-payload.py) · [Rust 构建入口](../../tauri-exe/build.rs) | 需 Python、Windows Rust 工具链和 WebView2。保持包名 mona-tauri、应用 ID com.mona.artifact.tauri 和固定端口。[ADR 0002](../adr/0002-tauri-shell-stays-experimental.md)记录独立封装定位；已有 Tauri 版本使用独立 EXE 更新，具体版本见[当前版本状态](current-state.md)。 |
| Android APK | [build-android.ps1](../../script/build-android.ps1) 依次构建网页、执行 cap sync android 和 Gradle assembleRelease，默认输出到 releases。覆盖升级传 `-SigningDirectory <原签名目录>`。 | 需 Java 21 和 Android SDK，可分别通过 `JAVA_HOME`、`ANDROID_HOME` 定位。沿用原签名和应用 ID com.mona.artifact.local，发版递增 versionCode。`-MobileTest` 追加 .mobiletest 包名，与正式版各有存储。[应用配置](../../android/app/build.gradle) |

Android 通过[原生插件](../../android/app/src/main/java/com/mona/artifact/local/MonaLocalPlugin.java)访问 Keystore 加密库、HoYoLAB 登录窗口和 APK 更新流程。桌面首次安装依赖、从上游包重新提取内核时的 7-Zip 要求见[构建与测试](build-and-test.md)，各模块如何调用计算内核见[架构](architecture.md)。
