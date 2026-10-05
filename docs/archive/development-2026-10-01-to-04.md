# 开发与验证历史：2026-10-01 至 2026-10-04

本页于 2026-10-04 从开发环境页归档，保留阶段开发、旧版本验证、旧 Electron 方法、清理结果及原证据边界；第一阶段清点追溯到 2026-09-30。原文中的“当前”“后续”与版本号均指记录形成时的状态，不作为今天的推荐命令，也不将旧运行时或局部通过结论升级为当前交付验收。当前操作统一从 [开发环境](../reference/development.md) 进入，当前包及实际通过范围见 [验收记录](../reference/acceptance.md)。

## 环境清点与选型记录

第一阶段（2026-09-30 至 2026-10-01）已清点开发环境：Windows 内核版本 `10.0.26200`、x64，Node.js `22.14.0`，pnpm `10.12.1`，Git `2.55.0.windows.3`。Windows 的 `10.0` 内核版本号不表示目标改为 Windows 10；目标系统按用户确认的 Windows 11 记录。第二阶段沿用锁定依赖，未升级工具链。

第一阶段选择 TypeScript 5.9.3 的依据是锁定的 typescript-eslint 8.71.0 声明支持 `<6.1.0`；当时检索到的 TypeScript 最新主版本为 7，不将所有工具机械升级到 latest。Vite、Vitest 和 ESLint 的 Node 下限与本机开发运行时兼容，历史选型依据见 [工程基础决策](../decisions/001-engineering-foundation.md)。本页版本描述的是仓库锁定状态，不代表持续查询的最新版本。

## 旧版本维护验证记录

### 游戏库、并发与内存验证（1.6.0）

本节完整矩阵适用于相关游戏、平台或界面实现变更。仅重新编号版本及修改开发文档时，检查格式、链接、脚本与配置，再执行 `pnpm package:win`（已包含构建）和 `pnpm verify:portable` 验证最终 ZIP；游戏源码未变的功能专项沿用既有通过证据。便携验证会检查运行程序的应用版本与根目录版本一致，避免只改文件名。

先执行 `pnpm check`、`pnpm build`，再按改动运行 `pnpm verify:experience`、`pnpm verify:game-ui`、`pnpm verify:desktop` 和显示／聚会专项。验证入口按根目录 `package.json` 版本选择证据目录，当前为 `artifacts/maintenance/v1.0.2/`；原 1.6.0 证据保留在 `artifacts/maintenance/v1.6.0/`：完整对局为 `development`／`portable`，新版操作为 `experience`／`experience-portable`，能力／卡面为 `ui`／`cards`，专项投影视觉为 `effects`，显示为 `display/development`／`display/portable`，聚会、等级及呈现仍用 `party`、`room`、`presentation` 及各自 `-portable` 子目录。旧版 `display-resolution` 等历史证据不覆盖。命令入口存在不代表验证已通过；便携结果必须对应最终 ZIP 的实际执行与哈希，不能由开发构建推定。

游戏元数据和加载器分别维护在服务注册表与 `apps/web/src/game-clients/registry.ts`。盒子只需要目录信息与缩略图；进入 `/game` 后加载对应客户端、样式和资源。服务按选择或存档 manifest 加载对应规则，Worker 按任务加载对应策略；`build/desktop/games/*.cjs`、`bots/*.cjs` 与前端分块一起本地打包。已加载模块可在进程内复用，回盒子卸载游戏界面不等于清除 JavaScript 模块缓存。正式目录展示宝可梦、现代艺术和电力公司；内部 `template` 用于切换、容量及策略兼容验证，不作为完整产品游戏。现代艺术的独立规则／三档策略／本地美术说明见 [游戏规格](../games/modern-art/README.md)，原接入专项证据保留于 `artifacts/maintenance/v1.0.0/modern-art/development` 与 `portable`；电力公司原接入验证在 `artifacts/maintenance/v1.0.1/power-grid/`，组件 fixture 在 `ui/`，自然混合局、恢复与最终便携证据在 `runtime/`；实际范围见历史验收。

