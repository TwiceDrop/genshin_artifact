# 11: 部署到服务器并验收

**What to build:** 用 `online-service/scripts/pack.py` 打出部署包，按 `online-service/DEPLOY.md` 部署到云服务器，用客户端走通注册、登录、同步和 Cookie 加解密。

**Blocked by:** 01, 02, 03, 04, 05

**Status:** ready-for-human

需要搭档提供服务器、域名和 SMTP 邮件账号。密钥和密码只放在服务器上，不提交，也不出现在对话里。

- [ ] `DEPLOY.md` 与 01–05 的改动一致
- [ ] 部署后 `/healthz` 正常
- [ ] 注册邮件能送达
- [ ] 两台设备验收：A 设备上传加密 Cookie 和档案，B 设备拉下来，输入解密密码后能解开并导入
- [ ] 改登录密码后 Cookie 仍能解开；注销后数据清空

## Comments
