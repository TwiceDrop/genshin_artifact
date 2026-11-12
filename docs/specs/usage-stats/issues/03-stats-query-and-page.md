# 03: 统计查询与统计页面

**What to build:** 开发者打开在线服务的 `/admin/stats`，输入一次管理员 token，就能看到每个功能的累计人数、近 7 天人数、近 30 天人数、占近 30 天活跃安装的比例，以及每日活跃安装数的折线，并可以按平台和版本筛选。过期明细每天自动清理，累计人数不受影响。

**Blocked by:** 02

**Status:** done

规格见 `docs/specs/usage-stats/spec.md` 的「在线服务」。

- [x] 查询接口：按平台、版本筛选，返回每个功能的四项数字和每日活跃安装数序列；没有 token 或 token 错误时拒绝
- [x] 管理员 token 作为 Compose secret 提供，初始化脚本在缺失时生成，不打印内容，不覆盖已有文件
- [x] 统计页面由在线服务直接提供：静态页面，显示登记模块里的中文名称；token 只存在当前标签页的 sessionStorage 里；图表库从本地引入，不走外部 CDN；不接入主前端的 Vue 构建
- [x] 后台任务每天删除 400 天前的明细，累计汇总表不受影响
- [x] 部署说明补充新 secret 的位置和统计页面的地址
- [x] 测试用合成的安装 ID 和日期构造数据，手算四项数字作为独立预期值，和接口返回值比较；覆盖 token 拒绝、筛选、过期清理后累计数不变
- [x] 验证：只跑在线服务的相关测试；统计页面在本地起一次服务，用浏览器打开并截图核对，汇报时写清是本地服务加合成数据

## Comments

- 2026-11-12：查询接口 `GET /v1/usage-stats/summary?platform=&version=`，用 `Authorization: Bearer <口令>`。返回当天（UTC）、近 30 天活跃安装数、全部 26 个功能的四项数字、平台和版本列表，以及近 90 天的每日活跃安装。累计人数取自 02 的累计表，按筛选去重计数。
- 口令文件为空时拒绝所有访问，避免空的 Authorization 头被当成正确口令。
- 统计页面是 `online-service/static/` 下的三个文件，只认 `/admin/stats`、`/admin/stats.js`、`/admin/stats.css` 三个路径，CSP 只允许同源。折线图用 SVG 手画，没有引入图表库，所以也不存在本地引入的问题。
- 过期清理放在 worker 每轮的清理里（和现有的会话、验证码清理一样），效果等于每天删除。
- 部署：`init-secrets.mjs` 补生成 `usage_stats_admin_token`，compose 挂载为 secret，Dockerfile、dockerignore 和打包脚本加入 `static/`，`DEPLOY.md` 新增"使用统计"一节。打包脚本和 Docker 构建没有实际运行。
- 验证：在线服务全部 13 项测试通过（含新增的 5 项）。浏览器实测是本机 PGlite 加 40 个合成安装：错误口令被拒绝，正确口令显示表格和折线，刷新后口令保留，平台筛选为 Android 时数字随之变化。实测中发现 `hidden` 被 `display: grid` 覆盖、登录后表单不消失，已修正。
