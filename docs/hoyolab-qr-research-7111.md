# HoYoLAB 海外扫码登录专项调研 — 7.1.11

日期：2026-10-17。目录：D:/Documents/ChatGPT/v7.1.11/source。

状态：本轮项目检索与公开源码调研完成；**没有确认完整可用的海外扫码协议，未实现、未验证真实账号登录**。本轮承接用户“先找项目，没有则自行研究”的要求；旧结论见[2026-10-07 调研](hoyolab-research-7110.md)。

## 结论

本轮未找到能够同时证明“海外二维码创建 → 手机扫描确认 → 桌面取得 HoYoLAB 可用凭据”的现成项目。多个仓库把米游社也命名为 hoyolab，另一些项目同时提供国服扫码和海外网页登录；这些都不能作为海外扫码已完成的依据。

已进一步自行追踪官方 SDK、实际登录平台、桌面／移动路由及异步登录模块，未发现海外扫码创建、轮询或确认的调用链。这个结论限于下述公开代码，不证明所有 HoYoPlay、游戏或 HoYoLAB 原生客户端都不存在扫码能力。

已找到可参考的海外官方网页登录及 Cookie 回收实现。它能作为登录便利性的候选方案；它与“HoYoLAB App 扫码确认”是不同进度，本轮没有将其替换为扫码功能或开始实现。

## 1. 已核对的候选项目

以下提交为读取时的公开源码版本，不是本地生成的校验摘要。