`pnpm verify:memory` 先从当前源码提取 `copySave`，与 1.5.0 基线的整份 `structuredClone` 在独立 `--expose-gc` Node 进程比较；可用 `--baseline-ref=<Git修订>` 指定另一个确实包含旧复制方式的基线。六席／1,200 checkpoint／1,200 receipt fixture 由合法六席快照扩展并经生产存档校验，不宣称已实际游玩 1,200 步。随后对实际后台 WebView2 连续执行 20 轮开始、结束、回盒子及重新选择同游戏，记录 GC 后 renderer heap、DOM、监听器和本应用进程内存。结果在对应版本目录的 `memory/results.json`（既有 `artifacts/maintenance/v1.0.0/` 与 1.6.0 Electron 测量保留，单纯编号导出不重测内存）；临时入口、数据和 fixture 在 `tmp/runtime-memory-*`。`--copy-only` 不启动桌面，`--desktop-only` 保留已有复制测量并追加桌面结果；后者需先构建。不同运行时的绝对工作集不能直接比较为游戏优化收益。

内存结果只说明测量配置下的复制分配、耗时和导航回归；并行工程负载可能影响耗时与工作集，不使用整台电脑 RAM 评价本应用。当前按字段复制仍保留全部有效回退历史，完整存档序列化和历史体积仍随对局增长，不能写成长期有界内存。磁盘阈值维护使用下节清理工具，与运行时 RAM 分开。

### 聚会可靠性维护验证（1.2.0）

`pnpm verify:party` 验证当前开发构建，使用隔离数据、后台 WebView2 和实际本机网卡 IPv4（监听 0.0.0.0），覆盖网卡名称／刷新／选择保持、已保存但丢失的加入回复与同请求确认重试、刷新／真实程序重启后确认、250ms 延迟和带宽限制、断网／冻结恢复、回退上下文与筛选、原班第二大局、重复启动、公共屏保留时恢复管理员窗口以及真实端口占用的中文错误日志；1.6.0 另确认已删除的兑换接口拒绝请求。不会修改防火墙、路由器或默认玩家存档；本机网卡地址可达并不证明真实手机或实际 Wi-Fi 已验收。启动前运行 `pnpm build`。正式包验证使用 `pnpm verify:party --portable`，新目录解压 ZIP、子进程 PATH 仅系统目录，证据独立进入 `party-portable`。

1.2.0 的 verify:desktop／verify:portable／verify:game-ui／verify:party 证据在 `artifacts/maintenance/party-reliability` 保留，历史 pokemon-refresh 不覆盖。整局驱动器在随机电脑先手时处理闪电鸟等真人被动选择，再观察真人正常回合；完整三胜结算后实际保留五座位、三 bot 和手机凭证，重新准备并启动新大局。该版包按 package.json 的 1.2.0 输出到 `artifacts/releases`；存档格式、游戏状态与策略版本保持，网络协议为 3。

普通便携启动保持端口 38473：占用时停止并展示具体原因及排障建议，不静默换端口。网卡可手动刷新并自动跟踪变化；手机身份仅在原浏览器源恢复，地址或端口变化后的新源不能自动沿用身份。1.6.0 已删除换绑，应优先恢复原地址；确需重新入座时由管理员处理旧座位，原座位不能通过绑定码迁移。服务运行期间防自动休眠，公共屏可见时保持亮屏，退出恢复系统正常电源行为。手动休眠或关机仍可能中断服务。

