# CNB 多源更新接入与验证（2026-10-24）

## 当前结论

**后续更新（覆盖下方历史阻塞）**：已创建 CNB `v7.1.12` 测试 Release 并上传四个 R2 成品，真实远程下载及独立覆盖验证、两 UI Android 存储检查通过，用户另反馈APK／EXE实机安装成功。Android 原失败发现旧模拟器 WebView LevelDB 日志损坏；签名验证包本轮构建成功。两版默认 CNB、其他源延后测速的 R4 源码及定向检查完成；用户最新要求只改源码、不构建，已停止在途构建，未生成或上传 R4 安装包。完整结果、失败证据及源码未上传的边界见[续记](cnb-default-20261024-r4.md)。以下为R2首轮历史过程。

7.1.11、7.1.12 均已实现 CNB 独立版本查询和附件下载源，已生成 Windows 安装器／ZIP、旧 Element Plus／新 UI 测试两种 APK。**尚未创建 CNB Release，尚未完成真实 CNB 7.1.11→7.1.12 全链路更新验收。** Android 网页存储保留检查未通过，同版本重启对照也复现，不能认定是升级导致或宣称数据保留已验证。

用户明确授权两版接入、Windows／Android 全面测试及通过 computer-use 创建 CNB Release，本次不受历史每轮最多五项验证限制。保留既有正式成品、原签名和两个 Android 包身份；不修改 README、不发布 GitHub、不处理其他历史待办。

## 调研与实现

