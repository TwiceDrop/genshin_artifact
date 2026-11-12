# 01: 功能登记模块

**What to build:** 使用统计的功能 ID 只在一个登记模块里定义一份。客户端、在线服务和统计页面以后都从它读取功能 ID、类别和中文名称；新增一条页面路由却没登记时，测试会失败。

**Blocked by:** None (can start immediately)

**Status:** done

规格见 `docs/specs/usage-stats/spec.md` 的「功能清单」。

- [x] 新建功能登记模块，每项包含功能 ID、类别（入口访问或关键动作）、中文名称；入口访问的项写对应的路由路径
- [x] 登记规格里的 12 个入口访问和 14 个关键动作（切换外观、切换语言各算一项）
- [x] 模块不依赖 Vue、浏览器 API 或 Node 专有 API，浏览器、Node 测试和在线服务都能直接导入
- [x] 对外提供按功能 ID 查询、按路由路径查功能 ID、列出全部功能三种用法
- [x] 新增一致性测试：路由表里每条非重定向路由都有对应的功能 ID；功能 ID 不重复；入口访问的路由路径都在路由表里
- [x] 一致性测试的写法参照检查包装链的那个测试，读真实的路由表，不另写一份路由清单
- [x] 验证：只跑新增的一致性测试

## Comments

- 2026-11-12：登记模块放在 `server/usage-stats-features.mjs`，沿用 `server/cookie.mjs` 那样由 `src/` 和 `online-service` 共同导入的做法。功能 ID 用 `page.*`、`action.*` 两类前缀，存进服务端后不再改名。
- 别名 `/` 不单独登记：路由钩子用匹配到的路由记录路径（别名取它指向的记录），由任务 04 处理。
- 验证：`tests/usage-stats-features.test.mjs` 4 项通过；临时加一条未登记路由，测试报 `route /new-page has no usage feature`，之后已还原路由文件。
