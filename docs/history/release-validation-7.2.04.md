# 7.2.04 发布核对

2026-11-12，开发者授权构建并在 CNB、GitHub 同步发布，同时更新 README；明确不构建 Tauri。

## 范围

- 正式版本 `7.2.4`／`7.2.04`，Android `70204`／`7.2.04`。
- 发布目标：两端 `main`、`v7.2.04` 标签、Windows EXE／ZIP、Element Plus 与新 UI 测试版 APK。
- 本地成品目录：`D:/Documents/ChatGPT/v7.2.04/release-20261112/`。旧版成品保留。
- 公开源码中的使用统计地址保持为空；成品使用本机已配置地址构建。本地地址配置不提交；SecretKey 和原始环境文件不打包。

## 实际核对

1. 针对性 Node 测试 54/54 通过：动态评分与独立档位预期、来源角色组过滤、清空已选、茜特菈莉二命、公共内核包装链、统计队列与 Android 发送通道、CNB 更新与版本选择。
2. 已配置统计服务的健康检查返回 200；非法功能 ID 请求返回 400，拒绝整批请求，未向生产统计写入测试记录。未执行真实玩家数据上报。
3. 桌面／新移动 UI 构建与 EXE／ZIP／两 APK 打包成功。ZIP 644 个文件与打包目录逐文件一致；两 APK 分别含 609／606 个网页构建文件，逐文件匹配。包内路径未发现私密目录、签名文件或 Debug 导出。
4. 使用全新隔离浏览器上下文核对两种 UI：首次统计提示可关闭；空装备时“清空已选”不可用；可切换新评分并打开两种基准设置；深色外观刷新后保留；统计保持关闭；页面异常均为 0。检查的是打包后的网页，不能代替 Android 真机验收。
5. EXE 与托盘启动器文件版本 `7.2.4.0`、产品版本 `7.2.04`。两 APK 的版本、原包名、localhost／https 存储来源保持；apksigner 验证成功，证书 SHA-256 与各自 7.2.03 成品一致：`ba0891657ae61081fc2061aa5c66ada867caf7a0f81b7ff2339174751b9e4834`。

原始发布 WASM 和角色数据未重新生成。未跑全量测试；本工作区没有私有账号夹具，因此未跑依赖这些夹具的 `test:evidence` 和 `smoke:fixtures`，也未复制真实数据。未执行 Windows 正式安装覆盖、Android 真机安装／升级或 Tauri 构建。

## 成品摘要

| 文件 | 字节数 | SHA-256 |
| --- | ---: | --- |
| `genshin_artifact_V7.2.04_windows_x64_setup.exe` | 51332202 | `9e8a30f4ad3016b5c4bdc5fe45826531cb96790f935d19b8b17efa6a1e6226e9` |
| `genshin_artifact_V7.2.04_web.zip` | 70080933 | `7f6091c0bc4f89058d62384a991292e64ee8846eee95a1039464f6037f33ea24` |
| `genshin_artifact_V7.2.04_android.apk` | 38519655 | `a85fb6e60929c3a0e0f2f583e6d9bc3515154a136d8a78a122eaecf3e8a4e273` |
| `genshin_artifact_V7.2.04_mobiletest_android.apk` | 38334809 | `836b11f4dce4c42e12d70cba1a4376ee655daa436294a50fe9a0c1c0ee124798` |

发布页：[CNB](https://cnb.cool/twicedrop/genshin_artifact/-/releases/tag/v7.2.04) · [GitHub](https://github.com/TwiceDrop/genshin_artifact/releases/tag/v7.2.04)。
