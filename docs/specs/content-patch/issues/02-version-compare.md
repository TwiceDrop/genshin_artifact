# 02: 版本比较支持 EA 与补丁号

**What to build:** 让现有版本比较能处理 `7.2.05EA`、`7.2.05EA.01` 这类版本号，并且同号 EA 排在正式版之前。

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

需要开发者先定：同号 EA 和正式版的先后（规格「待开发者决定」第 3 条，建议 EA 早于正式版），以及补丁号放在 EA 之后还是用别的分隔符。

现有实现：`server/update-sources.mjs` 的 `compareVersions`。它的正则只认「数字加可选的 `EA` 或 `-`、`+` 后缀」，`EA` 后面再跟 `.01` 会返回无法判断，同号的 EA 和正式版比较结果为 0。

- [ ] 改比较规则：同号时 EA 小于正式版；`EA` 后面可以接补丁段（`7.2.05EA.01`），补丁段大的更新
- [ ] 保持现有行为不变：多段数字版本、`v` 前缀、`-`/`+` 后缀、无法识别时返回 null
- [ ] 检查调用方：`describeRelease`（`src/platform/release-update.mjs`）、`LocalUpdater`、更新弹窗，确认改规则后版本比较的结果和界面提示一致
- [ ] 使用统计服务的版本格式 `VERSION` 允许字母和 `.`，不需要改，只在测试里确认 `7.2.05EA.01` 能通过
- [ ] 测试：EA 与同号正式版的先后、EA 加补丁号的先后、不同基础版本的补丁号比较、原有用例全部保持通过
- [ ] 验证：跑 `update-sources` 相关的现有测试加新增用例

## Comments
