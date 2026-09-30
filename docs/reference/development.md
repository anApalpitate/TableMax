# 开发环境与验证

范围：用户本机 Windows 11 x64；涵盖第一阶段工程基础与第二阶段独立原型的运行、产物和验证。正式入口仍是工程验证页面，原型只使用合成 UI 状态，均不代表完整桌游平台或产品验收。

第二阶段设计行为和 AC 场景见 [通用交互规格](phase-02-platform-spec.md)，规则关口与接续工作见 [阶段任务](../tasks/phase-02-rules-and-interaction.md)。原型不读取默认数据目录，不改变正式桌面入口。

## 环境与依赖

第一阶段（2026-09-30 至 2026-10-01）已清点开发环境：Windows 内核版本 `10.0.26200`、x64，Node.js `22.14.0`，pnpm `10.12.1`，Git `2.55.0.windows.3`。Windows 的 `10.0` 内核版本号不表示目标改为 Windows 10；目标系统按用户确认的 Windows 11 记录。第二阶段沿用锁定依赖，未升级工具链。

Node.js 开发约束为 `>=22.14.0 <23`，`.node-version` 记录本次验证版本；pnpm 固定为 `10.12.1`。没有修改本机全局运行时或其他项目配置。依赖清单使用精确版本，`pnpm-lock.yaml` 锁定传递依赖；后续安装使用冻结锁文件。版本升级应作为单独改动验证。

主要版本：React／React DOM `19.3.0`、Vite `8.3.1`、TypeScript `5.9.3`、Electron `44.5.1`、Fastify `5.12.5`、Socket.IO 服务／客户端 `4.8.4`、Zod `4.6.5`、qrcode `1.5.4`、Vitest `5.0.3`、Playwright `1.63.0`、electron-builder `26.15.3`。精确工具及类型版本见根目录与各工作区 `package.json`。

第一阶段选择 TypeScript 5.9.3 的依据是锁定的 typescript-eslint 8.71.0 声明支持 `<6.1.0`；当时检索到的 TypeScript 最新主版本为 7，不将所有工具机械升级到 latest。Vite、Vitest 和 ESLint 的 Node 下限与本机开发运行时兼容，历史选型依据见 [工程基础决策](../decisions/001-engineering-foundation.md)。本页版本描述的是仓库锁定状态，不代表持续查询的最新版本。

SQLite 使用 `node:sqlite` 的 `DatabaseSync`，只封装打开、准备语句和事务等基础 API。开发 Node 22.14.0 中该绑定标记为实验性，会打印 `ExperimentalWarning`；本工程不隐藏它。绑定收敛在 `apps/server/src/database.ts`，应用不依赖该细节，后续升级需复验。Electron 自带绑定避免额外原生 npm 绑定与 ABI 重编译；实际内置 Node／SQLite 版本以桌面验证结果为准。

## 初次配置

