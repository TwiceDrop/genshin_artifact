# 05: Android 发送通道

**What to build:** Android 客户端用原生请求把使用统计发到在线服务，行为和桌面端一致：入口访问自动记录、按天去重、离线补发、常量为空时不启用。

**Blocked by:** 04

**Status:** done

规格见 `docs/specs/usage-stats/spec.md` 的「发送通道」。

- [x] Android 的发送实现沿用现有在线账号的原生请求做法，作为使用统计模块的一个注入实现，模块本身不改
- [x] 不复用在线账号的会话或凭据
- [x] 平台字段上报为 Android
- [x] 补充发送实现的测试，覆盖成功、失败返回和网络异常三种情况
- [x] 验证：只跑相关测试；真机验收由开发者完成，汇报时写清没有在真机上跑过

## Comments

- 2026-11-12：`nativeUsageStatsSender` 和桌面发送放在同一个文件里，原生请求函数从外面传入（应用里传的是 `CapacitorHttp.request`），所以测试不依赖 Capacitor。地址校验复用本机转发用的 `usageStatsTarget`：只接受 https，不带在线账号的会话。
- Android 构建现在读同一个 `MONA_USAGE_STATS_URL`，平台上报为 `android`。
- 验证：`tests/usage-stats-transport.test.mjs` 4 项通过，覆盖成功、服务端拒绝（包括响应体是 JSON 文本和非 JSON 两种）、网络异常、非 https 地址被拒。**没有在 Android 真机或模拟器上跑过，真机验收需要开发者做。**
