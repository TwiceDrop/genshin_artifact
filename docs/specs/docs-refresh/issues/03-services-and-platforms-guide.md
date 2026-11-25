# 编写本机服务、在线服务与多端打包指南

Status: done

## 目标

新增常青文档 `docs/dev/services-and-platforms.md`，把 `server/`、`online-service/`、`android/`、`tauri-exe/` 和 `installer/` 的职责边界、本地联调与构建入口集中讲清楚（不重复 `docs/dev/architecture.md`、`docs/dev/build-and-test.md` 和 `online-service/DEPLOY.md` 的已有内容，相互链接）。

## 需对照源码核实的内容

编写前必须先读取对应源码和脚本，确保端口、环境变量、脚本路径和接口路由准确：
- `server/` 主要入口文件（端口、本机来源校验、米游社/HoYoLAB/Enka/云同步/内容补丁/更新接口、DPAPI 凭据存储）
- `online-service/` 目录结构与 `online-service/DEPLOY.md`
- `script/build-web-package.ps1`、`script/build-windows.ps1`、`script/build-tray-launcher.ps1`、`script/build-android.ps1`
- `tauri-exe/prepare-payload.py`（及相关配置）与 `docs/adr/0002-tauri-shell-stays-experimental.md`
- `android/app/build.gradle`

## 文档大纲

顶部写明一行「何时更新」（例如：增删本机/在线服务接口、调整监听端口、更改打包脚本或平台约束时更新）。

1. **本机服务（`server/`）**
   - 职责范围与安全边界（仅监听/接受本机来源、凭据加密存储）。
   - 主要 HTTP 接口分组速查表（按当前源码列出路径前缀与用途，如更新、Enka/导入、云账号代理、内容补丁等）。
   - 本地联调方式与端口存储隔离注意事项（4183 vs 4174 vs 47504）。
2. **在线服务（`online-service/`）**
   - 职责边界（账号登录、云档案同步、使用统计等）与当前仓库状态（源码已含、部署步骤见 `online-service/DEPLOY.md`）。
   - 客户端配置在线服务地址的优先级（本地已保存配置 vs 构建期 `desktop-cloud-url.local.json` vs 环境变量）。
3. **多端打包与运行形态**
   - Windows 网页便携包 / 安装器 + 托盘启动器（构建脚本、产出物、注意点）。
   - Windows Tauri 封装（实验性质见 ADR 0002、载荷生成方式、应用 ID 与端口不可改原则）。
   - Android Capacitor（构建脚本、签名与 `versionCode` 覆盖升级约束、原生插件职责）。
4. **常见联调与打包排错**
   - 端口变更导致“存档消失”的原因与恢复方式；原生签名/应用 ID 改动风险；构建环境依赖（Node / 7-Zip / Android SDK / Rust 等）。

## 收尾

- 在 `docs/README.md` 的开发者文档目录中链接 `docs/dev/services-and-platforms.md`。
- 完成后将本文件改为 `Status: done`。
