# 7.1.09 软件内更新实现记录

日期：2026-10-06。按用户要求只修改源码；未构建、发布或覆盖安装真实软件。

已将旧“打开 GitHub 下载页”入口接成 Windows／Android 的下载更新流程。软件启动及运行期间每小时自动检查，保留关于页手动检查和自动提示偏好。发现新版本后显示现有更新日志，点击“下载并更新”后检测线路、下载，并进入对应安装流程。

## 实现范围

- src/App.vue：更新窗口、第三方加速开关、线路选择、下载进度／速度、取消、错误与安装操作；没有新增帮助说明或小字。
- src/platform/release-update.mjs、server/update-sources.mjs：版本信息、发布资产选择、统一线路与客户端平台接口。线路为 GitHub、ghfast.top、ghproxy.net、gh-proxy.com；加速关闭时仅使用直连。元数据通过可成功响应的源读取，全部失败时保留具体来源错误。
- server/updates.mjs、server/local.mjs：独立于米游社登录的本机更新接口，沿用已有本机请求来源限制。按安装目录是否含 unins000.exe 区分安装版／便携版。下载流直接写临时文件，进度通过状态接口读取；达到发布资产大小并关闭文件后才进入可安装状态。不完整和取消下载不进入安装。
- installer/TrayLauncher.cs：向 Node 提供启动器 PID，接收 MONA_LAUNCHER_UPDATE 后调用既有正常退出流程，先停守护，再关闭 Node。
- script/install-update.ps1：在下载目录独立运行，等待启动器和服务退出；安装版运行既有 Inno 安装 EXE 并传入原安装目录，便携版覆盖程序目录和新启动器；随后打开新版本启动器。保留 .local-data、其他用户文件、旧启动器以及既有访问端口。错误写本次更新日志并显示具体原因。
- script/build-tray-launcher.ps1：输出到发布目录时同步复制 install-update.ps1。未修改含历史 SHA256 步骤的旧 build-web-beta-7108.ps1，也未运行它。
- Android MonaLocalPlugin.java／Manifest：并发线路片段检测、DownloadManager 后台下载、状态与取消、REQUEST_INSTALL_PACKAGES、安装授权返回回调和系统 APK 安装界面。下载 ID 及版本单独存于 mona-updates，不修改账号库或包名。APK 内容不经过 JS 大载荷传输。Android 安装保留系统确认。
- tests/auto-update-7109.test.mjs：本轮四项合成验证。

测速取所选发布资产的前 256 KiB，允许手动选择和直连；显示的是该片段平均速度，不承诺整个发布包或未来时刻的持续速度。无需注册第三方服务账号。采用既有 EXE／ZIP／APK 发布方式，没有迁移安装包体系。

Windows 更新安装入口要求由本版启动 EXE 运行，以便正常退出托盘守护；普通网页入口仍可下载对应 ZIP。新源码须在后续用户要求构建时进入新的启动器、网页和 APK，本轮没有把功能写入已发布的 7.1.08 成品。

## 五项针对性验证

1. 版本及资产：合成直连失败、第三方元数据成功，版本比较和 EXE／ZIP／APK 选择通过。
2. 实际本机 HTTP 与文件写入：完整 65536 字节回读相同；10／65536 字节下载判为不完整；取消后清理部分文件；下载完成但界面未刷新时的取消也会清除包并阻止安装。截断及取消均未启动安装。模拟安装进程先启动，HTTP 回复完成后才发送托盘退出通知，端口参数正确。
3. 便携更新：实际压缩／解压合成 ZIP，覆盖四个程序目录并生成新启动器文件；合成数据目录、用户文件和旧启动器保持原值。发现并修复 Windows PowerShell 5.1 中文脚本读取问题：安装脚本保存为 UTF-8 BOM，单项复验通过。
4. 真实更新组件：Vue SFC 编译及实际 script setup 隔离运行通过，最快有效线路被选中；操作顺序为后台下载→进度→安装，没有转到外部下载页。补入每小时检查后仅重跑本项，通过；补充取消时序后复验本机接口及本项，已确认延迟返回的 ready 不会在用户取消后触发安装。
5. 公开线路：仅读取正式 7.1.08 APK 的 256 KiB 片段及公开元数据，未保存或安装该 APK。结果如下。

| 线路 | APK 响应／读取量 | 片段耗时 | 公开最新版本元数据 |
| --- | --- | --- | --- |
| GitHub | 206／262144 字节 | 2720 ms | v7.1.08 |
| ghfast.top | 206／262144 字节 | 2130 ms | HTTP 403 |
| ghproxy.net | 206／262144 字节 | 3083 ms | HTTP 403 |
| gh-proxy.com | 206／262144 字节 | 1883 ms | v7.1.08 |

上述下载响应均为 APK 类型。两个节点当时不支持所测试的 API URL，不影响其下载线路；元数据由已成功的来源提供。数据仅描述本轮网络快照，运行时重新检测与选择。

复现合成检查：node --test tests/auto-update-7109.test.mjs。失败后只重跑相应编号；没有重复 Astra 已通过的历史验证或全量测试。

## 验证边界

- 没有构建 EXE／ZIP／APK，没有真实 Inno 覆盖安装。
- 前端为真实组件的隔离执行，未进行成品浏览器点击。
- Android 核对了本地 Capacitor 签名与官方 API，包括最小 API 24 可用的异步方法；未执行真实设备后台下载、授权或覆盖安装。不能将这些写成 Android 实机通过。
- 未修改 README、存档、UID 数据、签名或应用 ID。

## 来源

- [FufuLauncher 线路检测与更新流程](https://github.com/FufuLauncher/FufuLauncher/blob/cb3fe65fc217a8db8ea199efa47ddae5b398f9dd/UpdateFufuLauncher/MainWindow.xaml.cs)
- [公开 7.1.08 发布资产](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.08)
- [Android DownloadManager](https://developer.android.com/reference/android/app/DownloadManager)
- [Android 安装授权](https://developer.android.com/reference/android/provider/Settings#ACTION_MANAGE_UNKNOWN_APP_SOURCES)
- [Android CompletableFuture 异步接口](https://developer.android.com/reference/java/util/concurrent/CompletableFuture#runAsync(java.lang.Runnable))

## Astra 审查后的定向修复（2026-10-06）

两项本轮新增 P1 已修复：

- Android 的 PluginCall.getLong 不会将 Integer 转成 Long，导致正常 APK 的 size 被读成 0。downloadUpdate 改为 call.getData().getLong("size")，读取一次后共用于持久化和初始进度；保留下载结束时的完整字节比较。已核对当前 Capacitor 实际依赖、Android JSONObject／JSON 的数值转换和 JS→持久化→状态消费者，未执行 Android 实机下载或安装。
- Windows 默认 LocalUpdater.root 带末尾反斜杠；比较前缀再次追加分隔符会拒绝自身 dist。Install-PortablePackage 现在将边界前缀统一为一个末尾分隔符，保留原边界检查。既有第 3 项已补入真实默认路径及相似名称兄弟目录检查，随后使用带末尾分隔符的临时目标实际覆盖合成 ZIP；程序文件更新，合成数据、用户文件与旧启动器保持原值。

本轮仅执行 node --test --test-name-pattern '^3\.' tests/auto-update-7109.test.mjs，1 项通过；其余首次验证沿用历史证据。此前 ZIP 样例没有尾分隔符，不能作为默认生产路径的通过证据。完整改动、来源和边界见 [Astra 审查修复记录](astra-review-fixes-7109.md)。未构建、发布或操作真实安装目录。
