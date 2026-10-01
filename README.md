# TableMax

供自己和朋友线下聚会使用的 Windows 局域网全数字桌游平台。电脑负责本地服务与公共屏，玩家通过手机浏览器加入并操作；正式游玩不依赖互联网或实体组件。

首版目标是《宝可梦奇遇：皮卡丘和朋友们》完整可玩，并具备身份与秘密信息隔离、房主决策点回退、手机重连和程序重启恢复能力。后续目标包含经典版《电力公司》德国地图，具体边界以需求为准。

## 当前状态

第一阶段工程基础已完成：React／TypeScript 网页、Electron 桌面壳、独立本地服务、SQLite 工程验证适配器和固定工具链均已建立，Windows x64 便携 ZIP 已在本机通过解压运行验证。

当前正式入口提供公共屏、手机端和管理端的工程验证页面，尚未实现大厅、身份、回退恢复或首版游戏。[第二阶段：规则与交互准备](docs/tasks/phase-02-rules-and-interaction.md) 正在进行：已建立[通用交互规格与三端美术原型](docs/reference/phase-02-platform-spec.md)，并完成合成 UI 的 10 组自动走查；目标简体中文版的完整规则与卡牌原文仍有[核验缺口](docs/tasks/phase-02-rules-and-interaction.md#规则来源与核验缺口)。规则关口未通过，完整游戏规格尚未冻结，第二阶段尚未完成。第一阶段任务已归档，完成证据见 [归档记录](docs/archive/phase-01-engineering-foundation.md)。

用户指定中文资料已整理为[参考规则草案](docs/tasks/phase-02-rules-and-interaction.md#中文参考规则草案)，覆盖布局、初始化、替换、配对计分及部分能力概述；新增检索只使用中文来源。另已预备[原创自然主题背景](apps/web/src/prototype/assets/theme-preparation/manifest.json)，作为未导入 UI 的本地资源候选。

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

- [需求文档 v1.0](docs/requirements/TableMax_需求文档_v1.0.md)：产品范围、技术建议、规则研究项与首版验收标准；原件已移入 docs，正文保持不变。
- [Agent 入口](AGENTS.md)：最小阅读顺序、工作与提交约定。
- [文档索引](docs/README.md)：按任务意图查找文档。
- [子 agent 职责](docs/subagent/README.md)：专职 imagegen 角色、派工输入及交接边界。
- [目录职责](docs/reference/project-structure.md)：现有目录与未来内容的边界。
- [开发阶段与任务](docs/tasks/README.md)：粗粒度阶段、主要任务与交付物。
- [第一阶段完成记录（归档）](docs/archive/phase-01-engineering-foundation.md)：已完成任务范围、清单与历史证据。
- [第二阶段任务与核验记录](docs/tasks/phase-02-rules-and-interaction.md)：已交付范围、来源与规则缺口、完成标准及取得原文后的接续工作。
- [通用交互与交接规格](docs/reference/phase-02-platform-spec.md)：已选大厅交互、权限与恢复语义、资源方案、AC 场景及第三至五阶段输入。
- [工程基础决策](docs/decisions/001-engineering-foundation.md)：已采用技术、固定版本及重要取舍。
- [工程结构](docs/reference/architecture.md)：依赖方向、游戏契约、授权视图与后续恢复机制边界。
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
    decisions/
      README.md
      001-engineering-foundation.md
    tasks/
      README.md
      phase-02-rules-and-interaction.md
    subagent/
      README.md
      imagegen.md
    archive/
      README.md
      phase-01-engineering-foundation.md
  artifacts/                本地产物，Git 忽略但文件树可见
    phase-01/               工程便携包与跨层验证
    phase-02/               原型构建、来源响应与走查证据
```

文档随实现同步维护。较大任务完成并通过相关验证后自动提交，默认不 push。

## 第二阶段交互原型

执行 `pnpm prototype:dev` 后打开 `http://127.0.0.1:5174/prototype.html`。原型采用明亮的桌游主机美术，包含头像大厅、三端布局、提交反馈、暂停、回退、换手机绑定和恢复提示；右上“审阅工具”可切换角色／页面和模拟异常。均为合成 UI 状态，具体游戏区域等待规则核验，不连接真实服务或存档。

先执行 `pnpm prototype:build`，再执行 `pnpm prototype:preview` 或 `pnpm prototype:verify`。构建输出到 `artifacts/phase-02/prototype/`，预览入口为 `http://127.0.0.1:4174/prototype.html`；走查使用现有 Playwright／隐藏 Electron 窗口，在 `artifacts/phase-02/verification/` 生成25 张截图与 JSON 记录。命令前提、端口和验证限制见 [开发说明](docs/reference/development.md)，设计行为见 [通用规格](docs/reference/phase-02-platform-spec.md)。
