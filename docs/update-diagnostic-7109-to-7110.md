# 7.1.09 升级至 7.1.10 软件内更新故障排查

日期：2026-10-11。用户要求检测现有 7.1.09 升级至已发布 7.1.10 的流程。

> 2026-10-20 后续：7.1.11 已实施 Windows 接管与 Android 状态／取消修复，见[修复及本轮验证](auto-update-fix-7111.md)。下文保留2026-10-11旧版故障证据和当时尚未修复的状态；不能当作当前7.1.11未修改的结论。

## 当前结论和完成状态

| 问题 | 排查状态 | 修复状态 |
| --- | --- | --- |
| Windows 下载完成，点击安装后主程序退出，无后续 | **已在本机隔离复现启动器失效** | **未修改业务代码、未重新发布**；可行启动方式的合成对照通过，完整覆盖安装仍待修后验证 |
| Android 测速正常，下载一直 0% 且无错误 | **等待／暂停状态丢失已复现；用户手机系统任务未启动的具体原因未确认** | **未修改业务代码**；原始 7.1.09 APK 的原生整包下载与文件回读通过，合成断网下任务保持 pending 而应用显示 downloading／空错误 |

检测使用 `D:/Documents/ChatGPT/v7.1.09/web` 随包更新器、原始 7.1.09 APK、原随包 `runtime/node.exe`，并以源码／编译输出交叉核对。文档仅写入当前常规版 7.1.10；没有改 7.1.09、Beta、README、GitHub 资产或实际安装程序。

## Windows：进程创建成功不表示 PowerShell 已执行

实际链路：

1. `web/server/updates.mjs:115` 的 `LocalUpdater.install()` 复制旧版 PowerShell 更新脚本到临时下载目录。
2. 第 121–126 行直接启动 `powershell.exe`，使用 `detached:true, stdio:'ignore', windowsHide:true`。
3. 仅等待 Node 的 `spawn` 事件；第 128 行立即把状态改成 `installing`。
4. `web/server/local.mjs:65–66` 在 HTTP 回复结束后发 `MONA_LAUNCHER_UPDATE`，托盘关闭本地服务并退出。
5. 只有 PowerShell 脚本实际执行后，才会等待旧进程退出、调用安装器／复制 ZIP、重启新启动器。

本机与本轮临时重放的证据：

- 两次本机实际下载目录中均存在完整的 45034044 字节 7.1.10 EXE 和旧更新脚本，没有安装日志或脚本错误日志；没有执行这些真实安装包。
- 原随包 Node + 原随包更新器 + 无安装行为的合成进程重放：Node 正常返回 `phase=installing`，未出现合成执行标记或脚本错误日志。此重放本身不能区分脚本哪一步，因此继续做同一启动问题的最小对照。
- 相同 PowerShell 文件仅写入执行标记；保持父测试进程运行并等待子进程退出，结果如下：

| 启动配置 | 子进程退出码 | PowerShell 执行标记 |
| --- | --- | --- |
| `detached:true, stdio:'ignore', windowsHide:true` | 0 | 无 |
| `detached:false, stdio:'ignore', windowsHide:true` | 0 | 有 |
| `detached:true, stdio:['ignore','pipe','pipe'], windowsHide:true` | 0 | 无，stdout／stderr 亦为空 |

因此当前客户端会在更新器未实际开始执行时退出，且 `stdio:'ignore'` 无法提供启动阶段信息。该本机现象与公开 Node／PowerShell 控制台问题相符，不归因于发布资产丢失或 PowerShell 中文脚本编码。

已核对原源码、随包文件及两版 ZIP：更新脚本均保留 UTF-8 BOM；ZIP 新启动器真实名称为 `启动7.1.10.exe`；既有末尾分隔符修复存在。

### 方案对照与尚待验证

- 单独去掉 detached 能使即时脚本执行，但以 `unref()` 让父 Node 退出后的延迟执行未通过，不能直接据此写修复完成。
- 给 PowerShell 补 `-NonInteractive` 或直接使用 headless conhost 的本机对照未产生执行标记，不作为已通过方案。
- 使用**独立 detached Node 进程承载不带 detached 的 PowerShell，并让承载进程等待脚本结束**：父 Node 已返回 0 并退出，PowerShell 起始与延迟完成标记均存在。承载不依赖旧程序继续存活。这是合成启动方式验证，没有改业务源码或执行实际覆盖安装。
- 实施时应让真实独立更新进程接管安装，再验证旧主程序结束后的安装／ZIP 覆盖与重启；不要把 `spawn` 事件当作执行成功。不是要求新增全套校验、哈希、升级框架或无依据回退。

既有 `tests/auto-update-7109.test.mjs` 第二项以 EventEmitter 模拟 `launch` 的 spawn 事件，第三项只抽取 ZIP 复制函数，没有经过实际 Windows 进程启动。因此旧测试通过不覆盖本次故障。

已经安装的 7.1.09 会执行自己的旧更新器；仅修改待下载新版的源码不会自动修复旧客户端的这一启动步骤。旧客户端修复／一次手动升级的交付方式需在实际修复任务中处理。

