# 开发环境与验证

范围：用户本机 Windows 11 x64；第一至六阶段已完成，正式入口默认运行宝可梦完整游戏，独立原型保留合成状态。当前交付验收按用户授权使用电视／手机模拟，证据及 AC 对应见 [验收记录](acceptance.md)；历史阶段记录保持原验证范围。

第二阶段设计行为和 AC 场景见 [通用交互规格](phase-02-platform-spec.md)，规则关口与接续工作见 [阶段任务](../archive/phase-02-rules-and-interaction.md)。原型不读取默认数据目录，不改变正式桌面入口。

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

| 命令                                | 行为                                                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | 先构建，启动 Vite 与 Electron／独立服务；前端热更新，服务与桌面源码修改后重启该命令                                           |
| `pnpm start`                        | 运行已有 `build/desktop`；先执行 `pnpm build`                                                                                 |
| `pnpm typecheck`                    | 严格 TypeScript 检查，不生成文件                                                                                              |
| `pnpm lint`                         | ESLint 与 React Hooks 规则检查                                                                                                |
| `pnpm format:check` / `pnpm format` | 检查格式／按项目配置格式化                                                                                                    |
| `pnpm test`                         | Vitest 执行核心、真实 Socket.IO、SQLite、强制终止恢复及 Worker 验证                                                           |
| `pnpm check`                        | 顺序执行类型、静态、格式检查与当前测试                                                                                        |
| `pnpm build`                        | 构建网页、打包独立服务与桌面主进程到 `build/desktop`                                                                          |
| `pnpm verify:desktop`               | 隐藏窗口验证开发构建，包括真实大厅、宝可梦五人混合整局、回退、两次启动恢复、独立进程与退出协调                                |
| `pnpm verify:party`                 | 隐藏窗口验证加入／换绑丢回复、真实重启、网卡 IPv4、弱网恢复、原班续局、回退定位和桌面运行保障；可加 `--portable` 验证当前 ZIP |
| `pnpm verify:room-levels`           | 隐藏窗口验证手机各自入座、电脑仅管理／展示、围桌尺寸与三档人机配置、实际混合小局／续局／重启；可加 `--portable` 验证当前 ZIP  |
| `pnpm package:win`                  | 构建并生成 Windows x64 解压运行 ZIP 与 `win-unpacked`                                                                         |
| `pnpm verify:portable`              | 将最终 ZIP 解压到新的项目临时目录，对其中的 `TableMax.exe` 运行同一跨层验证，子进程 PATH 不含 Node／开发工具目录              |
| `pnpm prototype:dev`                | 启动独立原型开发服务，入口 `http://127.0.0.1:5174/prototype.html`，不启动正式桌面或本地服务                                   |
| `pnpm prototype:build`              | 使用独立 Vite 配置构建原型到 `artifacts/phase-02/prototype/`                                                                  |
| `pnpm prototype:preview`            | 预览已有原型构建，入口 `http://127.0.0.1:4174/prototype.html`；先执行原型构建                                                 |
| `pnpm prototype:verify:game`        | 对游戏原型执行Playwright／隐藏Electron全能力、角色、恢复反馈、尺寸和动效走查，证据在 `artifacts/phase-02/verification/game/`  |
| `pnpm prototype:verify`             | 对已有原型构建运行 Playwright／隐藏 Electron 窗口走查，生成 JSON 和截图；先执行原型构建并准备 Electron                        |

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
pnpm prototype:verify:game
```

`pnpm prototype:verify` 不自动构建，也不依赖正在运行的 4174 预览；脚本自行启动随机回环端口的 Vite 预览与隐藏 Electron 窗口，并在结束时关闭。人工审阅已有构建可执行 `pnpm prototype:preview`。5174／4174 均只监听 `127.0.0.1`，端口占用时停止，配置不会静默换端口；这两个地址不是局域网手机接入入口。

原型唯一入口由 `apps/web/vite.prototype.config.ts` 指定，正式构建由 `apps/web/vite.config.ts` 指定。原型不代理 `/api` 或 `/socket.io`，不使用真实身份、网络连接、存档或游戏状态。审阅工具可切换角色／页面、模拟提交与异常，刷新重置示例；页面中的网卡、连接和恢复反馈不是实际系统检测。

原型源码变更按上列命令检查；若影响正式构建边界，再验证 `pnpm build` 的隔离。仅文档变更检查来源引用、相对链接、索引、命令与配置一致性及 diff，不重复无关构建或便携打包。

## 按改动范围选择验证

| 改动范围             | 适用检查与证据                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档、索引或目录说明 | 相对链接与锚点、正文归属、命令／配置一致性、改动文件的 Prettier 格式及 `git diff --check`。`docs/` 默认被格式命令忽略，需要格式化改动页时对明确路径使用 `pnpm exec prettier --check --ignore-path .gitignore <文件路径>`，将 `--check` 改为 `--write` 可格式化。 |
| 独立原型源码         | 类型、静态、格式与独立构建，再执行受影响的通用／游戏走查；`pnpm prototype:verify:game --layout-only` 仅补查布局，不能替代流程走查。                                                                                                                              |
| 正式平台与共享契约   | `pnpm check` 与 `pnpm build`，按行为补真实服务、授权及恢复测试；影响桌面生命周期时执行 `pnpm verify:desktop`。                                                                                                                                                   |
| 正式游戏、计分或策略 | 接入后执行游戏规则、投影、人机和恢复测试，覆盖 [游戏场景](../games/pokemon-encounters/validation-scenarios.md) 的适用项；pnpm check 包含首版规则／策略／D01–D13／真实崩溃测试；pnpm verify:game-ui 运行能力 UI fixture。                                         |
| 正式便携交付         | pnpm package:win 和 pnpm verify:portable；当前用户授权设备模拟范围和证据见验收记录。                                                                                                                                                                             |

新报告只声明本次执行的范围。历史证据保留对应构建、日期与限制，不因更新说明或局部补查而改成完整产品验收。

## 当前维护验证

### 聚会可靠性维护验证（1.2.0）

`pnpm verify:party` 验证当前开发构建，使用隔离数据、隐藏 Electron 和实际本机网卡 IPv4（监听 0.0.0.0），覆盖网卡名称／刷新／选择保持、已保存但丢失的加入及换绑回复、刷新／真实程序重启后确认、250ms 延迟和带宽限制、断网／冻结恢复、回退上下文与筛选、原班第二大局、重复启动、公共屏保留时恢复房主管理以及真实端口占用的中文错误日志。不会修改防火墙、路由器或默认玩家存档；本机网卡地址可达并不证明真实手机或实际 Wi-Fi 已验收。启动前运行 `pnpm build`。正式包验证使用 `pnpm verify:party --portable`，新目录解压 ZIP、子进程 PATH 仅系统目录，证据独立进入 `party-portable`。

1.2.0 的 verify:desktop／verify:portable／verify:game-ui／verify:party 证据在 `artifacts/maintenance/party-reliability` 保留，历史 pokemon-refresh 不覆盖。整局驱动器在随机电脑先手时处理闪电鸟等真人被动选择，再观察真人正常回合；完整三胜结算后实际保留五座位、三 bot 和手机凭证，重新准备并启动新大局。该版包按 package.json 的 1.2.0 输出到 `artifacts/releases`；存档格式、游戏状态与策略版本保持，网络协议为 3。

普通便携启动保持端口 38473：占用时停止并展示具体原因及排障建议，不静默换端口。网卡可手动刷新并自动跟踪变化，原手机在地址或端口变化后的新浏览器源上需房主换绑。服务运行期间防自动休眠，公共屏可见时保持亮屏，退出恢复系统正常电源行为。手动休眠或关机仍可能中断服务。

正式桌面原生 Alt → 程序菜单提供“打开房主管理”“打开日志目录”；`LOCALAPPDATA/TableMax/logs/desktop.log` 保存启动失败的具体原因，`service.log` 保存服务生命周期。损坏／不兼容存档保持原文件，排障前备份 room.sqlite 和 WAL／SHM。验收见 [聚会维护记录](acceptance.md#首版维护聚会可靠性与连续游玩)。

### 手机围桌与等级验证（1.3.0）

`pnpm verify:room-levels` 使用真实桌面／独立服务和本地 Worker，手机采用独立 Chromium partition、触控视口和二维码普通加入 URL。实际 UI 添加三档人机、调整等级、由各手机准备和行动，检查 host/public 不占座且无游戏动作或私牌；尺寸矩阵检查围桌席位、名字、按钮与横向溢出，并保存实际隐藏渲染帧。真实混合小局后原班续局，再重启确认手机身份及等级保留。加 `--portable` 对当前 ZIP 新目录解压、仅系统 PATH 运行相同检查。

本轮证据在 `artifacts/maintenance/phone-table-levels`：`room/room-portable` 为围桌／三档 UI 与实际混合小局，`development/portable` 为完整三胜及恢复，`party/party-portable` 为聚会可靠性，`ui` 为既有能力和尺寸场景。旧维护目录全部保留；卡面代码未改，verify:cards 沿用原独立卡面证据。当前包版本 1.3.0、协议 4，存档格式／游戏状态／规则／基础策略版本保持；等级缺省按默认恢复，高级记忆有独立数据版本及合法信息边界。模拟不证明 Safari 或真实手机／Wi-Fi／电视硬件通过，证据范围见 [验收](acceptance.md)。

1.0.1 的 `pnpm verify:game-ui` 使用十组真实存档场景，覆盖七组能力／基本选择、跳过两类可选能力，以及弃牌与弃顶取牌。新增独立路由、盒子来回与刷新、菜单 Escape、游戏占屏、单击意图和具体卡位确认检查；证据在 `artifacts/maintenance/game-experience/ui/`。`pnpm verify:desktop` 与 `pnpm verify:portable` 的当前证据分别进入该维护目录的 `development/` 与 `portable/`，保留 phase-06 原交付证据。

`pnpm package:win` 当前生成 `artifacts/releases/TableMax-<package.json 版本>-win-x64.zip`，`pnpm verify:portable` 解压该路径并验证真实程序。版本更新不改变现有存档 schema 或游戏／策略版本；维护范围与结果以 [验收记录](acceptance.md#首版维护独立牌桌与操作简化) 为准。

## 配置、目录与网络

正式程序默认监听 `0.0.0.0:38473`。管理窗口使用 `127.0.0.1`，手机二维码使用用户在地址列表选择的本机 IPv4。多个地址可能包含虚拟网卡，用户需选择手机可访问的地址。当前端口占用会导致启动失败并提示，不静默改用其他端口。第三阶段完善网络引导与启动反馈；自动选择可用端口尚未作为已采用方案，需求允许明确提示或选取可用端口并更新二维码。

开发 Vite 使用 `127.0.0.1:5173`，把 `/api`、`/socket.io` 转发到默认服务端口。正式运行仅由 Fastify 提供构建后的网页，不使用 Vite。开发模式的服务端口保持默认值；修改服务端口时需同步 Vite 代理。

| 内容                 | 位置／策略                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 默认本地数据         | 系统 `LOCALAPPDATA` 下的 `TableMax/`，不写入程序包或仓库                                                                                     |
| 工程验证数据库       | 数据目录 `foundation.sqlite` 与 SQLite WAL／SHM；仅保留工程启动计数，正式平台另用 room.sqlite                                                |
| 正式平台存档         | 数据目录 `room.sqlite` 与 WAL／SHM；最新记录与修订 journal，包含秘密状态，禁止公开                                                           |
| 服务日志             | 数据目录 `logs/service.log`，只记录服务启动／停止事件，不记录验证消息或秘密状态                                                              |
| Electron 浏览器数据  | 数据目录 `desktop/`，包含网页会话与缓存                                                                                                      |
| pnpm、下载与工具缓存 | 仓库 `.pnpm-store/`、`.cache/`；Git 忽略，工作区隐藏与排除监听                                                                               |
| 可再生构建           | 仓库 `build/`，Git 忽略，工作区隐藏                                                                                                          |
| 便携包与验证图／JSON | 当前 ZIP 在 artifacts/releases，维护验证在 artifacts/maintenance/game-experience；历史阶段产物保留，Git 忽略，文件树可见；搜索与监听单独排除 |
| 原型构建             | 仓库 `artifacts/phase-02/prototype/`，独立于 `build/desktop/web/`                                                                            |
| 原型截图与走查 JSON  | 仓库 `artifacts/phase-02/verification/`，Git 忽略但文件树可见；每次走查更新对应证据                                                          |
| 美术原图与前后对比   | 仓库 `artifacts/phase-02/art-reset/`；保留 imagegen 原始 PNG、透明通道／尺寸／哈希检查、联系表及同尺寸前后截图和文字测量                     |
| 第二阶段检索原始响应 | 仓库 `artifacts/phase-02/research/`，清单记录 URL、HTTP 状态、字节数与 SHA-256；不是已核验规则书                                             |
| 原型走查临时入口     | 仓库 `tmp/prototype-verify-*`，与正式服务、数据库和用户默认存档分离                                                                          |
| 跨层验证临时数据     | 仓库 `tmp/desktop-verify-*`、`tmp/portable-extracted-*` 及命令入口验证目录，使用显式测试数据目录覆盖；不会读写用户默认存档                   |
| 单元测试数据库样本   | 系统临时目录 `tablemax-*`，与正式数据分离                                                                                                    |

仅支持开发／验证覆盖的环境变量：`TABLEMAX_DATA_DIR` 指定数据位置，`TABLEMAX_HOST` 指定监听地址，`TABLEMAX_PORT` 指定端口（0 仅用于验证临时端口）。`TABLEMAX_WEB_DEV_URL` 由开发脚本设置，普通便携启动不要设置。`ELECTRON_RUN_AS_NODE` 会改变 Electron 模式，项目启动和验证脚本主动移除该变量。不要将含秘密的本地配置纳入 Git。

没有自动修改防火墙、路由器或系统服务。手机连接还受私人网络防火墙、访客网络隔离和选错网卡影响。当前完成实际本地服务和禁止外部请求的完整混合局；手机／电视按用户授权模拟，不声称实际系统浏览器或外接硬件已测。

## 清理本地中间物

清理已结束的验证时，可删除 `tmp/` 下的测试浏览器数据、隔离存档、便携包解压副本及一次性脚本；先把唯一研究资料、原图和需要保留的过程记录移入对应 artifacts 目录。`artifacts/releases/win-unpacked/` 是打包工作目录，确认对应交付 ZIP 完整且程序退出后可删除，再次执行 `pnpm package:win` 会重建。`build/` 供 `pnpm start` 使用，当前构建保留；`.pnpm-store/`、`node_modules/` 和工具缓存用于继续开发，不随测试临时文件清理。忽略目录不能一律视为废弃资料。

## 第五、六阶段完整游戏与交付

当前版本 1.0.0，默认游戏 pokemon-encounters，规则 tablemax-cn-s19-v1，状态版本 1，策略 pokemon-encounters/basic／1。已有旧验证模板存档的用户需要保留／备份原数据，在独立数据目录启动新版本；不自动覆盖不兼容存档。可在 PowerShell 设置 $env:TABLEMAX_DATA_DIR 为明确的新目录后运行程序，普通使用仍取默认 LOCALAPPDATA/TableMax。

在根目录执行 pnpm check、pnpm build；游戏 UI 改动另执行 pnpm verify:game-ui，桌面／服务集成执行 pnpm verify:desktop。pnpm package:win 会先构建，输出 artifacts/phase-06/TableMax-1.0.0-win-x64.zip；pnpm verify:portable 解压该 ZIP 后实际运行，PATH 仅系统目录。它在当前电脑执行，不自动清理或修改默认玩家数据。

2026-10-01 全套类型／静态／格式检查和 48 项测试通过。新增首版规则／计分、20 固定种子 2–5 座位完整大局、D01–D13 精确回退／重演和 3 处实际服务 SIGKILL 恢复。真实能力 UI 7 组通过，包含 5 音频解码、保存反馈、动画 CSS／animationstart 观察、减少动态、360／390 布局、44px 和确认栏遮挡检查。完整桌面与最终便携走查为 2 真人模拟加 3 个实际 Worker bot，涵盖三胜结束、回退、正常关闭／同地址重启、后台冻结和断网导航后原身份恢复；观察到的网页资源全部本地，无页面错误。

UI 合法存档 fixture 的构造入口在 scripts/fixtures/prepare-pokemon.ts，仅为开发工具，不进入便携包或提供生产调试 API。生成的临时数据在 tmp/game-ui-_、tmp/pokemon-_ 与 tmp/portable-game-*；证据在 artifacts/phase-06/verification 的 development、portable、ui 子目录。ZIP 哈希及实际内置运行时随 portable/results.json 保存。

本轮按用户明确要求只使用当前 Windows 电脑，电视、Android／iPhone 浏览器及后台／断网采用模拟；不声称 Safari、电视硬件或另一台无开发环境电脑已测。AC 具体结果、声音观察限制和后续复查边界统一见 [验收记录](acceptance.md)，使用流程见 [项目说明](../../README.md#使用便携版)。以下保留阶段历史证据，过去的“待第五／六阶段”描述表示当时状态。

## 第三、四阶段平台验证

2026-10-01 完成真实平台与恢复基础。固定工具链保持不变，新增本地工作区 platform-core 和可运行 template 游戏；protocolVersion 为 2，游戏 SDK 仍为 1（源码契约扩展），平台存档格式为 1。模板游戏／规则／状态及独立策略版本分别在 manifest 与 bot 入口声明，版本不兼容保留原存档并停止启动。

正式桌面主机显示管理操作与公共信息，手机获取独立本人身份；公共屏只读。模板可完成真人／电脑混合局和下一局；默认地址 38473，房主凭证由桌面自动取得。F11 切换全屏，Alt 的屏幕菜单可移动当前窗口；实际多屏组合仍待第六阶段。

本次执行 `pnpm check`、`pnpm build` 与 `pnpm verify:desktop`。Vitest 当前 6 个测试文件、27 项测试覆盖真实权限和消息、并发去重、保存失败／原意图重试及 bot 存储失败停止／恢复、换绑不随回退撤销、旧分支拒绝、规则／策略随机与 checkpoint、下一局生命周期、策略替换／兼容性、bot 超时／异常／旧结果取消、SQLite 重启及强制终止服务后的事务恢复。损坏 JSON、不兼容 schema 与错误座位存档读取失败保持原 room.sqlite 字节不变；测试故障及实际数据库均使用隔离临时目录。

桌面走查沿用项目 Playwright／隐藏 Electron 工具，连续两次启动验证实际加入／准备／人机结算、公共主机无本人秘密、390×844 手机模拟布局与本地请求、决策点回退及同地址重启后的原身份恢复。公共屏 1920×1080 模拟截图、关闭公共屏保留服务、退出程序关闭独立服务也通过。证据在 `artifacts/phase-03-04/verification/`：`development.json`、`host.png`、`public.png`、`player.png`、`rollback.png` 和 `result.png`，文件树可见、不提交 Git。历史阶段一证据保留；更新的验证命令输出进入第三、四阶段目录。

测试检查了 Worker 对同步无限循环的取消，正式桌面的人机流程使用构建后的 `bot-worker.cjs`。构建／便携配置已加入该文件；本阶段不把第一阶段历史 ZIP 视作新平台包，正式便携产品交付仍待第六阶段。

地址或端口变化会改变手机浏览器源，localStorage 凭证不会自动跨源迁移；由房主当面换绑可保留原座位。原服务地址下刷新／重连／重启自动使用原身份。二维码、日志及报告不包含管理或玩家凭证。服务启动失败时保留存档，不静默新建；人工排查／备份时保留 SQLite 及 WAL／SHM 文件。

这些验证证明模板及平台机制，未运行宝可梦全部能力 D01–D13、完整人机首版局、产品 AC、Android／iPhone 实机、断互联网整局或无开发环境 Windows 交付验收。第五阶段使用 [游戏场景](../games/pokemon-encounters/validation-scenarios.md) 接入完整规则和策略；第六阶段完成产品组合验收。实际接入和策略替换流程见 [游戏开发指南](../game-development/README.md)。

## 人机与封装的后续验证

新增人机和适度封装要求已有逐节点规格及原型座位／单步合成演示，已实现平台 bot 调度、模板策略与电脑座位管理，宝可梦策略与产品 AC 仍待第五、六阶段。后续沿用真实工程检查入口，并在对应游戏／平台建立以下验证后再补具体命令与结果：

- 逐节点覆盖初始化、常规／被动／复合选择及合法参数，验证策略只读取对应座位授权信息；用固定种子完成真人与电脑混合的整局场景。
- 验证 bot 的重复意图、并发选择、暂停、回退、旧分支迟到结果、重启恢复、策略异常与版本不兼容；覆盖需求 AC-19 至 AC-23，并复用 AC-06、07、09、11 至 16 的适用要求。
- 替换策略或重构封装时按影响执行规则与平台行为回归，检查模块依赖、单一状态修改入口和普通数据序列化；纯规则与计分验证独立于前端及数据库。
- 第六阶段验证正式包断开互联网后的混合人机整局；当前开发工程、原型或固定工具链验证不等于这些新增验收通过。

详细预期与责任见 [人机规格](bot-players.md) 和 [阶段总览](../tasks/README.md)。新增测试只覆盖实际行为与风险，不以无业务行为的类封装或接口桩代替验证。

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

执行日期：2026-10-01（Asia/Shanghai）。本次美术重置重新执行适用的工程与原型检查；以下只记录独立原型的合成 UI 验证。

已通过 `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm prototype:build`、`pnpm prototype:verify` 和正常 `pnpm build`。正常网页构建只有正式入口，不含原型入口和原型文字；协议、SDK 及依赖锁文件未因原型改变。

`scripts/verify-prototype.mjs` 的 10 组检查已通过：独立构建与正式 API 不可用；大厅重名／关闭加入／座位身份与准备；提交锁定／拒绝／结果未知／同步／保存反馈；掉线／暂停／回退／过期动作／换绑及弹窗取消；角色控件与公共屏声音；恢复错误与房主结束；示例网卡与网络／端口反馈；6 页 × 3 角色在 360／390 CSS 像素宽度无横向溢出、受检触控控件高度至少 44px；新增美术组检查默认关闭的审阅抽屉、座位重排后头像稳定、桌面首屏无纵向滚动、所有图像加载、手机主要操作首屏可见且不遮住选择、减少动态效果和弹窗键盘焦点；观察到的运行请求全部本地且无页面错误。结果在 `artifacts/phase-02/verification/prototype.json`，记录 `passed: true`、空外部请求列表及空页面错误列表。

走查共生成 25 张截图，其中六张交互场景与 CSS 尺寸如下：

| 文件（均在 `artifacts/phase-02/verification/`） | 内容                 | CSS 尺寸  |
| ----------------------------------------------- | -------------------- | --------- |
| `host-setup.png`                                | 房主启动与网络选择   | 1280×900  |
| `player-lobby-360.png`                          | 手机大厅             | 360×800   |
| `player-submitting-390.png`                     | 手机提交反馈         | 390×844   |
| `host-rollback.png`                             | 房主回退确认         | 1280×900  |
| `public-session-1920.png`                       | 公共屏会话占位与声音 | 1920×1080 |
| `host-save-error.png`                           | 房主存档错误提示     | 1280×900  |

美术尺寸组另保存启动／大厅／会话／结束／恢复五页的房主 1080×800、1280×900 和公共屏 1920×1080 截图，以及手机大厅／会话的 360×800、390×844 截图。文件名为 `<角色>-<页面>-<宽度>-art.png`，全部尺寸均已检查；大厅、会话、恢复和回退弹窗等代表截图已人工查看。

同状态／同尺寸前后比较保存在 `artifacts/phase-02/art-reset/comparison/`：七组房主启动／大厅／会话、公共大厅／会话和手机大厅／会话，包含 14 张对比截图、`comparison.json` 及可从根目录运行的 `measure.mjs`。比较基线为记录中的 Git commit；指标为首屏可见说明段落字符数，排除游戏名、网址、短标签及临时提交／通知，关闭的说明与首屏之外的段落不计入。减少幅度为 83.82%–100%，均达到至少 50%；回退、换绑、结束确认和错误原因另按流程保留，不以该指标删减警告。

`artifacts/phase-02/art-reset/asset-checks.json` 记录 16 张 WebP 的尺寸、字节数、哈希及 13 张切图的透明通道；原始 PNG、修订前版本和联系表保留。最终素材总量 877,318 字节；实际运行请求全部本地。`delivery-checks.json` 记录相对文档链接、正常构建隔离及九组主要文字配色对比度，均至少 4.98:1。半透明插画面板结合截图检查；这不是完整无障碍或实机验收。正常 `build/desktop/web/` 只有正式入口，无原型入口、原型文字或 WebP 美术资源。PNG 像素随系统缩放变化，本次记录的 `deviceScaleFactor` 为 1.5。安全区域使用 CSS `env(safe-area-inset-*)` 留白；桌面 Chromium 走查不能证明 iPhone 安全区、Android／iPhone 系统浏览器、真实触控或锁屏重连通过。运行请求本地的观察也不能替代断开互联网后的正式游戏整局验收。

合成 UI 的分支、绑定代数、确认、恢复与音效控件只证明界面反馈，未验证服务端权限、真实凭证失效、随机结果一致、可靠动作、实际文件保留或持久化。第三至五阶段实现对应能力，第六阶段负责实机与正式离线验收。检索响应及文件哈希另见 [规则来源与核验缺口](../games/pokemon-encounters/sources.md#规则来源与核验缺口)；完整游戏的采用基线及场景已交付；正式规则与产品验证交由后续阶段。

## 首版游戏主题原型与规格验证

第二阶段游戏入口 `/prototype.html?game=pokemon-encounters`，源码为 `GamePrototype.tsx` 与 `game-scenes.ts`；只保存合成授权投影／演示历史，没有完整秘密fixture、真实凭证、规则引擎或存档。完整规则与三小局固定fixture留在 [游戏规格](../games/pokemon-encounters/README.md)，没有导入网页。`pnpm prototype:verify:game` 使用锁定Playwright及隐藏Electron，只访问随机本地预览，输出JSON／PNG；先构建原型。尺寸／动作／动画走查不能证明真实规则、人机、权限或崩溃恢复AC已验收。

2026-10-01 游戏原型最终走查通过9组／16张PNG，记录为 `artifacts/phase-02/verification/game/game-prototype.json`，外部请求和页面错误均为空。覆盖全部能力及完整后结束、本人临时查看、提交／暂停／回退／换绑／同步、电脑合成响应与大厅开局；公共1920×1080、手机360／390、24px底部安全区模拟、220ms保存后动效及减少动态通过。安全区模拟不等于iPhone实机。`specification-data.json`记录16类56张、11份完整牌组、三小局固定对局算术与正式构建隔离；文档／来源审计在research/chinese-reference/verification.json。类型、静态、格式、独立原型及正式构建均通过，真实规则／bot／存档和产品AC未验收。

手机固定提交栏调整后，另以 `pnpm prototype:verify:game --layout-only` 通过5组／17张截图；证据在 `artifacts/phase-02/verification/game/layout/`，检查下排选格后按钮仍可见、卡位中心无覆盖及安全区。完整流程与针对性布局证据分别保留。

### 1.0.2 视觉维护验证

`pnpm verify:cards` 使用正式 CardFace／CSS 和公开类别定义，单独构建只用于验证的卡面画廊，覆盖全部 16 类在 60／68／90／110／140px 下的名称裁切、字号、数值／能力碰撞和插画边界；它不是完整对局验收。证据进入 `artifacts/maintenance/visual-polish/cards`。

`pnpm verify:game-ui` 扩展为十四组真实服务场景：十组既有能力／基本操作加 2–5 人和长昵称排布。保留每种关键阶段截图，并检查默认窗口、桌面、平板、短手机与横屏。新增弃牌浮层／Escape／修订保持及减少动态补查。`--verify-deal` 核验真实下一小局的发牌动效；`--only` 用逗号选择场景，PowerShell 中用引号包住完整参数，例如 `pnpm verify:game-ui '--only=L2,L3,L4,L5' --evidence=landscape`，把补查保存到独立子目录。参数不选择任何已知场景时直接失败，避免空跑显示通过。证据在 `artifacts/maintenance/visual-polish/ui`；开发整局和便携验证分别在同级 `development`、`portable`。历史 `game-experience`、phase-06 证据保留。

### 1.1.0 后台维护验证

verify:cards、verify:game-ui、verify:desktop、verify:portable 当前证据进入 artifacts/maintenance/pokemon-refresh，旧 visual-polish 不覆盖。测试窗口 show:false、offscreen:true、backgroundThrottling:false，capturePage(stayHidden/stayAwake) 在 DOM 更新／两帧后捕获真实帧，不 showInactive 或 focus。翻牌后独立测量静止触控尺寸；整局截图用 CDP 精确 CSS 视口，避开 Windows DPI 边框的原生 1px 舍入。随机首位测试等待合法真人动作，不注入 hostToken 取得先手。animationstart／computedStyle 记录关键效果与 reduce，刷新／回退检查不误播；仍为 Windows Chromium 模拟，非手机／Safari／电视实机。
