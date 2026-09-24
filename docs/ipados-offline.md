# iPadOS 本地版（7.1.02）

iPadOS 版使用与 7.1.02 网页版、安卓版相同的计算代码、7.1 数据、图片和 WASM 内核。角色、武器、圣遗物、配装、评分、伤害、词条收益、UID 数据导入导出等内容在本机运行；米游社扫码或 Cookie 登录需要联网。应用不依赖电脑上的本地服务。

## 构建

在 GitHub Actions 中运行 **Build iPadOS unsigned IPA**，或推送到 `codex/7.1.02-ipados` 分支。工作流安装 Node.js 22，执行现有回归测试、移动端构建和 Capacitor iOS 同步，随后用 macOS 的 Xcode 26 编译真机 arm64 应用。产物在该次运行的 **Artifacts** 中，包含未签名 IPA、SHA-256 校验文件与构建信息。

未签名 IPA 不能直接安装。下载后需要使用自己的 Apple 开发者证书和描述文件签名，再用 Apple Configurator、Xcode 或兼容的自签工具安装到 iPad。签名时保留应用包名 `com.mona.artifact.local`；后续更新还须保留相同签名，否则系统会将其视为不同应用或无法覆盖安装。

本地使用 Mac 构建时，先运行 `npm ci`、`npm run build:mobile`、`npx cap sync ios`，然后打开 `ios/App/App.xcodeproj`。Capacitor 8 要求 Xcode 26 或更新版本，最低支持 iPadOS 15。

## 数据与平台功能

UID 数据包和圣遗物 JSON 可通过系统“文件”选择器导入，导出时由系统选择保存位置。Cookie 保存在 iPad 的 Keychain 中，不包含在 UID 数据包里；只有用户主动删除账号时才删除相应凭据。清除应用数据或卸载应用可能删除本机保存的角色、装备和历史，更新前可先导出 UID 数据包。

YAS/OCR 背包扫描依赖电脑上的扫描程序。在电脑完成扫描后，将 JSON 发到 iPad 导入即可。外部帮助与源码链接以及米游社同步需要网络。7.1.02 已记录的计算范围与限制见[使用说明](../7.1.02使用说明.md)。

工作流验证源码测试、原生编译及打包资源。真实米游社账号登录、iPad 系统文件选择器和自行签名后的安装仍应在目标设备上核对。
