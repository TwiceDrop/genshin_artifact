Status: ready-for-human

# 在线账号与服务端存储

进度（2026-11-18）：任务 01–05、07–10 已完成（`issues/`）。剩下要人来做的有三项：
- 06 的用户协议和隐私政策草稿待开发者审定；
- 11 部署和实机验收，需要搭档提供服务器、域名和 SMTP；验收前还要先定服务地址怎么填（见下方「下一步」第 2 条）；
- 12 原稿里的界面优化，待搭档口述。

## 给搭档的接手说明

目的：让接手的人不用翻完 12 个任务文件，就知道现在有什么、在哪、怎么验证、下一步做什么。细节以各任务文件的 Comments 为准。代码都在 `ui-redesign` 分支上，还没合进 `main`。

### 下一步，按顺序

1. **部署（任务 11）**：先准备好四样东西：
   - 一台装了 Docker Engine 和 Compose v2 的 Linux 服务器；
   - 指向它的域名；
   - 支持 SMTP 的发信账号；
   - 发信人地址。

   然后按 `online-service/DEPLOY.md` 的「首次部署」操作，部署包用 `python online-service/scripts/pack.py` 打。这一版改过 `Dockerfile` 和打包清单（去掉了米游社客户端文件），镜像还没有实际构建过，第一次部署时要留意构建结果。
2. **先定服务地址怎么填**：目前只有隐藏的在线账号页（`src/pages/OnlineAccountPage/`）能填服务地址，登录页和设置页都不能填。没有地址时，本机服务返回「请先设置服务地址」。验收前要由开发者定一种做法：在构建配置里写入默认服务地址，或者在设置页加一个服务地址的输入框，或者临时打开在线账号页的路由。
3. **实机验收（任务 11）**：服务地址填好后，在电脑和手机上各走一遍：
   - 注册；
   - 密码登录和验证码登录；
   - 改用户名、改头像、改邮箱、改密码；
   - 重设密码；
   - 设解密密码、上传 Cookie、在另一台设备解锁并导入；
   - 同步开关；
   - 首次使用弹窗；
   - 注销账号。

   PBKDF2 跑 60 万次在手机上的耗时也要测。
4. **协议审定（任务 06）**：`public/legal/terms.html`、`privacy.html` 是按实际实现写的草稿，开发者审定后才能对外。
5. **界面优化（任务 12）**：原稿最后四条字迹难认，需要口述后再拆任务。

### 服务端（`online-service/`）

| 模块 | 内容 |
| --- | --- |
| `src/http.mjs` | 全部路由，入口参数在这里交给各模块 |
| `src/auth.mjs` | 验证码、注册、密码登录、重设密码、改密码、改邮箱、注销、用户名和头像、会话、限流 |
| `src/cookie-vaults.mjs` | 客户端加密后的 Cookie 密文存取，服务端不解密 |
| `src/profiles.mjs` | 云档案、修订、历史记录 |
| `src/usage-stats.mjs` | 匿名使用统计和 `/admin/stats` 页面 |
| `src/maintenance.mjs`、`maintenance-main.mjs` | 后台定期清理过期验证码、会话、限流计数和使用统计明细（原 worker，已不再拉取游戏数据） |
| `src/crypto.mjs` | 验证码和会话密钥的加密（`vault_key`）、密码 scrypt 哈希 |
| `migrations/` | `006` 密码，`007` Cookie 密文表（同时删除旧的托管表），`008` 头像 |

接口一览（除前三行外都要登录）：

| 接口 | 作用 |
| --- | --- |
| `POST /v1/auth/email/request` | 发邮箱验证码，注册、登录、改邮箱、重设密码共用 |
| `POST /v1/auth/register`、`POST /v1/auth/password/login`、`POST /v1/auth/password/reset` | 注册、密码登录、重设密码，见任务 01、02 |
| `POST /v1/auth/email/verify` | 验证码登录，邮箱未注册时返回 404 `ACCOUNT_NOT_FOUND`，不再自动建号 |
| `GET`/`PATCH`/`DELETE /v1/me` | 读个人信息、改用户名或头像、注销账号，见任务 03、05 |
| `POST /v1/me/password`、`POST /v1/me/email` | 改密码、改邮箱，见任务 02 |
| `POST /v1/auth/logout`、`GET /v1/sessions`、`DELETE /v1/sessions/:id` | 退出登录、设备会话 |
| `/v1/cookie-vaults[/:platform/:accountUid]` | Cookie 密文的列出、读取、上传、删除、整体替换，见任务 04 |
| `/v1/profiles…` | 云档案、修订、历史，见 `docs/specs/online-sync/spec.md` |
| `POST /v1/usage-stats`、`GET /v1/usage-stats/summary` | 使用统计 |

