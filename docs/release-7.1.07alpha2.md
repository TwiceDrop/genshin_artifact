# v7.1.07alpha2 网页测试版

修复用户 alpha1 调试包中记录的 Worker 启动错误：Cannot use import statement outside a module。

## 原因与修复

日志在启动后约34毫秒出现语法错误，未出现 worker-ready 或 optimization-started；计算尚未进入内核。这次失败与候选圣遗物、套装或BUFF无关。

单人优化入口先将 new URL(...) 存为变量，再传给 new Worker(url)，不符合当前 Webpack WorkerPlugin 的静态识别形式，结果将含 import 的源码输出为普通资源，并当作经典线程启动。

恢复 new Worker(new URL(..., import.meta.url))，让打包器处理线程及其模块依赖。保留Debug事件、错误详情和本地导出。本次不改公式或WASM。

## 使用

1. 关闭旧版服务窗口，双击“启动7.1.07alpha2.bat”；需要已安装Node.js（20或更新）。
2. 使用原浏览器访问 http://127.0.0.1:4183/#/calculate ，必要时Ctrl+F5刷新，确认页面标题含7.1.07alpha2。
3. 开启“开始计算”下方的Debug模式，再次计算。若仍报错，在刷新前导出调试包。

Debug记录仅在当前页面内存中保存，不自动上传，具体字段与隐私说明见 docs/release-7.1.07alpha1.md。

## 交付状态

按用户要求仅构建，不执行自动测试、浏览器测试、手动测试或调试包回放。构建成功不等于用户计算流程已经通过验证。保留原有公式和适配限制。

网页版ZIP包含可运行网页、本地服务及启动脚本。完整源码另存source目录。不包含用户上传的调试JSON或账号数据，不发布GitHub。