在项目根目录使用 PowerShell：

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm setup:desktop
pnpm check
pnpm build
pnpm verify:desktop
```

开发安装需要联网下载 npm 包与 Electron 运行时。当前 Electron 包在第一次使用时可能才下载二进制，因此提供 `setup:desktop` 显式准备入口。脚本使用 Windows 11 自带 `curl.exe` 从 Electron 官方 GitHub Release 下载，按 npm Electron 包内官方 SHA-256 清单校验后，调用其安装脚本解压；缓存在项目 `.cache/electron`。本次 Node 下载器出现传输停滞，采用系统下载器后完成。打包复用已安装的运行时，不重复下载。pnpm 只允许明确需要的 Electron／esbuild 安装脚本；被忽略的 electron-winstaller 安装脚本不用于当前 ZIP 目标，无需全量批准依赖脚本。

VS Code 工作区启用保存时格式化，使用 `esbenp.prettier-vscode`；本机需已安装该扩展或手动安装。项目命令不依赖扩展，执行时使用项目固定的 Prettier。格式检查覆盖代码与配置，保留需求原件与现有文档排版，不对其批量重排。

`.editorconfig` 与 `.gitattributes` 统一文本 UTF-8／LF 习惯，Git 自动识别二进制资源，不按扩展名笼统改变资源内容。类型检查和规则验证的匹配范围包含未来 `games/` 源码，但不因此创建空游戏工程。

## 真实命令

| 命令 | 行为 |
| --- | --- |
| `pnpm dev` | 先构建，启动 Vite 与 Electron／独立服务；前端热更新，服务与桌面源码修改后重启该命令 |
| `pnpm start` | 运行已有 `build/desktop`；先执行 `pnpm build` |
| `pnpm typecheck` | 严格 TypeScript 检查，不生成文件 |
| `pnpm lint` | ESLint 与 React Hooks 规则检查 |
| `pnpm format:check` / `pnpm format` | 检查格式／按项目配置格式化 |
| `pnpm test` | Vitest 执行当前数据库与 HTTP 服务验证 |
| `pnpm check` | 顺序执行类型、静态、格式检查与当前测试 |
| `pnpm build` | 构建网页、打包独立服务与桌面主进程到 `build/desktop` |
| `pnpm verify:desktop` | 隐藏窗口验证开发构建，包括两次启动、网页连接、独立进程与退出协调 |
| `pnpm package:win` | 构建并生成 Windows x64 解压运行 ZIP 与 `win-unpacked` |
| `pnpm verify:portable` | 将最终 ZIP 解压到新的项目临时目录，对其中的 `TableMax.exe` 运行同一跨层验证，子进程 PATH 不含 Node／开发工具目录 |
| `pnpm prototype:dev` | 启动独立原型开发服务，入口 `http://127.0.0.1:5174/prototype.html`，不启动正式桌面或本地服务 |
| `pnpm prototype:build` | 使用独立 Vite 配置构建原型到 `artifacts/phase-02/prototype/` |
| `pnpm prototype:preview` | 预览已有原型构建，入口 `http://127.0.0.1:4174/prototype.html`；先执行原型构建 |
| `pnpm prototype:verify` | 对已有原型构建运行 Playwright／隐藏 Electron 窗口走查，生成 JSON 和截图；先执行原型构建并准备 Electron |

验证通过后，解压 `artifacts/phase-01/TableMax-0.1.0-win-x64.zip`，双击 `TableMax.exe`。这是第一阶段工程验证包，不包含大厅、身份或首版游戏。

## 独立原型的运行与检查

初次安装沿用上节冻结依赖和 `pnpm setup:desktop`；仅浏览器开发／预览不需要启动 Electron，自动走查需要已安装的 Electron 运行时。在项目根目录执行：

```powershell
pnpm prototype:dev
```

