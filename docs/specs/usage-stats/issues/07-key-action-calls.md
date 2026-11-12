# 07: 关键动作的记录调用

**What to build:** 规格里的 14 项关键动作在成功的那一刻各记录一次，开发者在统计页面上能看到每项动作有多少人实际执行过，而不只是页面被打开过。

**Blocked by:** 04

**Status:** done

规格见 `docs/specs/usage-stats/spec.md` 的「功能清单」中的关键动作表。

- [x] 每项动作在成功的地方调用一次"记录功能 ID"，失败或取消时不记录
- [x] 单人配装：伤害模式和面板模式跑完都记
- [x] 动态圣遗物评分：跑完时记
- [x] 四人轴计算：评估和搜索跑完都记
- [x] 米游社/HoYoLAB 导入、导入圣遗物文件：导入成功时记
- [x] 导出数据：账号页和圣遗物页的导出都记
- [x] 保存预设、保存圣遗物组：保存成功时记
- [x] 清空已选：点击时记
- [x] 切换外观、切换语言：选择后记
- [x] 检查更新：手动检查时记，自动检查不记；安装更新：开始安装时记
- [x] Debug 导出：配装页和四人轴页的导出都记
- [x] 记录调用不改变任何计算的输入、输出和时序
- [x] 每项的触发位置和核对结果写在本文件的 Comments 里
- [x] 验证：一致性测试检查每个关键动作的功能 ID 至少被调用一处；其余逐项手动核对，汇报时写清哪些在浏览器里点过

## Comments

2026-11-12 触发位置：

| 功能 ID | 位置 | 时机 |
| --- | --- | --- |
| `action.single-optimize` | 配装页，配装任务的结果回调 | 跑完且没有取消；伤害模式和面板模式都记 |
| `action.dynamic-artifact-score` | 动态评分组件 | 拿到结果、显示"计算完成"时 |
| `action.team-dps` | 四人轴页 `run` | 任务正常结束（取消会抛 AbortError，不记） |
| `action.miyoushe-import` | 米游社导入组件 `sync` | 快照保存成功后 |
| `action.artifact-file-import` | 圣遗物页 `importJson` | `importMonaJson` 成功后 |
| `action.data-export` | 圣遗物页导出；米游社导入组件的角色快照导出和 UID 包导出 | 文件保存成功后 |
| `action.preset-save` | 配装页"保存预设"和"存为预设" | 写入预设后 |
| `action.kumi-save` | 配装页"保存为圣遗物组" | 写入后 |
| `action.clear-selected` | 配装页"清空已选"按钮 | 点击 |
| `action.color-mode-change` | 设置页外观 | 选择后 |
| `action.locale-change` | 设置页语言 | 切换完成后 |
| `action.update-check` | 手动检查更新事件 | 触发时；自动检查不记 |
| `action.update-install` | 下载完成、开始安装前 | 开始安装时 |
| `action.debug-export` | 配装页、四人轴页的 Debug 导出 | 导出成功后 |

- 规格里写的"账号页导出"，代码里那个按钮是注释掉的，所以导出数据只接了圣遗物页和米游社导入组件里的三处导出。
- 没有接的入口：米游社导入组件里的"还原 UID 包"（属于导入文件，但它不是圣遗物文件导入），以及圣遗物组页的"新建空组"（只建空组，不算保存）。要不要算进去，由开发者决定。
- 一致性测试增加一条：`src` 里每个关键动作至少被调用一处，而且调用的都是已登记的功能 ID。
- 有两个现有测试会去掉页面脚本里的 import、再注入替身（`auto-update-7109`、`filter-kumi-source-7204`），新增的 `recordUsage` 让它们报"未定义"。已给替身补上 `recordUsage`，并断言调用了对应的功能 ID。
- 验证：
  - `usage-stats-features` 等 4 个文件共 24 项通过，上面两个测试修好后 7 项通过。
  - 另外 6 项失败（`good-import`、`team-dps-page`、`team-dps-personal-task`、`team-mona-manager`、`team3-product`、`team-action-manager`）在改动前的提交 `f156ac3` 上同样失败，原因是这些测试的替身里缺 `onActivated`、`useRoute` 等，和本次无关，没有改。
  - 浏览器里只实测了切换外观这一项（见 06）；其余 13 项是对照代码核对的，没有在浏览器里逐项点过。
- 2026-11-12：开发者交由 agent 决定。新增 `action.uid-data-restore`（还原 UID 数据），UID 包和角色快照文件两种还原成功后都记；"新建空的圣遗物组"只是建一个空组，不计。关键动作变为 15 项。服务端的功能清单随部署包更新，尚未部署，所以没有影响。
