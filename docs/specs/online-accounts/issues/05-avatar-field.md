# 05: 服务端为账号增加头像字段

**What to build:** 账号上保存所选的角色头像，存角色名一类的短字段；`/v1/me` 返回该字段，`PATCH /v1/me` 可以修改。不做图片上传。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 迁移：`users` 增加头像字段，可为空
- [ ] `PATCH /v1/me` 接受头像，并校验长度和字符范围；改用户名的现有行为不变
- [ ] 测试：设置、清空、非法值被拒

## Comments
