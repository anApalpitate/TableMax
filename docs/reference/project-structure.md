# 目录职责

## 已创建结构

| 路径                                                                                              | 职责与允许内容                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                                                       | Agent 阅读入口、关键工作和维护约定；详细说明放入对应文档                                                                                                 |
| `README.md`                                                                                       | 项目目标、真实进度、实际启动／检查命令和导航                                                                                                             |
| `Clean-Releases.ps1`、`Clean-Intermediates.ps1`、`Maintain-Project.ps1`                           | 手动分类清理及空闲边界容量维护入口，均默认预览；维护发现同仓库主工作区，超过 5 GiB 后清至 4 GiB 或候选耗尽；共用 `scripts/cleanup-local.ps1` 安全保护    |
| `TableMax.code-workspace`                                                                         | 本项目编辑器设置，根目录引用为相对路径 `.`                                                                                                               |
| `.gitignore`                                                                                      | 依赖、缓存、日志、临时文件、可再生文件及本地秘密的忽略规则                                                                                               |
| `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.npmrc`                                 | 固定工具链、工作区依赖、安装策略和真实工程命令                                                                                                           |
| `.node-version`、`global.json`、`tsconfig.json`、`eslint.config.mjs`、Prettier／EditorConfig 配置 | 固定 Node 22.14.0／.NET SDK 9.0.102、严格类型、静态检查、统一排版与保存格式化                                                                            |
| `scripts/`                                                                                        | 网页／服务／原生桌面构建、官方 Node 与 NuGet 包准备、开发与启动、便携 ZIP 打包及压缩／解压体积双门禁；原型与跨层验证入口                                 |
| `scripts/desktop-test.mjs`、`scripts/verify-native-safety.mjs`                                    | 测试专用原生 stdin／stdout 驱动、WebView2 CDP 连接和桌面安全／生命周期验证；正式启动不启用测试通道或调试端口                                             |
| `scripts/verify-experience.mjs`、`scripts/verify-runtime-memory.mjs`                              | 1.6.0 真实隐藏窗口的游戏库／房主／并发操作验证及独立复制／导航内存测量；证据进入 `artifacts/maintenance/v1.6.0/`                                         |
| `scripts/fixtures/`                                                                               | 验证专用合法存档及进程入口；`memory-save.ts`、`measure-copy-memory.mjs` 构造并测量六席长历史规模 fixture，不进入正式运行包                               |
| `scripts/cleanup-local.test.ps1`、`scripts/project-maintenance.test.ps1`                          | 隔离清理安全回归及 Git 主仓库／worktree 容量维护回归，不清理真实交付目录                                                                                 |
| `apps/desktop/native/`                                                                            | C# WinForms／net48／x64 原生外壳；双窗口、WebView2、本源顶层桥接、显示／声音调度、私有服务管道、Job Object、单实例与防休眠；原生依赖锁文件随源码维护     |
| `apps/desktop/src/`                                                                               | 网页使用的桌面显示／声音 TypeScript 契约及独立控制逻辑回归；不作为正式窗口或服务启动入口                                                                 |
| `apps/server/`                                                                                    | HTTP、Socket.IO、构建后网页、本地二维码、SQLite 平台存档仓储与独立 bot Worker；`src/game-registry.ts` 注册游戏目录和按需规则加载器                       |
| `apps/web/`                                                                                       | 单一 React 工程；三种身份的盒子与独立游戏页，会话／导航／通用控件分别维护；独立原型不进入正式构建                                                        |
| `assets/`                                                                                         | 全部运行／原型美术和声音，来源／版本及替换说明                                                                                                           |
| `assets/games/<id>/`                                                                              | 游戏角色、音频、环境和浏览器资源表；规则不依赖文件名                                                                                                     |
| `assets/platform/`                                                                                | 共享平台 WebP 与 imagegen 来源清单；正式页面和原型共同引用，迁移不改变图像字节                                                                           |
| `apps/web/src/session/`、`screens/`、`components/`                                                | 会话权威同步与可靠提交、独立页面、通用平台控件；首版牌桌场景留在游戏 UI                                                                                  |
| `apps/web/src/game-clients/`                                                                      | 按游戏 ID 动态加载的页面适配器、已加载客户端复用和加载失败重试；组合平台会话与对应游戏 UI，不把宝可梦投影耦合进通用会话                                  |
| `build/desktop/games/`、`build/desktop/bots/`                                                     | `scripts/build.mjs` 生成的本地独立规则／策略模块，随便携包分发；与前端分块共同实现按选择／恢复／bot 任务加载，不手改生成物                               |
| `build/native/`、`build/native-obj/`、`build/desktop/`                                            | 可再生原生编译结果、中间物与完整运行目录；正式目录收集 TableMax.exe、x64 WebView2 SDK 必需 DLL、node.exe、许可证、服务／Worker／游戏模块和本地网页       |
| `packages/protocol/`                                                                              | 当前工程通信与桌面／服务消息的类型和运行时校验                                                                                                           |
| `packages/game-sdk/`                                                                              | 纯类型游戏／策略／生命周期契约；实际模板与恢复见 games/template 与 platform-core                                                                         |
| `packages/platform-core/`                                                                         | 真实房间／管理员与手机房主授权、游戏注册及切换、串行去重与并发意图校验、随机／checkpoint／分支恢复、bot 调度与存档校验                                   |
| `games/template/`                                                                                 | 可运行内部验证游戏，独立规则、计分、投影、策略和两端 UI；用于切换及平台兼容测试，不在正式游戏目录展示                                                    |
| `docs/game-development/`                                                                          | 当前模板、注册／替换步骤、恢复接口与验证方法                                                                                                             |
| `games/pokemon-encounters/`                                                                       | 首版规则、计分、授权投影、独立 bot、主机／手机 UI、保存表现及测试；素材在根目录 assets                                                                   |
| `games/README.md`                                                                                 | 每款游戏独立目录的约定；当前首版与验证模板均已建立，不预铺空游戏工程                                                                                     |
| `docs/README.md`                                                                                  | 按任务意图组织文档入口                                                                                                                                   |
| `docs/requirements/`                                                                              | 产品需求基线；已按用户要求注明日期增补跨游戏调试与纠错目标，区分后续规划与已实现行为                                                                     |
| `docs/games/pokemon-encounters/`                                                                  | 首版来源、规则、cards.json、状态／权限／决策、交互、资源、scenarios.json及人机规格；完整测试fixture不导入原型                                            |
| `docs/reference/`                                                                                 | 当前目录与工程边界、开发操作及验证记录、维护规则、第二阶段通用交互与交接规格、人机规格及适度封装原则                                                     |
| `docs/decisions/`                                                                                 | 已确定的重要选择、理由与后果；已有工程基础技术方向决策，含新增人机与可维护性范围决策；产品决策引用需求与用户最新指示                                     |
| `docs/tasks/`                                                                                     | 粗粒度阶段总览与进行中任务；已完成阶段保留归档链接；第一至六阶段完成，后续独立需求在任务索引维护                                                         |
| `docs/subagent/`                                                                                  | 子 agent 职责索引与单独角色文档；覆盖原生桌面、平台服务、构建验收、独立视觉审查和 imagegen，保存输入、文件边界、交付和维护约定，不保存图片或会话实例配置 |
| `docs/archive/`                                                                                   | 已完成任务及有历史价值的过程材料；第一至六阶段与已完成首版维护已归档，索引说明归档原因和当前参考入口                                                     |