### 客户端

| 位置 | 内容 |
| --- | --- |
| `src/pages/LoginPage/LoginPage.vue`、`src/platform/login-gate.mjs` | 登录页（密码、验证码、注册、重设密码），以及打开软件时的登录门 |
| `src/pages/SetupPage/SetupPage.vue`、`src/pages/MainPage/SideBar.vue`、`src/cloud/online-user.mjs` | 设置页的账号管理；侧栏底部的头像和用户名；两处共用的登录用户状态 |
| `src/cloud/cookie-crypto.mjs` | Cookie 端到端加密（PBKDF2-SHA256 + AES-GCM），解密密码至少 8 位 |
| `src/cloud/profile-sync.ts`、`profile-sync-core.mjs`、`sync-categories.mjs`、`history-sync.mjs` | 云档案同步，以及按类别的同步开关 |
| `src/components/FirstUseDialog.vue`、`src/platform/first-use.mjs` | 首次使用弹窗 |
| `src/platform/cloud.mjs`、`server/cloud.mjs`、`src/platform/cloud-mobile.mjs` | 页面访问在线服务的入口。桌面经本机服务网关（转发白名单、本机保存会话和 Cookie 密钥），Android 走自己的实现。服务端新增接口时，这三处都要放行 |
| `src/pages/OnlineAccountPage/` | 在线账号页（Cookie 与云档案），路由仍隐藏。开放前要把页内旧的验证码登录区改成跳转到登录页，首次使用弹窗的「从云端账号导入」也要改为指向这里 |

### 验证

- 服务端：`cd online-service`，`npm ci` 后运行 `npm test`。用 PGlite 内存数据库，不需要真实 PostgreSQL；全部是合成数据。
- 客户端相关的测试在仓库根目录跑：`node --test tests/<文件>`，涉及的文件有：
  - `login-routes`、`cloud-gateway`、`cloud-gateway-account`、`cloud-client`、`cloud-ui`、`cloud-profiles-ui`；
  - `cloud-history-sync`、`sync-categories`、`cookie-crypto`、`first-use`（`.test.mjs`）。

  其中网关测试用真实 DPAPI，只在 Windows 上跑。按 `AGENTS.md`，不要跑根目录的全量测试。
- 单独构建某个页面：`npx cross-env ENV_FILE=.env.development.yaml vue-cli-service build --target lib --dest .cache/test/<用途>/ <入口>`，用完删掉产物。

目的：把搭档 2026-11-17 手写的「在线服务架构设计（DropCloud）」整理成文字，和现有 `online-service/` 对照，列出要新做的部分和已定的取舍。搭档说明：纸上列的是服务器要存的东西，这部分由他负责；界面相关的几条一并记下。

原稿是手写照片，个别字是推测的，推测处标了「（？）」，确认后删掉标记。

## 原稿内容

**登录与注册**

- 登录：邮箱或用户名 + 密码；同一 IP 每小时 20 次。
- 注册：邮箱、用户名、邮箱验证码、密码、确认密码。
- 登录、注册即代表同意用户协议和隐私政策。

**账号管理**

- 修改个人信息：更换邮箱、密码、用户名。
- 页面左下角（？）显示头像和用户名；退出登录、注销账号。

**数据同步设置**

1. 米游社 Cookie（原稿注：本地存入、加密解密不经过服务器）
2. MONA-DSL 手改
3. UID 数据
4. 历史记录（？原稿形似「7次记录」）
5. 圣遗物数据
6. 角色设置
7. 多人轴和文件

每类可单独开关；显示上次同步时间、自动同步设置和「立即同步」按钮。

**首次使用弹窗**：使用云端账号导入数据，或通过 UID / 圣遗物文件导入。

**其他优化**（客户端，与服务端无关，原稿字迹难认，需搭档口述）：

