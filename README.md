# TableMax

供自己和朋友线下聚会使用的 Windows 局域网全数字桌游平台。电脑负责本地服务与公共屏，玩家通过手机浏览器加入并操作；正式游玩不依赖互联网或实体组件。

首版目标是《宝可梦奇遇：皮卡丘和朋友们》完整可玩，并具备身份与秘密信息隔离、房主决策点回退、手机重连和程序重启恢复能力。后续目标包含经典版《电力公司》德国地图，具体边界以需求为准。

## 当前状态

第一阶段工程基础已完成：React／TypeScript 网页、Electron 桌面壳、独立本地服务、SQLite 工程验证适配器和固定工具链均已建立，Windows x64 便携 ZIP 已在本机通过解压运行验证。

当前提供公共屏、手机端和管理端的工程验证页面，尚未实现大厅、身份、回退恢复或首版游戏。下一阶段核验对应版本的游戏规则、卡牌与交互，见 [开发阶段](docs/tasks/README.md)。第一阶段完成证据见 [阶段任务](docs/tasks/phase-01-engineering-foundation.md)。

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
- [目录职责](docs/reference/project-structure.md)：现有目录与未来内容的边界。
- [开发阶段与任务](docs/tasks/README.md)：粗粒度阶段、主要任务与交付物。
- [第一阶段任务](docs/tasks/phase-01-engineering-foundation.md)：技术栈确认、环境配置、代码结构设计及完成标准。
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
    web/                     三类入口的单一网页工程
  packages/
    protocol/                类型与运行时消息校验
    game-sdk/                纯类型初始游戏契约
  games/README.md            游戏目录约定，尚无游戏实现
  scripts/                  构建、启动、打包与验证
  docs/
    README.md
    requirements/TableMax_需求文档_v1.0.md
    reference/
      README.md
      maintenance.md
      project-structure.md
      architecture.md
      development.md
    decisions/
      README.md
      001-engineering-foundation.md
    tasks/
      README.md
      phase-01-engineering-foundation.md
    archive/README.md
```

文档随实现同步维护。较大任务完成并通过相关验证后自动提交，默认不 push。
