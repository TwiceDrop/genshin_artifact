# 01: 补丁包格式与校验

**What to build:** 一个纯逻辑模块，定义补丁清单的格式，并能校验一个补丁包：清单签名、每个文件的 sha256、路径是否在登记表内、基础版本是否适用。

**Blocked by:** None (can start immediately)

**Status:** done


规格见 `docs/specs/content-patch/spec.md` 的「补丁包格式」。

- [x] 新建补丁校验模块，不依赖 Vue、浏览器专有 API 或 Node 专有 API，桌面页面、Worker、Node 测试和打包工具都能直接导入。签名和哈希用 WebCrypto（浏览器和 Node 都有）
- [x] 清单字段：补丁号、适用基础版本范围、文件列表（路径、sha256、大小）、创建时间
- [x] 校验顺序：先验清单签名，再逐个文件核对大小和 sha256，再核对路径在登记表内、基础版本适用
- [x] 登记表用任务 03 的 `PATCHABLE_DATA`（`beta-data/data-overlay.mjs`），没有另做测试用的小登记表
- [x] 公钥由调用方传入（未压缩的 P-256 点，65 字节），模块里不写任何密钥；构建配置里的公钥常量由任务 05 接入。测试用的密钥对在 `tests/helpers/patch-signing.mjs` 里每次现生成，只在内存里，不用真实密钥
- [x] 校验失败的错误带阶段（签名、哈希、路径、版本）和原因，不吞异常
- [x] 测试：正常包通过；清单被改一个字节签名失败；文件被改哈希失败；路径含 `..` 或不在登记表内被拒；基础版本不在范围内被拒；缺文件、多文件被拒
- [x] 验证：只跑新增的测试文件

## Comments

- 2026-11-20：已实现，模块在 `server/patch-package.mjs`（沿用 `server/update-sources.mjs` 那样由 `src/` 和 Node 共同导入的位置）。
  - **算法**：ECDSA P-256 + SHA-256，签名是 WebCrypto 的 r‖s 格式（64 字节），签名覆盖清单的原始字节，不需要规范化。规格草案写的是 Ed25519，我换成了 P-256：这条签名要在 Android 页面里也能验，Ed25519 在旧 WebView 里是否可用我没有核实，P-256 是 WebCrypto 的基础算法。任务 08 做的时候仍要先验证。
  - **清单**：`{patch, createdAt, baseVersion: {min, max}, files: [{path, sha256, size}]}`。比任务 04 里的清单多了 `createdAt`，已同步改了 `PatchStore`。
  - **校验顺序和阶段**：签名、清单、路径、哈希、版本。签名不对时不去解析清单内容；路径阶段包括不在登记表内、含 `..`、重复、多文件、少文件；错误都带 `stage`，`code` 是 `PATCH_PACKAGE`。
  - **复用**：`PatchStore`（任务 04）原来自带的清单和文件检查改成复用这个模块，避免两份规则；它的阶段名随之改了（登记表问题从「清单」变为「路径」，错误码从 `PATCH_STORE` 变为 `PATCH_PACKAGE`）。
  - **没做**：公钥常量和构建配置注入留给任务 05；签名工具留给任务 07；补丁包在网络上怎么传（压缩包还是目录）也还没定，模块只接收「清单字节、签名、文件字节」三部分。
- 验证：`tests/patch-package.test.mjs` 10 项，加上更新后的 `patch-store`、`data-overlay`、`kernel-entry-composition`、`release-update`，共 42 项通过。测试覆盖：清单改一个字节签名失败且先于清单解析、别的密钥和截断签名、文件被改（大小和哈希）、路径越界和重复、多文件少文件、清单格式错误、版本范围两端包含和无法识别的版本、阶段顺序。没有在浏览器里跑，因为这个模块还没有被页面导入。
