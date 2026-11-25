# 07: 代码审查收尾修复

**What to build:** 修复 01～05 代码审查中发现的 2 处实现细节和工作区遗留文件，并补齐对应单测。

**Blocked by:** 01, 02, 03, 04, 05

**Status:** done

规格见 `docs/specs/onboarding/spec.md`。

## 任务清单

- [x] `src/onboarding/state.mjs`：`markWelcomeDismissed(storage)` 在写入 `mona.onboarding.v1` 后，同时向同一 `storage`（默认 `globalThis.localStorage`）写入 `FIRST_USE_KEY`（`mona.firstUseDone = 'true'`）；若写入 `FIRST_USE_KEY` 失败，记日志但不影响返回值和会话状态
- [x] `src/onboarding/controller.mjs`：`refreshRect()` 开头增加 `if (!activeStep.value) return` 守卫，避免退出引导边缘时序下访问 `undefined`
- [x] `tests/onboarding.test.mjs`：补充测试，断言 `markWelcomeDismissed` 会同时写入 `mona.onboarding.v1` 和 `mona.firstUseDone = 'true'`，且写入 `FIRST_USE_KEY` 抛错时不阻塞
- [x] 清理与提交工作区：
  - 还原 `src/components.d.ts` 中本次构建自动产生的无关改动（`CalcErrorDialog`）
  - 将 `docs/specs/onboarding/spec.md`、`docs/specs/onboarding/issues/06-build-and-acceptance.md` 与本任务文件 `07-review-fixes.md`（完成后置 `Status: done`）一并纳入本地提交
- [x] 验证：运行 `node --test tests/onboarding.test.mjs tests/first-use.test.mjs` 与 `npm run build:local`（构建后若 `src/components.d.ts` 再次产生无关改动，提交前还原）

## Comments

关闭欢迎卡先保存 v1 进度，再向同一存储写入旧标记。旧键写入异常会记录原始错误，保留已保存的进度和返回值。总规格的旧键说明已同步更新。
退出引导后的延迟刷新会在访问锚点前返回。已还原 CalcErrorDialog 的自动生成声明，构建后再次核对该文件无差异。
验证：node --test tests/onboarding.test.mjs tests/first-use.test.mjs 共 13 项通过，包括新旧键双写和旧键单独写入失败。npm run build:local 成功，构建报告 15 条警告，涉及 CSS 顺序与资源体积。06 保持 ready-for-human，桌面和手机浏览器交互待人工验收。
