# 04: 覆盖层存储与加载

**What to build:** 把校验通过的补丁存进用户数据目录，页面和 Worker 在启动计算内核之前读到它。支持回滚。

**Blocked by:** 01, 03

**Status:** done

规格见 `docs/specs/content-patch/spec.md` 的「Solution」。本任务先做 Windows 桌面，Android 见任务 08。

- [x] 本机服务（`server/local.mjs`）新增读取覆盖层的接口，覆盖层存放在 `MONA_DATA_DIR` 下的专用子目录。不动用户的账号、预设和库存数据，也不改已保存数据的位置
- [x] 写入是原子的：先写临时目录，校验通过后一次改名生效；写入中途断电不会留下半个补丁
- [x] 页面启动时先取覆盖层，再初始化计算内核；取不到或没有覆盖层时按原数据运行，并把原因记进 Debug，不弹错
- [x] 四人轴 Worker 和其他 Worker 拿到同一份覆盖数据（由页面启动时传入或 Worker 自己通过同一个接口读取，保证与页面一致）
- [x] 已生效的补丁文件在每次启动时重新校验哈希，被改坏的覆盖层按「没有覆盖层」处理并记录原因
- [x] 回滚：`PatchStore.rollback()` 删除所有补丁；只在本机服务内部可调用，没有开放 HTTP 接口
- [x] 基础版本升级后，适用范围外的旧补丁不再生效（只忽略，不删文件，见评论）
- [x] 验证：Node 测试覆盖原子写入、损坏覆盖层、版本范围；另用构建出的页面和本机服务实际打开一次，确认读到补丁（见评论）

## Comments

- 2026-11-20：已实现。
  - **存储**：`server/patch-store.mjs` 的 `PatchStore`。目录下有 `pending`（已安装、等下次启动）和 `current`（本次运行在用）。`install` 只写 `pending`，本机服务启动后第一次被问到补丁时才把 `pending` 换成 `current`（`activatePending`），所以同一次运行里页面和所有 Worker 读到的是同一份。文件按登记表的键存成 `files/<键>.json`，不用补丁里的路径做文件名。
  - **原子写入**：先写 `.staging-*`，再用改名换上；换的过程中先把旧目录改成 `.old-*`。上次中断留下的临时目录在下次 `install` 或 `activatePending` 时清理，换到一半的旧目录会被恢复。
  - **读取**：`load(appVersion)` 每次都重新核对每个文件的大小和 sha256，再解析 JSON。不抛错，返回 `none`、`applied` 或 `rejected`（带阶段：清单、版本、哈希、解析，和原因）。被改坏、版本不适用的补丁都只是不生效，页面用安装包原数据。
  - **版本**：清单 `baseVersion` 为 `{min, max}` 两端都包含，用 `compareVersions` 比较。页面把自己的 `MONA_VERSION`（`displayVersion`）作为 `version` 参数传给本机服务。适用范围外的补丁只忽略不删除，由下一次安装换掉；任务文件原写「自动作废」，我没有做删除，免得在版本参数有误时误删。
  - **接口**：`GET /api/patch/overlay?version=…`（`server/local.mjs`），和其他本机接口一样要求 `x-mona-local` 头。没有开放回滚的 HTTP 接口。
  - **页面和 Worker**：`src/platform/patch-overlay.mjs` 的 `loadPatchOverlay`。`mona_wasm/pkg/index.js` 和 `src/wasm/team-dps-native-api.mjs` 在组装内核前 `await` 它，并把结果的 `overlay` 传给 `composeKernelApi`。取不到本机服务（Android、开发服务器、服务没启动）返回 `unavailable` 和原因，按原数据运行；补丁被拒绝时在控制台输出原因。Debug 导出的接入留给任务 06。
  - **清单格式和任务 01 的关系**：本任务用的清单是 `{patch, baseVersion: {min, max}, files: [{path, sha256, size}]}`，路径必须在 `PATCHABLE_DATA` 里。签名校验还没做（任务 01），所以现在 `install` 的调用方要自己保证来源可信；任务 01 要产出同样的清单字段，或在这里一并调整。没有真实的下载来源，目前只有测试在调用 `install`。
- 验证：`tests/patch-store.test.mjs` 11 项通过（安装和激活顺序、不合格补丁被拒且不留残留、文件被改坏、清单损坏、版本范围、中断恢复、回滚、本机服务只激活一次并在运行中保持不变、页面加载器的各种失败、从磁盘存到伤害计算的完整链路）；`kernel-entry-composition` 新增两项检查入口先读补丁再组装；`auto-update-7109`、`cloud-gateway`、`cloud-profile-gateway` 没有被影响。页面入口和四人轴入口各用 `vue-cli-service build --target lib` 打包过，通过。
- **浏览器实测**：用 `vue-cli-service build` 把完整页面构建到测试目录，起一个本机服务，预先装好一个把 `BeyondTheChrysalis` 副词条加 0.1 的合成补丁（适用 7.2.04 到 7.2.04.99），在内置浏览器打开计算器页。页面和 Worker 一共请求了两次 `/api/patch/overlay?version=7.2.04`，都返回 200 和 `applied`，补丁号 `7.2.04.01`；控制台没有补丁相关的输出，计算器正常显示伤害。没有核对补丁让页面上的哪个数字变了，数值变化只由 Node 测试验证。没有跑安装包，没有核对四人轴的计算结果，也没测手机宽度。测试用的服务因没有传入账号存储，在线账号相关请求返回 502，与补丁无关。测试目录和服务已清理。
