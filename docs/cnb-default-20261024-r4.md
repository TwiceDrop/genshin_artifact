# CNB 实际更新验收与默认下载入口（2026-10-24）

## 当前状态

- CNB 浏览器权限阻塞已解除；已通过用户登录的 ChatGPT 浏览器创建 [v7.1.12 测试 Release](https://cnb.cool/twicedrop/genshin_artifact/-/releases/tag/v7.1.12)，上传 R2 的 Windows 安装器、ZIP、旧 UI APK、新 UI APK。latest 回读为 v7.1.12，四个附件均完整可下载。
- 按用户本轮明确指令，只发布成品，未上传或更新仓库源码。测试标签基于现有 main（1003a62e）；发布页已注明自动源码归档不是 7.1.12 对应源码。先创建的 v7.1.12-cnb-test 改为非 latest 的预发布附件预检记录，保留不删除。
- 原签名 instrumentation 构建本轮成功，未再触发审批拒绝，未复制或公开签名资料。Android 存储检查的原失败已定位到旧模拟器配置内 WebView IndexedDB 日志损坏；独立环境的真实应用存储验证见下文。
- 用户已反馈 APK、EXE 实机测试安装成功。随后反馈 R2 显示“当前已是最新”：确认曾关闭“第三方下载加速”，原实现因此只查询 GitHub；重新安装测试后恢复正常。不是 CNB Release 仍为空。
- 用户随后要求两版改为 CNB 默认下载，绿色推荐按钮免测速，灰色独立按钮点击后再展开其他源并测速；版本查询先 CNB，再 GitHub。两版源码已实现，各 18 项定向检查通过。用户最新指令为“先修改源码，不构建”，已停止在途构建，不再打包、上传或进行成品验收。当前线上 v7.1.12 附件仍为 R2，不能当作 R4 新交互。

## R2 真实远程更新证据

证据目录：本项目 `.build-target/cnb-storage-20261024-r3/`。

1. 原 7.1.11 R2 `LocalUpdater` 从实际 CNB latest 查到 v7.1.12，并完整下载 ZIP（61,377,676 字节）及安装器（45,112,446 字节）。两 APK（30,084,239／29,885,457 字节）也从实际 CNB 下载，四包直接逐字节等于原 R2 成品，没有新增摘要校验。
2. 使用 7.1.11 R2 原 `Install-PortablePackage` 将远程 ZIP 覆盖到独立完整运行目录。436 个文件与 7.1.12 R2 精确一致，合成 `.local-data`／用户标记保留，启动器文件版本 7.1.12.0；更新后 runtime 及生产网页实际启动，浏览器显示 7.1.12，页面错误 0。本项未自动操纵用户原托盘、默认浏览器存档或生产安装注册。
3. Android 原夹具立即结束进程会复现 localStorage 标记缺失；等待写入后 localStorage 保留，但原旧 UI 模拟器配置的 IndexedDB 仍丢失。日志明确报 `Corruption: missing start of fragmented record(2)`，随后 WebView 自动删除损坏数据库并恢复。真实应用导入合成 UID／装备后也在该配置同版本重启失败；没有清用户数据来掩盖。
4. 使用未有旧 UI 数据的独立新 AVD `MonaCnb7112R3`，安装原签名 7.1.11 R2，走实际 UID 文件导入入口保存合成账号、21 件圣遗物及预设／UID 关联数据；同版本重启通过。实际原生 DownloadManager 从 CNB 下载完整旧 UI APK，回读与本地成品逐字节相同，再 `adb install -r` 覆盖至 7.1.12。账号／仓库／预设／UID 数据精确保留，额外 localStorage、IndexedDB 标记和原生 SharedPreferences 断言均通过（2 tests）。
5. 新 UI 在独立的包身份下完成同样的实际合成导入、同版本重启、原生 CNB 完整下载、字节对照和 7.1.11→7.1.12 覆盖，应用存储精确一致且页面恢复 21 件。原生 CapacitorHttp 的实际 latest 请求也返回 HTTP 200／v7.1.12。

新 AVD 位于证据目录 `fresh-avd/`，原 AVD 及正式应用数据未清理。以上 Android 自动验证使用系统覆盖命令，不冒充系统“未知来源授权／安装”按钮交互实测；用户后续 APK、EXE 成功反馈单独计入实机证据。WebView 损坏记录及各原始失败日志保留，不把新环境通过解释为已修复原损坏数据。

## R4 交互与查询变更

- 共用 `server/update-sources.mjs` 按 CNB→GitHub 顺序查询。CNB 发现比当前更新的版本即采用；CNB 无更新或失败时再查 GitHub。已知结果按版本比较，两个源均失败保留两者错误。版本查询不再使用代理源，也不读取旧下载加速开关。
- 两版 `src/App.vue` 使用绿色“使用 CNB 下载（推荐）”，直接进入既有下载／取消／大小核对／安装流程，不探测 CNB 速度。
- 下方灰色“使用其他下载源下载”打开独立对话框，之后才测速 GitHub 与既有三个代理线路；CNB 不进入测速列表。关闭其他源对话框后，绿色按钮仍明确选择 CNB。
- 旧 UI 和新 UI 使用同一业务入口，按钮颜色由局部 CSS 明确设置；原自动提示偏好、真实错误、下载取消与安装接管保留。
- 版本、包名、原签名、端口、存档身份、公式和 WASM 不变。README、GitHub 发布、仓库源码均未更新。新成品必须输出新目录并保留 R2。

## 源码交付与构建停止状态

- 两版修改 `src/App.vue`、`src/platform/release-update.mjs`、`server/update-sources.mjs`，并同步对应的三个已有定向测试文件。各版 `node --test tests/cnb-update.test.mjs tests/release-update.test.mjs tests/auto-update-7109.test.mjs` 均 18/18 通过；覆盖 CNB 优先、无更新／失败后查询 GitHub、忽略旧加速偏好、默认 CNB 下载、灰色入口延后测速及原取消／下载流程。
- 在用户收紧范围之前，已完成 7.1.12 两种 UI 和 7.1.11 旧 UI 网页构建；收到“不构建”后停止了正在运行的 7.1.11 新 UI 构建及其子进程。已有局部构建文件保留，不作为本轮成品交付，也未同步原 launcher。
- R4 没有生成 APK、Windows 安装器或 ZIP，没有更新 CNB 附件或仓库源码。未进行 R4 实际浏览器界面／安装验证；这部分不以 R2 的证据替代。
- 本轮到源码修改和已有定向测试为止。后续构建、成品验证和上传等待用户新指令。
