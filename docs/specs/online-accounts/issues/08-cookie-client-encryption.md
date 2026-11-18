# 08: 客户端在本机加密 Cookie 并上传，换设备后解密

**What to build:** 用户自己设定一个解密密码，与登录密码无关。客户端用 WebCrypto 从它派生密钥（PBKDF2，随机盐），用 AES-GCM 加密米游社 Cookie 后上传。新设备拉取后输入解密密码，在本地解密，再走现有的本地米游社导入。

细节见 `spec.md` 已定结论 1。

**Blocked by:** 04

**Status:** done

- [x] 加解密模块独立成文件，接口只有加密、解密、派生密钥；密钥派生的迭代次数写进密文元数据，以后可以调高
- [x] 本机只存派生出的密钥，不存解密密码和明文 Cookie 的副本；存储位置沿用现有 Cookie 的存放方式
- [x] 解密密码输错时明确提示，不清空任何数据
- [x] 修改解密密码：用旧密钥解密、新密钥加密后上传
- [x] 忘记解密密码：提供重新导入 Cookie 并设新密码的入口
- [x] 独立预期值测试：用固定的密码、盐和明文加密后能解开，错误的密码会失败，篡改密文会失败
- [x] 新增界面文案先交开发者确认（占位实现，拟用文案见 Comments，待确认）

## Comments

### 实现说明（2026-11-18）

**加解密**：`src/cloud/cookie-crypto.mjs`，接口只有 `deriveCookieKey`、`encryptCookie`、`decryptCookie`。PBKDF2-SHA256 600000 次、16 字节随机盐，派生 AES-GCM 256 密钥；12 字节随机 IV 拼在密文前，整体 base64url 为 `ciphertext`。上传体为 `{ciphertext, salt, kdf, version: 1}`，迭代次数在 `kdf` 里。明文就是规范化后的 Cookie 字符串；平台和游戏账号 UID 在路径里。测试 `tests/cookie-crypto.test.mjs` 用 `node:crypto` 独立计算预期值（PBKDF2 结果、独立实现加密的密文能解开、本模块的密文能被独立实现解开），并覆盖密码错误、篡改密文、盐已变化三种失败。

**一个用户一把密钥**：所有游戏账号共用一个盐，所以本机只存一把派生密钥 `{key, salt, kdf}`。
- 桌面：存进在线会话的 DPAPI 文件（`cloud-session.dpapi` 的 `online` 记录，字段 `cookieKey`），网关新增本机路由 `cookie-key`（GET/PUT/DELETE），不转发到在线服务。
- Android：存进 `MonaLocal` 的 cloud vault（与会话同一份），`cloud-mobile.mjs` 同样的路由。
- 密钥记录带 `userId`，与当前登录用户不一致时视为没有；退出登录、会话失效（401）、换服务地址时清除。解密密码本身不经过网关。

**明文 Cookie 不出本机**：网关的 `/game-accounts/import-local` 换成本机路由 `local-accounts/cookie`（POST `{id}`），只把已保存账号的 `{platform, accountUid, cookie}` 交给页面，由页面加密后 PUT `/v1/cookie-vaults/:platform/:accountUid`。转发白名单删掉 `game-accounts` 和 `jobs`，加上 `cookie-vaults`；本机服务给整体替换放宽到 512 KB 请求体（与服务端上限一致）。

