# 09: 把 Node 入口改成不带版本号的名字

**What to build:** Node 入口的文件名不再带 `7106`，所有引用指向新名字，`AGENTS.md` 里「名字含 7106，仍是当前入口」的说明可以删掉。

**Blocked by:** 08

**Status:** ready-for-agent

开发者已决定的范围：

- 做：`beta-tools/runtime-7106.mjs` 改名为 `beta-tools/runtime.mjs`。
- 做：新文件命名不带版本号，这条规则已写进 `AGENTS.md`。
- 不做：已有的带版本号的测试文件和适配层模块（例如 `beta-data/preview-7201-*.mjs`）不改名。
- 不做：`beta-data`、`beta-tools` 目录不改名，暂不分子目录。原因是它们被几百处导入，改名没有功能收益，还会让在途分支全部冲突。

被 103 个文件引用，按「先加新名、分批迁移、最后删旧名」做，每一步单独提交：

- [ ] 第一步：新建 `beta-tools/runtime.mjs` 承载现有内容，`beta-tools/runtime-7106.mjs` 改成只转发新文件的全部导出；挑三份测试跑通
- [ ] 第二步：按目录分批把引用改到新名字（`tests/`、`tests/helpers/`、`beta-tools/`、`script/`、文档各一批），每批改完挑三份涉及的测试跑通
- [ ] 第三步：全仓搜索确认没有对旧名的引用后，删除 `beta-tools/runtime-7106.mjs`
- [ ] 更新 `AGENTS.md`、`docs/dev/add-character.md`、`docs/dev/architecture.md`、`docs/dev/build-and-test.md` 里的文件名
