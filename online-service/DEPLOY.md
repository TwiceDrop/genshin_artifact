# 莫娜在线服务 7.2.04 部署包

第一阶段采用邮箱验证码注册／登录、服务端加密托管米游社或 HoYoLAB Cookie、手动与定时拉取、最新角色快照。客户端访问 API，API 和后台任务访问 PostgreSQL；数据库不开放公网端口。计算仍在客户端。接口目前只能拉取角色及其已穿戴圣遗物，不能拉取完整背包。

## 首次部署

需要一台安装 Docker Engine 和 Docker Compose v2 的 Linux 云服务器、指向服务器的域名，以及支持 SMTP 的事务邮件账号。域名的 80、443/TCP 和可选的 443/UDP 用于 Caddy；邮件出站端口以及游戏服务 HTTPS 出站应可用。选择服务器区域时，用实际用户所在地验证邮箱送达和米游社／HoYoLAB 访问。

解压部署包，保留 `online-service` 与 `server` 的相邻位置，然后执行：

```bash
cd mona-online-service-7.2.04/online-service
cp .env.example .env
# 用编辑器填写 .env 中的 SERVICE_DOMAIN、ACME_EMAIL、SMTP_*、MAIL_FROM。
# SERVICE_DOMAIN 只写域名，例如 api.example.com，不带 https:// 或路径。
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:24-bookworm-slim node scripts/init-secrets.mjs
# 用编辑器把 SMTP 密码写入 secrets/smtp_password（只写密码本身）。
chmod 700 secrets
chmod 644 secrets/db_password secrets/database_url secrets/vault_key secrets/smtp_password secrets/usage_stats_admin_token
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail https://api.example.com/healthz
```

初始化脚本只新建缺失文件，不覆盖现有密码或加密密钥，也不打印内容。`secrets/` 目录为 0700；目录内文件允许容器的非 root Node 用户读取，通过目录权限阻止宿主机其他用户读取。不要把该目录设成共享可访问目录。Compose 文件型 secret 实际采用绑定挂载，不会按 YAML 的 uid/gid/mode 重映射宿主权限，因此上面的目录和文件权限需要保留。密钥和密码通过 Compose secrets 挂载，未写进 `.env`、镜像或源码。`vault_key` 为 32 字节随机密钥的 base64，保留原文件以便恢复已托管凭据。

先启动 PostgreSQL，再执行迁移，迁移成功后 API 和 worker 启动；API 健康后启动 Caddy。数据库存入 Docker 命名卷 `mona-online_postgres_data`。Caddy 自动申请和续期 HTTPS 证书，证书状态存入自己的命名卷。未启用请求正文或访问日志；容器运行日志有容量限制。

API 的 `TRUST_PROXY=true` 仅用于本包的单层 Caddy 入口；Caddy 用连接来源地址覆盖 `X-Forwarded-For`，用于邮箱请求限流。不要把 API 的 8080 端口直接开放公网。若增加 CDN 或额外反代，需先重新配置可信代理链，否则所有访问会按 CDN 地址计数。

客户端“在线账号”填写 `https://你的域名`，发送验证码并登录，再选择要托管的游戏账号或输入 Cookie。每个游戏账号可暂停定时拉取、手动拉取、删除托管，并将最新快照导入当前本地账号。默认间隔 360 分钟。删除云托管会删除云端凭据和快照，不清理客户端原库存。

## 配置

| 项目 | 配置位置／意义 |
| --- | --- |
| 域名与证书邮箱 | `.env` 的 `SERVICE_DOMAIN`、`ACME_EMAIL` |
| 邮件服务 | `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`MAIL_FROM`；密码在 `secrets/smtp_password` |
| SMTP TLS | 587 通常使用 `SMTP_SECURE=false`、`SMTP_REQUIRE_TLS=true`；465 通常使用 `SMTP_SECURE=true`；以邮件供应商要求为准 |
| 会话有效期 | `SESSION_TTL_DAYS`，默认 30 天 |
| 验证码 | `OTP_TTL_SECONDS` 默认 600 秒，`OTP_RESEND_SECONDS` 默认 60 秒 |
| 定时拉取 | `SYNC_INTERVAL_MINUTES` 默认 360 分钟；后台持久任务队列去重，任务租约默认 120 秒 |
| CORS | 原生客户端／桌面本地代理不需要填写；仅确实使用浏览器直连时填写精确 Origin，以逗号分隔，不使用通配符 |
| 本机诊断 | API 仅在服务器 `127.0.0.1:18080` 额外监听；`LOCAL_API_PORT` 可改 |
| 数据库连接 | `secrets/database_url`；内置 PostgreSQL 的密码对应 `secrets/db_password` |
| 使用统计页面 | `https://你的域名/admin/stats`，口令是 `secrets/usage_stats_admin_token` 的内容；文件为空时页面拒绝所有访问 |

