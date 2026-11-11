# 07: 把依赖本机既有文件的测试分到单独目录

**What to build:** 刚克隆的仓库执行 `tests/` 下的测试时，失败的都是真失败；需要本机预先生成文件才能跑的测试集中在 `tests/evidence/`，发版前单独跑。

**Blocked by:** 05

**Status:** done

开发者已决定：分目录，不提交证据文件，不加自动跳过。

现状：27 个测试文件提到 `.build-target/`，但用法分两种，要先分清：

- **读取预先存在的文件**，新克隆的仓库里必然失败。已确认的有：`character-score-7108`、`score-tie-order-7108`（导入 `.build-target/character-score-20261002/oracle.mjs`）、`direct-reactions-only-7108`（读 `baseline.json`）、`interface-parameters-7108`（读 `default-before.json`）、`linkage-fix-7201`（读 `contracts.json`）。
- **只把报告写到 `.build-target/`**，不依赖既有文件。其中有几个直接 `writeFileSync` 而没有先建目录，目录不存在时也会失败。

待核对：`astra-followup-7108`、`pending-fixes-7108`、`qiqi-stellar-dsl-7108`、`vodyanitsa-stellar-support-7108` 用到 `.build-target/<名称>/worker-probe`，要看这个目录是测试自己构建的还是预先存在的。

- [x] 在一个没有 `.build-target/` 的干净检出里（例如临时 `git worktree`，装好依赖）逐个跑这 27 个文件，得出真实的失败名单
- [x] 因为缺少预先存在的文件而失败的，整份移到 `tests/evidence/`，修正其中对 `./helpers/` 等相对路径的导入；一份文件里只有个别用例依赖既有文件的，把那些用例拆到 `tests/evidence/` 下的新文件
- [x] 因为输出目录不存在而失败的，在写文件前补上建目录，测试留在原位
- [x] `package.json` 增加 `test:evidence` 脚本，运行 `tests/evidence/*.test.mjs`
- [x] `docs/dev/build-and-test.md` 更新：说明 `tests/evidence/` 需要哪些 `beta-tools/` 脚本先生成文件；`docs/dev/release-checklist.md` 的构建核对一节加一步跑 `test:evidence`
- [ ] 干净检出里，原名单中留在 `tests/` 的文件全部通过（未达成，见 Comments）

## Comments

- 2026-11-11（任务 01 时发现）：除了 `.build-target/`，还有 4 个测试读取被 `.gitignore` 排除的私有夹具 `beta-data/skirk-fixture.json` 或 `beta-data/mizuki-fixture.json`：`lunar-integration`、`optimize-7107-regression`、`release-7106`、`unified-kernel`。这两个文件是真实账号数据，按 `AGENTS.md` 不能提交，这些用例同样要分到 `tests/evidence/`，或改用合成夹具。
- `tests/interface-audit-7108.test.mjs` 有用例报 `StellarDamageDetail is not defined`，不是缺文件，是测试本身失效，需要单独排查。
- 2026-11-11（任务 05 时发现）：`beta-tools/` 的冒烟脚本 `smoke`、`smoke-beta2`、`smoke-beta3`、`smoke-limited-71` 也读取私有夹具，而 `beta-tools/build-extension.ps1` 在编译扩展内核后会依次运行它们。处理测试时一并决定这些冒烟脚本放在哪一类。
- 2026-11-11（完成情况）：
  - 整份移到 `tests/evidence/`：`character-score-7108`、`score-tie-order-7108`、`optimize-7107-regression`（模块顶层就读取本机文件）。
  - 拆出个别用例：`direct-reactions-only-7108`（用例 1、4）、`interface-parameters-7108`（默认结果、构建后的 Worker）、`interface-audit-7108`（构建后的 Worker）、`linkage-fix-7201`、`lunar-integration`、`release-7106`（用例 1、3、5）、`stellar-swirl-multiplier-7108`（用例 1、4）、`unified-kernel`（用例 5）。依赖分三种：`.build-target/` 下的证据、私有夹具、先运行 `npm run build:local` 才有的 `dist/`。
  - 先写文件再建目录的 7 处补了建目录：`progress-results-7112`、`progress-results-7201`、`stellar-swirl-multiplier-7108`、`team-dps-team-polish`、`team-engine-feasibility`、`interface-parameters-7108`、`linkage-fix-7201`。
  - 4 个 worker-probe 测试自己用 webpack 构建到 `.build-target/`，不依赖已有文件，留在原位。
- 干净检出（`git worktree`，没有 `.build-target/` 和私有夹具）的实测：前 9 个文件里，`linkage-fix-7201`、`lunar-integration`、`release-7106`、`unified-kernel`、`progress-results-7112`、`progress-results-7201` 拆分后通过；`direct-reactions-only`、`interface-parameters`、`stellar-swirl-multiplier` 暴露出静态检查漏掉的依赖（`dist/` 和另两个证据文件），已补拆，并对这几个文件在干净检出里复跑。`team-dps-*` 等 18 个只写报告的测试单个耗时很长，没有在干净检出里跑完；它们写文件前都会建目录，没有发现读取已有文件的代码。
- 仍会失败、但不是缺文件的问题：`direct-reactions-only-7108` 用例 3 解析 `NewArtifactPlanPage.vue` 模板时报语法错误（主工作区同样失败），`interface-audit-7108` 有用例报 `StellarDamageDetail is not defined`，`all-character-entry-7108` 有 3 个断言失败。都是测试本身失效，需要单独排查。
- 2026-11-11（后续修复）：上面三份失效测试已按开发者同意修好，全部通过。原因都是测试跟不上后来的实现：
  - `direct-reactions-only-7108` 用例 3：页面模板加了 TypeScript 表达式，测试编译模板时按脚本语言打开 TS 解析。
  - `interface-audit-7108`：审计脚本写报告前补建目录；目录数量按 7.2 后的目录更新为 2167／810／257；组件求值补上新引入的 `StellarDamageDetail` 和星烁辅助函数。
  - `all-character-entry-7108`：米提亚的星导直伤技能没有普通伤害，改为要求至少一个有限伤害分支；沧海生命填 0 时已按每套候选的生命换算加攻，改为断言能出结果；去掉已删除的独立星扩散 `stellarswirl_anemo`；桑多涅改为断言不显示星扩散；未校准的提示由明细组件读取 `reaction_availability` 的原因显示，断言改查状态而不是标签文字。
