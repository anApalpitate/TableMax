# 目录职责

本页说明当前文件归属与材料边界；运行与构建机制在[开发环境](development.md)，交付及GitHub发布流程在[Release流程](release.md)，代码依赖与封装在[工程结构](architecture.md)维护。

## 已创建结构

扩展`config/cards.json`、`decks.json`、`research.json`分别维护34类角色／摘要、112／144数量和30项研究内容／条件／固定图示；有类型校验及纯函数条件注册表供规则、策略、UI共读，原版配置不变。AI派生图在`assets/games/pokemon-encounters/expansion/research-illustrations/`，原图与生成过程保留在对应维护证据目录。两版共用`ui/CardSkin.tsx`纯展示骨架，扩展排版限定自身根样式，不进入平台会话。

宝可梦模块的 `shared/` 维护共享卡牌、资源身份和纯棋盘拓扑，`variants/original.ts` 保留轻量原版元数据；`expansion/` 独立维护九格规则、状态、研究与计分，其 `bot/`、`web/` 分别维护策略与界面。原版规则与存档仍限定六格，`rules/cards.ts` 保留兼容导出。规则／策略／客户端入口提供版本映射，盒子只加载目录元数据，不加载完整游戏资源。

[宝可梦扩展版设计基线](../games/pokemon-encounters/expansion-design.md) 归游戏文档目录；九格计分、研究、扩展存档与权威版本选择已实现。原版 `cards.json` 和采用规格继续独立维护；正式资源在 `assets/games/pokemon-encounters/expansion/`，来源原件与生成证据在 `artifacts/pokemon-expansion/`。素材完整性与最终验收状态见任务页。

