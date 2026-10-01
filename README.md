# TableMax

供自己和朋友线下聚会使用的 Windows 局域网全数字桌游平台。电脑负责本地服务与公共屏，玩家通过手机浏览器加入并操作；正式游玩不依赖互联网或实体组件。

首版目标是《宝可梦奇遇：皮卡丘和朋友们》完整可玩，并具备身份与秘密信息隔离、房主决策点回退、手机重连和程序重启恢复能力，并支持可完成全部游戏选择的简单 bot。后续目标包含经典版《电力公司》德国地图，具体边界以需求为准。

## 当前状态

第一阶段工程基础已完成：React／TypeScript 网页、Electron 桌面壳、独立本地服务、SQLite 工程验证适配器和固定工具链均已建立，Windows x64 便携 ZIP 已在本机通过解压运行验证。

当前正式入口仍为工程验证页面。第二阶段已完成并归档：交付[首版游戏主题规格](docs/games/pokemon-encounters/README.md)、16类56张结构化牌表、状态与全决策恢复、人机覆盖、资源方案和23个场景，以及覆盖初始化、普通操作、全部特殊能力与结算的独立可点击原型。通用／游戏浏览器走查、工程与文档检查均通过，见[完成记录](docs/archive/phase-02-rules-and-interaction.md)。第三至五阶段实现真实身份、通信、规则／计分、bot及存档，第六阶段验收产品。

