# 10: 把 Tauri 封装的应用标识固定下来

**What to build:** Tauri 2 封装的应用标识和包名不再带版本号，以后升级版本时它的存储位置不变；发版核对里不再需要为它手工同步版本号。

**Blocked by:** None (can start immediately)

**Status:** done

开发者已决定（见 `docs/adr/0002-tauri-shell-stays-experimental.md`）：正式发行继续用「托盘启动器加默认浏览器」；`tauri-exe/` 保留为实验形态，不取代托盘启动器，不采用 PyTauri。

现状：应用标识是 `com.mona.artifact.tauri7204`，包名是 `mona-tauri7204`，`productName` 和 `description` 里也写着 `7.2.04`。应用标识决定本机数据目录，换一个标识就读不到之前的数据。这份封装还没有正式发行过，现在改没有迁移负担。

- [x] `tauri-exe/tauri.conf.json`：`identifier` 改为 `com.mona.artifact.tauri`，`productName` 改为 `莫娜占卜铺`（窗口标题里的版本号已经由 `MONA_DISPLAY_VERSION` 提供）
- [x] `tauri-exe/Cargo.toml`：`name` 改为 `mona-tauri`，`description` 去掉版本号；同步 `tauri-exe/Cargo.lock` 里本包的名字
- [x] 端口 `47504` 保持不变，在 `tauri-exe/src/main.rs` 的常量旁加一行注释说明它决定存储位置、不随版本修改
- [x] `docs/dev/release-checklist.md`：Tauri 一行只保留 `Cargo.toml` 与 `Cargo.lock` 的 `version`
- [x] `docs/dev/architecture.md` 发行形态表里的应用标识同步更新
- [x] 验证：在 `tauri-exe/` 下执行 `cargo metadata --no-deps --format-version 1` 成功。完整构建需要仓库外的 Node.js 运行时目录和 `payload.tar.gz`，本任务不做完整构建，汇报时照实说明

本任务不做：补构建脚本、设计从浏览器存储到 WebView2 的迁移。这两件事等决定正式发行这个形态时再立规格。

## Comments

- 2026-11-11：`cargo metadata --no-deps --offline` 成功，包名为 `mona-tauri@7.2.4`。没有做完整构建。执行时 rustup 自动安装了 `rust-toolchain.toml` 指定的 nightly-2024-10-10 工具链（本机原先没有）。