- 仓库：`https://cnb.cool/twicedrop/genshin_artifact`。参考 [BetterGI 更新器配置](https://github.com/babalae/better-genshin-impact/blob/main/Build/kachina.config.json)，使用本项目自己的 Release 附件，不把 BetterGI 仓库当作本项目镜像。
- 拦截发生前的公开请求确认：CNB 公共网页的 Release 路径配合 `Accept: application/json` 可匿名返回数据；`api.cnb.cool` 对本次匿名请求返回 401，不能直接把它作为公共版本查询地址。本项目当时 Release 列表为空。
- 参考项目安装器首 1 MiB 范围请求：CNB 206／1,048,576 字节／1090ms，GitHub 206／相同字节数／2363ms，均为 MZ 文件头和正确 Content-Range。仅代表本机该次观察，不代表完整包或其他网络速度。未运行参考项目安装器。
- `server/update-sources.mjs` 统一 GitHub、CNB 与原有代理线路；加速开启时并行查询，CNB 独立查询 `/-/releases/latest` 并构造本项目相同标签／附件名的稳定下载地址。GitHub 不可用时仍可从 CNB 发现更新。
- 快速旧版本响应不会立即压住慢速新版本：高于当前版本的有效响应可立即返回；否则等待请求结束并选择已完成响应中最高版本。多个均高于当前版本的源仍以先返回者为准，不宣称始终选择全球最高版本。关闭加速时继续仅查询 GitHub。
- 共享原有版本比较逻辑；Windows API 传递当前版本，Android 原生 HTTP 保留对应 Accept 头。新旧 UI 分别选择自己的 APK，不依赖附件列表顺序。
- `MonaLocalPlugin.java` 的外部发布页允许范围加入本项目 CNB HTTPS Release 路径；未放开任意站点，原有下载、大小检查、取消和安装接管流程保持。
- Android Gradle 的 `monaTestBuildType` 仅用于本次 release instrumentation；默认仍为 debug。测试代码不会进入正式 release APK。

## 已完成的验证

| 验证 | 结果与证据边界 |
| --- | --- |
| 两版更新专项 Node 回归 | 每版 19/19 通过。覆盖四种包与两版本 URL、元数据独立性、旧／新响应竞争、错误保留、实际本地 HTTP 完整／截断／取消下载，以及实际合成 ZIP／Inno 在父进程退出后覆盖与重启。不是所有游戏功能全量回归 |
| 两版桌面／手机实际 Chrome | 四个生产构建检查均通过，页面错误 0。GitHub 全失败而合成 CNB 元数据可用，显示并选择 CNB、取消后不安装、重新下载精确字节后到达接管入口。网络使用本地合成服务，安装器使用桩；不是远程 CNB 实际下载／安装 |
| 四个 release APK | 均构建成功；7111 旧／新 UI 为 70111／7.1.11，7112 为 70112／7.1.12。分别为 `com.mona.artifact.local`、`com.mona.artifact.local.mobiletest`；直接比较原公开证书 DER，四包与原正式签名相同。对应网页 415／409／416／410 文件逐字节一致，许可证保留 |
| Windows 成品与真实 ZIP 覆盖 | 两版安装器和完整 ZIP 已生成，启动器分别为 7.1.11／7.1.11.0、7.1.12／7.1.12.0。原生产 `Install-PortablePackage` 函数应用实际 7112 ZIP 到隔离的 7111 运行目录，保留合成 `.local-data` 与用户文件，得到 7112 启动器 |
| Windows 实际完整安装内容覆盖 | 用生产 ISS 派生仅供测试的独立 AppId，禁用卸载注册、快捷方式、卸载器和自动启动；依次安装实际 7111、7112 全部运行文件。最终 436 文件与 7112 stage 直接字节一致，合成存档和用户文件保留。正常生产安装器也已编译，但本项不证明生产 AppId 的注册／快捷方式集成或真实 CNB 自动更新链路 |
| Android 原生下载等待／取消 | 只读隔离 Android 35 模拟器，最终两 UI 712 包实际安装成功；两 UI 各一项真实 DownloadManager 离线 pending／paused 状态、字节、原因及取消清理测试通过。网络保持关闭，不访问被拦截的 CNB。测试结束关闭本轮模拟器 |

构建期间两版共用依赖的 Gradle 构建目录曾因并发写入发生资源竞争；改为串行后四个 release APK 均成功。没有为该构建问题修改产品代码。

## 未完成与阻塞

1. **浏览器发布被工具安全策略拦截。** 原生 Chrome 工具返回无法可靠判断浏览器 URL 并要求停止；按用户后来明确指定改用已登录的内置浏览器后，`cua.getTab` 仍返回已保存权限／管理策略拒绝 `https://cnb.cool`。用户已明确允许访问，并提供“浏览始终允许”的截图，随后默认也改为始终允许；各次重试仍得到相同拒绝。不能将其归咎于未登录或用户未设置权限；没有通过其他浏览器、原始 CDP、API 或 CLI 绕过发布。
2. **实际 CNB 更新未验收。** 本项目 Release 和四个附件尚未上传；尚不能验证本项目 latest 返回值、实际全包速度、真实源选择／下载／安装／重启的连续链路。7111 必须用下面 R2 修改版作为测试起点；已发布旧包不会凭空获得新 CNB 逻辑。
3. **Android 存储检查未通过。** 7111 旧 UI 播种后，实际 `adb install -r` 覆盖为 7112 成功，原生 SharedPreferences 校验通过，但 localStorage 合成标记返回 null，后续 IndexedDB 断言未执行。同一 7112 版本播种后直接重新启动 instrumentation 也得到相同结果，因此尚不能定位为版本升级问题。需先确认测试夹具跨进程写入持久化，再验证实际应用保存入口和两个 UI；不得写成升级存档保持已通过。
4. 为检查上述夹具曾拟延长播种后的驻留时间；重新构建 instrumentation 的签名构建命令被自动审批拒绝，工具未返回具体原因。该临时改动已撤回，未声称修复或构建成功。原已签名验证 APK 与 release 成品保留。没有输出签名密码或复制密钥。
5. Android 系统未知来源授权／PackageInstaller 交互尚未验证；`adb install -r` 成功只证明系统接受同身份覆盖，不等于软件内下载后系统安装界面已完成。

## 成品与证据

每版最新测试输出均位于版本根目录 `cnb-test-20261024-r2/`；旧 `cnb-test-20261024/` 是前一轮输出，保留但不作为本轮起点。`r2/web/` 是完整 Windows 测试运行目录，含匹配版本启动器、runtime、server、script、dist 和许可证，不是仅有 EXE 的核对目录。

每版四个文件：

- `genshin_artifact_V<版本>_windows_x64_setup.exe`
- `genshin_artifact_V<版本>-cnb-test_web.zip`
- `genshin_artifact_V<版本>-cnb-test_android.apk`
- `genshin_artifact_V<版本>-cnb-test_mobiletest_android.apk`

保留原已发布的 7111 正式四包，不用修改版悄悄覆盖原正式附件。712 为待验收测试包，未正式发布；如公开 CNB 测试 Release，需明确测试状态并核对标签对应源码，不能把 7111 main 冒充 712 源码。

两源码目录各自的 `.build-target/cnb-update-20261024/` 保存 `updater-suite.log`、两份 browser JSON／截图、桌面／手机／Android／Inno 构建日志、公开证书对照与包内容记录。7112 同目录另外有 `real-portable-upgrade.json`、`real-installer-upgrade.json`、`native-tests/storage-*`、`control-same-version-*`、`native-offline-*` 和包身份记录。

原 `v7.1.12/launcher/` 仍是此前取消／ETA 功能交付目录，本轮 CNB R2 不声称已同步该目录。请按本轮 R2 输出审查；README、版本号、存档路径、原五个 WASM、计算公式和搜索算法未因 CNB 任务修改。测试只使用合成数据，未将用户 UID／仓库／预设／Debug、浏览器账户或签名资料加入成品。

## 继续工作

权限执行状态恢复后，从既有已登录 CNB 标签页继续；不重复索取已授权的发布许可。先核对目标标签与源码对应关系并创建测试 Release，上传审核后的四种目标附件；回读 latest／附件大小和稳定 URL，再用 7111 R2 分别完成 Windows 安装版／便携版及两种 Android UI 的真实更新。Android 存储夹具与真实保存入口验证也必须完成，才能报告“全面测试通过”。