正式桌面原生 Alt → 程序菜单提供“打开房主管理”“打开日志目录”；`LOCALAPPDATA/TableMax/logs/desktop.log` 保存启动失败的具体原因，`service.log` 保存服务生命周期。损坏／不兼容存档保持原文件，排障前备份 room.sqlite 和 WAL／SHM。验收见 [聚会维护记录](../reference/acceptance.md#首版维护聚会可靠性与连续游玩)。

### 手机围桌与等级验证（1.3.0）

`pnpm verify:room-levels` 使用真实桌面／独立服务和本地 Worker，手机采用独立 Chromium partition、触控视口和二维码普通加入 URL。实际 UI 添加三档人机、调整等级、由各手机准备和行动，检查 host/public 不占座且无游戏动作或私牌；尺寸矩阵检查围桌席位、名字、按钮与横向溢出，并保存实际隐藏渲染帧。真实混合小局后原班续局，再重启确认手机身份及等级保留。加 `--portable` 对当前 ZIP 新目录解压、仅系统 PATH 运行相同检查。

本轮证据在 `artifacts/maintenance/phone-table-levels`：`room/room-portable` 为围桌／三档 UI 与实际混合小局，`development/portable` 为完整三胜及恢复，`party/party-portable` 为聚会可靠性，`ui` 为既有能力和尺寸场景。旧维护目录全部保留；卡面代码未改，verify:cards 沿用原独立卡面证据。当前包版本 1.3.0、协议 4，存档格式／游戏状态／规则／基础策略版本保持；等级缺省按默认恢复，高级记忆有独立数据版本及合法信息边界。模拟不证明 Safari 或真实手机／Wi-Fi／电视硬件通过，证据范围见 [验收](../reference/acceptance.md)。

1.0.1 的 `pnpm verify:game-ui` 使用十组真实存档场景，覆盖七组能力／基本选择、跳过两类可选能力，以及弃牌与弃顶取牌。新增独立路由、盒子来回与刷新、菜单 Escape、游戏占屏、单击意图和具体卡位确认检查；证据在 `artifacts/maintenance/game-experience/ui/`。`pnpm verify:desktop` 与 `pnpm verify:portable` 的当前证据分别进入该维护目录的 `development/` 与 `portable/`，保留 phase-06 原交付证据。

`pnpm package:win` 当前生成 `artifacts/releases/TableMax-<package.json 版本>-win-x64.zip`，`pnpm verify:portable` 解压该路径并验证真实程序。版本更新不改变现有存档 schema 或游戏／策略版本；维护范围与结果以 [验收记录](../reference/acceptance.md#首版维护独立牌桌与操作简化) 为准。

## 第五、六阶段完整游戏与交付

当前应用版本 1.0.2，首版游戏 pokemon-encounters 的规则 tablemax-cn-s19-v1、状态版本 1、基础策略 pokemon-encounters/basic／1 保持；正式入口可选择三款游戏。已有旧验证模板存档的用户需要保留／备份原数据，在独立数据目录启动新版本；不自动覆盖不兼容存档。可在 PowerShell 设置 $env:TABLEMAX_DATA_DIR 为明确的新目录后运行程序，普通使用仍取默认 LOCALAPPDATA/TableMax。

当前在根目录执行 pnpm check、pnpm build；游戏 UI 改动另执行 pnpm verify:game-ui，桌面／服务集成执行 pnpm verify:desktop。pnpm package:win 会先构建，输出 artifacts/releases/TableMax-1.0.2-win-x64.zip；pnpm verify:portable 解压该 ZIP 后实际运行，PATH 仅系统目录。第五、六阶段历史包曾位于 artifacts/phase-06，以下 2026-10-01 结果仍属于当时工程与运行时，不覆盖为新原生壳验收。

2026-10-01 全套类型／静态／格式检查和 48 项测试通过。新增首版规则／计分、20 固定种子 2–5 座位完整大局、D01–D13 精确回退／重演和 3 处实际服务 SIGKILL 恢复。真实能力 UI 7 组通过，包含 5 音频解码、保存反馈、动画 CSS／animationstart 观察、减少动态、360／390 布局、44px 和确认栏遮挡检查。完整桌面与最终便携走查为 2 真人模拟加 3 个实际 Worker bot，涵盖三胜结束、回退、正常关闭／同地址重启、后台冻结和断网导航后原身份恢复；观察到的网页资源全部本地，无页面错误。

UI 合法存档 fixture 的构造入口在 scripts/fixtures/prepare-pokemon.ts，仅为开发工具，不进入便携包或提供生产调试 API。生成的临时数据在 tmp/game-ui-_、tmp/pokemon-_ 与 tmp/portable-game-*；证据在 artifacts/phase-06/verification 的 development、portable、ui 子目录。ZIP 哈希及实际内置运行时随 portable/results.json 保存。

本轮按用户明确要求只使用当前 Windows 电脑，电视、Android／iPhone 浏览器及后台／断网采用模拟；不声称 Safari、电视硬件或另一台无开发环境电脑已测。AC 具体结果、声音观察限制和后续复查边界统一见 [验收记录](../reference/acceptance.md)，使用流程见 [项目说明](../../README.md#开始对局)。以下保留阶段历史证据，过去的“待第五／六阶段”描述表示当时状态。

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

详细预期与责任见 [人机规格](../reference/bot-players.md) 和 [阶段总览](../tasks/README.md)。新增测试只覆盖实际行为与风险，不以无业务行为的类封装或接口桩代替验证。

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

1.1.0 的 verify:cards、verify:game-ui、verify:desktop、verify:portable 证据进入 artifacts/maintenance/pokemon-refresh，旧 visual-polish 不覆盖。测试窗口 show:false、offscreen:true、backgroundThrottling:false，capturePage(stayHidden/stayAwake) 在 DOM 更新／两帧后捕获真实帧，不 showInactive 或 focus。翻牌后独立测量静止触控尺寸；整局截图用 CDP 精确 CSS 视口，避开 Windows DPI 边框的原生 1px 舍入。随机首位测试等待合法真人动作，不注入 hostToken 取得先手。animationstart／computedStyle 记录关键效果与 reduce，刷新／回退检查不误播；仍为 Windows Chromium 模拟，非手机／Safari／电视实机。

## 1.4.0 游玩呈现与六人验证

正常启动采用游玩模式；房主在盒子或游戏页按 `Ctrl+Shift+F12` 打开隐藏运行模式窗口。测试模式与游玩使用相同的权威动作、持久化和恢复链路，只加速人机并省略动效／声音。桌面 `--tablemax-test-mode` 显式选择测试，`--tablemax-play-mode` 显式选择游玩；隐藏验证已有 `--foundation-test` 默认测试，生产节奏验证用它同时加 `--tablemax-play-mode`，不能把隐藏启动写成可见普通启动实测。

`pnpm verify:presentation` 通过独立手机分区验证六真人自然小局、浮窗关闭和焦点、结束确认、星标和公开行动、实际保存动画／音频调用，以及三档真实 Worker 在两种模式的时序与暂停／切换／结束取消；加 `--portable` 检查最终 ZIP。`pnpm verify:game-ui` 为十五组实际能力／2–6 人 fixture，保留多尺寸与秘密查看隔离；`pnpm verify:cards` 直接用正式六人保存状态渲染全部 16 类，检查图像加载、字号和三个卡面分区，不再只验证独立组件画廊。

本轮证据根为 `artifacts/maintenance/six-player-presentation`，包括 `development`／`portable`、`party`／`party-portable`、`room`／`room-portable`、`presentation`／`presentation-portable`、`ui` 和 `cards`。全部窗口隐藏、数据隔离、截图来自更新后的真实渲染，历史记录保留；测试范围仍为当前 Windows 与 Chromium 尺寸／触控模拟。具体执行结果见 [1.4.0 验收](../reference/acceptance.md#首版维护游玩节奏与六人提示)。

打包每次使用独立的 `artifacts/releases/package-<版本>-<随机后缀>` 目录生成 `win-unpacked` 和 ZIP，成功后才把 ZIP 复制到标准 release 路径。这样已有解压程序正在运行时无需关闭它，也不会覆盖被 Windows 锁定的旧 `win-unpacked`；输出保持可见，按实际需要人工整理。

### 1.5.0 多分辨率显示验证

`pnpm verify:display` 使用真实隐藏 Electron 与隔离服务／数据，通过各自手机页面加入六位真人，核验电脑房间和六人牌桌在 1280×720、1920×1080、2560×1440、3840×2160 原生内容尺寸的首屏、卡牌、文字和浮窗。原生页面 zoom 改变 CSS 视口，因此电脑场景直接设置窗口内容尺寸，不用 CDP 固定视口覆盖它；记录 DIP 窗口、CSS 视口、DPI、页面倍率与截图尺寸，避免把模拟口径混用。

专项覆盖预设／100–150% 界面、窗口变化、浮窗焦点、刷新／重启恢复、同源房主与公共屏独立缩放、手机无设置且不受影响、系统显示器配置保持；通过实际菜单暂停和恢复，另查两端四档尺寸与 4K 三档界面大小的提示、恢复按钮及 36 张牌全部首屏。`--force-device-scale-factor=1.5` 模拟原生显示器 DPI；Electron 离屏绘制的渲染密度仍为 1，另用 CDP 的 1.5 密度和零宽高参数模拟像素密度而不覆盖窗口视口。记录两种密度及实际 PNG 尺寸，不将它们写成实体 4K 显示器或电视实测。开发与最终便携证据分别进入 `artifacts/maintenance/display-resolution/development` 和 `portable`；临时隔离数据／ZIP 解压进入 `tmp/display-*`。便携模式解压当前标准 ZIP，以仅系统目录 PATH 运行，记录最终哈希；历史 1.4.0 验收不覆盖。

电脑显示配置保存在数据目录的 `display-settings.json`，与 `room.sqlite` 分开；设置损坏时采用自动适配，写入失败在浮窗提示且不改变已保存偏好。1.5.0 当时的 Electron 包含 `preload.cjs`；当前原生桥接嵌入 TableMax.exe，继续保持网页接口和设置格式。以上 1.5.0 的离屏／DPI 方法与证据属于历史，当前后台验证方法见 [原生桌面后台验证](../reference/development.md#原生桌面后台验证)。使用入口和行为见 [电脑显示规格](../reference/phase-02-platform-spec.md#电脑多分辨率显示150)。

## 历史清理记录

2026-10-02 用户要求清除历史版本，已移除 0.1.0 至 1.3.0 的七个 ZIP，以及 phase-01／phase-06／releases 下三个旧 `win-unpacked`；当次保留 1.4.0 ZIP、解压程序和打包目录。历史原图、截图及 JSON 保留，以下历史包路径只用于追溯当时交付；详情见 [清理记录](../../artifacts/maintenance/release-cleanup-2026-10-02/cleanup.json)。打包不会自动清除其他版本。

同日新一轮清理按用户要求移除 1.4.0 程序包及已结束的中间物，当前 1.5.0 ZIP 保持原哈希；结果及清理工具验证见 [本轮记录](../../artifacts/maintenance/cleanup-history/tool-checks/legacy/cleanup-summary.json) 与 [20 项隔离检查](../../artifacts/maintenance/cleanup-history/tool-checks/legacy/tool-tests.json)。

## 历史材料与产物位置

- 长期需求、规则规格、来源清单和必要游戏资源属于项目资料；放入对应主题，不混入临时目录。
- 本地实验、临时导出或下载中间文件可放入根目录 `tmp/`（需要时创建）；不作为长期资料入口。
- 未采用的等待背景原图和来源归档在 `artifacts/phase-02/theme-preparation/`；不再占用运行资源目录。清理临时研究目录时，有历史价值的资料先归入 `artifacts/phase-02/research/`，重复下载与一次性脚本不长期保留。
- 根目录 `build/` 已用于可再生构建中间物，`dist/` 为保留的构建排除项。工程验证截图与 JSON 证据保存在 `artifacts/phase-01/`；第二阶段原型构建、检索原始响应和走查证据在 `artifacts/phase-02/`。第三、四阶段真实平台截图与 JSON 在 `artifacts/phase-03-04/verification/`。第五阶段原图／素材检查在 artifacts/phase-05/imagegen；第六阶段 desktop／portable／ui 验证在 artifacts/phase-06。版本 ZIP 输出到 `artifacts/releases/`；1.5.0 显示证据保留在 `artifacts/maintenance/display-resolution/`，原 1.6.0 各专项保留在 `artifacts/maintenance/v1.6.0/`，当前 v1.0.2 新验证进入 `artifacts/maintenance/v1.0.2/`，各历史版本证据目录保留原归属。WebView2 迁移记录位于其 `webview2/` 子目录，迁移前 Electron 同版本证据保留在 `before-webview2/`；便携是否通过以最终 ZIP 对应实际记录为准。历史程序包及已结束中间物的清理见 [开发说明](../reference/development.md#清理本地中间物)，清理日志在 `artifacts/maintenance/local-cleanup-*`，一次性脚本先归档；历史证据与原始素材保留，上述本地产物 Git 忽略但文件树保持可见。
- `tmp/experience-*` 包含新版操作验证的隔离数据与便携解压，`tmp/runtime-memory-*` 包含临时复制模块、规模化存档 fixture 和桌面数据；已结束且满足安全条件时可清理，长期 JSON／截图在对应 `artifacts/maintenance/v1.6.0/` 子目录保留。容量维护流式统计且跳过链接和嵌套仓库，不能因总量超标删除依赖、工具缓存、正式数据或证据。
- `artifacts/phase-02/prototype/` 是可再生原型构建，`verification/` 是对应走查证据，`research/` 是已保存的检索响应与哈希清单。资料是否可再生分别判断，不能因同在 artifacts 下就覆盖或删除原始响应。路径与命令见开发说明，资料适用性见 [规则来源与核验缺口](../games/pokemon-encounters/sources.md#规则来源与核验缺口)。
- `artifacts/phase-02/research/chinese-reference/s14/` 保存用户三张原始中文截图、尺寸／哈希和牌面转录；叠图数量已由 S17 核对为 56，原始观察及原图保留；完整采用表在 docs/games/pokemon-encounters/cards.json，原图不直接导入运行时。
- `artifacts/phase-02/art-reset/` 保存 imagegen 原始 PNG、素材检查、三端同尺寸前后对比与文字密度测量；`verification/before-art-reset/` 保留重置前截图。原始图像与历史证据不被原型构建覆盖。
- 原始规则资料、数据、正式资源和最终交付物不按扩展名笼统忽略；是否提交按实际用途、来源与需要决定。
- 运行数据默认放在系统当前用户 `LOCALAPPDATA` 下的 `TableMax/`，具体位置和验证覆盖方式见 [开发说明](../reference/development.md)。已有 foundation.sqlite 工程计数及 room.sqlite 平台存档；测试使用隔离目录，不触碰默认玩家存档。
- 忽略规则不是删除授权；已有资料不自动迁移、重命名或取消跟踪。