最新采用版本 `tablemax-cn-s19-v1`：当前特殊能力完整结算后检查六牌全明并最终结算，没有其他玩家最后回合。三胜、共同赢家、公开摸牌、整堆重洗及百变怪联合最低分保留。中文资料未明确的边界已按用户授权确定[项目方案](docs/games/pokemon-encounters/rules.md#未明示细节的项目方案)，不再追问；官方规则书、版次和勘误仍未认证，详见[来源](docs/games/pokemon-encounters/sources.md)。

公共大屏兼房主管理已在游戏原型演示；正式界面、计分模块及基础bot尚未实现。跨游戏调试与纠错仍按[需求第6.5节](docs/requirements/TableMax_需求文档_v1.0.md#65-跨游戏调试与纠错后续独立规划)另行规划。[人机规格](docs/reference/bot-players.md)与[适度封装](docs/reference/architecture.md#面向对象与适度封装)明确后续职责，B01采用独立TS策略入口默认方案。

## 开发与验证

开发目标为本机 Windows 11 x64，使用 Node.js 22.14.0、pnpm 10.12.1。在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm setup:desktop
pnpm dev
```

```powershell
pnpm check
pnpm build
pnpm verify:desktop
pnpm package:win
pnpm verify:portable
```

`pnpm start` 运行已有构建。`pnpm dev` 提供网页热更新，服务与桌面源码修改后需重启命令。实际命令、环境与配置见 [开发说明](docs/reference/development.md)。

便携包位于 `artifacts/phase-01/TableMax-0.1.0-win-x64.zip`，解压后双击 `TableMax.exe`。当前包是工程验证版，默认服务端口为 38473；存档与日志使用当前用户本地应用数据目录。正式运行无需预装 Node.js，所有网页资源本地提供。验证截图与记录位于 `artifacts/phase-01/verification/`；这些本地产物不提交 Git，文件树保持可见。

## 项目入口

- [需求文档 v1.0](docs/requirements/TableMax_需求文档_v1.0.md)：产品范围、技术建议、规则研究项与首版验收标准；2026-10-01 按用户要求增补跨游戏调试与纠错目标，并注明后续独立规划。
- [Agent 入口](AGENTS.md)：最小阅读顺序、工作与提交约定。
- [文档索引](docs/README.md)：按任务意图查找文档。
- [子 agent 职责](docs/subagent/README.md)：专职 imagegen 角色、派工输入及交接边界。
- [目录职责](docs/reference/project-structure.md)：现有目录与未来内容的边界。
- [开发阶段与任务](docs/tasks/README.md)：粗粒度阶段、主要任务与交付物。
- [第一阶段完成记录（归档）](docs/archive/phase-01-engineering-foundation.md)：已完成任务范围、清单与历史证据。
- [第二阶段完成记录（归档）](docs/archive/phase-02-rules-and-interaction.md)：历史范围、完成清单、采用基线与验证证据。
- [通用交互与交接规格](docs/reference/phase-02-platform-spec.md)：已选大厅交互、权限与恢复语义、资源方案、AC 场景及第三至五阶段输入。
- [工程基础决策](docs/decisions/001-engineering-foundation.md)：已采用技术、固定版本及重要取舍。
- [工程结构](docs/reference/architecture.md)：依赖方向、游戏契约、授权视图与后续恢复机制边界及面向对象的适度封装。
- [人机规格](docs/reference/bot-players.md)：电脑座位、独立决策文件、信息权限、调度恢复和全选择覆盖。
- [开发环境与验证](docs/reference/development.md)：安装、命令、数据位置和本机验证证据。
- [编辑器工作区](TableMax.code-workspace)：以相对路径打开本项目，包含项目级显示、搜索与监听设置。

## 目录概览

```text
TableMax/
  AGENTS.md
  README.md
  TableMax.code-workspace
  .gitignore
  package.json / pnpm-workspace.yaml / pnpm-lock.yaml
  tsconfig.json / eslint.config.mjs / electron-builder.yml
  apps/
    desktop/                 窗口与独立服务生命周期
    server/                  本地服务、资源与数据库适配
    web/                     三类正式入口的单一网页工程
      prototype.html         独立原型入口
      vite.prototype.config.ts
      src/prototype/         合成交互原型，不进入正式构建
  packages/
    protocol/                类型与运行时消息校验
    game-sdk/                纯类型初始游戏契约
  games/README.md            游戏目录约定，尚无游戏实现
  scripts/                  构建、启动、打包与桌面／原型验证
  docs/
    README.md
    requirements/TableMax_需求文档_v1.0.md
    reference/
      README.md
      maintenance.md
      project-structure.md
      architecture.md
      development.md
      phase-02-platform-spec.md
      bot-players.md
    decisions/
      README.md
      001-engineering-foundation.md
      002-host-public-screen-and-debug.md
      003-bot-and-maintainability.md
      004-phase02-game-spec-and-bot-file.md
    games/pokemon-encounters/  规则与完整主题规格
    tasks/
      README.md
    subagent/
      README.md
      imagegen.md
    archive/
      README.md
      phase-01-engineering-foundation.md
      phase-02-rules-and-interaction.md
  artifacts/                本地产物，Git 忽略但文件树可见
    phase-01/               工程便携包与跨层验证
    phase-02/               原型构建、来源响应与走查证据
```

文档随实现同步维护。较大任务完成并通过相关验证后自动提交，默认不 push。

## 第二阶段交互原型

执行 `pnpm prototype:dev` 后打开 `http://127.0.0.1:5174/prototype.html`。原型采用明亮的桌游主机美术，包含头像大厅、三端布局、提交反馈、暂停、回退、换手机绑定和恢复提示；右上“审阅工具”可切换角色／页面和模拟异常。均为合成 UI 状态，游戏主题原型覆盖 2×3 卡位、全部能力及结算，不连接真实服务或存档。

先执行 `pnpm prototype:build`，再执行 `pnpm prototype:preview`；游戏入口添加 `?game=pokemon-encounters`。分别用 `pnpm prototype:verify` 和 `pnpm prototype:verify:game` 走查通用与游戏原型。构建输出到 `artifacts/phase-02/prototype/`，预览入口为 `http://127.0.0.1:4174/prototype.html`；走查使用现有 Playwright／隐藏 Electron 窗口，在 `artifacts/phase-02/verification/` 生成通用25张及游戏16张截图与JSON记录。命令前提、端口和验证限制见 [开发说明](docs/reference/development.md)，设计行为见 [通用规格](docs/reference/phase-02-platform-spec.md)。