## 已采用与计划结构

第二款正式游戏集中于 `games/modern-art/`（data、rules、bot、ui），独立图片与浏览器映射在 `assets/games/modern-art/`，出版规则及项目采用说明在 `docs/games/modern-art/`。`apps/web/src/assets/game-covers.ts` 仅提供目录缩略图；每个游戏的布局 CSS 归其 UI 目录并限定自身根节点。

上表是现有目录；真实平台、验证模板与宝可梦完整游戏均已实现。工程依赖方向、进程及封装边界统一见 [工程结构](architecture.md)，采用理由见 [工程基础决策](../decisions/001-engineering-foundation.md)。1.6.0 盒子先展示游戏库，服务及客户端按选择／存档加载对应游戏；主机／公共／手机分别维护盒子和 `/game` 子路由。电脑管理员可指定一位手机房主管理游戏生命周期，玩家仍只接收本人获准视图，见 [通用平台规格](phase-02-platform-spec.md) 与 [界面决策](../decisions/002-host-public-screen-and-debug.md)。

| 计划位置（尚未创建） | 建立时机与内容                           |
| -------------------- | ---------------------------------------- |
| `packages/ui/`       | 按后续实际组件复用需要建立，不预铺空包。 |

当前首版规格与数据已在 [游戏主题](../games/pokemon-encounters/README.md)，游戏标识与当前源码及资源命名空间一致。长期来源、规则、权限、交互、资源和场景各有主题；跨游戏行为维护在 [通用平台规格](phase-02-platform-spec.md)，运行及检查维护在 [开发说明](development.md)。后续候选的人气线索与平台适配集中在 [docs/games/candidates.md](../games/candidates.md)，研究记录不等于已建立游戏规格或实现目录。

新增目录应有当前明确职责，不预铺未来插件、多房间或后续游戏的空层级。确需跟踪空目录时使用 `.gitkeep` 或有实际用途的说明文件。

## 材料与产物边界

