# 04: 服务端改为只存加密后的 Cookie

**What to build:** 服务端为每个游戏账号保存客户端加密后的 Cookie：密文、盐和派生参数，并提供上传、读取、删除接口。服务端不再持有可解密的 Cookie，也不再定时拉取游戏数据。

现状：`/v1/game-accounts` 接收明文 Cookie，用 `vault_key` 加密保存；worker（`online-service/src/worker.mjs`）定时用它拉取角色快照。规格已定改为端到端加密，见 `spec.md` 已定结论 1。

**Blocked by:** None (can start immediately)

**Status:** ready-for-human

动手前先列出受影响的接口、表、worker 和 `DEPLOY.md` 段落，交开发者确认要删什么、留什么。确认后再实现：

- [ ] 列出影响清单，开发者确认
- [ ] 迁移：新增密文存储，按用户 + 平台 + 账号 UID 唯一；按确认结果处理旧的托管表和快照
- [ ] 接口：上传或覆盖密文、列出、读取、删除；密文大小设上限
- [ ] 按确认结果下线 worker 的定时拉取，同步修改 `compose.yaml` 和 `DEPLOY.md`
- [ ] 测试：服务端存取的是不透明数据，不解析内容；用户只能读到自己的数据

## Comments