按需在浏览器打开开发入口，结束时按 Ctrl+C。对构建产物走查时执行：

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm prototype:build
pnpm prototype:verify
```

`pnpm prototype:verify` 不自动构建，也不依赖正在运行的 4174 预览；脚本自行启动随机回环端口的 Vite 预览与隐藏 Electron 窗口，并在结束时关闭。人工审阅已有构建可执行 `pnpm prototype:preview`。5174／4174 均只监听 `127.0.0.1`，端口占用时停止，配置不会静默换端口；这两个地址不是局域网手机接入入口。

原型唯一入口由 `apps/web/vite.prototype.config.ts` 指定，正式构建由 `apps/web/vite.config.ts` 指定。原型不代理 `/api` 或 `/socket.io`，不使用真实身份、网络连接、存档或游戏状态。审阅工具可切换角色／页面、模拟提交与异常，刷新重置示例；页面中的网卡、连接和恢复反馈不是实际系统检测。

原型源码变更按上列命令检查；若影响正式构建边界，再验证 `pnpm build` 的隔离。仅文档变更检查来源引用、相对链接、索引、命令与配置一致性及 diff，不重复无关构建或便携打包。

## 配置、目录与网络

正式程序默认监听 `0.0.0.0:38473`。管理窗口使用 `127.0.0.1`，手机二维码使用用户在地址列表选择的本机 IPv4。多个地址可能包含虚拟网卡，用户需选择手机可访问的地址。当前端口占用会导致启动失败并提示，不静默改用其他端口。第三阶段完善网络引导与启动反馈；自动选择可用端口尚未作为已采用方案，需求允许明确提示或选取可用端口并更新二维码。

开发 Vite 使用 `127.0.0.1:5173`，把 `/api`、`/socket.io` 转发到默认服务端口。正式运行仅由 Fastify 提供构建后的网页，不使用 Vite。开发模式的服务端口保持默认值；修改服务端口时需同步 Vite 代理。

| 内容 | 位置／策略 |
| --- | --- |
| 默认本地数据 | 系统 `LOCALAPPDATA` 下的 `TableMax/`，不写入程序包或仓库 |
| 工程验证数据库 | 数据目录 `foundation.sqlite` 与 SQLite WAL／SHM；不是未来正式游戏存档 |
| 服务日志 | 数据目录 `logs/service.log`，只记录服务启动／停止事件，不记录验证消息或秘密状态 |
| Electron 浏览器数据 | 数据目录 `desktop/`，包含网页会话与缓存 |
| pnpm、下载与工具缓存 | 仓库 `.pnpm-store/`、`.cache/`；Git 忽略，工作区隐藏与排除监听 |
| 可再生构建 | 仓库 `build/`，Git 忽略，工作区隐藏 |
| 便携包与验证图／JSON | 仓库 `artifacts/phase-01/`，Git 忽略，文件树保持可见；搜索与监听单独排除 |
| 原型构建 | 仓库 `artifacts/phase-02/prototype/`，独立于 `build/desktop/web/` |
| 原型截图与走查 JSON | 仓库 `artifacts/phase-02/verification/`，Git 忽略但文件树可见；每次走查更新对应证据 |
| 第二阶段检索原始响应 | 仓库 `artifacts/phase-02/research/`，清单记录 URL、HTTP 状态、字节数与 SHA-256；不是已核验规则书 |
| 原型走查临时入口 | 仓库 `tmp/prototype-verify-*`，与正式服务、数据库和用户默认存档分离 |
| 跨层验证临时数据 | 仓库 `tmp/desktop-verify-*`、`tmp/portable-extracted-*` 及命令入口验证目录，使用显式测试数据目录覆盖；不会读写用户默认存档 |
| 单元测试数据库样本 | 系统临时目录 `tablemax-*`，与正式数据分离 |

仅支持开发／验证覆盖的环境变量：`TABLEMAX_DATA_DIR` 指定数据位置，`TABLEMAX_HOST` 指定监听地址，`TABLEMAX_PORT` 指定端口（0 仅用于验证临时端口）。`TABLEMAX_WEB_DEV_URL` 由开发脚本设置，普通便携启动不要设置。`ELECTRON_RUN_AS_NODE` 会改变 Electron 模式，项目启动和验证脚本主动移除该变量。不要将含秘密的本地配置纳入 Git。

没有自动修改防火墙、路由器或系统服务。手机连接还受私人网络防火墙、访客网络隔离和选错网卡影响。局域网实机验证与正式离线整局仍属于后续阶段；工程验证不能替代手机系统浏览器验收。

## 第一阶段验证记录

执行日期：2026-09-30 至 2026-10-01（Asia/Shanghai）。

- 已通过：`pnpm install --frozen-lockfile`、`pnpm setup:desktop`、`pnpm check`（严格类型、ESLint、格式与 5 项 Vitest）、`pnpm build`、`pnpm verify:desktop`、`pnpm dev --foundation-check`、`pnpm start --foundation-check`。
- 开发桌面跨层验证：两次启动依次读取启动记录 1／2，服务独立进程、消息往返与畸形消息拒绝、三类页面、公共屏关闭后服务保留、桌面关闭后服务停止、全部网页资源同源和本地二维码均通过。
- 实际运行时：开发 Node 22.14.0 自带 SQLite 3.47.2；Electron 44.5.1 内置 Node 24.21.0、自带 SQLite 3.53.4。
- 已通过：`pnpm package:win` 和 `pnpm verify:portable`。最终 ZIP 解压到新的临时目录后，在仅包含 Windows 系统目录的 PATH 下启动其中的程序；两次启动、SQLite 记录递增、独立服务进程、三类页面、消息校验、资源同源与正常退出均通过，记录的 `packaged` 为 `true`。
- 当前限制：自动化会在同一本机运行，手机页面使用 Chromium 窄屏尺寸验证；不表示 Android／iPhone 实机或无开发环境的另一台电脑已验收。
- Codex 执行环境中，Vite、Vitest 和 esbuild 启动子进程曾被沙箱以 `spawn EPERM` 阻止；经自动审批在允许子进程的环境运行后检查通过。这是本次代理执行限制，不应通过修改工程逻辑规避。

跨层验证生成 `artifacts/phase-01/verification/development.json`、`portable.json` 和三类页面截图。测试数据与生成证据保持本地，不将绝对个人路径或二进制产物提交到 Git。

最终产物：`artifacts/phase-01/TableMax-0.1.0-win-x64.zip`，153,698,110 字节（约 146.6 MiB）。本次验证 ZIP 的 SHA-256 为 `2af33a46e4e126e38480aaecd63410a09a0063900efca5992a686c2f0ee4bb86`；重新构建因归档时间等可能产生不同哈希，需以对应验证记录为准。

隐藏窗口检查使用 Electron `capturePage`（保持隐藏）生成截图。公共屏链接由桌面阻止原窗口导航并创建新窗口，因此自动化点击不等待被取消的导航；验证仍等待新公共屏实际加载并检查其页面。

## 第二阶段原型验证记录

执行日期：2026-10-01（Asia/Shanghai）。以下为已有原型实现的验证记录，不表示文档更新时重跑了这些检查。

已通过 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm prototype:build`、`pnpm prototype:verify` 和正常 `pnpm build`。正常网页构建只有正式入口，不含原型入口和原型文字；协议、SDK 及依赖锁文件未因原型改变。

