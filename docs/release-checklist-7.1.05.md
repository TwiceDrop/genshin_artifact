# v7.1.05 发布校验

在测试和三端构建完成后，将已提交的源码快照放入新目录 `D:\Documents\ChatGPT\v7.1.05\source`，将网页 ZIP、Windows 安装包、Android APK 与源码 ZIP 放入同目录的 `releases`。不得把 `.local-data`、签名密码、账号数据、`node_modules` 或编译缓存复制进去。

发布前逐项核对：

1. `package.json` 的 `displayVersion` 为 `7.1.05`，Android `versionCode` 为 `70105`，Windows 安装器名称包含 `V7.1.05`。
2. `characters-release-71.json` 与 `weapons-signature-release-71.json` 的 revision 为 `7.1.0 D48145775`；普通与扩展武器数据的 branch/version/designRevision/resourceRevision 为 `release / 7.1.0 / 48145775 / 48145775`。
3. `mona_wasm/pkg/mona_wasm_bg.wasm` 为原发布内核，SHA-256 固定为 `fa42077784f9556dd312743bc1327bd475970c53146e4867191f3cad63005b90`。最终重编完成后，把扩展内核 `mona_wasm/extension/mona_extension_bg.wasm` 的 SHA-256 写入 `beta-data/release-7.1.05-integrity.json` 的 `extensionWasmSha256`，并在构建和导出源码后再次核对。
4. 更新直接星扩散的新公式数值快照，并以独立算例验收；验证 Android APK 与 v7.1.04 APK 的签名证书一致，运行网页、Windows 与 Android 的启动/计算入口及旧方案导入检查；发布说明中的未完成路径仍保留阻断或显式提示。
5. 在新目录就绪后运行 `powershell -NoProfile -ExecutionPolicy Bypass -File source/script/finalize-release.ps1 -ReleaseDirectory 'D:\Documents\ChatGPT\v7.1.05'`。脚本核对数据 revision 和双内核固定哈希，再生成新目录根部的 `SHA256SUMS.txt`，列出关键数据、两份 WASM 和全部发布文件。脚本失败时不得上传。

GitHub 的 v7.1.05 标签、Release 正文及资产应与上述源码快照和 SHA256SUMS 对应；上传后从 GitHub 下载的文件再核对一次哈希。