| 路径                                                                           | 职责与允许内容                                                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`、`README.md`                                                       | Agent 工作入口／项目现状、游玩流程及导航；详细正文进入对应主题                                            |
| 根目录 package／workspace／lockfile、`.node-version`、`global.json` 与检查配置 | 固定工作区、工具链、安装策略、类型／静态／格式检查                                                        |
| `TableMax.code-workspace`、`.gitignore`                                        | 本项目编辑器设置与 Git 忽略；文件树、搜索和监听各自维护                                                   |
| `scripts/`                                                                     | 桌面运行时准备、构建／启动、便携打包、原型与真实跨层验证、资源派生及本地维护工具                          |
| `scripts/fixtures/`                                                            | 验证专用合法状态／存档、进程故障与测量入口；不进入正式包或生产调试 API                                    |
| `scripts/lib/save-audit.mjs`                                                   | SQLite v1／v2只读审计解码，共用完整Save重建逻辑；运行JS与类型声明均纳入服务构建输入                       |
| `Clean-Releases.ps1`、`Clean-Intermediates.ps1`、`Maintain-Project.ps1`        | 手动分类清理及空闲边界容量维护入口；共用 `scripts/cleanup-local.ps1` 保护                                 |
| `Compress-Workspace.ps1`                                                       | NTFS 透明压缩与实际分配审计入口；实现及隔离回归在 `scripts/`                                              |
| `apps/desktop/native/`                                                         | C# WinForms／net48／x64 外壳：双窗口、WebView2 桥接、显示／声音、私有服务管道、进程与单实例保障及锁定依赖 |
| `apps/desktop/src/`                                                            | 网页使用的桌面显示／声音 TypeScript 契约及独立控制逻辑回归；不启动正式窗口或服务                          |
| `apps/desktop/release/`                                                        | 完整EXE发布启动器，内置已核验运行ZIP并解压至稳定应用目录；打包、验收和GitHub白名单入口在 `scripts/`       |
| `apps/server/`                                                                 | HTTP／Socket.IO、构建后网页、二维码、SQLite 存档仓储、独立 bot Worker 与游戏注册／加载                    |
| `apps/web/`                                                                    | 平台盒子、会话／导航与网页宿主实现；游戏网页独立构建，另保留隔离原型                                      |
| `apps/web/src/session/`、`screens/`、`components/`                             | 权威同步、可靠提交、换机、盒子和通用控件；PlayerFrame 为电脑浏览器玩家保留同源手机界面，具体牌桌留在游戏 UI |
| `apps/web/src/game-clients/`                                                   | 清单驱动的本地ESM加载与重试；旧Screen仅为源码fixture保留兼容包装                                          |
| `packages/protocol/`                                                           | 通信与桌面／服务消息的类型和运行时校验                                                                    |
| `packages/game-sdk/`                                                           | 游戏、策略和生命周期纯类型契约                                                                            |
| `packages/web-host/`                                                           | 版本化授权网页契约、GameClient与共享控件／React运行时的实际入口                                           |
| `packages/platform-core/`                                                      | 房间与授权、游戏切换、串行动作／去重、随机／checkpoint／回退恢复、bot 调度与存档校验                      |
| `games/<id>/`                                                                  | game-module.json清单、独立rules／bot／web入口、UI、数据和测试；不跨游戏导入                               |
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
| `.cache/build-modules/v1/`、`build/snapshots/`                                 | 内容寻址的成功单元、隔离任务输出和冻结组装清单；按专用缓存保留规则维护                                    |
| `artifacts/releases/`、`artifacts/maintenance/`、`artifacts/phase-*/`          | 最终交付、维护及阶段证据／原始资料；材料是否可再生分别判断                                                |
| `tmp/`                                                                         | 隔离验证数据、解压副本及实验中间物；长期资料不能只留在临时目录                                            |

## 已采用与计划结构

三款正式游戏分别使用 `games/pokemon-encounters/`、`games/modern-art/` 和 `games/power-grid/`，资源与规格使用同名命名空间。各游戏的 data／rules／bot／ui／types 按实际职责组织，布局 CSS 限定自身根节点；共享平台只按通用契约组装，盒子缩略图由 `apps/web/src/assets/game-covers.ts` 提供。服务与 Worker 注册入口分别加载独立规则和策略，网页适配器加载对应 UI。

跨游戏身份、座位、手机房主、回退／恢复与显示行为见 [平台规格](phase-02-platform-spec.md)，共性表现见 [通用视觉](visual-design.md)，工程依赖见 [工程结构](architecture.md)。候选研究集中在 [游戏候选](../games/candidates.md)，研究记录不代表已创建游戏规格或实现。

`packages/ui/` 仅在实际组件复用需要时建立，目前不预铺空包。新增目录须有明确职责，不预铺未来插件、多房间或后续游戏层级；确需跟踪空目录时使用 `.gitkeep` 或有实际用途的说明文件。

## 材料与产物边界

宝可梦扩展版的开发阶段、完成标准与当前接续统一维护在[扩展任务](../tasks/pokemon-encounters-expansion.md)；候选规则仍归游戏目录的[设计草案](../games/pokemon-encounters/expansion-design.md)，不将阶段规划写成已实现玩法。

长期需求、规则规格、来源清单和必要资源进入对应主题；本地实验和可再生中间物可进入 `tmp/`、`build/`，不作为长期资料入口。v1.0.3单EXE旁新建 `TableMax/` 专属目录，配置与数据默认在其中，`TableMax/app` 存放运行资源；ZIP解压版直接使用解压目录。对应根目录内 `TableMax.config.json` 指定数据目录；测试覆盖为隔离目录；正式存档含秘密，不能公开或纳入程序包。

`artifacts/` 同时包含必须保留的原始资料／文字验收记录、可退役的历史运行截图和可再生的构建／解压副本，不能按上级目录或 Git 忽略规则一起删除。阶段、旧版本、Electron 与 WebView2 证据保留原归属；当前证据及哈希从 [验收记录](acceptance.md) 查询，历史开发方法与路径从 [开发归档](../archive/development-2026-10-01-to-04.md) 查询。

| 材料                                                        | 归属与保护                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 最终 ZIP、逐文件清单与独立打包目录                          | `artifacts/releases/`；当前已验证 ZIP 保留，旧程序只走 [安全清理入口](development.md#清理本地中间物)           |
| 当前截图／历史 JSON、失败及返修文字记录、历史包核验         | 对应 `artifacts/phase-*/` 或 `artifacts/maintenance/`；保留实际版本、构建及运行时边界                          |
| 规则研究响应、PDF、用户原始截图、转录及哈希                 | 对应游戏研究证据目录；不是运行资源，也不因研究完成丢弃，采用依据见对应 sources.md                              |
| imagegen 原图、未采用候选、透明度／尺寸／哈希检查、前后对比 | 对应素材证据目录与资源清单；已导入运行资源和原始输入分别维护                                                   |
| 原型构建／走查／研究                                        | `artifacts/phase-02/prototype/` 为可再生构建，`verification/` 为走查证据，`research/` 为原始资料；不能互相覆盖 |
| 本地临时数据与便携解压                                      | `tmp/<用途>-<六位随机后缀>` 等脚本专属目录；确认相关进程结束并通过保护检查后才清理                             |

宝可梦原始中文截图与转录保留于 `artifacts/phase-02/research/chinese-reference/s14/`，叠图数量由 S17 核对为 56；完整采用表在 `docs/games/pokemon-encounters/cards.json`，原图不直接导入运行时。原型美术重置的原图、检查和前后对比保留于 `artifacts/phase-02/art-reset/`，重置前走查另在 `verification/before-art-reset/`。这些资料的适用边界见 [规则来源](../games/pokemon-encounters/sources.md#规则来源与核验缺口)。

已集中归档的清理历史位于 `artifacts/maintenance/cleanup-history/`：`directories/` 原样保存已结束的 `local-cleanup-*` 目录，`records/` 保留既有可读清理报告，`tool-checks/` 保存工具检查，`preserved-history-<日期>.zip` 保留此前归档的全部原字节，`index.json` 对应原路径／现路径／哈希及旧 ZIP 归档成员，`operations/` 保存整理操作记录。每轮清理结束后将分散记录目录移入 `directories/` 并修正引用；不改写原结果，不把此目录当作可随意丢弃的缓存。

清理、容量维护和透明压缩的范围、保护及记录路径只在 [开发环境](development.md#清理本地中间物) 维护。忽略不是删除授权，已有资料不自动迁移、重命名或取消跟踪；原始资料与最终产物即使 Git 忽略也保持文件树可见。

## Git 与编辑器策略

源码、文档、必要配置和工作区文件默认跟踪且可见。`.gitignore` 排除依赖、工具缓存、日志、临时／构建目录、`artifacts/`、本地 `.env` 与 `secrets/`；无秘密的 `.env.example` 和 `.env.*.example` 可以跟踪。是否提交资源和资料按实际用途、来源与需要判断，不按扩展名笼统忽略。

工作区分别维护 `files.exclude`、`search.exclude` 与 `files.watcherExclude`：文件树隐藏依赖、缓存、日志及可再生临时／构建目录，`artifacts/` 仅排除搜索和监听。`explorer.excludeGitIgnore: false` 保持 Git 忽略与文件树显示独立，不隐藏全部原始资料、正式资源或最终交付物。

Git 远程 `origin` 为 GitHub 的 `anApalpitate/TableMax`，尚未配置仓库 CI。提交与推送遵循 [维护约定](maintenance.md#更新与归档)，默认仅提交；入口变化同步项目说明、Agent 入口及所属文档索引。

工作区与交付的瘦身依据、历史包退役及执行报告统一维护在 [项目瘦身](project-slimming.md)，不按文件目录名推断资料是否可删除。
