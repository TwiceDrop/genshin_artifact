# v7.1.06 发布校验

在测试和三端构建完成后，将已提交的源码快照放入新目录 `D:\Documents\ChatGPT\v7.1.06\source`，将网页 ZIP、Windows 安装包、Android APK 与源码 ZIP 放入同目录的 `releases`。不得把 `.local-data`、签名密码、账号数据、`node_modules` 或编译缓存复制进去。

发布前逐项核对：

1. `package.json` 的 `displayVersion` 为 `7.1.06`，Android `versionCode` 为 `70106`，Windows 安装器名称包含 `V7.1.06`。
2. `characters-release-71.json` 与 `weapons-signature-release-71.json` 的 revision 为 `7.1.0 D48145775`；普通与扩展武器数据的 branch/version/designRevision/resourceRevision 为 `release / 7.1.0 / 48145775 / 48145775`。
3. `mona_wasm/pkg/mona_wasm_bg.wasm` 为原发布内核，SHA-256 固定为 `fa42077784f9556dd312743bc1327bd475970c53146e4867191f3cad63005b90`。最终重编完成后，把扩展内核 `mona_wasm/extension/mona_extension_bg.wasm` 的 SHA-256 写入 `beta-data/release-7.1.06-integrity.json` 的 `extensionWasmSha256`，并在构建和导出源码后再次核对。
4. 五项定向用例覆盖直接星扩散独立算例、计算与配装等路径；Android APK 与 v7.1.05 的签名证书一致。三端构建通过，但本轮未进行各端交互、旧方案导入、实体手机或账号登录测试；发布说明中的未完成路径仍保留阻断或显式提示。
5. 在新目录就绪后运行 `powershell -NoProfile -ExecutionPolicy Bypass -File source/script/finalize-release.ps1 -ReleaseDirectory 'D:\Documents\ChatGPT\v7.1.06'`。脚本核对数据 revision 和双内核固定哈希，再生成新目录根部的 `SHA256SUMS.txt`，列出关键数据、两份 WASM 和全部发布文件。脚本失败时不得上传。

GitHub 的 v7.1.06 标签、Release 正文及资产应与上述源码快照和 SHA256SUMS 对应；上传后从 GitHub 下载的文件再核对一次哈希。

本轮按用户要求仅执行 tests/release-7106.test.mjs 中的五项定向用例，不调用 build-extension.ps1 的全量 smoke 测试。
