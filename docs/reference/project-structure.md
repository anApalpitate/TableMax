# 目录职责

## 已创建结构

| 路径 | 职责与允许内容 |
| --- | --- |
| `AGENTS.md` | Agent 阅读入口、关键工作和维护约定；详细说明放入对应文档 |
| `README.md` | 项目目标、真实进度、实际启动／检查命令和导航 |
| `TableMax.code-workspace` | 本项目编辑器设置，根目录引用为相对路径 `.` |
| `.gitignore` | 依赖、缓存、日志、临时文件、可再生文件及本地秘密的忽略规则 |
| `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.npmrc` | 固定工具链、工作区依赖、安装策略和真实工程命令 |
| `.node-version`、`tsconfig.json`、`eslint.config.mjs`、Prettier／EditorConfig 配置 | 开发运行时版本、严格类型、静态检查、统一排版与保存格式化 |
| `electron-builder.yml`、`scripts/` | 网页／服务／桌面构建、运行时准备、开发与启动、便携打包、跨层验证；`verify-prototype.mjs` 负责独立原型走查 |
| `apps/desktop/` | Electron 主进程、窗口与独立服务生命周期 |
| `apps/server/` | HTTP、Socket.IO、构建后网页、本地二维码与 SQLite 工程验证适配器 |
| `apps/web/` | 单一 React 网页工程，公共屏／手机／管理工程验证页面；独立 `prototype.html` 与 `src/prototype/` 为第二阶段合成交互原型，不进入正式构建 |
| `packages/protocol/` | 当前工程通信与桌面／服务消息的类型和运行时校验 |
| `packages/game-sdk/` | 纯类型初始游戏契约；尚非完整游戏模板或恢复实现 |
| `games/README.md` | 每款游戏独立目录的约定；未建立宝可梦或空游戏工程 |
| `docs/README.md` | 按任务意图组织文档入口 |
| `docs/requirements/` | 产品需求基线；原有需求文档已移入，正文保持不变 |
| `docs/reference/` | 当前目录与工程边界、开发操作及验证记录、维护规则、第二阶段通用交互与交接规格 |
| `docs/decisions/` | 已确定的重要选择、理由与后果；已有工程基础技术方向决策，产品决策引用需求与用户最新指示 |
| `docs/tasks/` | 粗粒度阶段总览与进行中任务；当前第二阶段任务合并来源记录、规则缺口、接续工作及完成标准 |
| `docs/archive/` | 已完成任务及有历史价值的过程材料；第一阶段任务已归档，索引说明归档原因和当前参考入口 |

## 已采用与计划结构

第一阶段已确认采用需求第 6.3 节的组织方向：`apps/` 划分桌面壳、服务端和单一网页工程，`packages/` 承载共享契约与平台模块，`games/` 承载独立游戏模块。每款游戏集中在 `games/<游戏标识>/`，内部区分规则、公共屏 UI、手机 UI、资源和验证，规则与客户端入口分开。桌面壳启动独立服务进程；公共屏、手机端和房主管理在同一网页工程中分开入口与布局。采用依据见 [工程基础技术决策](../decisions/001-engineering-foundation.md)。

上表列出的结构均已创建。第一阶段工程基础已验证，第二阶段另已交付独立合成原型及通用规格，其完整游戏交付仍受规则关口约束。具体依赖方向与机制归属见 [代码结构与工程边界](architecture.md)。`packages/platform-core/` 与 `packages/ui/` 尚未创建，平台业务机制与独立通用 UI 包按实际需要在后续阶段建立。工程基础和原型验证不表示大厅、身份、游戏或恢复能力已经实现；证据分别见 [第一阶段任务](../archive/phase-01-engineering-foundation.md)、[第二阶段任务](../tasks/phase-02-rules-and-interaction.md)。

游戏规则研究、扩展指南和资源整理时，按实际工作建立对应主题目录并更新索引。[第二阶段任务](../tasks/phase-02-rules-and-interaction.md) 已列出游戏主题计划去向；规则关口尚未通过，`docs/games/`、`docs/game-development/` 等仍未创建。来源、缺口和接续步骤统一维护在该任务页，长期通用规格维护在 [第二阶段平台规格](phase-02-platform-spec.md)。游戏标识在版本确认后确定，并与后续源码模块一致；已有需求原件统一存放在 `docs/requirements/`，不在根目录保留副本。

新增目录应有当前明确职责，不预铺未来插件、多房间或后续游戏的空层级。确需跟踪空目录时使用 `.gitkeep` 或有实际用途的说明文件。

## 材料与产物边界

- 长期需求、规则规格、来源清单和必要游戏资源属于项目资料；放入对应主题，不混入临时目录。
- 本地实验、临时导出或下载中间文件可放入根目录 `tmp/`（需要时创建）；不作为长期资料入口。
- 根目录 `build/` 已用于可再生构建中间物，`dist/` 为保留的构建排除项。工程验证便携包、截图与 JSON 证据保存在 `artifacts/phase-01/`；第二阶段原型构建、检索原始响应和走查证据在 `artifacts/phase-02/`。这些文件 Git 忽略但文件树保持可见；正式产品交付策略在第六阶段确认。
- `artifacts/phase-02/prototype/` 是可再生原型构建，`verification/` 是对应走查证据，`research/` 是已保存的检索响应与哈希清单。资料是否可再生分别判断，不能因同在 artifacts 下就覆盖或删除原始响应。路径与命令见开发说明，资料适用性见 [规则来源与核验缺口](../tasks/phase-02-rules-and-interaction.md#规则来源与核验缺口)。
- 原始规则资料、数据、正式资源和最终交付物不按扩展名笼统忽略；是否提交按实际用途、来源与需要决定。
- 运行数据默认放在系统当前用户 `LOCALAPPDATA` 下的 `TableMax/`，具体位置和验证覆盖方式见 [开发说明](development.md)。当前仅有工程验证数据库，不在仓库内生成玩家存档或秘密状态。
- 忽略规则不是删除授权；已有资料不自动迁移、重命名或取消跟踪。

## Git 与编辑器策略

源码、文档、必要配置和工作区文件默认跟踪且可见。`.gitignore` 排除依赖目录、工具缓存、日志、根目录临时／构建目录、`artifacts/`、本地 `.env` 和 `secrets/`；无秘密的 `.env.example` 和 `.env.*.example` 可以跟踪。

工作区分别维护 `files.exclude`、`search.exclude`、`files.watcherExclude`。文件树隐藏依赖、缓存、日志和可再生临时／构建目录；搜索排除噪声，监听排除对应目录的内容。`artifacts/` 只排除搜索和监听，仍在文件树可见。没有按 Git 忽略规则隐藏全部文件的设置，也没有笼统隐藏原始资料、正式游戏资源或最终交付物。

当前已有依赖安装、最小源码工程、服务启动和实际验证入口；未配置远程仓库或 CI，也未实现平台业务和具体游戏。工程入口保持与 [项目说明](../../README.md)、[Agent 入口](../../AGENTS.md) 和 [开发说明](development.md) 同步。
