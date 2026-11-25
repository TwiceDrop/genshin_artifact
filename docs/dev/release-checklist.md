# 发版核对

版本字段、发布产物或发版步骤变化时更新。

正式发布、推送标签、创建 GitHub Release 都要当前开发者在对话里明确授权，一次授权只覆盖这一次。未公开的游戏版本内容，要等官方授权创作体验服视频正式解禁并公开后才能发布，也不能夹带其他未解禁内容。

## 1. 同步版本号

以 `package.json` 的 `version`（例如 `7.2.4`）和 `displayVersion`（例如 `7.2.04`）为准。下面这些位置需要手动改：

- [ ] `package.json`：`version`、`displayVersion`
- [ ] `android/app/build.gradle`：`versionCode`（例如 `70204`）、`versionName`
- [ ] `tauri-exe/Cargo.toml` 与 `tauri-exe/Cargo.lock` 里本包的 `version`（应用标识、包名和端口固定不变，见 ADR 0002）
- [ ] `online-service/compose.yaml` 镜像标签、`online-service/scripts/pack.py` 的 `root_name`
- [ ] TeamDPS 规则版本有变化时：`beta-data/team-engine/action-config.mjs` 的 `TEAM_ACTION_RULES_VERSION`，以及引用它的测试

这些会自动跟随 `package.json`，不用手改，但要核对产物：

- Windows 安装器（`installer/mona.iss`，由 `script/build-windows.ps1` 传入版本）。
- 托盘启动器（`script/build-tray-launcher.ps1`）：EXE 文件名、托盘名称、日志窗口标题、`AssemblyTitle`、`AssemblyInformationalVersion`、`AssemblyVersion`、`AssemblyFileVersion`。每次改版本都要重新生成启动器，启动器源码里不另外硬编码版本号。

## 2. 更新文档

- [ ] `Update.Log` 顶部加本版条目。
- [ ] `docs/release-<版本>-final.md` 写发布说明。
- [ ] `docs/dev/current-state.md` 更新版本和本版变化。
- [ ] 玩家可见功能或入口变化时，同步更新 `docs/user-guide.md`。
- [ ] 新增或归档文档时，同步更新[文档导航](../README.md)。
- [ ] README 只在开发者要求时改；改的话，README、发布说明、启动器和成品的版本保持一致。

## 3. 构建与核对成品

- Windows 桌面版的默认在线服务地址取自构建机的 `server/desktop-cloud-url.local.json`，文件内容为一个 JSON 字符串，仅填写服务根地址。Git 忽略该文件，Tauri 载荷和托盘安装包会随包携带它。已保存的服务地址优先，其次为运行环境的 `VUE_APP_MONA_CLOUD_URL`。

- [ ] 新成品输出到新目录或带修订后缀，保留已验证的旧版成品，不覆盖。
- [ ] Windows 安装器、便携包、APK 分别核对实际内容与版本。
- [ ] Android 用原签名目录构建，应用 ID、端口、主机名保持不变，保证能覆盖升级、保留用户存档。
- [ ] 发布包里没有账号、UID、库存、预设、Debug 导出、浏览器存储、密钥或签名资料。
- [ ] 使用统计：`.env.development.yaml` 的 `MONA_USAGE_STATS_URL` 为空时成品不上报。要启用时，按 `docs/dev/usage-stats-rollout.md` 的顺序：先部署并验证在线服务，再填上在线服务地址（只写 https 根地址）。
- [ ] 内容补丁：`.env.development.yaml` 的 `MONA_PATCH_BASE_URL` 或 `MONA_PATCH_PUBLIC_KEY` 任一为空时成品不检查补丁。要启用时先用 `node beta-tools/patch-tool.mjs keygen` 生成密钥对，私钥只留在本机，把打印出的公钥和补丁所在目录的 https 地址填进去。规格和任务见 `docs/specs/content-patch/`。
- [ ] 在持有私有夹具和证据文件的机器上跑一次 `npm run test:evidence` 和 `npm run smoke:fixtures`，失败项逐个核对是否与本版改动有关。

## 4. 发布源码

- [ ] 发布源码接续已清理的公开历史，不导入本地工作目录或调试资料（如 `.build-target/`、`.cache/`）。
- [ ] 推送和创建 Release 前，再向开发者确认一次具体要推的分支、标签和产物。
