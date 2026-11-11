# 技术栈

各部分用什么技术、版本锁在哪个文件。版本以锁定文件为准，本文件只记到主版本；升级依赖时改锁定文件，主版本变化时再改这里。架构和调用关系见 `docs/dev/architecture.md`。

## 一览

| 部分 | 技术 | 版本锁定位置 |
| --- | --- | --- |
| 前端框架 | Vue 3、Vue Router 4、Pinia 2、vue-i18n 9，TypeScript 4.5 与 JS 混写 | `package.json`、`package-lock.json` |
| 前端构建 | Vue CLI 5（webpack 5）、Babel、Sass、ifdef-loader | `package.json`、`vue.config.js` |
| 桌面 UI | Element Plus 2、unplugin 自动导入、ECharts 5、Monaco Editor | `package.json` |
| 新移动 UI | radix-vue、Tailwind CSS 3、class-variance-authority | `mobile/package.json` |
| 浏览器存储 | localforage（IndexedDB）与 localStorage | `package.json` |
| 原始发布内核、效果桥接内核 | 上游 v5.33.58 的 WASM；桥接内核用 Python 加 WABT 改写 WAT 生成 | `THIRD_PARTY_NOTICES.md`、`mona_wasm/pkg/release.json` |
| 扩展内核 | Rust nightly-2024-10-10、wasm-bindgen 0.2.92、pest、askama | `rust-toolchain.toml`、`mona_wasm/Cargo.lock`、`beta-tools/compiler-source.json` |
| 适配层与四人轴 | 纯 ES 模块（`.mjs`），浏览器与 Node 共用；四人轴另有 WebGPU（WGSL）路径 | 无外部依赖 |
| 本机服务 | Node.js 20 以上，只用标准库的 `node:http` | `server/` |
| Windows 发行 | Inno Setup 6 安装器、C# 托盘启动器（.NET Framework 4 的 `csc.exe`）、WebView2 登录窗口，随包带 Node.js | `installer/`、`script/build-*.ps1` |
| Windows Tauri 封装 | Tauri 2（Rust），内嵌网页产物和 Node.js | `tauri-exe/Cargo.lock` |
| Android | Capacitor 8、Gradle 8、compileSdk 36、minSdk 24 | `package.json`、`android/variables.gradle` |
| 在线账号服务 | Node.js 24、PostgreSQL 17（`pg`）、nodemailer、Docker Compose、Caddy 2 | `online-service/package-lock.json`、`online-service/compose.yaml` |
| 测试 | `node --test`；移动 UI 用 jsdom 与 Playwright；Android 用 JUnit 仪器测试；在线服务用 PGlite | `package.json`、`mobile/package.json` |
| 构建脚本 | PowerShell、Node、Python 3 | `script/`、`beta-tools/` |

## 语言分布

| 语言 | 用在哪里 |
| --- | --- |
| JavaScript／TypeScript | 前端、适配层、四人轴、本机服务、在线服务、测试 |
| Rust | 扩展内核（`mona_core`、`mona_dsl`、`mona_derive`、`mona_wasm`）、Tauri 封装 |
| C# | Windows 托盘启动器、HoYoLAB 登录窗口 |
| Java | Android 壳与原生插件 |
| Python | 生成效果桥接内核、打包 Tauri 载荷、打包在线服务 |
| PowerShell | Windows 与 Android 的构建和发版脚本 |

## 本机需要安装的工具

| 做什么 | 需要 |
| --- | --- |
| 前端开发、跑测试 | Node.js 20 以上、Git、7-Zip |
| 编译扩展内核 | Rust nightly-2024-10-10（`x86_64-pc-windows-gnu`）、`compiler-source.json` 指定的 MinGW、wasm-bindgen 0.2.92 |
| 生成效果桥接内核 | Python 3、WABT（`wasm2wat`、`wat2wasm`） |
| 打 Windows 包 | Inno Setup 6、.NET Framework 4、Node.js 运行时目录、WebView2 SDK |
| 打 Android 包 | JDK、Android SDK 36、原签名目录 |
| 构建 Tauri 封装 | Rust（受根目录 `rust-toolchain.toml` 约束）、Python 3；仓库里没有对应的构建脚本 |
| 跑在线服务 | Node.js 24、Docker |

具体命令见 `docs/dev/build-and-test.md`。

## 已知的版本包袱

升级前先评估影响，升级本身按规格和任务走。

- Vue CLI 5 已停止功能开发，TypeScript 4.5、ESLint 7、axios 0.21 都落后多个主版本。
- `.eslintrc.js` 的 `ignorePatterns` 排除了 `src/`，`npm run lint` 实际不检查前端源码。
- Rust 工具链固定在 2024 年 10 月的 nightly；`rust-toolchain.toml` 里列的 `x86_64-unknown-linux-gnu` 目标在 Windows 构建中用不到。
- 根目录服务要求 Node.js 20，在线服务要求 Node.js 24，`THIRD_PARTY_NOTICES.md` 记录的随包运行时是 Node.js 22，三处不一致。