1. 面板根据所选对象的原始显示来选择（？）
2. （？）行加某个元素选项
3. （？）
4. BUFF 栏单独下拉（？）

## 与现有服务对照

| 原稿 | 现状 | 要做 |
| --- | --- | --- |
| 邮箱 + 密码登录 | 只有邮箱验证码登录（`/v1/auth/email/request`、`verify`），`users` 表没有密码 | 新增密码字段和密码登录接口 |
| 用户名登录 | 已有用户名，不区分大小写唯一（`005_usernames.sql`，`PATCH /v1/me`） | 登录接口支持用户名查找 |
| IP 每小时 20 次 | 已有：发验证码每 IP 每小时 20 次、每邮箱 10 次；验证每 IP 10 分钟 120 次 | 密码登录另设限流桶 |
| 注册填验证码 + 密码 | 验证码登录时自动建号 | 注册流程改为验证码 + 设密码 |
| 同意协议与隐私政策 | 无 | 两份文本，界面文案由开发者确认 |
| 更换邮箱 / 密码 / 用户名 | 只能改用户名 | 新增改邮箱（新邮箱验证码）、改密码、忘记密码 |
| 退出登录 | 已有（`/v1/auth/logout`、`/v1/sessions`） | — |
| 注销账号 | 无；表上已有级联删除 | 新增注销接口 |
| 米游社 Cookie | 服务端用 `vault_key` 加密托管，worker 定时拉取，不下发给设备 | 改为端到端加密，见已定结论 1 |
| UID、圣遗物、角色、历史、轴 | 云端档案已有（`profiles.mjs`，对应关系见 `docs/specs/online-sync/spec.md`） | — |
| MONA-DSL 手改 | 随预设保存，已在档案 `presets` 里 | 并入角色设置，见已定结论 3 |
| 每类单独开关、同步时间、立即同步 | 档案按整份提交，无分类开关 | 客户端实现，见已定结论 4 |
| 头像 | 无 | 选角色头像，见已定结论 5 |
| 部署 | 部署包已有（`scripts/pack.py`、`DEPLOY.md`、Docker Compose + PostgreSQL + Caddy） | 上服务器实际部署一次 |

## 已定结论

2026-11-18 开发者确认。

1. **米游社 Cookie 端到端加密，用户自定义解密密码。**搭档的设想：本地加密后上传，换设备拉下来后输入密钥在本地解密。
   - 解密密码由用户自己设定，与登录密码无关；只在本机使用，不上传。客户端用它派生加密密钥（PBKDF2，随机盐），用 AES-GCM 加密 Cookie 后上传；服务器只存密文、盐和派生参数，无法解密。
   - 本机不存明文解密密码，只存派生出的密钥。新设备第一次读取云端 Cookie 时输入一次解密密码。
   - 改登录密码、用验证码登录、重置登录密码都不影响云端 Cookie。
   - 修改解密密码：客户端用旧密钥解密、新密钥重新加密后上传。忘记解密密码则云端 Cookie 无法找回，只能重新导入 Cookie 并设新的解密密码。
   - 服务器不能再用 Cookie 定时拉取，拉取改由客户端完成（解密后走现有的本地米游社导入）。现有的服务端托管（`/v1/game-accounts`、worker 定时拉取、`vault_key` 加密的凭据）要由密文存储代替，实现前先列出受影响的接口和迁移，交开发者确认。
2. **密码登录与验证码登录并存。**注册时必须设密码，所以每个账号都有密码；登录可任选其一。忘记密码通过邮箱验证码重设。
3. **MONA-DSL 手改并入「角色设置」，不单列。**手改的 DSL 随预设保存（`src/types/preset.ts` 的 `dslSource`、`useDSL`），已在档案的 `presets` 里，跟着角色设置一起同步，不新增类别，也不改档案校验。
4. **按类别开关由客户端实现，服务端不改。**档案仍按整份提交、字段齐全：
   - 上传时，关闭的类别填入云端最新版本里的原值，云端这一类保持不变；
   - 拉取时，关闭的类别不覆盖本机数据。
   - Cookie 不在档案里，单独开关。
   - 这样不用放宽 `online-sync` 里提到的档案校验。
5. **头像不存图片。**从游戏角色头像中选一个，账号上只存角色名一类的短字段，跨设备显示一致；不做图片上传。

## Comments
