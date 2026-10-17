# 文档索引

按问题选择下表中的唯一正文；产品范围见[需求基线](requirements.md)，实现概况与使用入口见[项目说明](../README.md)，当前完整EXE及实际验证边界见[验收](reference/acceptance.md#当前源码与本地交付)。

## 开始开发

Windows安装、卸载与盒子内更新的操作方法见[构建与运行](reference/build-and-run.md#windows-安装与整个程序更新)，签名与推广流程见[Release流程](reference/release.md)，历史过程见[安装归档](archive/windows-installation-update-2026-10-15.md)。

macOS服务端运行包的剩余工作从[专门任务](tasks/macos-adaptation.md)接续。

人机统一评估、分层策略升级和捣蛋王从[人机崛起任务](tasks/bot-rise.md)接续，现有行为仍查[人机规格](reference/bot-players.md)。

游戏开发从[模块索引](../games/README.md)和[接入指南](reference/game-development.md)进入；依赖边界与采用理由分别见[架构](reference/architecture.md)和[决策009](decisions/009-independent-game-packages.md)。

用户手写的剩余改动与任务量标记见[手写改动单](tasks/手写改动单.md)。

清理方法见[深度瘦身方法论](reference/deep-slimming-methodology.md)及[维护规则](reference/workspace-maintenance.md)；实际占用、退役记录与未完成来源核实统一见[项目瘦身](reference/project-slimming.md)。

先读 [AGENTS.md](../AGENTS.md)，检查 Git 状态与当前任务相关 diff，再按下表进入唯一正文。已知主题直接定位章节或使用定向查询，不先通读整个 docs。原首版与Windows安装改造均已完成，历史范围从[归档索引](archive/README.md)追溯，未完成需求从[任务索引](tasks/README.md#后续开发接续入口)接续。

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
| 本地交付、GitHub Release流程与更新说明                 | [当前交付及边界](reference/acceptance.md#当前源码与本地交付)；[Release流程](reference/release.md)维护签名、推广和发布。                                                                                                                                                                                      |
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

收尾安全维护、手动清理和无损压缩从[维护规则](reference/workspace-maintenance.md)进入；运行时与容量方法见[构建与运行](reference/build-and-run.md#便携包体积与共享运行时)，实际交付容量见[验收](reference/acceptance.md#当前源码与本地交付)。

跨游戏互动、覆盖播放和身份边界见[平台规格](reference/phase-02-platform-spec.md#跨游戏互动v1052026-10-08)，本地素材来源见[互动清单](../assets/platform/interaction/manifest.json)。

## 开发效率速查

按[开发入口](reference/development.md)选择构建／验证／维护；[提效任务](tasks/development-efficiency.md)记录本轮接续。先用docs:read列标题，按章节读取，不把归档／生成物混入默认查询。
