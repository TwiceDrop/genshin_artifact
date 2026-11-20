# 内容补丁交接说明

写于 2026-11-20，给接手的人：现在做到哪、怎么验收、接下来做什么。规格在 [spec.md](spec.md)，任务在 `issues/`，每个任务文件底部的 Comments 记着当时的细节和没验证的地方。代码在 `content-patch` 分支（从 `ui-redesign` 切出，还没合进 `main`）。

## 一句话

在 Release 之外加了一个「内容补丁」通道：一个带签名的小数据包，只替换已登记的数据文件（武器数值、角色数据等），不含任何代码。客户端启动时查一次，之后每 4 小时查一次，下载校验后放进本机，**下次启动**生效。不需要发新版本，也不碰 GitHub Release。

## 状态

| 任务 | 内容 | 状态 |
| --- | --- | --- |
| 01 | 补丁包格式和签名校验 | 完成 |
| 02 | 版本比较：同号 EA 早于正式版，`7.2.05EA.01` 这种补丁号 | 完成 |
| 03 | 数据覆盖层，三个计算入口共用一处 | 完成 |
| 04 | 补丁存储、原子写入、启动时读取 | 完成 |
| 05 | 检查与下载 | 完成 |
| 06 | 设置页显示、Debug 导出、使用统计补丁号 | 完成 |
| 07 | 打包签名工具 | 完成 |
| 08 | Android | 暂缓，第一版只做 Windows |
| 09 | 实机验收 | **待你们用真实安装包验收**，见下面 |

构建配置里 `MONA_PATCH_BASE_URL` 和 `MONA_PATCH_PUBLIC_KEY` 都是空的，**所以现在的成品默认不检查补丁**，也不显示设置页那一行。要启用就填这两项。

## 代码在哪

| 位置 | 作用 |
| --- | --- |
| `beta-data/data-overlay.mjs` | 登记表 `PATCHABLE_DATA`（哪些数据能被补丁替换）和 `applyDataOverlay` |
| `beta-data/compose-kernel-api.mjs` | `composeKernelApi` 新增可选参数 `overlay`，覆盖只在这里应用一次 |
| `server/patch-package.mjs` | 补丁包格式、ECDSA P-256 + SHA-256 验签、清单和文件校验 |
| `server/patch-store.mjs` | 本机存储：`pending`（待生效）和 `current`（本次在用），原子换入，每次读取重新核对哈希 |
| `server/patch-updater.mjs` | 检查和下载：ETag、先验签再下载、版本范围、补丁号比较 |
| `server/local.mjs` | 本机接口：`GET /api/patch/overlay`、`GET /api/patch/info`、`GET /api/patch/status`、`POST /api/patch/check` |
| `src/platform/patch-overlay.mjs` | 页面和 Worker 启动内核前读补丁 |
| `src/platform/patch-update.mjs` | 页面端触发检查、玩家开关 |
| `src/platform/patch-info.mjs` | 设置页和 Debug 用的补丁状态 |
| `mona_wasm/pkg/index.js`、`src/wasm/team-dps-native-api.mjs`、`beta-tools/runtime.mjs` | 三个计算入口。四人轴那个原来自己抄了一份包装链，现在改成走 `composeKernelApi` |
| `beta-tools/patch-tool.mjs` | 开发者本机用的打包和签名工具 |
| `online-service/migrations/009_usage_stats_patch.sql` 等 | 使用统计的补丁号字段 |

补丁在本机的存放位置：安装版是 `%LOCALAPPDATA%\MonaArtifact\data\patches`，开发时是仓库下的 `.local-data\patches`。

## 怎么验收

下面的步骤我在构建出的页面加本机服务上走过一遍，用的是测试密钥和本机假补丁服务。**没有用安装包、没有用真实密钥和真实补丁地址。** 请用真实安装包把这些再走一遍，重点看下面「我没验证到的」。

### 1. 准备密钥和配置

```powershell
node beta-tools/patch-tool.mjs keygen --out F:\codeForStudy\for-test\patch-keys\dev
```