| 项目与固定源码 | 实际实现 | 对本任务的判断 |
| --- | --- | --- |
| [genshin.py：client.py](https://github.com/seriaati/genshin.py/blob/a11758e4911d4d2e906290b4db013c27d023428c/genshin/client/components/auth/client.py#L288)、[routes.py](https://github.com/seriaati/genshin.py/blob/a11758e4911d4d2e906290b4db013c27d023428c/genshin/client/routes.py#L285) | login_with_qrcode 明确限定 CHINESE；二维码端点是 passport-api.miyoushe.com/account/ma-cn-passport/web | 有完整国服扫码，没有在这条链路实现海外扫码 |
| [Hoyo Buddy：login.py](https://github.com/seriaati/hoyo-buddy/blob/10eba827098ff97bac7040120ded82d16e6ab3cf/hoyo_buddy/api/routers/login.py#L443) | 二维码创建和查询均构造 Region.CHINESE 客户端；同文件的 HoYoLAB 登录走账号密码 App 流程 | 同时出现 HoYoLAB 与 QR，不代表 HoYoLAB 使用 QR |
| [PizzaHelperUnited：GenerateQRCodeURLAPI.swift](https://github.com/pizza-studio/PizzaHelperUnited/blob/29a063c4d906d9f02954ddf1f422e9a4d087aa59/Packages/PZKit/Sources/PZAccountKit/HoYoAPIs/LoginRelated/QRCodeLoginAPI/GenerateQRCode/GenerateQRCodeURLAPI.swift#L12) | 使用 HYPContainer UA 和 ddxf5dufpuyo，但创建／查询地址仍是 passport-api.mihoyo.com/account/ma-cn-passport/app | “HoYoPlay 风格请求头”不能证明海外扫码。该文件标注 AGPL-3.0-or-later，本轮未复制实现 |
| [Starward：LoginPage.xaml.cs](https://github.com/Scighost/Starward/blob/df8ae07b5ad4c9c6cb70d288488ce8073ce01478/src/Starward/Features/GameRecord/LoginPage.xaml.cs) | 海外打开 www.hoyolab.com/home；完成后用 WebView2 CookieManager.GetCookiesAsync 取登录 Cookie 并查询角色 | 是可参考的海外官方网页登录与凭据回收，不是自建海外二维码协议 |
| [Remembrance：main.rs](https://github.com/tuzibuqiahuluobo/Remembrance/blob/7b400ff5745693b94278e406dfae21b31730a9f6/apps/desktop/src-tauri/src/main.rs#L508) | 按 CN／OS 打开官方页面；complete_web_login 调用 cookies_for_url，再交给 login_with_cookie | README 合并描述多种登录能力；实际 OS 路径也是官方网页容器 |
| [HoYoLabPP：interfaces.ts](https://github.com/MoRanYue/HoYoLabPP/blob/b646f18db4179b14a58fcdad24852b74880dcf8c/src/api/interfaces.ts) | 已定位到的游戏扫码函数请求 hk4e-sdk.mihoyo.com/hk4e_cn/combo/panda/qrcode | 仓库名不能作为海外扫码证据；该扫码函数是国服 |
| [AI1379/mihoyo-mcp](https://github.com/AI1379/mihoyo-mcp) | README 仍把 HoYoLAB 登录列为未接入，OS 扫码端点待验证；已实现扫码供米游社使用 | 不能作为海外扫码成品 |

旧 [UIGF qrcode_hoyolab.md](https://github.com/UIGF-org/mihoyo-api-collect/blob/main/hoyolab/login/qrcode_hoyolab.md) 虽位于 hoyolab 目录，正文写的是国服 ma-cn-passport，未把它当作海外协议。

## 2. 自行研究官方代码所得

### SDK 与实际加载模块

本轮只下载公开 HTML／JavaScript，不执行登录脚本，不发送账号或 Cookie。

- [官方 account SDK](https://webstatic.hoyoverse.com/dora/biz/hoyoverse-account-sdk/main.js) 内版本为 2.56.0；包含 SG／US／EU passport-api 区域路由、密码／第三方登录相关枚举及 CookieTokenAndLToken=6。
- [HoYoLAB 账号组件](https://webstatic.hoyoverse.com/dora/biz/mihoyo-hoyolab-components/init-account-sea/main.js) 调用账号 SDK；[账号首页](https://account.hoyolab.com/) 当前引用 [index.47dc214f.js](https://account.hoyolab.com/index.47dc214f.js)。
- 沿 SDK 的登录平台引用继续读取[桌面 HTML](https://account.hoyoverse.com/login-platform/index.html)和[移动 HTML](https://account.hoyoverse.com/login-platform/mobile.html)，两者引用 151489f2 这组实际资源。核对了[公共 API 模块](https://account.hoyoverse.com/login-platform/chunk-common.151489f2.js)、[桌面路由](https://account.hoyoverse.com/login-platform/web.151489f2.js)、[移动路由](https://account.hoyoverse.com/login-platform/mobile.151489f2.js)及共享依赖。
- 桌面 password-login 路由加载模块 2606，对应[桌面异步登录模块](https://account.hoyoverse.com/login-platform/password-login-web.151489f2.js)；移动端加载模块 9642，对应[移动异步登录模块](https://account.hoyoverse.com/login-platform/password-login-mobile.151489f2.js)。本轮已读取这两个实际模块，没有停留在入口脚本。

上述读取模块中，createQRLogin、queryQRLoginStatus、qrcode、qr_code、QRLogin 均未命中。公共模块可以直接定位到 /account/ma-passport/api 下的 webLoginByPassword、webLoginByEmailCaptcha、webLoginByThirdParty；SDK 可定位到 token/crossLoginStart、crossLogout。由此确认当前可见代码有海外网页登录与跨域登录逻辑，但未提供海外扫码链路。

单独请求 /single-page/index.html 时返回 AccessDenied；没有把这个地址的内容或可能的其他动态能力记为已核对。也没有检查官方原生 App／HoYoPlay 二进制、在线 getConfig 返回或账号登录后的网络请求，因此不能把静态代码未命中扩大为全平台不支持。

### 凭据链不能跳过

[genshin.py 的海外网页登录](https://github.com/seriaati/genshin.py/blob/a11758e4911d4d2e906290b4db013c27d023428c/genshin/client/components/auth/subclients/web.py#L53)可以追踪到 token_type=6、device_id、人机验证结果及响应 Cookie 的实际消费。它是已有海外登录消费者，可以作为后续实现参考；本轮未使用账号调用。

同一库中能找到的 getTokenByGameToken 与 getCookieAccountInfoByGameToken 路由仍是国服地址。现有证据不足以把“可能存在的海外游戏 GameToken”兑换成 HoYoLAB ltoken／cookie_token。官方跨域登录重定向也没有证明存在“手机授权后，独立桌面会话通过 ticket 取回凭据”的契约。不能只换域名、套用国服 app_id、把普通登录网址生成二维码，或把手机登录成功当作桌面已登录。

## 3. 海外扫码仍缺的具体合同

| 环节 | 需要补齐的证据 |
| --- | --- |
| 创建 | 由实际官方海外扫码入口使用的 URL、方法、app_id、设备参数、有效期及票据返回 |
| 手机扫描 | 由哪个 App／哪个入口扫描；识别的是网页链接还是原生扫码协议；确认动作发给哪个服务 |
| 状态查询 | 使用同一票据与设备上下文的轮询请求，以及等待、已扫、确认、取消、过期的实际返回 |
| 凭据回收 | 确认后是 Set-Cookie、SToken、GameToken 还是其他票据；若需兑换，必须有可追溯的海外消费者 |
| 业务消费 | 获得的凭据能用于海外绑定角色与战绩读取，且平台身份能进入当前账号和导入链 |

继续研究扫码时，应先定位一个真实可用的官方海外扫码入口或完整公开消费者，再追踪这一整条合同。本轮没有可靠协议依据，不进行猜测端点探测，也不要求用户提供密码、Cookie 或重新收集账号材料。

## 4. 对当前莫娜的实施建议

1. **扫码仍保留“协议未确认、未实现”。** 本轮检索没有得到可直接接入的项目；不把国服扫码或海外网页登录改名作为完成。
2. **海外登录便利性已有可参考方案。** 可借鉴 Starward／Remembrance 的官方页面容器与原生 Cookie 回收。当前 Windows 是本机服务加浏览器，需落实独立的 WebView2 登录宿主及与本机服务的交接；Android 需落实原生登录 WebView 的 Cookie 回收。只打开外部浏览器不代表本机服务获得凭据。此项仅为建议，本轮没有开始实现。
3. **登录与数据读取共用明确的平台身份。** 当前 server/mys.mjs 的 MysClient、server/vendor/twicedrop/mihoyo-api.mjs 及 src/platform/mys-mobile.mjs 仍是国服调用链；getRoles 固定 hk4e_cn 和 cn_gf01／cn_qd01。src/platform/native.mjs 只允许现有四个国服域名。以后接海外登录还需同步账号平台、官方域名、海外角色路由及共享装备转换，不能仅改登录按钮；详见旧调研的数据合同。
4. 现有二维码 URL 检查及 Android 域名规则不在本轮删除。后续只能依据选定协议补充实际需要的官方域名，不能删掉检查冒充适配。界面文案与额外校验继续遵守 AGENTS.md 的用户同意约定。

## 5. 本轮范围与交付

本轮为公开源码调研，核对范围为：候选登录项目、项目中实际扫码地区、官方 SDK／账号页、桌面与移动登录异步模块、莫娜现有接入边界。没有运行功能测试或历史回归，没有创建登录票据、调用扫码／认证接口或进行真实账号验证。

只新增本调研并更新当前项目 AGENTS.md。未读取用户账号库、Cookie、UID、浏览器存储、仓库、预设或导出；未修改业务代码、README、版本及启动器，未构建或发布。公开上游脚本仅在本机临时目录读取，未整份复制进源码。
