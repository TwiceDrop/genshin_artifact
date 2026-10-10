# HoYoLAB 接入调研 — 常规版 7.1.10

日期：2026-10-07。状态：调研完成；未实现 HoYoLAB 登录或数据同步，未进行真实账号验证。仅检查当前常规版源码与公开上游源码／官方静态脚本，没有读取用户 Cookie、账号库、UID、仓库或预设，没有调用创建登录票据、认证、签到、兑换等接口，没有构建或发布。

## 结论

HoYoLAB 海外角色与已穿戴装备的数据接口已有现成开源消费者，数据读取可以参考 genshin.py 并接入当前莫娜转换链路。当前 TwiceDrop 扫码模块及莫娜客户端使用国服通行证接口，不能只替换域名便声称支持海外扫码。

本次没有确认完整可用的“海外二维码创建 → 手机扫描确认 → 可用 Cookie 获取”链路：genshin.py 的扫码方法明确限定米游社；当前官方 HoYoLAB 账号 SDK 与账号页面公开代码未找到 createQRLogin、queryQRLoginStatus 或扫码登录路由。这是已读源码的证据边界，不是断言 HoYoLAB／HoYoPlay 在所有客户端均不支持扫码。

## 1. 当前莫娜实际调用链

- 前端入口：`src/components/import/MiyousheImport.vue`。桌面调用 `/api/mys/*`；Android 调用 `src/platform/mys-mobile.mjs`。
- 桌面：`server/local.mjs` → `server/mys.mjs` 的 `MysClient` → `server/vendor/twicedrop/mihoyo-api.mjs`。
- Android 复用相同 `MysClient`，用 `src/platform/native.mjs` 的 `nativeFetch` 经 CapacitorHttp 请求。因此不能只改桌面端。
- 当前扫码先 POST `passport-api.mihoyo.com/account/ma-cn-passport/app/createQRLogin`，再轮询 `queryQRLoginStatus`；确认后读取 aid／mid／SToken，再请求国服 `getCookieAccountInfoBySToken` 与 `getLTokenBySToken` 获取 Cookie。
- 当前绑定角色请求限定 `game_biz=hk4e_cn`，只保留 `cn_gf01`／`cn_qd01`；角色详情请求使用 `api-takumi-record.mihoyo.com/game_record/app/genshin/api`。
- 来源确认为 [TwiceDrop/mhy-qdcode-to-cookie](https://github.com/TwiceDrop/mhy-qdcode-to-cookie/blob/1813583f97548fb7b9afddead548b13f92d4106a/plugins/mys-qr-login/lib/mihoyo-api.js)，当前提交与本地固定来源一致。不是用户描述中的无连字符仓库地址。

## 2. HoYoLAB 已有登录实现

核对 genshin.py 当前 master 提交 `aad1d287e390cce8acbdd1d3e13e898affb96918`：

- [auth/client.py](https://github.com/seriaati/genshin.py/blob/aad1d287e390cce8acbdd1d3e13e898affb96918/genshin/client/components/auth/client.py#L288) 的 `login_with_qrcode` 限定 `Region.CHINESE`；[routes.py](https://github.com/seriaati/genshin.py/blob/aad1d287e390cce8acbdd1d3e13e898affb96918/genshin/client/routes.py#L285) 的二维码端点也是米游社 `ma-cn-passport/web`，不是海外扫码实现。
- 海外网页登录已有 `os_login_with_password` 与 `_os_web_login`，请求 `sg-public-api.hoyolab.com/account/ma-passport/api/webLoginByPassword`。账号和密码使用上游规定的公钥加密，使用海外 app_id／Origin／Referer／device_id；验证码触发时处理 `x-rpc-aigis`，登录后读取响应 Set-Cookie。见 [web.py](https://github.com/seriaati/genshin.py/blob/aad1d287e390cce8acbdd1d3e13e898affb96918/genshin/client/components/auth/subclients/web.py#L53)、[auth.py](https://github.com/seriaati/genshin.py/blob/aad1d287e390cce8acbdd1d3e13e898affb96918/genshin/utility/auth.py#L41)。
- 海外 App 登录另有 `login_with_app_password`，处理不同验证码版本及新设备邮箱验证，不能当作扫码兑换接口。
- 海外 v2 凭据包含 account_id_v2／account_mid_v2、ltuid_v2／ltmid_v2、ltoken_v2／cookie_token_v2；当前莫娜 `normalizeCookie` 已支持这些字段，但角色查询与请求路由仍是国服，所以“Cookie 格式能解析”不代表“海外数据能同步”。
- [AI1379/mihoyo-mcp 的 qr.py](https://github.com/AI1379/mihoyo-mcp/blob/2a65be79eb2af85a3c3bf4503e2286ee34117f05/src/mihoyo_mcp/auth/qr.py#L48) 也明确仅实现米游社扫码，HoYoLAB 登录仍是后续事项，不能把 README 标题视为海外扫码已完成。
- [UIGF 当前 passport.tsp](https://github.com/UIGF-org/mihoyo-api-sdk/blob/7c3107f95b72e7324af966b2e8989eb8375e5fc7/src/passport.tsp#L5) 明确声明 CN 服务；其二维码接口同样是 `ma-cn-passport/app`。没有以旧收集文档中的 hoyolab 目录名推断为海外协议。

官方页面补充核对：

- [HoYoLAB 官网](https://www.hoyolab.com/home) 当前应用引用 [hoyoverse-account-sdk/main.js](https://webstatic.hoyoverse.com/dora/biz/hoyoverse-account-sdk/main.js) 和 [init-account-sea/main.js](https://webstatic.hoyoverse.com/dora/biz/mihoyo-hoyolab-components/init-account-sea/main.js)。公开 SDK 中包含 SG／US／EU 的 passport-api 区域域名及跨域登录流程。
- [官方账号页](https://account.hoyolab.com/) 当前引用 [index.47dc214f.js](https://account.hoyolab.com/index.47dc214f.js)。读到密码／邮箱／第三方等登录枚举与 TokenTypeCookieTokenAndLToken；未发现 QRLogin／createQRLogin／queryQRLoginStatus 路由。只读取静态代码，没有运行官方登录页面或尝试用户账号。
- genshin.py 已实现的旧海外网页登录地址与官网当前分区 SDK 不是同一个完整实现。以后选择直接协议或官方登录窗口时需核对所选路径的实际返回，不能混合端点和请求头。

## 3. 海外数据读取与国服差异

来源：[genshin.py routes.py](https://github.com/seriaati/genshin.py/blob/aad1d287e390cce8acbdd1d3e13e898affb96918/genshin/client/routes.py#L136)、[原神战绩消费者](https://github.com/seriaati/genshin.py/blob/aad1d287e390cce8acbdd1d3e13e898affb96918/genshin/client/components/chronicle/genshin.py#L78)、[详细角色模型](https://github.com/seriaati/genshin.py/blob/aad1d287e390cce8acbdd1d3e13e898affb96918/genshin/models/genshin/chronicle/characters.py#L191)。

| 项目 | 当前国服 | 海外接入所需 |
| --- | --- | --- |
| 绑定角色 | api-takumi.mihoyo.com | api-os-takumi.mihoyo.com，按海外业务与返回角色筛选 |
| 原神业务 | hk4e_cn | hk4e_global |
| 游戏区域 | cn_gf01／cn_qd01 | os_usa／os_euro／os_asia／os_cht；以绑定接口返回值为准 |
| 战绩前缀 | /game_record/app/genshin/api | sg-public-api.hoyolab.com/event/game_record/genshin/api |
| 角色读取 | character/list → character/detail | 同样 POST 两个端点，参数 role_id／server／character_ids |
| 请求头 | 国服 DS、米游社 UA／Referer、设备 FP | 海外请求头与 DS 规则；不能直接复用国服签名内容和 getFp 流程 |
| Android 网络入口 | 四个国服域名 | 需按选定海外协议补充实际官方域名 |

海外详细角色模型同样包含 base、weapon、skills、relics、selected_properties，圣遗物包含 main_property／sub_property_list／property_type；从结构看，可复用 `src/import/miyoushe.mjs` 和共享入库合并逻辑。此结论是源码结构对应，未用真实海外返回验证。

当前天赋对应依赖本地技能名称，角色／武器／套装也会按名称或图标识别；接入海外请求应明确使用 `zh-cn` 并核对原始返回，不把英文名字直接送入中文天赋匹配。不要重新使用接口数组顺序对应三个主动天赋。

读取范围为账号拥有角色及其已穿戴装备；本轮查到的这些接口不是未装备圣遗物全仓库导出接口，不承诺同步整个背包。

## 4. 最小接入建议与具体未决事项

1. 先在现有客户端增加明确的平台参数与海外路由／请求头，保留当前国服路径；支持已有 HoYoLAB Cookie 时，沿“绑定 UID → 角色列表 → 详情 → 当前共享转换与入库”接通数据读取。登录便利性与数据转换分别验证，无需引入整套 Python 运行时。
2. 账号存储需要平台身份：现有桌面／Android 都仅用数字 account.id 匹配更新，且没有 platform 字段。新增海外账号应区分平台与账号 ID，保留既有国服账号；这属于数据合同需求，不是新增猜测性拦截。
3. `src/platform/native.mjs` 当前只允许四个国服域名，需要随所选海外路由补齐具体域名。海外不能被默认为走当前国服 `prepareRecord()` 和设备 FP。
4. `src/store/pinia/miyoushe.ts` 当前要求快照 source 为 miyoushe，生成预设标题也是米游社；海外快照来源、标题与账号平台需一致，继续复用锁定、装备 ID、UID 分组及穿戴保护消费者。
5. 若要无手填凭据，可进一步研究官方登录窗口接入与凭据返回，或验证已有海外邮箱／密码登录协议；不能仅打开外部浏览器就认定本机服务已获得 Cookie。当前 Windows 是本机服务＋浏览器、Android 是 Capacitor，两端登录凭据回收方式需要分别落实。
6. 扫码仍需补齐具体海外 app_id、创建／轮询端点、扫描应用、确认响应、Cookie 来源／兑换接口。本轮没有可靠依据时不猜域名、appid，不把国服 SToken、海外游戏 GameToken 或网页二维码链接当作已可用的 HoYoLAB Cookie。

本轮不新增业务代码、界面说明、校验、拦截、回退或哈希实现。真实海外扫码与数据导入仍未验证；此状态不影响已经完成的国服功能，不将“没有海外账号实测”列为国服 bug。