参考：[Node 官方 detached 文档](https://github.com/nodejs/node/blob/main/doc/api/child_process.md)、[Node 官方仓库 issue #51018](https://github.com/nodejs/node/issues/51018)。后者记录了 Windows DETACHED_PROCESS 与 PowerShell 控制台要求的同类现象；本轮结论以本机实际对照为依据，不把该讨论代替莫娜测试。

## Android：测速正常，系统下载任务一直 0%，等待原因未传回

当前 [7.1.10 正式 Release](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.1.10) 的资产与本地产物一致：

| 资产 | 字节数 | 上传状态 |
| --- | ---: | --- |
| `genshin_artifact_V7.1.10_android.apk` | 29220065 | uploaded |
| `genshin_artifact_V7.1.10_web.zip` | 60508193 | uploaded |
| `genshin_artifact_V7.1.10_windows_x64_setup.exe` | 45034044 | uploaded |

以 APK 的真实地址检查 GitHub、ghfast.top、ghproxy.net、gh-proxy.com：四条线路的 Range 请求均返回 HTTP 206、262144 字节和 `Content-Range: bytes 0-262143/29220065`，内容以 ZIP／APK 文件头开始；普通不带 Range 的 GET 均返回 HTTP 200、`Content-Length: 29220065`，没有残留 Content-Range。仅读取响应开头，没有将片段验证写成原生整包下载通过。

实际编译后的 7.1.09 `MonaLocalPlugin.downloadUpdate` 通过 `getData().getLong("size")` 读取并持久化大小，原先 Integer 被 PluginCall.getLong 读成 0 的问题已进入编译输出。manifest 有 INTERNET／REQUEST_INSTALL_PACKAGES，下载目标仍是应用 external files 下 `Downloads/mona-update.apk`。本轮没有证据认定大小、权限或目标文件为此次用户故障根因。

### 用户补充与原始 APK 实际下载（2026-10-11）

用户已确认电脑为 **EXE 安装版**。手机使用 Wi-Fi，开启／关闭代理均测试过 GitHub 与镜像线路：测速正常，点击下载后进度一直 0%，没有错误文字或失败代码。不要继续要求用户提供当前界面没有显示的失败代码，也不能把问题归因于单一下载线路。

原链路中，`MonaLocalPlugin.probeUpdate()` 使用应用内 `HttpURLConnection`，`downloadUpdate()` 改用系统 `DownloadManager.enqueue()`。测速通过只证明前者读到了片段，不证明系统任务已经执行。`updateStatus()` 仅将 successful／failed 映射为 ready／error，pending／running／paused 全部映射为 downloading；只有 failed 才读取 `COLUMN_REASON`。前端 `src/App.vue:121` 按这个 phase 持续轮询，没有得到系统实际等待状态和暂停原因。

在新的只读 AVD 会话 `emulator-5582` 中显式设置测试 DNS、启用 Wi-Fi 后，原始正式 7.1.09 APK 通过原 WebView 的真实 JS→MonaLocal 桥完成：

1. ghfast 线路测速返回 elapsed=2242 ms、speed=116924.174844 字节／秒。
2. 下载真实 7.1.10 APK，状态回读 downloaded=7085201 → 27614353 → **29220065**，最终 phase=**ready**、total=29220065、error 为空。
3. 从测试应用 external files 下的 `Download/mona-update.apk` 回读整包，文件 **29220065 字节**。ZIP 完整解压检查没有坏项，860 个条目包含 manifest、classes.dex 与网页入口；aapt 读取应用 ID `com.mona.artifact.local`、versionCode **70110**、versionName **7.1.10**。

下载文件的本机临时位置：`C:/Users/Admin/AppData/Local/Temp/mona-7109-downloaded-188e0c2b-b6c8-4e33-918f-ce606124a7c5.apk`。没有在用户手机安装，也没有执行更新安装授权／覆盖安装；本结果只确认完整下载和文件可读，不记为手机更新安装通过。

### 0%／无错误的最小复现与结论边界

同一只读测试会话中，正常测速／下载完成后，控制关闭测试 Wi-Fi 和移动数据，再经原始 APK 桥启动同一下载：

- 原生启动返回 `{phase:"downloading", downloaded:0, total:29220065}`。
- 真实系统下载记录 `_id=9` 长时间保持内部 `status=190`（pending）、`current_bytes=0`、`total_bytes=-1`，未实际开始下载。
- 应用回读仍为 `{phase:"downloading", downloaded:0, total:29220065, error:"", version:"v7.1.10"}`。

因此**任务等待被显示成下载中、缺少等待／暂停原因**是已证实问题，能复现“0%、无错误”的外观。合成断网是触发这一问题的测试条件，**不是用户 Wi-Fi 手机的已确认根因**。用户已测试多线路及代理开关；尚未取得其真实 DownloadManager status／reason、系统任务调度与网络日志，不能确定是系统任务排队、暂停重试还是其他限制。

后续修复应先让真实等待／暂停原因可见，再按实际状态处理下载阻塞。若调整下载实现，可评估复用已正常测速的应用内连接写入 APK；当前只是实施方向，尚未写入业务代码。不能以隐藏 0%、任意设置超时或删除文件完整性检查冒充修复。

早先只读测试 AVD 的默认 DNS 失败已作为测试环境问题排除；它不作为用户手机原因。临时调试副本仅用于诊断准备，本次通过的是原始正式 APK 的桥，不用调试包结果冒充正式包验证。新增测试会话和端口已关闭，未操作账号／UID／仓库／预设、未改应用 ID／升级签名或正式成品。

## 验证目的与授权范围

本轮有三个有明确目的的定向排查范围：发布资产及响应合同、Windows 真实进程启动／退出时序、Android 编译合同与隔离原生桥。对同一进程问题的几种必要启动方式做对照，没有重跑历史审查或全量测试。没有执行正式覆盖安装、发布或修改业务源码；本文件和 AGENTS.md 记录已确认及未确认状态。

本轮用户补充后，仅追加两项目的：原始 APK 完整下载及文件回读、受控等待状态的真实系统／应用对照。Windows EXE 分支沿用已取得的启动证据；没有重复跑资产线路扫描、历史全清单、构建或发布。
