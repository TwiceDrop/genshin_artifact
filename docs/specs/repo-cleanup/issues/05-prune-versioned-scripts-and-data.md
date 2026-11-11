# 05: 清理带版本号的一次性脚本和数据

**What to build:** `beta-tools/` 和 `beta-data/` 里只留下现行入口、仍被读取的数据和仍在产出证据的脚本；`package.json` 的脚本不再按旧版本号命名。

**Blocked by:** None (can start immediately)

**Status:** done

判断依据要两步都做：先搜文件名有没有被引用，再查这个脚本写出的文件（多数在 `.build-target/`）有没有被测试读取。上一轮清理只做了第一步，误删后又恢复了一批脚本。

- [x] `beta-tools/` 里文件名零引用的 17 个脚本逐个核对：`extract-release-*.cjs`、`extract-sandrone-stellar.mjs`、`full-audit-*-7201.mjs`、`generate-expanded-*.cjs`、`linkage-fix-browser-7201.mjs`、`metadata-stellar-support.cjs`、`metadata-strengthened.cjs`、`progress-results-browser-*.mjs`、`progress-scope-7112.mjs`。其中一部分会写 `.build-target/`，有测试读取产物的保留
- [x] `beta-data/` 里零引用的清单和笔记：`release-7.1.05-integrity.json`、`release-7.1.06-validation.json`、`release-validation.json`、`source-preservation.json`、`original-preservation-beta2.json`、`strengthened-source-audit.json`、`limited-71-notes.md`、`strengthened-notes.md`、`moon-reaction-calibration.md`。笔记类移到 `docs/history/`
- [x] `script/finalize-release.ps1` 仍在读 `beta-data/release-7.1.06-integrity.json` 并拿它和当前版本号比对：确认这个发版脚本是否还在用，不用就一起删，在用就把清单改成不带版本号的名字
- [x] `script/build-web-beta-7108.ps1`：确认已被 `build-web-package.ps1` 取代后删除
- [x] `package.json` 的 `test:7106`、`test:7107`、`test:7108`、`test:beta2`、`test:beta3`、`test:limited71`：没有被别处调用的删掉，文档里改成直接写 `node --test <文件>`
- [x] 删除后挑三份读取证据文件的测试和 `npm run test:beta` 各跑一次

## Comments

- 2026-11-11：`beta-tools/` 删了 7 个审计脚本（`full-audit-7201`、`full-audit-browser-7201`、`full-audit-regression-followup-7201`、`linkage-fix-browser-7201`、`progress-results-browser-7112`、`progress-results-browser-7201`、`progress-scope-7112`），它们写出的报告没有测试读取。保留 `full-audit-contracts-7201.mjs`，它写的 `contracts.json` 被 `linkage-fix-7201` 读取。数据生成脚本（`extract-*`、`generate-expanded-*`、`metadata-*`）产出的是已提交的数据，保留，以便重新生成。
- `script/finalize-release.ps1` 要求 `release-7.1.06-integrity.json` 的版本等于当前版本，当前必然报错，已和清单一起删除。`beta-data/` 删了 6 个零引用清单，3 份笔记移到 `docs/history/`。
- 验证：`smoke`、`smoke-beta2`、`smoke-beta3`、`smoke-limited-71` 都因为缺少不提交的私有夹具（`beta-data/skirk-fixture.json`、`mizuki-fixture.json`、`sources-limited-71/`）而失败，与本次删除无关。这意味着 `npm run build:beta-kernel` 在没有这些夹具的机器上必然中途失败，记在任务 07。
