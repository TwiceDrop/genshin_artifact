# ui-redesign 发版前审查记录

审查日期：2026-11-21。审查对象：`origin/ui-redesign` 在 `ddefe09` 的状态，也就是准备发 7.2.05EA 之前推上来的那一批提交（兹白月结晶四人轴、云档案同步与修订保留、7.2.05EA 版本号、界面改版，以及合并进来的内容补丁）。

审查方式：读代码加跑 5 组针对性测试。**没有构建，没有在浏览器里看，没有跑全量测试（200 多个文件）。** 兹白的倍率和时序没有独立来源，没有审数值。

## 结论

修掉第 1 条（红测试）后可以发。第 2 条看这次要不要出 Windows 安装器。第 3～8 条不拦发布，但建议在发版前后处理。

## 要处理的问题

| # | 级别 | 问题 | 怎么处理 |
| --- | --- | --- | --- |
| 1 | 发布前 | 两个测试在 `ui-redesign` 上是红的：`tests/team-dps-page.test.mjs` 的「repair 4…」和 `tests/team-dps-personal-task.test.mjs` 的「personal task survives remount…」，报 `ReferenceError: defaultTeamCharacter is not defined` | 兹白提交（`ddefe09`）让 `TeamDpsPage.vue` 用上了 `defaultTeamCharacter`，这两个测试手工编译页面时只给了 `changeTeamConstellation` 的桩。页面里的 import 是真的，是测试没跟上。**已在本地修好**（见下面「已做的」），等推送 |
| 2 | 看情况 | `script/build-windows.ps1` 第 10 行 `([version]$package.version).ToString(3)` 遇到 `7.2.5-EA` 会报错（PowerShell 里 `[version]'7.2.5-EA'` 抛「格式不正确」）。托盘启动器脚本 `build-tray-launcher.ps1` 已经用 `-split '-'` 处理了 | 改成和托盘脚本一样：`([version]($package.version -split '-')[0]).ToString(3) + '.0'`。只出 Tauri EXE 和 APK 的话碰不到，要出 Windows 安装器就会失败 |
| 3 | 建议 | `Update.Log` 顶部没有 7.2.05EA 条目，最上面还是 V7.2.04（发版清单第 2 项）。`docs/release-7.2.05EA.md` 有 | 在 `Update.Log` 顶部补一条 |
| 4 | 建议 | `online-service/compose.yaml` 的镜像标签 `mona-online-service:7.2.04` 和 `online-service/scripts/pack.py` 的 `root_name` 还是 7.2.04，而服务端这次有两条新迁移，部署包会和旧标签重名（发版清单第 1 项） | 部署在线服务前把这两处和版本对齐 |
| 5 | 建议 | 迁移编号撞号：`009_profile_revision_retention.sql`（修订保留）和 `009_usage_stats_patch.sql`（使用统计补丁号）。迁移按完整文件名排序和记录，两个都会各执行一次，功能上没问题，但编号重复容易以后搞混 | 把 `009_usage_stats_patch.sql` 改名 `010_usage_stats_patch.sql`。它没部署过，改名安全。引用它的文档（`docs/specs/content-patch/` 下的任务 06、交接文档）里的文件名也要跟着改 |
| 6 | 要确认 | 默认在线服务地址 `VUE_APP_MONA_CLOUD_URL`（`server/cloud-config.mjs`）：桌面的本机服务是单独的 Node 进程，读的是进程环境变量，启动器没有传这个变量；页面包里是构建时替换的。结果是桌面成品里默认地址大概率不生效，Android 和开发服务器能生效。测试自己设了环境变量，没覆盖桌面成品这条路径 | 确认桌面是否也要用默认地址。要的话需要让启动器把地址传给本机服务，或者把它写进服务读取的配置。发布说明写「线上开放时间待确认」，如果本版不开放就没影响 |
| 7 | 要确认 | 云同步（`src/cloud/profile-sync-core.mjs`）去掉了「改动后 2 秒防抖立即同步」，改成 60 秒定时，也去掉了联网和页面重新可见时的触发 | 这样修订涨得慢，和服务端只保留 5 份配合。代价是玩家改完数据最多要等一分钟才同步，换设备前要注意。确认是有意的；如果是，发布说明里可以带一句 |
| 8 | 知道即可 | 修订保留 5 份（`online-service/src/profiles.mjs` 的 `RETAINED_REVISIONS`）：我读了 SQL，逻辑通顺（当前下载的那份永远保留；旧的清掉快照只留哈希，重试同一个操作仍能识别；列表和读取只看有快照的）。冲突副本和普通修订共用这 5 个位置，连续产生冲突会把更早的修订挤掉 | 可以接受，不用改 |
| 9 | 要确认 | `AGENTS.md` 的发布规则：未公开的游戏版本内容，要等官方授权的体验服视频解禁并公开后才能发布，也不能夹带其他未解禁内容 | 请自己对一下兹白、新武器等这批内容是否都已解禁，我没有这个信息 |

## 已做的

- 第 1 条已在本地 `ui-redesign` 修好：两个测试改成导入真实的 `defaultTeamCharacter`（和它们原来对 `changeTeamConstellation` 的做法一致），提交 `8317410`。两个文件和四人轴相关共 31 项通过。**还没有推送。**

## 确认没问题的

- 内容补丁代码合并后完整：三个计算入口（`mona_wasm/pkg/index.js`、`src/wasm/team-dps-native-api.mjs`、`beta-tools/runtime.mjs`）都还走 `composeKernelApi`，两个浏览器入口带 `overlay`。补丁、版本比较、更新相关 74 项通过。
- 云同步、登录、UID 相关 23 项通过；界面、使用统计、首次使用 47 项通过；在线服务 40 项通过。
- 版本号核对：`package.json` 7.2.5-EA／`displayVersion` 7.2.05EA，Android 70205／7.2.05EA，Cargo 和 lock 7.2.5-EA，Tauri 资源修订 `20261119-7205ea`，同步里的 `appVersion` 也已更新。版本比较函数能正确处理 EA（EA 早于同号正式版）。
- 新提交里没有密钥、构建产物、`.env`、`.dpapi` 等不该提交的文件；README 没动；补丁地址、补丁公钥、使用统计地址的构建配置仍是空的。

## 没有审的

- 兹白月结晶的倍率和时序是否与游戏一致：看了结构（`moon-crystallize.mjs`、公用的排名算法、125 行的轮转测试、样例轴），测试通过，但没有独立来源核对数值。
- 界面改版（`1c6b894`，68 个文件，主要是样式）：只跑了相关测试，没有在浏览器里看桌面和手机宽度。
- 构建和成品：没有构建，没有核对安装包、APK 的内容和签名。

## 测试范围

| 组 | 内容 | 结果 |
| --- | --- | --- |
| A | 内容补丁、数据覆盖、入口一致性、版本比较、更新检查 | 74 通过 |
| B | 云同步、登录路由、同步类别、UID Cookie | 23 通过 |
| C | 四人轴时序、GPU 任务、并行、兹白轮转、缺圣遗物、页面、个人任务 | 31 项，修复前 2 项失败，修复后全部通过 |
| D | 角色属性、旅行者共鸣、圣遗物对比、动态评分手动导航、使用统计、首次使用 | 47 通过 |
| E | `online-service` 全部测试 | 40 通过 |
