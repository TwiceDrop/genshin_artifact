# 07: 把依赖本机既有文件的测试分到单独目录

**What to build:** 刚克隆的仓库执行 `tests/` 下的测试时，失败的都是真失败；需要本机预先生成文件才能跑的测试集中在 `tests/evidence/`，发版前单独跑。

**Blocked by:** 05

**Status:** ready-for-agent

开发者已决定：分目录，不提交证据文件，不加自动跳过。

现状：27 个测试文件提到 `.build-target/`，但用法分两种，要先分清：

- **读取预先存在的文件**，新克隆的仓库里必然失败。已确认的有：`character-score-7108`、`score-tie-order-7108`（导入 `.build-target/character-score-20261002/oracle.mjs`）、`direct-reactions-only-7108`（读 `baseline.json`）、`interface-parameters-7108`（读 `default-before.json`）、`linkage-fix-7201`（读 `contracts.json`）。
- **只把报告写到 `.build-target/`**，不依赖既有文件。其中有几个直接 `writeFileSync` 而没有先建目录，目录不存在时也会失败。

待核对：`astra-followup-7108`、`pending-fixes-7108`、`qiqi-stellar-dsl-7108`、`vodyanitsa-stellar-support-7108` 用到 `.build-target/<名称>/worker-probe`，要看这个目录是测试自己构建的还是预先存在的。

- [ ] 在一个没有 `.build-target/` 的干净检出里（例如临时 `git worktree`，装好依赖）逐个跑这 27 个文件，得出真实的失败名单
- [ ] 因为缺少预先存在的文件而失败的，整份移到 `tests/evidence/`，修正其中对 `./helpers/` 等相对路径的导入；一份文件里只有个别用例依赖既有文件的，把那些用例拆到 `tests/evidence/` 下的新文件
- [ ] 因为输出目录不存在而失败的，在写文件前补上建目录，测试留在原位
- [ ] `package.json` 增加 `test:evidence` 脚本，运行 `tests/evidence/*.test.mjs`
- [ ] `docs/dev/build-and-test.md` 更新：说明 `tests/evidence/` 需要哪些 `beta-tools/` 脚本先生成文件；`docs/dev/release-checklist.md` 的构建核对一节加一步跑 `test:evidence`
- [ ] 干净检出里，原名单中留在 `tests/` 的文件全部通过

## Comments

- 2026-11-11（任务 01 时发现）：除了 `.build-target/`，还有 4 个测试读取被 `.gitignore` 排除的私有夹具 `beta-data/skirk-fixture.json` 或 `beta-data/mizuki-fixture.json`：`lunar-integration`、`optimize-7107-regression`、`release-7106`、`unified-kernel`。这两个文件是真实账号数据，按 `AGENTS.md` 不能提交，这些用例同样要分到 `tests/evidence/`，或改用合成夹具。
- `tests/interface-audit-7108.test.mjs` 有用例报 `StellarDamageDetail is not defined`，不是缺文件，是测试本身失效，需要单独排查。
- 2026-11-11（任务 05 时发现）：`beta-tools/` 的冒烟脚本 `smoke`、`smoke-beta2`、`smoke-beta3`、`smoke-limited-71` 也读取私有夹具，而 `beta-tools/build-extension.ps1` 在编译扩展内核后会依次运行它们。处理测试时一并决定这些冒烟脚本放在哪一类。
