# HoYoLAB 手机版流程（2026-10-31）

用户已确认 Windows 官方网页登录、国际服绑定角色及角色同步成功；本轮继续处理 Android，未读取或复制用户截图中的账号、UID、Cookie、库存或角色数据。

## 实现

- 把原内联登录窗口整理为 `android/app/src/main/java/com/mona/artifact/local/HoyolabLoginDialog.java`，`MonaLocalPlugin` 只负责打开窗口、接回结果和生命周期清理。
- 登录页启用 Android WebView 多窗口支持，`WebChromeClient.onCreateWindow` 用新 WebView 和 `WebViewTransport` 承接官方弹窗，保留真实 opener。参考 [Chromium 的 onCreateWindow 合同](https://chromium.googlesource.com/chromium/src/+/HEAD/android_webview/docs/how-does-on-create-window-work.md)。不把安全页导航到原登录页，不注入官方脚本，不跳过验证。
- 弹窗按实际父子关系清理。官方回调可以先新开同级窗口、再关闭旧窗口；旧窗口关闭不连带销毁新同级窗口。子窗口关闭后返回仍存活的页面。
- 返回键优先关闭当前弹窗；主登录页有历史则返回上一页，没有历史则取消。另保留“取消登录／完成登录”；未取得完整凭据时窗口保持打开并显示原因。
- 登录完成关闭窗口并回到应用，结果沿现有本地桥接及加密账号库保存。窗口取消或 Activity 销毁释放所有 WebView，不清除已有 Cookie 或应用存档。安全区和键盘区域复用 `SafeViewport`，页面使用手机 viewport。
- `src/platform/mys-mobile.mjs` 将持久化绑定到发起请求的客户端。切换账号后，旧角色查询晚返回不能保存为当前账号；旧请求的过期错误不能误标新账号。原国服、国际服账号键和加密存储格式保持。

## 针对性验证

仅执行相关五条测试：

1. Node：原手机账号保存／失败保留／取消／显式删除。
2. Node：海外登录窗口晚返回，在切换到国服账号后被忽略；正常确认可保存同 ID 的国际服账号。
3. Node：角色查询晚返回或过期错误，不写入／误标已经切换的新账号。
4. Android 真 WebView：合成 `window.open` 的子窗口确有 opener；官方形状的 postMessage 回调抵达原页；旧弹窗关闭保留新同级窗口；返回及取消释放窗口。
5. Android 真 WebView：无凭据时点击“完成登录”不会假成功，返回只触发一次取消。

Node 3/3、Android instrumentation 2/2 通过。Android 测试只在本轮新建的 `MonaHoyo7202Synthetic` AVD 执行，未启动、清空或覆盖旧模拟器。未使用真实账号，也没有访问官方登录接口作为测试数据。官方手机实号登录与同步仍交用户验证。

手机新 UI 网页、Android debug APK 构建完成。核对 APK 包名 `com.mona.artifact.local.mobiletest.debug`、版本 `7.2.02/70202`，签名验证通过，包内首页及四个入口脚本逐字节对应本轮 `dist-mobile`，原生登录类存在。未生成正式签名发布包。

失败证据保留：首次后台模拟器启动日志路径错误（未启动），修正路径后启动；首次 Gradle 测试属性在 PowerShell 下被拆分，修正参数引用后运行。未修改业务规则或放宽断言制造通过。

## 交付

新 UI 独立调试包（约 39.5 MB）：

`D:/Documents/ChatGPT/v7.2.02/test-builds/hoyolab-mobile-20261031/genshin_artifact_V7.2.02_hoyolab_mobiletest_debug.apk`

此包与正式版使用不同应用 ID，安装后显示“莫娜占卜铺 · 新UI测试”。打开 UID 数据 → 使用 HoYoLAB 登录 → 在官方页面登录／完成安全验证 → 点击底部“完成登录” → 选择国际服角色并同步。

测试日志、原生 XML 报告、编译和 APK 核对记录：`.build-target/hoyolab-mobile-20261031/`。未修改 README、版本声明、原 WASM、旧发布包或 56727／4187／61090 服务；未提交、推送或发布。用户提供截图中的未识别角色不属于本轮手机登录修复，仍保留原始记录。