如仅做本机 HTTP 调试，可在配置好 SMTP 后执行 `docker compose up -d --build db migrate api worker`，访问 `http://127.0.0.1:18080/healthz`。该地址只在服务器本机可用，不作为公网部署地址。

## 使用统计

客户端匿名上报每天用过哪些功能，接口是 `POST /v1/usage-stats`，不需要登录。库里只有匿名安装 ID、功能 ID、平台、版本和日期，不保存 IP；限流计数只在 API 进程内存里，重启后清零。按天的明细保留 400 天，由 worker 自动删除；累计人数另存，不随明细删除。

打开 `https://你的域名/admin/stats`，输入 `secrets/usage_stats_admin_token` 的内容即可查看。口令只保存在当前浏览器标签页。更换口令：改写该文件后执行 `docker compose up -d api`。从旧版本升级时，先重新运行一次初始化脚本补出这个文件，并按上面的命令设好权限。

## 备份与恢复

```bash
bash scripts/backup.sh
```

备份输出到 `backups/*.dump`，权限为当前用户私有；它包含账号邮箱、加密凭据、任务与快照。另行安全保存 `secrets/`、`.env` 和包版本；数据库备份无法替代加密密钥备份。可由服务器定时任务调用该脚本，备份保留期限及异地存储由部署者设置。

恢复操作会替换当前数据库内容。先完成当前数据库备份，确认要使用的备份文件，再停写并执行：

```bash
docker compose stop caddy api worker
docker compose exec -T db pg_restore -U mona -d mona --clean --if-exists --no-owner < backups/要恢复的备份.dump
docker compose run --rm migrate
docker compose up -d api worker caddy
```

恢复到新服务器时，先还原同一份 `secrets/` 和 `.env`，只启动 `db`，再运行上述恢复命令。保留同一 `vault_key`，否则已加密的 Cookie 和会话无法解密。不要在运行中直接替换加密密钥；本版未提供在线密钥轮换工具。不要用 `docker compose down -v` 作为普通更新命令。

## 更新与排查

升级前备份，保留 `secrets/`、`.env` 与 Docker 命名卷。将新部署包解压到独立目录，复制同一份私密配置，沿用 Compose 项目名 `mona-online`。停止旧 API／worker，构建新镜像并执行迁移，然后启动新服务。数据库结构回滚应使用对应版本代码与升级前备份。

```bash
docker compose logs --tail 100 api worker migrate
curl --fail http://127.0.0.1:18080/healthz
```

邮件失败检查 SMTP 授权、发件人域验证和邮件服务日志；验证码不会写入服务日志。游戏 Cookie 失效或触发验证码时，云任务会保留实际错误，暂停相应账号并保留上次成功快照；客户端重新取得有效 Cookie 后再托管，本版不绕过人机验证。云主机真实拉取与邮件送达需部署后实测。

本包未包含云账号、SMTP 密码、加密密钥、真实 Cookie、客户端存档或游戏计算数据，也未创建任何云资源。国内与海外账号共用服务协议，实际网络可达性由部署区域决定。数据库可后续替换为私有托管 PostgreSQL，但需同步修改 `database_url`、网络与 Compose 数据库依赖。

## 构建依据

- [Docker Compose 启动顺序](https://docs.docker.com/compose/how-tos/startup-order/)
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [文件型 secret 的权限行为](https://docs.docker.com/reference/compose-file/services/#secrets)
- [Caddy 自动 HTTPS](https://caddyserver.com/docs/automatic-https)
- [Caddy 反向代理](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
