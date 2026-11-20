# 08: Android 支持内容补丁

**What to build:** 让 Android 版也能检查、下载和使用内容补丁。

**Blocked by:** 04, 05

**Status:** ready-for-human

已定（2026-11-20）：第一版只做 Windows，本任务暂缓，Windows 验证稳定后再做。Android 的 WebView 里 ECDSA P-256 的可用性做这个任务时要先验证。

Android 没有本机服务，打包的是同一套 `src/` 界面（Capacitor）。覆盖层的存放和读取要走 Capacitor 的文件或存储接口，下载走和 `src/platform/release-update.mjs` 一致的原生网络调用。

- [ ] 覆盖层的存放位置和读取方式，保证补丁在应用覆盖升级后仍按基础版本规则判断
- [ ] 下载、校验和落盘沿用任务 01、04、05 的模块，只替换平台相关的存取层
- [ ] 应用 ID、端口、主机名和签名保持不变，不影响覆盖升级和用户存档
- [ ] 验证：真机上走一遍；没有真机时只能说明做了哪些代码检查，不说实测通过

## Comments