得到 `dev.key`（私钥，只留在本机，不要提交）和 `dev.pub`（公钥）。把 `dev.pub` 里的内容填进 `.env.development.yaml` 的 `MONA_PATCH_PUBLIC_KEY`，补丁所在目录的地址填进 `MONA_PATCH_BASE_URL`（只能是 https，本机测试可以用 `http://127.0.0.1:端口`）。**这两个值不要把测试值提交进仓库。**

### 2. 打一个会改变结果的补丁

补丁适用的基础版本要包含你构建的版本（`package.json` 的 `displayVersion`，现在是 `7.2.04`）。我用的改法：把新弓「柔风游弦」每个等级的副词条（暴击率）加 0.2。

1. 新建一个临时目录，里面放 `beta-data\weapons-release-71.json` 的副本，在副本里找到 `name` 为 `BreezeborneRefrain` 的武器，把它 `levels` 里每一项的 `subStat` 加 0.2。
2. 打包：

```powershell
$env:MONA_PATCH_SIGNING_KEY = "F:\codeForStudy\for-test\patch-keys\dev.key"
node beta-tools/patch-tool.mjs build --base-min 7.2.04 --base-max 7.2.04.99 --patch 7.2.04.01 --source-root <临时目录> --out <输出目录> beta-data/weapons-release-71.json
```

3. 把输出目录（里面有 `manifest.json`、`manifest.sig`、`files\`）放到补丁地址对应的静态服务上。第二个补丁用 `--previous <上一个输出目录>` 自动得到 `.02`。

### 3. 看这几项

1. **没有补丁时的基线**：用构建出的软件，在计算器页把安柏的武器换成「柔风游弦」（90 级，精炼 1），记下面板的暴击率和期望伤害。我这边是 32.6%、294。
2. **下载但本次不生效**：启动后软件自动检查并下载补丁。访问 `http://127.0.0.1:端口/api/patch/info?version=7.2.04`（要带请求头 `x-mona-local: 1`），看到 `lastCheck.status` 是 `installed`，`pending` 是补丁号，`current.status` 仍是 `none`。这次运行的计算结果不变。
3. **下次启动后结果变化**：完全退出软件再启动（本机服务重启），再换同一把武器，暴击率应该多 20 个点（我这边是 52.6%、319）。设置页的「内容补丁」一行显示补丁号。
4. **改坏一个字节**：改服务器上补丁文件的一个字节，应该被拒绝（`lastCheck.stage` 是「哈希」），已生效的补丁继续用。再改本机 `patches\current\files` 里的文件，重启后读取被拒绝，计算回到基线，控制台有「内容补丁未生效，使用安装包原数据」。把服务器上的补丁恢复后，下一次检查会重新下载，下次启动恢复生效。
5. **版本**：补丁适用范围不含当前版本时不生效，原因里写明范围。注意这只是「不生效」，文件不会被删除。
6. **回滚**：删掉 `patches` 目录里的内容，重启，回到原始数据，设置页显示「无」。
7. **离线**：补丁地址不可达时，已装的补丁继续生效，页面没有弹窗。
8. **玩家开关**：设置页关掉「自动获取内容补丁」，重新载入后页面不再发检查请求。
9. **使用统计**：有补丁时上报里多一个 `patch` 字段，`version` 仍是基础版本；没有补丁时和以前完全一样。

### 4. 我没验证到的，需要你们补

