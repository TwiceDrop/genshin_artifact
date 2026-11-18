# 05: 服务端为账号增加头像字段

**What to build:** 账号上保存所选的角色头像，存角色名一类的短字段；`/v1/me` 返回该字段，`PATCH /v1/me` 可以修改。不做图片上传。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 迁移：`users` 增加头像字段，可为空
- [x] `PATCH /v1/me` 接受头像，并校验长度和字符范围；改用户名的现有行为不变
- [x] 测试：设置、清空、非法值被拒

## Comments
- 2026-11-18：已实现。
  - 迁移：`008_avatars.sql`。
  - 头像存角色英文键名，即 `src/assets/_gen_character.js` 里的键，例如 `Mona`。服务端只校验格式（大写字母开头，只含字母和数字，最长 40 个字符），传 `null` 表示清除。
  - `PATCH /v1/me` 可以改用户名、头像，或两项一起改。传其他字段或者什么都不传都返回 400；原来的 `setUsername` 改名为 `updateMe`。
  - 所有返回 `user` 的接口都带上 `avatar` 字段：登录、注册、`/v1/me`、改邮箱。
  - 测试见 `online-service/tests/avatar.test.mjs`。