`scripts/verify-prototype.mjs` 的 9 组检查已通过：独立构建与正式 API 不可用；大厅重名／关闭加入／座位身份与准备；提交锁定／拒绝／结果未知／同步／保存反馈；掉线／暂停／回退／过期动作／换绑及弹窗取消；角色控件与公共屏声音；恢复错误与房主结束；示例网卡与网络／端口反馈；6 页 × 3 角色在 360／390 CSS 像素宽度无横向溢出、受检触控控件高度至少 44px；观察到的运行请求全部本地且无页面错误。结果在 `artifacts/phase-02/verification/prototype.json`，记录 `passed: true`、空外部请求列表及空页面错误列表。

截图与已记录的 CSS 尺寸：

| 文件（均在 `artifacts/phase-02/verification/`） | 内容 | CSS 尺寸 |
| --- | --- | --- |
| `host-setup.png` | 房主启动与网络选择 | 1280×900 |
| `player-lobby-360.png` | 手机大厅 | 360×800 |
| `player-submitting-390.png` | 手机提交反馈 | 390×844 |
| `host-rollback.png` | 房主回退确认 | 1280×900 |
| `public-session-1920.png` | 公共屏会话占位与声音 | 1920×1080 |
| `host-save-error.png` | 房主存档错误提示 | 1280×900 |

六张截图已人工查看。PNG 像素随系统缩放变化，本次记录的 `deviceScaleFactor` 为 1.5。安全区域使用 CSS `env(safe-area-inset-*)` 留白；桌面 Chromium 走查不能证明 iPhone 安全区、Android／iPhone 系统浏览器、真实触控或锁屏重连通过。运行请求本地的观察也不能替代断开互联网后的正式游戏整局验收。

合成 UI 的分支、绑定代数、确认、恢复与音效控件只证明界面反馈，未验证服务端权限、真实凭证失效、随机结果一致、可靠动作、实际文件保留或持久化。第三至五阶段实现对应能力，第六阶段负责实机与正式离线验收。检索响应及文件哈希另见 [规则核验记录](../tasks/phase-02-rule-research.md)；完整游戏相关验证仍受规则关口约束。

## 文档同步检查记录

2026-10-01 全面同步第二阶段相关的 15 份文档。检查了仓库 18 份 Markdown 中的 136 个相对链接、14 份 docs 分类页面的可达入口、17 个根脚本命令的文档覆盖及原型配置端口；六份检索响应的字节数／SHA-256 和六张截图的文件／尺寸与既有记录一致。根 README 与 AGENTS 的项目 Prettier 检查、`git diff --check` 通过；需求基线、源码、协议、SDK 和依赖未修改。

本次只执行文档及既有证据检查，未重跑原型、游戏或便携验收。检查摘要保存在本地 `artifacts/phase-02/verification/documents.json`；规则关口状态保持未通过，原型验证不被提升为产品 AC。
