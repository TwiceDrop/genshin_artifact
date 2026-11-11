# 构建与测试

## 首次准备

```powershell
npm ci --legacy-peer-deps
```

- 需要 Node.js 20 或更高版本和 Git。
- 要构建新移动 UI，再在 `mobile/` 下执行 `npm ci --legacy-peer-deps`。`radix-vue` 声明了 `vue` 为对等依赖，但构建时 `vue.config.js` 把 `vue` 指到根目录那一份，所以 `mobile/` 不另装 `vue`；不加这个参数，`npm ci` 会因为锁文件里没有 `vue` 而报错。
- 原始发布内核、浏览器入口和生成的元数据都已提交，新克隆的仓库不需要再提取。

## 重新提取原始发布内核

只在需要从上游发布包恢复原始文件时运行 `npm run setup:release`。它需要 7-Zip（默认路径 `C:/Program Files/7-Zip/7z.exe`，可以用 `SEVEN_ZIP` 指定），会下载上游 v5.33.58 发布包，按 `THIRD_PARTY_NOTICES.md` 记录的 SHA-256 校验后，改写 `public/release-assets/`、`mona_wasm/pkg/`、`src/assets/_gen_*.js` 和 `src/i18n/generated/`。

其中 `mona_wasm/pkg/index.js` 会被换成上游的简化入口，丢掉本项目的适配层包装。运行后用 `git diff` 检查，除了确实要更新的文件，其余用 `git checkout -- <文件>` 还原，`index.js` 一定要还原。

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
- `npm run test:local` 会跑 `tests/` 下全部 200 多个测试文件，耗时很长。全量跑过一次时，有进程长时间无输出、占用约 4 GB 内存，所以默认不跑全量。
- `tests/evidence/` 下的测试需要本机预先存在、不提交的文件，用 `npm run test:evidence` 单独跑，`test:local` 不包含它们。需要的文件有两类：
  - `.build-target/` 下的证据，由对应脚本在本机生成，例如 `beta-tools/full-audit-contracts-7201.mjs` 生成 `linkage-fix-7201` 读取的 `contracts.json`。
  - 真实账号夹具 `beta-data/skirk-fixture.json`、`beta-data/mizuki-fixture.json`，被 `.gitignore` 排除，只在持有者本机存在。
- `tests/` 下的测试会把报告写到 `.build-target/`，目录不存在时自己创建。
- 依赖缺失（`Cannot find package`）时先确认已经执行过 `npm ci`。

## 临时文件

测试产物放在 `.cache/test/<用途>/`，每类用一个固定子目录，下次覆盖，用完删除。
