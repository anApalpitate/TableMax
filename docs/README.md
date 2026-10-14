# 文档索引

当前公开版本为 **v1.0.6**，本地已验证构建为 **1.0.6.10**。Windows 仅交付预装全部正式游戏及玩法的完整 EXE；取消盒子版、独立游戏下载、离线导入与独立游戏更新。当前游戏库来自本 EXE 验证后的预装映射，旧安装索引或缓存目录不能改变新局使用的发行。旧存档按原发行精确恢复，非当前发行只用于继续原局。实现与设备验证边界见[当前验收](reference/acceptance.md#当前源码与本地交付)。

公开版本使用三位 `1.x.x`，本地构建使用四位 `1.x.x.y`；兼容校验依据协议与能力声明。内部模块载荷、冻结快照、签名和逐文件清单继续保留。本轮尚未发布，线上 v1.0.6 与 Pages 内容保持原发布状态；新交付流程见[Release流程](reference/release.md#唯一完整-exe-交付2026-10-12)，版本规则见[版本与构建](reference/release.md#三位公开版本与四位本地构建2026-10-12)。

经典 [阿瓦隆](games/avalon/README.md)采用2012原版、平台5–10人，新局使用用户指定的唯一人数角色表，支持莫德雷德／奥伯伦知识边界、三档本地策略及并发密投；旧配置仅恢复原局。规则来源、秘密投影和实际交付边界分别进入游戏主题及 [验收](reference/acceptance.md)；本次直接视觉要求见 [用户偏好](reference/art-preferences.md#阿瓦隆最新要求2026-10-10)。

完整程序预装宝可梦奇遇、现代艺术、经典德国版电力公司、UNO、阿瓦隆与经典2–4人拉密；宝可梦包含原版与九宫格扩展。真人通过手机或电脑浏览器操作，电脑主机负责服务、管理与公共展示。电脑浏览器玩家首次保持居中竖屏，可切换并记住横屏选择，见[玩家显示与滚动条](reference/visual-design.md#电脑浏览器玩家的手机区域2026-10-08)。加入支持扫码和二维码下“打开网址”，使用根网址并兼容旧玩家路由；实现概况与游玩流程见[项目说明](../README.md)。

## 开始开发

2026-10-15[Windows安装、卸载与盒子内更新](tasks/windows-installation-update.md)已实现安装布局、默认保留卸载、可信检查下载、保存关闭与恢复事务；安装候选 **1.0.6.13** 已封包并通过静态闭包、生产根验签、向导取消及相关隔离专项。真实干净Windows用户的完整安装／升级／卸载与首次启动体积尚待验收，未推广current；已验证便携交付仍为1.0.6.10。运行契约见[构建与运行](reference/build-and-run.md#windows-安装与整个程序更新)，签名与推广门禁见[Release流程](reference/release.md#完整安装器与免费应用签名2026-10-15)。

2026-10-12建立[macOS服务端运行包适配任务](tasks/macos-adaptation.md)：目标与执行草案已建立，导出未开始；沿用仅服务端运行包的范围，现行Windows交付事实保持，Mac权限与验证边界从任务页接续。

游戏规则、策略、网页与资源继续按模块独立维护和增量构建，源码入口见[游戏模块索引](../games/README.md)，公共 SDK、模板及源码接入能力保留。签名模块与历史仓库供内部预装、修复及旧局恢复使用，独立安装与分发产品入口已退役；理由见[决策009](decisions/009-independent-game-packages.md)，接入从[游戏开发指南](reference/game-development.md)开始。所有多玩法入口共用平台 `GameplaySelector`。

用户手写的剩余改动与任务量标记见[手写改动单](tasks/手写改动单.md)。

历史深度瘦身曾实测 **5.897 GB**（含嵌套仓库），后续安全瘦身采样为 **5.973 GB**，均低于当次6GB目标；这些不是当前容量。高收益做法见[深度瘦身方法论](reference/deep-slimming-methodology.md)，原结果见[瘦身记录](reference/project-slimming.md)。2026-10-15新增[分层维护规则](reference/workspace-maintenance.md#容量触发与深度瘦身2026-10-15)：完整逻辑体积超过15GB优先深度瘦身至严格低于6GB，未触发时保留日常10GiB／8GiB分支及全部保护。

先读 [AGENTS.md](../AGENTS.md)，检查 Git 状态与当前任务相关 diff，再按下表进入唯一正文。已知主题直接定位章节或使用定向查询，不先通读整个 docs。原首版第一至六阶段已完成；安装改造是后续独立任务，其阶段2–6仍有系统验收缺口，见 [任务索引](tasks/README.md#后续开发接续入口)。

艺术／UI 设计前须查询 [用户美术偏好](reference/art-preferences.md)，按游戏、端侧、人数和本次用途适当参考其倾向与细节。新游戏先按[设计选用入口](reference/art-preferences.md#新游戏设计选用)选择通用倾向，已有游戏再核对专属差异。该页从用户历史请求提取依据，区分直接偏好、场景要求和设计判断；最新明确反馈优先，不将 agent 回答或既有实现当作用户偏好。

本机美术资源搜索、原图保存与处理从 [TableMaxMaterial 素材工作区](../../TMP/TableMaxMaterial/AGENTS.md)进入，流程见其 [文档索引](../../TMP/TableMaxMaterial/docs/README.md)；该目录不创建 Git，正式导入仍从本项目 [资源入口](../assets/README.md)进入。外部链接仅适用于本机目录布局，不是运行包依赖。

| 当前问题                                               | 最小阅读入口                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 清理、历史退役与项目瘦身                               | [深度瘦身方法论](reference/deep-slimming-methodology.md) → [工作区维护](reference/workspace-maintenance.md#容量触发与深度瘦身2026-10-15)；实际结果见[项目瘦身](reference/project-slimming.md)                                                                                                                |
| 产品范围、验收要求                                     | [需求基线](requirements.md)                                                                                                                                                                                                                                                                                  |
| UI、布局、文字、角标、动效、规则浮层                   | [用户美术偏好](reference/art-preferences.md) → [通用视觉与规则说明](reference/visual-design.md) → 对应游戏主题                                                                                                                                                                                               |
| 身份、座位、手机房主、提交、回退、恢复、计时、显示设置 | [通用平台规格](reference/phase-02-platform-spec.md)                                                                                                                                                                                                                                                          |
| 宝可梦规则／能力／交互／秘密／策略／资源               | [宝可梦奇遇](games/pokemon-encounters/README.md)                                                                                                                                                                                                                                                             |
| 宝可梦九宫格扩展、牌组、能力与研究任务                 | [扩展版设计基线](games/pokemon-encounters/expansion-design.md)；63矢量姿态、策略／存储见[技术收尾](archive/pokemon-encounters-expansion-2026-10-05-to-06.md#一次性技术收尾2026-10-06)，独立配置、30项插画与最终界面见[UI重设计](archive/pokemon-encounters-expansion-2026-10-05-to-06.md#ui重设计2026-10-06) |
| 现代艺术规则／拍卖／行情／秘密／策略／资源             | [现代艺术](games/modern-art/README.md)                                                                                                                                                                                                                                                                       |
| 电力公司规则／经典地图／经济／秘密／策略／资源         | [电力公司](games/power-grid/README.md)；空间数据与展示查 [地图](games/power-grid/map.md)                                                                                                                                                                                                                     |
| 电脑玩家配置、输入权限与调度                           | [通用人机规格](reference/bot-players.md) → 对应游戏独立人机页                                                                                                                                                                                                                                                |
| 宝可梦扩展版开发阶段与接续                             | [扩展版开发阶段](tasks/pokemon-encounters-expansion.md)，实现、同包验证及真人待测项                                                                                                                                                                                                                          |
| 代码依赖、进程、契约与适度封装                         | [工程结构](reference/architecture.md)                                                                                                                                                                                                                                                                        |
| 构建、测试、运行、便携、清理、压缩                     | [开发环境](reference/development.md)                                                                                                                                                                                                                                                                         |
| 本地交付、GitHub Release流程与更新说明                 | [Release流程与发布约定](reference/release.md)：构建验收、EXE与源码附件、提交标签、发布文案和收尾。                                                                                                                                                                                                           |
| 文件应放哪里、哪些是产物                               | [目录职责](reference/project-structure.md)                                                                                                                                                                                                                                                                   |
| 新游戏注册、策略替换与模板                             | [游戏开发指南](reference/game-development.md)                                                                                                                                                                                                                                                                |
| 当前交付包、模拟设备边界和最近证据                     | [验收记录](reference/acceptance.md)                                                                                                                                                                                                                                                                          |
| 重要选择的理由                                         | [决策索引](decisions/README.md)                                                                                                                                                                                                                                                                              |

平台交互与通用视觉分别维护行为和表现；玩法、字段和决策只在游戏主题维护。当前六款游戏的规则说明按用户最新授权分别维护，具体图解、素材和验证范围见对应主题；通用采用要求不代表旧页或全部设备已经验收。原文核验、项目约定与实现状态保持区分，查来源从对应游戏的 sources.md 进入。

游戏解耦、独立增量构建和冻结组装已实现，历史运行 ZIP 的实施记录见[归档](archive/completed-tasks-2026-10-10.md#游戏解耦与增量构建打包已实现)。现行交付为唯一完整 EXE，模块边界和验收分别维护在工程结构及开发环境。

## 定向查询

手机延迟、轻量探测、动作确认与恢复水位见[手机同步任务](tasks/mobile-room-sync.md)，本机模拟与真实设备验收分别记录。

先选目录，再检索主题或标题；只在入口未知时扩大范围。默认查询当前规格，不把 archive、日志、截图或生成物混入结果。

```powershell
# 找当前章节；已知文件时只给该文件
rg -n '^#{1,3} |规则|角标|纵向|字号' docs/reference/visual-design.md

# 查某款游戏的规则、交互或策略
rg -n '竞价|秘密|跨轮' docs/games/modern-art games/modern-art

# 当前规范仍不够时，查维护办法或历史来源
rg -n '唯一正文|视觉|锚点|归档' docs/reference/maintenance.md
rg -n '公开竞价|debug' docs/archive/acceptance-2026-10-01-to-04.md
```

按一次任务保留已读章节与结论，资料未变时用 `git diff -- 路径` 和定向 `rg` 增量补读；不重复遍历 docs 或 artifacts。具体查询与迁移维护见 [维护规则](reference/maintenance.md#定向查询与入口维护)。

## 维护与追溯

| 用途                                  | 入口                                                         |
| ------------------------------------- | ------------------------------------------------------------ |
| 当前参考页与游戏主题总览              | [参考索引](reference/README.md)、[游戏索引](games/README.md) |
| 分类、唯一正文、视觉范围与归档维护    | [文档维护规则](reference/maintenance.md)                     |
| 子 agent 职责和派工边界               | [职责索引](subagent/README.md)                               |
| 较早版本、AC 对照、哈希与原始验收结论 | [历史验收](archive/acceptance-2026-10-01-to-04.md)           |
| 阶段、接入过程与旧开发／验证操作      | [归档索引](archive/README.md)                                |
| 所有美术／声音来源、版本与替换        | [资源入口](../assets/README.md)                              |
| 待办、完整交付与候选研究              | [任务索引](tasks/README.md)、[游戏候选](games/candidates.md) |

新增、迁移或归档主题时同步相关索引和目录职责；旧锚点保留短转链。当前验收页只保留最近交付与必要导航，历史原结论保留在归档，不因新版维护倒改。新包与证据分别位于 `artifacts/releases`、`artifacts/maintenance`；后续计划不写成已实现。

收尾安全维护、手动清理和无损压缩均从[开发环境](reference/development.md#清理本地中间物)进入；按预览和保护范围执行，不按 Git 忽略规则批量删除资料。桌面运行时前提及体积门槛见[小体积桌面决策](decisions/008-small-native-desktop.md)：完整 EXE、内部载荷 ZIP 及实际提取内容分别严格小于 120,000,000 字节，工程预警 110,000,000 字节；内部模块预算另行核验。

跨游戏互动、覆盖播放和身份边界见[平台规格](reference/phase-02-platform-spec.md#跨游戏互动v1052026-10-08)，本地素材来源见[互动清单](../assets/platform/interaction/manifest.json)。

## 开发效率速查

按[开发入口](reference/development.md)选择构建／验证／维护；[提效任务](tasks/development-efficiency.md)记录本轮接续。先用docs:read列标题，按章节读取，不把归档／生成物混入默认查询。