- **用安装包走一遍。** 我用的是 `vue-cli-service build` 的页面加 `server/local.mjs`，没有用 Windows 安装器和托盘启动器。
- **「下次启动」到底指什么。** 补丁是在**本机服务进程重启**后才生效。托盘启动器关掉窗口后服务进程会不会退出、多久退出，我没有核对。如果服务一直常驻，补丁就要等到玩家完全退出软件才会生效，可能需要改成在页面重新载入时换入，或者给玩家一个提示。
- **Debug 导出没有实际导出过。** 单人配装的调试包要先跑出配装结果（需要仓库里有圣遗物，点自动配装，打开「Debug 模式」再导出调试包），应该在 `environment.contentPatch` 里看到补丁号、各文件哈希、最近一次检查的失败阶段和原因。四人轴的导出在顶层 `contentPatch`。两个页面的导出代码我只改了，没有运行过，只有单元测试覆盖。
- **安装器覆盖升级**后，旧补丁是否按版本范围正确地不生效。
- **真实升级基础版本**：我用「适用范围是旧版本的补丁」模拟，没有真的升级。
- **使用统计的服务端部分**：新迁移 `009_usage_stats_patch.sql` 只在内存数据库里跑过。部署在线服务时迁移会自动执行；之后打开 `/admin/stats`，「补丁」下拉应该有补丁号，按它筛选只影响近 7 天、近 30 天和每日活跃，累计数不受影响。新客户端对没升级的旧服务端上报也没问题（多出的字段被忽略）。
- **真实密钥和 https 的补丁地址**。

## 要知道的限制

- **只能替换登记表里的数据**，见 `beta-data/data-overlay.mjs`：`weapons-release-71.json`、`weapons-signature-release-71.json`、`vodyanitsa.json`、`extension-support.json`、`src/assets/_gen_character.js`。规则代码（`equipment-*.mjs` 等）、wasm 内核、界面都不能热更，仍然走 Release。`beta-data/team-dps-native/*.json` 和 `*-runtime.mjs` 的扩展武器数据是静态导入的，也不在第一版里。
- 角色数据 `_gen_character.js` 是 JS 模块，补丁里存的是去掉 `export default` 后的 JSON。
- 旧补丁超出适用范围只是不生效，不会被删除。
- 同一天同一功能的统计只有一行，记下的补丁号是第一次存这一行时的。
- 只做 Windows 桌面。Android 没有本机服务，`loadPatchOverlay` 会返回「不可用」，设置页那一行也不显示。
- 只支持一个补丁地址，没有 GitHub、CNB、镜像那样的多线路。
- 补丁地址由构建配置给出，页面把它连同公钥传给本机服务；本机服务只接受带 `x-mona-local` 头的同源请求。

## 接下来做什么

1. 用真实安装包完成上面的验收，尤其是「下次启动」的含义和 Debug 导出。完成后把任务 09 改成 `done`。
2. 决定补丁放在哪个 https 地址，部署在线服务（或别的静态服务），填进构建配置。补丁目录要能返回 ETag，普通的静态文件服务（比如 Caddy 的 `file_server`）默认有。
3. 决定发布补丁的流程。工具只生成本地文件，不会上传，发布由人手动完成。私钥由开发者保管。
4. 之后再考虑：Android（任务 08，开始前先验证 WebView 里 ECDSA P-256 能不能用）、扩展武器数据改成可注入、补丁的灰度发布。
5. 合并到 `main` 前，`ui-redesign` 里的在线账号和界面改动要先处理，这个分支从它切出，包含它的全部提交。

## 发布规则提醒

这个项目的规则不变：推送、建 PR、发 Release、发布补丁，都只在开发者明确要求时做，一次要求只做那一次。未公开的游戏版本内容，要等官方体验服解禁公开后才能发补丁。

## 测试怎么跑

```powershell
node --test tests/patch-package.test.mjs tests/patch-store.test.mjs tests/patch-updater.test.mjs tests/patch-info.test.mjs tests/patch-tool.test.mjs tests/data-overlay.test.mjs tests/kernel-entry-composition.test.mjs
cd online-service; node --test tests/usage-stats-patch.test.mjs tests/usage-stats.test.mjs tests/usage-stats-summary.test.mjs
```

测试用的临时目录在 `.cache/test/` 下，用完会删。顺带一句：`online-service/tests/usage-stats-summary.test.mjs` 里功能总数原来写的 28，在我之前加 `page.online-account` 后就一直是红的，这次改成了 29。
