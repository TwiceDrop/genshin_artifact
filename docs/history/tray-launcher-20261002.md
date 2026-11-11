# 7.1.08beta Windows 启动 EXE 与托盘守护

日期：2026-10-02。当前源码：`D:/Documents/ChatGPT/v7.1.08beta/source`。

本轮按用户要求将 beta 的 BAT 启动入口改为 Windows EXE。EXE 管理本地服务、日志窗口和托盘，业务界面仍在默认浏览器。当前网页源码已重新构建，包含此前尚未打包的导入、界面清理、图片、评分及星扩散倍率修改；未另改这些业务模块。本轮不制作 Android，不上传 GitHub。

## 实现

- `installer/TrayLauncher.cs`：独立 beta 启动器，未修改旧版 `installer/Launcher.cs` 和 7.1.07 安装配置。
- `script/build-tray-launcher.ps1`：使用 Windows 自带 .NET Framework C# 编译器，嵌入原有图标；显示版本和 EXE 产品版本读取 `package.json`。输出 `启动7.1.08beta.exe`，同时附带指定 Node 运行时及其 LICENSE。
- 启动时显示只读日志窗口，将本地服务 stdout/stderr 和守护的实际状态写入窗口；服务就绪后调用 Windows 默认浏览器打开 `http://127.0.0.1:4184/#/calculate`。
- 日志窗口的关闭按钮隐藏窗口。浏览器关闭不影响本地进程。托盘名为 `莫娜占卜铺 7.1.08beta`，菜单仅有 `打开界面`、`关闭莫娜占卜铺`；双击也打开界面。打开界面会恢复日志窗口并打开浏览器。
- 按 4184 端口使用命名 Mutex 保持一个启动器；再次启动 EXE 通过命名事件通知现有托盘打开界面。
- 启动器监视自身启动的 Node 子进程。已成功启动的服务意外退出后，间隔两秒重启；重启不会再次自动打开浏览器。启动失败的实际原因留在日志窗口。
- `script/start-local.mjs` 新增 `--tray` 控制协议。就绪信号不显示给用户；托盘退出通过 stdin 发出 `shutdown`，服务关闭连接并停止。启动器异常结束导致 stdin 关闭时，服务也执行关闭。
- 托盘退出停止守护计时器并等待自身服务正常关闭，最多五秒；未退出的自身进程随后结束。不会按进程名称批量终止其他 Node 服务。
- 地址、端口和现有 `.local-data/miyoushe.dpapi` 账号路径未更换；不设置旧安装器使用的 AppData 数据路径，不迁移、复制或删除账号、浏览器存储、库存和预设。
- 新交付包使用 EXE，源码内旧 beta BAT 仅转发到 EXE。旧网页包及其 BAT 保留原样。网页包附带 Node 22.23.2 x64，无需另装 Node；使用 Windows 的 .NET Framework 和默认浏览器。

## 本轮五项针对性验证

验证器为 `tests/tray-launcher-7108.cs` 与 `tests/tray-launcher-7108.ps1`，通过 Windows PowerShell 的 STA 环境运行测试库；不发布测试库。服务账号路径指向 `.build-target/tray-launcher/synthetic-data`，不读取用户账号或浏览器存档。浏览器调用以回调记录目标地址，未操作用户浏览器。

| 项目 | 实际检查及结果 |
| --- | --- |
| 1 启动与日志 | 实际 WinForms 日志窗与 NotifyIcon 可见，服务 stdout 出现在窗口，就绪控制信号没有显示；名称、两个菜单、EXE 产品版本及本次构建首页一致 |
| 2 关闭与恢复 | 调用日志窗关闭事件后隐藏而未销毁，Node PID 不变且首页仍可访问；实际打开菜单恢复窗口，并向浏览器调用传入原访问地址 |
| 3 重复启动 | 再执行真实产品 EXE，第二个进程正常退出，原托盘收到打开事件，原 Node PID 和服务不变 |
| 4 异常重启 | 仅结束测试自己创建的 Node；实际守护启动新 PID，首页恢复，托盘继续可见，没有重复打开浏览器，窗口包含重启日志 |
| 5 托盘退出 | 调用实际关闭菜单后 Node 结束、4184 释放、托盘隐藏、日志窗释放、守护停止 |

最终结果：5/5 通过。首轮验证器的网页解码导致内容比较失败，已改为明确按 UTF-8 解码响应字节后重跑同五项；未为此修改产品服务或放宽网页内容比较。

Windows 环境曾移除独立验证 EXE，验证改为测试 DLL 由 Windows PowerShell 执行；未更改安全软件设置，产品 EXE 的再次启动检查通过。未人工逐项操作 Windows 托盘，也未实际启动默认浏览器；测试覆盖真实窗口事件、菜单回调、真实产品单实例入口及实际本地服务生命周期。

日志窗口截图经本地查看，启动信息可读。证据：`.build-target/tray-launcher/verification.log`、`startup-log.png`、`startup-log.txt`。网页构建成功，证据 `web-build.log`，webpack Hash `53939f17185085f4`。原始发布 WASM、README 及旧 repair5 ZIP 的 SHA256 保持不变。

## 本地产物

- 源码目录启动入口：`启动7.1.08beta.exe`，同目录有 `runtime/node.exe` 和运行时 LICENSE。
- 新目录：`release/web-tray-repair1`。
- 完整 ZIP：`release/genshin_artifact_V7.1.08beta-tray-repair1_web.zip`，附带 `.sha256`。

完整包只包含构建的网页、服务器源码、启动脚本、EXE、Node 运行时、许可证及相关维护文档，不包含用户数据、测试证据或源码根目录。旧成品未覆盖。

后续打包继续使用未占用的新后缀：

```powershell
& ./script/build-web-beta-7108.ps1 -SkipWebBuild -OutputSuffix tray-repair2 -OutputDirectory ./release -NodeRuntime ./runtime
```

仅在 `dist` 对应本次源码构建后使用 `-SkipWebBuild`。五项验证可在源码根目录运行：

```powershell
& "$env:WINDIR/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -File ./tests/tray-launcher-7108.ps1
```
