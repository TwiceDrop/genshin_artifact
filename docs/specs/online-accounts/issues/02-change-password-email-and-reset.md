# 02: 服务端支持改密码、改邮箱和忘记密码

**What to build:** 已登录的用户可以修改登录密码和邮箱；忘记密码时用邮箱验证码重设。

改用户名已经有了（`PATCH /v1/me`）。

**Blocked by:** 01

**Status:** done

- [x] 改密码：要求输入旧密码。成功后注销本设备以外的其他会话
- [x] 改邮箱：向新邮箱发验证码，验证通过后更换；新邮箱已被占用时报错
- [x] 忘记密码：向注册邮箱发验证码，验证通过后设新密码，并注销所有会话。对未注册邮箱的响应与已注册邮箱一致，避免借此探测邮箱是否注册
- [x] 以上发码共用现有的发码限流
- [x] 测试覆盖以上流程和对应的错误分支

## Comments
- 2026-11-18：已实现，测试见 `online-service/tests/account-credentials.test.mjs`。
  - 改密码：`POST /v1/me/password`，请求体为 `{currentPassword, newPassword}`。成功后注销本设备以外的会话。旧密码输错按账号限流，每小时 10 次，和注销账号共用这个额度。
  - 改邮箱：先用公开的 `POST /v1/auth/email/request` 向新邮箱发验证码，再调 `POST /v1/me/email`，请求体为 `{challengeId, code}`。新邮箱已被别的账号占用时返回 409 `EMAIL_TAKEN`。
  - 忘记密码：先用同一个发码接口发验证码，再调 `POST /v1/auth/password/reset`，请求体为 `{challengeId, code, newPassword}`。成功后注销所有会话，不会自动登录。邮箱未注册时返回 404 `ACCOUNT_NOT_FOUND`。只有已经拿到验证码的人才能看到这个结果，而发码接口对任何邮箱的回复都一样。
