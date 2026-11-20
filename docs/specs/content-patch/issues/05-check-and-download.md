# 05: 补丁检查与下载

**What to build:** 客户端启动时查补丁清单，之后定时再查。有更新就下载、校验、放进覆盖层，下次启动生效。

**Blocked by:** 01, 04

**Status:** done

清单地址已定（2026-11-20）：写成一个常量，开发和测试用本地假服务，在线服务部署后只换这个常量；真实地址由开发者部署后提供。校验直接用 `server/patch-package.mjs` 的 `verifyPatchPackage`，公钥来自构建配置。

规格见 `docs/specs/content-patch/spec.md`。

- [x] 启动时查一次清单，之后每隔几小时查一次，或玩家打开计算页时查一次。用 `ETag` 或 `If-Modified-Since`，没变化时只取回 304
- [x] 清单里的补丁号不高于本机、或基础版本不适用时什么都不下载
- [x] 下载线路：没有复用 `update-sources.mjs` 的 GitHub、CNB、镜像线路（见评论），补丁地址由构建配置给出
- [x] 下载完成后用任务 01 的模块校验，通过后交给任务 04 的存储，当前这次运行不换数据，下次启动生效
- [x] 查不到、下载失败、校验失败都不打扰玩家，保持现有补丁继续用，原因和阶段记进 Debug，下次再试
- [x] 玩家可以在设置里关闭自动补丁，关闭后不再查清单（沿用 `release-update.mjs` 里自动检查开关的做法）
- [x] 测试：用本地假的清单服务覆盖无更新、有更新、下载中断、签名错误、哈希错误、基础版本不适用、离线
- [x] 验证：跑新增测试；报告里说明没有连真实服务

## Comments

- 2026-11-20：已实现。
  - **服务端**：`server/patch-updater.mjs` 的 `PatchUpdater`，页面通过 `POST /api/patch/check`（带 `version`、`baseUrl`、`publicKey`）触发，`GET /api/patch/status` 返回最近一次结果，供任务 06 的 Debug 使用。流程：取 `manifest.json`（带 `If-None-Match`，304 就停）→ 取 `manifest.sig` 并先验签 → 版本范围 → 与已安装的补丁号比较（`PatchStore.latestPatch()`，待生效的优先）→ 下载 `files/<键>.json` → 整包再用 `verifyPatchPackage` 验一遍 → `PatchStore.install` 装进待生效。当前这次运行的数据不变，下次启动生效。
  - **结果**：`installed`、`unchanged`（304）、`up-to-date`、`not-applicable`、`none`（服务器上还没有补丁，404）、`disabled`、`failed`（带 `stage` 和 `reason`）。所有失败都不抛错、不弹窗，下次再试；失败的检查不会记 ETag，下次会重新下载。同一时刻只做一次检查。
  - **下载安全**：文件最多读到清单声明的大小，超出就停并报哈希阶段；清单上限 1 MB，签名上限 1 KB；清单和签名 15 秒、文件 60 秒超时。补丁地址必须是 https，或本机回环地址的 http（开发测试），不带账号密码、查询和锚点。
  - **下载线路**：任务文件写「复用 `update-sources.mjs`」，我没有复用。那几条线路（GitHub、CNB、镜像）只转发本项目 Release 的附件，而内容补丁通道刻意不放在 Release 上，所以补丁地址由构建配置 `MONA_PATCH_BASE_URL` 给出，目前只支持一个地址。真要多线路，等在线服务和线路定了再加。
  - **页面端**：`src/platform/patch-update.mjs`。`App.vue` 启动时查一次，之后每 4 小时查一次，进入计算页时也查（两次之间不短于 10 分钟，间隔内直接返回上次结果）。玩家开关 `isAutomaticPatchEnabled`/`setAutomaticPatchEnabled`（localStorage，默认开）已就绪，界面入口等任务 06 的文案确认。Android 返回 `disabled`，不检查。
  - **构建配置**：`.env.development.yaml` 新增 `MONA_PATCH_BASE_URL` 和 `MONA_PATCH_PUBLIC_KEY`，都是空字符串，任一为空就不检查，和 `MONA_USAGE_STATS_URL` 一样。公钥是 `patch-tool.mjs keygen` 打印的 Base64。真实地址和公钥等部署后由开发者填，我没有填。
  - **顺带的修改**：`checkManifest` 新增补丁号必须能识别；`tests/auto-update-7109.test.mjs` 里手工编译 `App.vue` 的测试补了 `watch`、`useRoute`、`createPatchChecker`、`startPatchChecks` 这几个桩，否则会因新增的导入失败。
- 验证：`tests/patch-updater.test.mjs` 13 项（假清单服务用真实 HTTP：没有补丁、安装且本次不生效、304、补丁号相同或更旧不下载、版本不适用、别的密钥签名、文件被改、超大、缺失、下载中断、服务挂起超时、服务不可达、配置错误、并发共享、本机服务路由、页面端开关、节流和定时），连同其他补丁测试和 `release-update`、`auto-update-7109`、`cloud-gateway`，共 69 项通过。
- **浏览器实测**：用 `.env` 文件指向本机假补丁服务，把完整页面构建到测试目录。用 `patch-tool.mjs` 打了一个补丁（适用 7.2.04），在内置浏览器里打开：第一次服务器还没有文件时返回 `none`；补丁服务补好后重新载入页面，页面触发检查，状态变为 `installed`（7.2.04.01），此时覆盖接口仍是 `none`；重启本机服务（相当于下次启动）并重新载入后，覆盖接口返回 `applied`，检查结果变为 `up-to-date`，计算器正常显示伤害，控制台没有补丁相关输出。服务和测试目录已清理。没有用真实发布密钥和真实服务，没有核对补丁让页面上哪个数字变了，没有跑安装包，没有测手机宽度。
