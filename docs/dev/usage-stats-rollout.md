# 启用使用统计的步骤

使用统计的代码已经在源码里（规格见 `docs/specs/usage-stats/`）。2026-11-12 的本地 7.2.04 发布配置已填写上报地址，服务端健康和非法请求拒绝已核对；公开源码中的地址仍为空，按源码默认配置构建不会上报。本文保留从部署服务端到发布启用统计客户端的完整步骤。

顺序不能反过来：先让服务端可用，再发布填了地址的客户端。反过来的话，客户端发送都会失败，玩家看不到任何影响，但统计数据会从中途才开始。

## 1. 准备

- 一台装有 Docker Engine 和 Docker Compose v2 的 Linux 服务器，以及一个指向它的域名。
- 一个支持 SMTP 的事务邮件账号。使用统计本身用不到邮件，但在线服务启动时要求 `SMTP_HOST`、`MAIL_FROM`，缺了不能启动。
- 确认国内网络能访问这台服务器的 443 端口：Windows 端经玩家本机转发，Android 端直接请求，两者都从玩家所在网络发出。

## 2. 生成部署包

在仓库根目录执行（本机的 `python` 是 Windows 商店占位程序，要用 `py`）。zip 会输出到仓库旁边的 `release-online-service-20261107/`，也可以在命令后面加一个目录参数指定位置：

```bash
py online-service/scripts/pack.py
```

部署包里会包含 `server/usage-stats-features.mjs`（功能登记）、`server/usage-stats-characters.mjs`（角色名单）和 `online-service/static/`（统计页面）。以后功能清单或角色名单有变化，服务端也要用新的部署包重新部署，否则新版客户端上报的新功能 ID 或新角色会被整批拒绝。新增角色时先运行 `node beta-tools/usage-stats-characters.mjs` 重新生成名单。

## 3. 部署在线服务

- **首次部署**：按 `online-service/DEPLOY.md` 的"首次部署"操作。初始化脚本会一起生成 `secrets/usage_stats_admin_token`，`chmod 644` 那一行已经包含这个文件。
- **已经部署过**：按 `DEPLOY.md` 的"更新与排查"升级。升级前先重新运行一次初始化脚本，补出 `usage_stats_admin_token`，并设好权限。迁移会自动建好 `usage_stats_days` 和 `usage_stats_firsts` 两张表。

## 4. 验证服务端（不写入数据）

把 `api.example.com` 换成实际域名。

```bash
curl --fail https://api.example.com/healthz
```

```bash
curl -s -X POST https://api.example.com/v1/usage-stats -H 'Content-Type: application/json' -d '{"installId":"00000000-0000-4000-8000-000000000000","platform":"windows","version":"0.0.0","records":[{"feature":"action.not-registered","day":"2000-01-01"}]}'
```

第二条应返回 400，提示"第 1 条记录：功能 ID 未登记"。这说明上报接口和校验都在工作，而且这条请求被整批拒绝，不会写进库。

然后在浏览器打开 `https://api.example.com/admin/stats`，输入服务器上 `secrets/usage_stats_admin_token` 的内容，应该能看到全部功能都是 0 的表格。

## 5. 构建启用统计的客户端

1. 在 `.env.development.yaml` 和 `.env.mobile.yaml` 里，把 `MONA_USAGE_STATS_URL` 填成 `"https://api.example.com"`。只写 https 根地址，不带路径。
2. 按 `docs/dev/release-checklist.md` 构建 Windows 和 Android 成品。
3. 发版前各装一台测试机：
   - **Windows**：打开软件，首次提示里选"知道了"，切换几个页面，然后关闭软件。刷新统计页面，应该多出 1 个 Windows 安装。
   - **Android 真机**：同样操作，统计页面应该多出 1 个 Android 安装。这一步也是 Android 端的真机验收。
   - 在任一端的设置里关掉使用统计，确认之后不再有新的记录。

测试机会被算进统计，只有一两个安装，可以忽略。

## 6. 发布

按发版清单走，并且要开发者明确授权后才推送和发布。发布后的前几天，看一下统计页面的近 7 天人数是否在增长。

## 停用

- **停止新客户端上报**：把两个环境文件里的地址改回空字符串，再发一版。已经安装的旧版本会继续尝试发送。
- **同时停掉接收**：停掉服务端的 `api`，旧版本客户端会发送失败。失败对玩家不可见，只会出现在 Debug 导出里，不影响使用。
- **库里的数据**：只有匿名安装 ID、功能 ID、平台、版本和日期。明细由 worker 在 400 天后自动删除；累计表不会自动删除，确实要清理时由部署者用 SQL 处理。
