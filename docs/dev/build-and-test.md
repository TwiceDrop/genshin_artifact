# 构建与测试

## 首次准备

```powershell
npm ci --legacy-peer-deps
npm run setup:release
```

- 需要 Node.js 20 或更高版本、Git 和 7-Zip（默认路径 `C:/Program Files/7-Zip/7z.exe`，可以用 `SEVEN_ZIP` 指定）。
- `setup:release` 会下载上游 v5.33.58 发布包，按 `THIRD_PARTY_NOTICES.md` 记录的 SHA-256 校验后解出原始内核和元数据。它会改写 `public/release-assets/`、`mona_wasm/pkg/` 和 `src/assets/_gen_*.js`，运行后用 `git diff` 确认没有覆盖本地补充的数据。

## 运行与构建

| 目的 | 命令 |
| --- | --- |
| 本机服务（米游社导入、更新） | `npm run build:local` 后 `npm start`，打开 `http://127.0.0.1:4183/#/calculate` |
| 前端开发服务（不含本机服务功能） | `npm run serve` |
| 桌面网页 | `npm run build:local` |
| 新移动 UI | `npm run build:mobile` |
| Android | `script/build-android.ps1 -Ui elementplus` 或 `-Ui mobiletest`，显式传 `-SigningDirectory <原签名目录>` |
| Rust 扩展内核 | `npm run build:beta-kernel`，需要先把 `compiler-source.json` 里的 MinGW 解到 `beta-tools/mingw64/` |
| 效果桥接内核 | `npm run build:effect-bridge`（Python） |

签名、密码不进入源码。`npm start` 默认端口是 4183，Windows 启动器（`installer/Launcher.cs`）固定用 `MONA_PORT=4174`。改端口或在 localhost 与 127.0.0.1 之间切换，会进入另一份浏览器存储。

## 测试

- 单个文件：`node --test tests/<文件>.test.mjs`。按改动挑选，每轮不超过五项验证。
- `npm run test:local` 会跑全部 200 多个测试文件，耗时很长。全量跑过一次时，有进程长时间无输出、占用约 4 GB 内存，所以默认不跑全量。
- 一部分测试读取 `.build-target/` 下的证据文件（例如 `tests/progress-results-7112.test.mjs`）。这些文件由 `beta-tools/` 里对应的脚本在本机生成，并不提交，新克隆的仓库里这类测试会因为文件缺失而失败，属于预期情况。
- 依赖缺失（`Cannot find package`）时先确认已经执行过 `npm ci`。

## 临时文件

测试产物放在 `.cache/test/<用途>/`，每类用一个固定子目录，下次覆盖，用完删除。