**页面**（`OnlineAccountPage.vue`）：删掉立即同步、自动同步开关、快照列表和任务轮询。三种状态：
- 云端没有 Cookie、本机没有密钥：设置解密密码（输两次）。
- 云端有 Cookie、本机没有密钥（新设备）：输入解密密码解锁。用第一条密文的盐派生后试解，失败时提示「解密密码不正确」，不改任何数据。旁边是「忘记解密密码」：确认后删除云端全部 Cookie，回到设置解密密码，再重新上传本机 Cookie。
- 已解锁：加密上传本机已保存账号或手动输入的 Cookie；修改解密密码（逐条读取、旧密钥解密、新盐新密钥加密，`PUT /v1/cookie-vaults` 整体替换，409 时显示服务端的「请刷新后重试」，本机密钥不变）。
- 每条云端 Cookie 可「导入本机」（解密后调用现有的本地米游社接口 `accounts` POST，存为本机已保存账号，之后在米游社导入里选它拉角色）或删除。
- 本机密钥的盐与云端不一致（解密密码在别的设备改过）时，作废本机密钥、回到输入解密密码，提示原因。上传前也先读一条云端密文核对盐，避免云端混入两种密钥的密文。
- Cookie 同步开关（09 的 `cookie` 类别）关闭时显示说明、上传按钮不可用，上传前再读一次开关。

**抽出的模块**：`src/platform/mys-api.mjs`。本地米游社接口的调用原先只在 `MiyousheImport.vue` 里，页面导入需要第二处，所以抽出共用，`MiyousheImport.vue` 改为引用它，行为不变。

**验证**（共 5 项）：`node --test` 跑了 `cookie-crypto`、`cloud-ui`、`cloud-client`、`cloud-gateway`（Windows 真实 DPAPI）四个测试文件，全部通过；用 SFC 编译器确认 `MiyousheImport.vue` 能编译。未构建、未在浏览器或真机实测。

### 待开发者确认的界面文案（目前是占位实现）

| 位置 | 拟用文案 |
| --- | --- |
| 区块标题 | 云端 Cookie |
| Cookie 同步关闭时的说明 | Cookie 同步已关闭，不会上传 Cookie |
| 设置解密密码 | 输入框占位：设置解密密码 / 再次输入解密密码；按钮：设置解密密码 |
| 新设备解锁 | 输入框占位：输入解密密码；按钮：解锁 |
| 忘记解密密码 | 按钮：忘记解密密码；确认框：删除云端全部 Cookie，之后重新上传并设置新的解密密码？（删除 / 取消） |
| 上传 | 加密上传所选 Cookie；手动输入 Cookie；加密上传 Cookie |
| 修改解密密码 | 按钮：修改解密密码；输入框占位：新解密密码 / 再次输入新解密密码；按钮：确认修改 |
| 列表 | 空状态：云端暂无 Cookie；每行：米游社 · 账号 UID，上传于 时间；按钮：导入本机、删除；删除确认：删除这条云端 Cookie？ |
| 导入成功 | 已存入本机：米游社 · 账号 UID · 角色昵称 |
| 错误提示 | 解密密码不正确，或云端 Cookie 已损坏；解密密码已在其他设备修改，请重新输入解密密码；Cookie 同步已关闭 |

### 待开发者确认的取舍

- 解密密码没有最低长度要求，只要求两次输入一致。要不要加长度下限？（按规则，新增校验先问。）
- 退出登录时清除本机密钥，重新登录后需要再输一次解密密码。
- 「导入本机」只把 Cookie 存成本机已保存账号，不自动拉取角色；拉取仍在米游社导入里做。

### 遗留（未处理）

- `CloudProfilesPanel.vue` 引用的 `@/cloud/profile-sync` 在当前代码里不存在（09 已记录）。本页读 Cookie 同步开关也引用了它；这个装配文件补上之前，在线账号页无法构建（页面目前没有挂到路由上）。
- 浏览器和 Android 真机上的完整流程（WebCrypto 600000 次迭代的耗时、Android 上 `MonaLocal` 写入）需要实测。

### 开发者确认（2026-11-18）

按推荐定稿：

- 上表的界面文案定稿。
- 新设或修改解密密码至少 8 个字符，和登录密码一致；解锁时不检查长度。规则在 `cookie-crypto.mjs` 的 `checkNewPassphrase`，有测试。
- 退出登录时清除本机密钥，重新登录后要再输一次解密密码。
- 「导入本机」只把 Cookie 存成本机账号，不自动拉取角色。
- `@/cloud/profile-sync` 已补上（`src/cloud/profile-sync.ts`），在线账号页单独构建通过。