- 长期需求、规则规格、来源清单和必要游戏资源属于项目资料；放入对应主题，不混入临时目录。
- 本地实验、临时导出或下载中间文件可放入根目录 `tmp/`（需要时创建）；不作为长期资料入口。
- 未采用的等待背景原图和来源归档在 `artifacts/phase-02/theme-preparation/`；不再占用运行资源目录。清理临时研究目录时，有历史价值的资料先归入 `artifacts/phase-02/research/`，重复下载与一次性脚本不长期保留。
- 根目录 `build/` 已用于可再生构建中间物，`dist/` 为保留的构建排除项。工程验证截图与 JSON 证据保存在 `artifacts/phase-01/`；第二阶段原型构建、检索原始响应和走查证据在 `artifacts/phase-02/`。第三、四阶段真实平台截图与 JSON 在 `artifacts/phase-03-04/verification/`。第五阶段原图／素材检查在 artifacts/phase-05/imagegen；第六阶段 desktop／portable／ui 验证在 artifacts/phase-06。版本 ZIP 输出到 `artifacts/releases/`；1.5.0 显示证据保留在 `artifacts/maintenance/display-resolution/`，原 1.6.0 各专项保留在 `artifacts/maintenance/v1.6.0/`，当前 v1.0.0 新验证进入 `artifacts/maintenance/v1.0.0/`。WebView2 迁移记录位于其 `webview2/` 子目录，迁移前 Electron 同版本证据保留在 `before-webview2/`；便携是否通过以最终 ZIP 对应实际记录为准。历史程序包及已结束中间物的清理见 [开发说明](development.md#清理本地中间物)，清理日志在 `artifacts/maintenance/local-cleanup-*`，一次性脚本先归档；历史证据与原始素材保留，上述本地产物 Git 忽略但文件树保持可见。
- `tmp/experience-*` 包含新版操作验证的隔离数据与便携解压，`tmp/runtime-memory-*` 包含临时复制模块、规模化存档 fixture 和桌面数据；已结束且满足安全条件时可清理，长期 JSON／截图在对应 `artifacts/maintenance/v1.6.0/` 子目录保留。容量维护流式统计且跳过链接和嵌套仓库，不能因总量超标删除依赖、工具缓存、正式数据或证据。
- `artifacts/phase-02/prototype/` 是可再生原型构建，`verification/` 是对应走查证据，`research/` 是已保存的检索响应与哈希清单。资料是否可再生分别判断，不能因同在 artifacts 下就覆盖或删除原始响应。路径与命令见开发说明，资料适用性见 [规则来源与核验缺口](../games/pokemon-encounters/sources.md#规则来源与核验缺口)。
- `artifacts/phase-02/research/chinese-reference/s14/` 保存用户三张原始中文截图、尺寸／哈希和牌面转录；叠图数量已由 S17 核对为 56，原始观察及原图保留；完整采用表在 docs/games/pokemon-encounters/cards.json，原图不直接导入运行时。
- `artifacts/phase-02/art-reset/` 保存 imagegen 原始 PNG、素材检查、三端同尺寸前后对比与文字密度测量；`verification/before-art-reset/` 保留重置前截图。原始图像与历史证据不被原型构建覆盖。
- 原始规则资料、数据、正式资源和最终交付物不按扩展名笼统忽略；是否提交按实际用途、来源与需要决定。
- 运行数据默认放在系统当前用户 `LOCALAPPDATA` 下的 `TableMax/`，具体位置和验证覆盖方式见 [开发说明](development.md)。已有 foundation.sqlite 工程计数及 room.sqlite 平台存档；测试使用隔离目录，不触碰默认玩家存档。
- 忽略规则不是删除授权；已有资料不自动迁移、重命名或取消跟踪。

## Git 与编辑器策略

源码、文档、必要配置和工作区文件默认跟踪且可见。`.gitignore` 排除依赖目录、工具缓存、日志、根目录临时／构建目录、`artifacts/`、本地 `.env` 和 `secrets/`；无秘密的 `.env.example` 和 `.env.*.example` 可以跟踪。

工作区分别维护 `files.exclude`、`search.exclude`、`files.watcherExclude`。文件树隐藏依赖、缓存、日志和可再生临时／构建目录；搜索排除噪声，监听排除对应目录的内容。`artifacts/` 只排除搜索和监听，仍在文件树可见。没有按 Git 忽略规则隐藏全部文件的设置，也没有笼统隐藏原始资料、正式游戏资源或最终交付物。

当前已配置 Git 远程 `origin`（GitHub 的 `anApalpitate/TableMax`），尚未配置仓库 CI。提交与推送遵循 [维护约定](maintenance.md#更新与归档)，默认仅提交；工程入口保持与 [项目说明](../../README.md)、[Agent 入口](../../AGENTS.md) 和 [开发说明](development.md) 同步。
