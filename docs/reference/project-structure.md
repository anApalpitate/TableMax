# 目录职责

本页说明当前文件归属与材料边界；运行命令只在 [开发环境](development.md) 维护，代码依赖与封装只在 [工程结构](architecture.md) 维护。

## 已创建结构

| 路径                                                                           | 职责与允许内容                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`、`README.md`                                                       | Agent 工作入口／项目现状、游玩流程及导航；详细正文进入对应主题                                            |
| 根目录 package／workspace／lockfile、`.node-version`、`global.json` 与检查配置 | 固定工作区、工具链、安装策略、类型／静态／格式检查                                                        |
| `TableMax.code-workspace`、`.gitignore`                                        | 本项目编辑器设置与 Git 忽略；文件树、搜索和监听各自维护                                                   |
| `scripts/`                                                                     | 桌面运行时准备、构建／启动、便携打包、原型与真实跨层验证、资源派生及本地维护工具                          |
| `scripts/fixtures/`                                                            | 验证专用合法状态／存档、进程故障与测量入口；不进入正式包或生产调试 API                                    |
| `Clean-Releases.ps1`、`Clean-Intermediates.ps1`、`Maintain-Project.ps1`        | 手动分类清理及空闲边界容量维护入口；共用 `scripts/cleanup-local.ps1` 保护                                 |
| `Compress-Workspace.ps1`                                                       | NTFS 透明压缩与实际分配审计入口；实现及隔离回归在 `scripts/`                                              |
| `apps/desktop/native/`                                                         | C# WinForms／net48／x64 外壳：双窗口、WebView2 桥接、显示／声音、私有服务管道、进程与单实例保障及锁定依赖 |
| `apps/desktop/src/`                                                            | 网页使用的桌面显示／声音 TypeScript 契约及独立控制逻辑回归；不启动正式窗口或服务                          |
| `apps/server/`                                                                 | HTTP／Socket.IO、构建后网页、二维码、SQLite 存档仓储、独立 bot Worker 与游戏注册／加载                    |
| `apps/web/`                                                                    | 单一 React 工程；盒子与独立游戏页、会话／导航／通用控件，另保留隔离原型                                   |
| `apps/web/src/session/`、`screens/`、`components/`                             | 权威同步与可靠提交、平台页面和通用控件；具体牌桌留在游戏 UI                                               |
| `apps/web/src/game-clients/`                                                   | 按游戏 ID 加载的适配器、加载失败重试及介绍；组合平台会话与游戏 UI                                         |
| `packages/protocol/`                                                           | 通信与桌面／服务消息的类型和运行时校验                                                                    |
| `packages/game-sdk/`                                                           | 游戏、策略和生命周期纯类型契约                                                                            |
| `packages/platform-core/`                                                      | 房间与授权、游戏切换、串行动作／去重、随机／checkpoint／回退恢复、bot 调度与存档校验                      |
| `games/<id>/`                                                                  | 各游戏独立规则、计分、投影、数据、bot、UI、保存表现及测试；不跨游戏导入                                   |
| `games/template/`                                                              | 可运行内部验证游戏，用于切换、容量与平台／策略兼容测试，不在正式目录展示                                  |
| `assets/`、`assets/games/<id>/`、`assets/platform/`                            | 全部运行／原型美术和声音、游戏独立资源、平台头像／图标等，以及各自来源／版本清单                          |
| `docs/requirements/`                                                           | 需求基线及用户确认的增补，区分要求、现状和规划                                                            |
| `docs/reference/`                                                              | 当前平台、工程、视觉、开发／维护知识与最近验收；用户美术偏好单独维护                                      |
| `docs/games/<id>/`                                                             | 各游戏来源、采用规则、数据、权限／决策、交互、资源、人机与验证场景                                        |
| `docs/game-development/`                                                       | 新游戏注册、模板、策略替换及恢复契约                                                                      |
| `docs/decisions/`                                                              | 已采用的重要选择、理由与后果                                                                              |
| `docs/tasks/`                                                                  | 阶段总览、进行中任务与已确认待办；已完成阶段链接归档                                                      |
| `docs/subagent/`                                                               | 长期角色职责、派工输入、文件边界与交接标准；不保存会话实例或素材                                          |
| `docs/archive/`                                                                | 已完成任务及历史过程／验收／开发记录；不作为当前实现或命令依据                                            |
| `build/native/`、`build/native-obj/`、`build/desktop/`                         | 可再生编译与完整运行目录；规则／策略模块和前端分块随本地包收集，不手改生成物                              |
| `artifacts/releases/`、`artifacts/maintenance/`、`artifacts/phase-*/`          | 最终交付、维护及阶段证据／原始资料；材料是否可再生分别判断                                                |
| `tmp/`                                                                         | 隔离验证数据、解压副本及实验中间物；长期资料不能只留在临时目录                                            |

## 已采用与计划结构

三款正式游戏分别使用 `games/pokemon-encounters/`、`games/modern-art/` 和 `games/power-grid/`，资源与规格使用同名命名空间。各游戏的 data／rules／bot／ui／types 按实际职责组织，布局 CSS 限定自身根节点；共享平台只按通用契约组装，盒子缩略图由 `apps/web/src/assets/game-covers.ts` 提供。服务与 Worker 注册入口分别加载独立规则和策略，网页适配器加载对应 UI。

跨游戏身份、座位、手机房主、回退／恢复与显示行为见 [平台规格](phase-02-platform-spec.md)，共性表现见 [通用视觉](visual-design.md)，工程依赖见 [工程结构](architecture.md)。候选研究集中在 [游戏候选](../games/candidates.md)，研究记录不代表已创建游戏规格或实现。

`packages/ui/` 仅在实际组件复用需要时建立，目前不预铺空包。新增目录须有明确职责，不预铺未来插件、多房间或后续游戏层级；确需跟踪空目录时使用 `.gitkeep` 或有实际用途的说明文件。

## 材料与产物边界

长期需求、规则规格、来源清单和必要资源进入对应主题；本地实验和可再生中间物可进入 `tmp/`、`build/`，不作为长期资料入口。运行数据默认在当前用户 `LOCALAPPDATA/TableMax/`，测试覆盖为隔离目录；正式存档含秘密，不能公开或纳入程序包。

`artifacts/` 同时包含必须保留的原始资料／文字验收记录、可退役的历史运行截图和可再生的构建／解压副本，不能按上级目录或 Git 忽略规则一起删除。阶段、旧版本、Electron 与 WebView2 证据保留原归属；当前证据及哈希从 [验收记录](acceptance.md) 查询，历史开发方法与路径从 [开发归档](../archive/development-2026-10-01-to-04.md) 查询。

| 材料                                                        | 归属与保护                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 最终 ZIP、逐文件清单与独立打包目录                          | `artifacts/releases/`；当前已验证 ZIP 保留，旧程序只走 [安全清理入口](development.md#清理本地中间物)           |
| 当前截图／历史 JSON、失败及返修文字记录、历史包核验                  | 对应 `artifacts/phase-*/` 或 `artifacts/maintenance/`；保留实际版本、构建及运行时边界                          |
| 规则研究响应、PDF、用户原始截图、转录及哈希                 | 对应游戏研究证据目录；不是运行资源，也不因研究完成丢弃，采用依据见对应 sources.md                              |
| imagegen 原图、未采用候选、透明度／尺寸／哈希检查、前后对比 | 对应素材证据目录与资源清单；已导入运行资源和原始输入分别维护                                                   |
| 原型构建／走查／研究                                        | `artifacts/phase-02/prototype/` 为可再生构建，`verification/` 为走查证据，`research/` 为原始资料；不能互相覆盖 |
| 本地临时数据与便携解压                                      | `tmp/<用途>-<六位随机后缀>` 等脚本专属目录；确认相关进程结束并通过保护检查后才清理                             |

宝可梦原始中文截图与转录保留于 `artifacts/phase-02/research/chinese-reference/s14/`，叠图数量由 S17 核对为 56；完整采用表在 `docs/games/pokemon-encounters/cards.json`，原图不直接导入运行时。原型美术重置的原图、检查和前后对比保留于 `artifacts/phase-02/art-reset/`，重置前走查另在 `verification/before-art-reset/`。这些资料的适用边界见 [规则来源](../games/pokemon-encounters/sources.md#规则来源与核验缺口)。

已集中归档的清理历史位于 `artifacts/maintenance/cleanup-history/`：`records/` 保留可读清理报告，`tool-checks/` 保存工具检查，`preserved-history-<日期>.zip` 保留原目录的全部原字节，`index.json` 对应原路径／哈希／归档成员，`operations/` 保存整理操作记录。ZIP 内保留原仓库相对路径，原资料可按索引恢复；不把此目录当作可随意丢弃的缓存。

清理、容量维护和透明压缩的范围、保护及记录路径只在 [开发环境](development.md#清理本地中间物) 维护。忽略不是删除授权，已有资料不自动迁移、重命名或取消跟踪；原始资料与最终产物即使 Git 忽略也保持文件树可见。

## Git 与编辑器策略

源码、文档、必要配置和工作区文件默认跟踪且可见。`.gitignore` 排除依赖、工具缓存、日志、临时／构建目录、`artifacts/`、本地 `.env` 与 `secrets/`；无秘密的 `.env.example` 和 `.env.*.example` 可以跟踪。是否提交资源和资料按实际用途、来源与需要判断，不按扩展名笼统忽略。

工作区分别维护 `files.exclude`、`search.exclude` 与 `files.watcherExclude`：文件树隐藏依赖、缓存、日志及可再生临时／构建目录，`artifacts/` 仅排除搜索和监听。`explorer.excludeGitIgnore: false` 保持 Git 忽略与文件树显示独立，不隐藏全部原始资料、正式资源或最终交付物。

Git 远程 `origin` 为 GitHub 的 `anApalpitate/TableMax`，尚未配置仓库 CI。提交与推送遵循 [维护约定](maintenance.md#更新与归档)，默认仅提交；入口变化同步项目说明、Agent 入口及所属文档索引。

工作区与交付的瘦身依据、历史包退役及执行报告统一维护在 [项目瘦身](project-slimming.md)，不按文件目录名推断资料是否可删除。
