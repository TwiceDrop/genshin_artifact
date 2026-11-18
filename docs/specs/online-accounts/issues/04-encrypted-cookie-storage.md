# 04: 服务端改为只存加密后的 Cookie

**What to build:** 服务端为每个游戏账号保存客户端加密后的 Cookie：密文、盐和派生参数，并提供上传、读取、删除接口。服务端不再持有可解密的 Cookie，也不再定时拉取游戏数据。

现状：`/v1/game-accounts` 接收明文 Cookie，用 `vault_key` 加密保存；worker（`online-service/src/worker.mjs`）定时用它拉取角色快照。规格已定改为端到端加密，见 `spec.md` 已定结论 1。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

只做服务端；客户端的加密、页面、本机服务和 Android 转发归任务 08。

- [x] 列出影响清单，开发者确认（2026-11-18，见下方 Comments）
- [ ] 迁移 `007`：新增密文表 `cookie_vaults`，按用户 + 平台 + 账号 UID 唯一；删除 `game_accounts`、`sync_jobs`、`game_snapshots`
- [ ] 接口：上传或覆盖、列出（不带密文）、读取、删除，加一个整体替换该用户全部密文的批量接口（改解密密码用，原子）；密文大小设上限；`kdf` 迭代次数不低于 600000
- [ ] 删除 `game-client.mjs`、`accounts.mjs` 的托管和同步部分、`/sync`、`/snapshots`、`PATCH`、`/v1/jobs` 路由、游戏错误映射，以及同步相关配置
- [ ] worker 只保留清理（验证码、会话、限流、使用统计），改名 `maintenance`；同步修改 `compose.yaml`、`.env.example`、`DEPLOY.md`
- [ ] 测试：服务端存取的是不透明数据，不解析内容；用户只能读到自己的数据；`backend.test.mjs` 里旧的托管用例删除，按新接口重写，`helpers.mjs` 去掉假 `gameClient`

## Comments

### 影响清单（2026-11-18，只读会话整理）

- **删除**：
  - `src/game-client.mjs`；
  - `worker.mjs` 的同步任务部分；
  - `accounts.mjs` 的 `queueJob`、`publicJob`、`sync`、`job`、`snapshots`、`setEnabled`，以及 `save` 里的游戏请求；
  - `http.mjs` 的 `/sync`、`/snapshots`、`PATCH`、`/v1/jobs/:id`；
  - `errors.mjs` 的游戏错误映射（删之前先确认没有别处引用）；
  - 配置 `syncIntervalMinutes`、`jobLeaseSeconds`，以及 `compose.yaml`、`.env.example` 里对应的变量；
  - 表 `sync_jobs`、`game_snapshots`、`game_accounts`。
- **改造**：
  - `accounts.mjs` 重写为密文存储；
  - `worker.mjs` 的 `recover()` 还负责清理过期的验证码、会话、限流和使用统计，要保留，改名为 `maintenance`；
  - `http.mjs` 的 `/v1/game-accounts` 换成新接口，新上传接口用自己的大小上限，限流沿用 `bind-user`。
- **保留**：
  - `vault_key` 和 `crypto.mjs` 仍用于验证码和会话密钥，不能删；
  - `server/hoyolab.mjs`、`server/cookie.mjs` 本机导入还在用；
  - `profiles.mjs`、`usage-stats.mjs`、`backup.sh` 不动。
- **客户端部分**（归 08）：
  - `OnlineAccountPage.vue` 的托管界面和轮询；
  - `server/cloud.mjs` 的转发白名单和 `/game-accounts/import-local`；
  - `src/platform/cloud-mobile.mjs`；
  - `tests/cloud-client.test.mjs`、`cloud-gateway.test.mjs`、`cloud-ui.test.mjs` 里的旧路由。

### 开发者确认的结论（2026-11-18）

1. 旧托管表直接删除。在线服务尚未部署，没有真实用户的数据。
2. 加密在页面里用 WebCrypto 做，桌面和 Android 共用一套代码；`src/platform/crypto-browser.mjs` 只是米游社签名用的 md5 替身，不能复用。
3. 平台和游戏 UID 明文保存，用于去重；不存昵称。
4. PBKDF2-SHA256 迭代 600000 次；服务端校验 `kdf` 的迭代次数不低于此值。
5. 每个用户一个解密密码，所有游戏账号共用；改密码时用批量接口原子替换该用户的全部密文。
6. worker 改名为 `maintenance`，`compose.yaml` 和 `DEPLOY.md` 的命令一起改。
7. `DEPLOY.md` 注明：升级会删除旧的托管数据，用户需要重新上传 Cookie。
8. 04 只做服务端，客户端归 08。迁移编号用 `007`（`006` 已被任务 01 占用）。

接口草案：
- `PUT /v1/cookie-vaults/:platform/:accountUid`，body 为 `{ciphertext, salt, kdf, version}`；
- `GET /v1/cookie-vaults`（列表）；
- `GET /v1/cookie-vaults/:platform/:accountUid`；
- `DELETE /v1/cookie-vaults/:platform/:accountUid`；
- 批量替换接口。

建议密文上限 8 KB、body 上限 16 KB，实现时用合成的长 Cookie 量一下再定。
