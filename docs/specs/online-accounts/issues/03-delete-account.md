# 03: 服务端支持注销账号

**What to build:** 用户可以注销账号，服务端删除账号及其全部数据：会话、云端档案和历史、Cookie 密文、使用统计中与账号关联的部分。

各表对 `users` 已设 `ON DELETE CASCADE`，实现时逐表核对一遍，确认没有遗漏。

**Blocked by:** 01

**Status:** done

- [x] 注销接口：要求重新验证身份，输入密码或邮箱验证码，二选一
- [x] 删除后，这个账号的所有会话立即失效
- [x] 核对所有引用 `users` 的表都会级联删除；如有不级联的表，先报告开发者，再决定怎么处理
- [x] 测试：注销后旧会话访问返回 401，相关数据行清空

## Comments
- 2026-11-18：已实现，测试见 `online-service/tests/delete-account.test.mjs`。
  - 接口：`DELETE /v1/me`，请求体为 `{password}`，或者 `{challengeId, code}`（验证码必须是发到本人邮箱的）。
  - 核对了所有引用 `users` 的表，都设了 `ON DELETE CASCADE`：`sessions`、`profiles`（及其 `profile_revisions`、`profile_history`）、`cookie_vaults`。
  - 使用统计是匿名的，不关联账号，所以不需要删。按用户计数的限流行会由 maintenance 按时间清掉。
