# 7.1.11 自动更新修复

日期：2026-10-20。按用户“修”的授权，在当前 7.1.11 源码实施。只处理已确认的 Windows 安装进程未接管、Android 等待／暂停状态丢失及取消回读时序；哥伦比娅继续暂缓。

## 实现与边界

### Windows

- LocalUpdater 不再直接 detached 启动 PowerShell。将当前 Node 运行文件、独立承载模块 server/install-update.mjs 和安装脚本复制到本次下载临时目录，再启动临时 Node 承载进程。这样独立更新进程不会继续锁住原 runtime/node.exe。
- PowerShell 真正开始执行时输出 MONA_UPDATE_READY；承载进程通过 IPC 转交确认，之后断开 IPC 并继续等待 PowerShell 完成。主程序收到该确认后才进入 installing，由既有 HTTP 回复完成通知关闭托盘及服务。
- 承载进程退出、PowerShell 启动／解析失败均会将具体错误传回，下载状态保持 ready，旧程序不因 spawn 事件提前退出。新日志为更新包旁的 .update.log；安装脚本原有 .error.log 和错误提示保留。
- 既有 EXE 安装、ZIP 覆盖、新启动器重启、原目录和端口传递逻辑保持；托盘正常退出不会结束独立临时承载进程。现有打包过程递归收集 server，新增模块会随该目录收集；本轮没有运行正式打包。

### Android 与界面

- 保留 DownloadManager 实际后台下载。downloadUpdate 入队后回读真实状态，不预先把所有任务写成 downloading。
- STATUS_PENDING 映射 pending；STATUS_PAUSED 映射 paused，并提供等待重试、等待网络连接、等待 Wi-Fi 或实际未知暂停代码；running／successful／failed 分别保持 downloading／ready／error。状态同时返回 nativeStatus、reason、message，保留失败原因及完整字节检查。
- 更新弹窗显示真实等待／暂停消息，pending／downloading／paused 都继续轮询并允许取消，不重复创建系统任务。取消后才返回的旧状态被忽略，不覆盖 cancelled 或触发安装。
- 这修复了“等待／暂停却只显示下载中0%、空错误”的已知信息丢失；**用户手机最初不启动系统下载的具体原因仍未确认**。没有替换下载器、设置任意下载超时、删除完整性检查，或把网络暂停写成下载成功。

## 五项定向验证

| 目的 | 结果与实际范围 |
| --- | --- |
| 1. 更新 API 的交接时序 | 既有 auto-update-7109.test.mjs 第2项通过：合成完整／截断／取消下载、下载完成后取消、未接管失败保留 ready，spawn 不触发退出，收到接管确认后才发送一次托盘退出通知 |
| 2. 实际 ZIP 接管与重启 | auto-update-handoff-7111.test.mjs 第1项通过：真实 Node→独立临时 Node→PowerShell；解析失败保留 ready；正常父进程自然退出后完整覆盖合成 ZIP 并运行合成新 EXE，原 runtime/node.exe 可被替换，尾分隔符／带空格目录、端口透传和合成数据保留均通过 |
| 3. 实际 EXE 安装分支 | 同文件第2项通过：用本机 Inno 编译仅写临时目录、不注册卸载项的合成安装器；真实父进程退出后静默安装至原合成目录并重启合成 EXE，程序文件更新，合成数据、用户文件和旧启动器保持原值 |
| 4. 前端等待／暂停与取消 | 既有测试第4项通过，实际 App.vue 脚本／模板编译及组件隔离执行：pending→paused→downloading→ready 后安装，不重复下载；取消后迟到 paused 状态不能覆盖 cancelled，也不能安装 |
| 5. Android 实际原生桥 | JDK21、SDK36、Gradle8.14.3 离线缓存编译当前原生源码及专用调试测试 APK。在独立只读 emulator-5582 运行 UpdateRegressionTest：断网真实系统任务的 phase／nativeStatus／reason／message 与 DownloadManager 查询一致，取消后记录消失；真实 HTTPS 下载固定公开 Node v22.23.2 SECURITY.md 共23067字节，进入 ready、完整文件回读一致，预期字节改为23068时返回具体不完整错误 |

只复验失败的对应场景，没有重跑历史全量验证。Android 初始合成完成记录不等同于真实下载，最终改用真实 HTTPS 传输。145485字节公开 LICENSE 的网络对照曾在131072字节进入 paused，真实状态为 nativeStatus=4、reason=1、“等待重试（代码 1）”；这也确认暂停原因实际返回，但该网络样本没有下载完成，不把它记为整包下载通过。最终完整文件验证使用上述23067字节固定样本。

Windows 用例的临时目录和合成安装器已清理。模拟器只读且不保存快照，结束后已关闭；未连接真实手机。原生调试 APK、构建缓存、初始失败和最终通过日志位于 .build-target/auto-update-7111，不是发布成品。此处调试 APK 使用最小测试网页，不能作为完整7.1.11应用交付。

## 仍保留的交付边界

- 已安装的旧版运行自己的旧更新器，新源码不能自动改变旧客户端的接管步骤。旧 Windows 客户端需要先手动覆盖升级一次，或另行明确交付旧客户端修复；本轮没有改旧源码、旧成品或实际安装目录。
- Windows 已验证真实合成 EXE／ZIP 全链路，未操作正式已安装应用。Android 验证了原生状态、真实文本下载和文件检查，没有执行 APK 系统授权／覆盖安装，用户手机0%的根因仍需新版真实状态确认。
- 软件版本仍为7.1.11；没有修改版本、README、签名、应用ID、既有端口、账号、UID、仓库或预设。没有生成完整网页、Windows 正式安装包／ZIP、Android 正式 APK 或发布。仅测试所需原生调试编译完成。

## 修改入口与复验命令

- server/updates.mjs、server/install-update.mjs、script/install-update.ps1。
- android/app/src/main/java/com/mona/artifact/local/MonaLocalPlugin.java、src/App.vue。
- tests/auto-update-7109.test.mjs 第2／4项、tests/auto-update-handoff-7111.test.mjs、android/app/src/androidTest/java/com/mona/artifact/local/UpdateRegressionTest.java。

Node 定向复验：node --test --test-name-pattern '^[24]\.' tests/auto-update-7109.test.mjs；真实进程复验：node --test tests/auto-update-handoff-7111.test.mjs。Android 验证专用 init 脚本重定向构建输出和依赖路径，位于 .build-target/auto-update-7111/android-validation.gradle；仅运行 UpdateRegressionTest 或失败的具体方法，不默认重跑其他设备用例。

来源：[历史故障证据](update-diagnostic-7109-to-7110.md)、[Node detached与IPC文档](https://nodejs.org/download/release/v22.23.3/docs/api/child_process.html)、[Android DownloadManager状态与原因](https://developer.android.com/reference/android/app/DownloadManager)。
