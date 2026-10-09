# 代码结构与工程边界

## 宝可梦原版适配与稳定复用边界（2026-10-05）

`shared/card-catalog.ts` 的纯 `createCardCatalog` 管理类别、实例及固定值；`variants/original-cards.ts` 绑定现有牌表，`shared/cards.ts` 保留兼容导出。实例ID、生成顺序和随机调用不变。`shared/creature-resources.ts` 按角色资源身份登记图片名、框色与声音，`variants/original-presentation.ts` 维护原版类别映射及切入配置；素材不复制、不改路径。

纯拓扑提供行列、横纵邻接和方形对角线；原版规则、计分与人机仍读取原版六格描述。`ui/BoardGrid.tsx` 只收布局、已授权牌位、合法／已选状态及标记；原版 `ui/cards.tsx` 解释投影与同值归零。能力摘要和阶段归原版配置，提示容器与无规则状态的 `AbilityEntrance` 可组合复用。共享会话仅接受固定或按授权视图计算的动效时长，不依赖宝可梦类别。

盒子保持一个宝可梦入口，模块目录提供 `original`／`expansion` 权威版本；新房间默认原版，管理员仅大厅或结束后可切换。原版六格与扩展九格分别维护规则、状态、策略及客户端，复用身份、拓扑、BoardGrid和事件调度；房间、存档、Worker携带版本身份，原版指纹与旧存档兼容。当前实现与未完成项见[扩展任务](../tasks/pokemon-encounters-expansion.md)。

扩展 `web/presentation.ts` 只从已保存公开结果生成场地轨迹及演出顺序，`BoardEffects.tsx` 按实际牌位几何绘制移位、盖回与翻明反馈；`SavedEffects.tsx` 从游戏内 `poses/timeline.ts` 读取14套分层SVG关节动作时长，末步按能力→公开轨迹→研究→结算安排表现，不阻塞规则推进。私看不生成公开目标；减少动态保留静态主题，取消／切换清理演出，不在恢复时追补队列。主题音配方复用共享双槽与唯一播放窗口，资源和来源见[游戏资源表](../games/pokemon-encounters/assets.md#代码矢量动作与音源收尾2026-10-06)。

## SQLite去重存储（2026-10-06）

`SaveRepository.load/save` 与外层 `Save.formatVersion=1` 保持兼容，内部SQLite采用 `user_version=2`。Checkpoint节点按内容身份与前驱保存一次，修订记录只引用历史头；累积动作确认和会话确认用独立增量链重建。回退保留原分支历史与秘密权限，管理授权继续独立于checkpoint；游戏自身当前状态和日志不在此层裁剪。

旧v1先只读，游戏兼容性验证后的下一次保存才流式导入同目录临时v2库。每条修订解码深比较、数据库检查及新保存成功后，保留原DB／WAL／SHM和可恢复迁移记录再切换；失败不替换未验证库。迁移连接开启外键和FULL同步，应用保存事务覆盖节点、修订及头像。服务审计入口 `apps/server/src/save-audit.ts`、脚本入口 `scripts/lib/save-audit.mjs` 统一解码v1／v2，不直接把 `saves.data` 当完整Save。固定载荷的磁盘增量近线性不代表任意游戏累积日志或保存CPU有界。

第一至六阶段已完成；正式运行宝可梦完整游戏，验证模板继续用于契约、策略替换和恢复回归。采用依据：[工程基础](../decisions/001-engineering-foundation.md)、[平台授权与恢复](../decisions/005-platform-authority-and-recovery.md)、[游戏目录与房主分权](../decisions/007-library-owner-and-concurrency.md)、[小体积原生桌面](../decisions/008-small-native-desktop.md)。2026-10-03 桌面外壳改为共享 WebView2，最终交付验证状态仍以 [验收记录](acceptance.md) 为准。

## 已建立的工程

| 路径                       | 当前职责                                                                   | 依赖方向                                                           |
| -------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/desktop/native`      | C# WinForms／net48／x64 窗口、私有服务管道、主机凭证、显示／声音与生命周期 | .NET Framework、WebView2；按桌面／服务协议通信，不访问数据库或规则 |
| `apps/desktop/src`         | 网页使用的桌面显示／声音 TypeScript 契约与独立控制逻辑回归                 | 不作为正式窗口入口；保留网页接口与已有控制逻辑测试                 |
| `apps/server`              | HTTP／Socket.IO、身份绑定、资源／二维码、SQLite 仓储与 bot Worker 适配     | protocol、platform-core、注册游戏；组合具体适配器                  |
| `apps/web`                 | 公共主机兼管理、只读公共屏、手机本人界面；独立合成原型                     | protocol、注册游戏 UI；不导入规则服务或完整状态                    |
| `packages/protocol`        | 平台信封、角色投影及确认、桌面／服务消息的类型与 Zod 校验                  | Zod；不依赖应用、游戏或数据库                                      |
| `packages/game-sdk`        | JSON、规则／投影／多人决策、管理生命周期、受限策略纯类型契约               | 不依赖 UI、网络、数据库、桌面运行时或具体游戏                      |
| `packages/platform-core`   | 单房间、凭证摘要授权、串行动作、checkpoint／分支、兼容校验和 bot 调度      | SDK、protocol、Node 随机凭证；不依赖具体游戏、Socket.IO 或 SQLite  |
| `games/template`           | 可玩验证游戏，独立规则、状态校验、计分、投影、策略和两端 UI                | 规则／策略仅 SDK，UI 仅 React 与投影类型                           |
| `games/pokemon-encounters` | 首版完整规则、独立计分、授权投影、基础策略、两端 UI 与本地资源             | 规则／策略仅 SDK 与纯数据，UI 仅 React 与投影类型                  |
| `scripts`                  | 构建、开发、桌面／便携／原型验证及隔离强制退出 fixture                     | 开发工具；不进入游戏规则                                           |

应用组装具体规则、策略和适配器，核心只依赖抽象契约。共享包使用 `workspace:*`，开发导出 TS 源码，Vite／esbuild 消费；严格类型检查统一覆盖 apps、packages 和 games 的 TypeScript。服务、bot Worker 和游戏输出独立 CJS，生成服务 CJS 使用生产压缩，源码继续保持可读；网页输出本地静态资源；原生桌面单独编译为 `TableMax.exe`。`global.json` 固定 .NET SDK 9.0.102，原生锁文件固定 WebView2 SDK 1.0.4258.31 和编译用 net48 引用程序集。

便携包收集原生壳、x64 WebView2 必需 DLL、官方 Node 22.14.0 的 `node.exe` 和许可证、`server.cjs`／`server.cjs.br`、`bot-worker.cjs`、`games/*.cjs`、`bots/*.cjs` 与本地网页。服务入口校验压缩载荷与还原源码的SHA-256及精确长度，在内存解压并由当前CommonJS模块编译；不另行落盘源码，保留入口、exports、require.main及文件路径语义。Worker、官方Node字节和原生Job生命周期不变；缓存与冻结同时登记两个服务文件，细节和验证见[开发环境](development.md#服务载荷无损压缩2026-10-06)。使用系统共享 WebView2 与 .NET Framework 4.8，不分发 Electron、WebView2 Fixed Version 或现代 .NET 自包含运行时；电脑无需预装 Node.js 或开发工具。缺少 WebView2 时提示用户安装官方 Evergreen Runtime，可取消，安装后正式对局仍不依赖互联网。

新增游戏前，Windows x64 ZIP 和实际解压目录内全部交付文件各自必须严格小于 120,000,000 字节；114,000,000 字节为工程预算，达到预算时报告、达到硬上限时拒绝交付。系统共享运行时、用户存档和浏览器缓存不计入交付目录；打包清单记录实际大小、文件哈希与运行时版本，并核对 ZIP 实际解压结果。

当前没有实际复用需求支持独立 `packages/ui`，因此未创建空包。首版游戏集中在 `games/pokemon-encounters/`；模块编译打包、运行时按目录选择并懒加载，不实现外部插件安装或多房间。模板注册及策略替换入口见 [扩展指南](../game-development/README.md)。

游戏数量增加后的按需下载与本地安装已列为 [未来计划](../tasks/README.md#多游戏按需安装未来计划未实现)，尚未实现；当前懒加载仍读取随程序打包的模块和资源，不代表已经支持下载游戏包。

## 独立构建与模块边界

2026-10-05 独立模块实现接续产品v1.0.2，需求见 [需求增补](../requirements/TableMax_需求文档_v1.0.md#621-游戏解耦与增量交付增补)。平台仍统一管理身份、权限、通信、保存恢复与人机调度。

`games/<id>/game-module.json` 是游戏目录、入口、兼容版本和预算的唯一组装清单。服务、Worker 与盒子读取组装后的清单；增加游戏无需修改中心名单。规则与人机分别输出 CJS，游戏网页分别执行普通入口 Vite 构建，CSS 和素材保持独立文件。正式包排除内部 template，开发构建保留它。

实际模块划分：

| 构建单元 | 内容与依赖边界                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| 平台块   | 原生桌面、Node、服务与 Worker 宿主、盒子及共享网页运行时；不包含某游戏的规则或完整 UI                      |
| 各游戏块 | 模块清单、规则、策略、网页入口及本地资源；只依赖声明的 SDK、协议、网页宿主契约与共享运行时，不依赖其他游戏 |
| 组装步骤 | 校验模块、汇总目录及轻量封面／介绍、收集文件并生成完整运行 ZIP；不在组装时隐式重建全部游戏                 |

`packages/web-host` 提供 GameHost／GameClient、授权数据与通用控件。平台的 HostedGame 绑定当前实例、分支和决策，拒绝迟到提交，再交给原有可靠命令信封。完整 RoomSession 仅存在于平台私有 Context；游戏拿不到凭证或 Socket。游戏网页入口归 `games/<id>/web/`；旧应用适配器仅为已有源码 fixture 提供兼容包装，正式加载器不导入它们。

React、React DOM 和宿主组件在 `/runtime/v1/` 只构建一份，独立入口的外部依赖映射到固定本地 ESM 路径。盒子使用轻量 catalog.json 和封面，不加载游戏脚本、完整插画或音频。网页宿主与游戏 CSS 分开输出，动态加载时先等待对应游戏 CSS。不依赖 import map，保留 Safari 16 构建目标。

清单声明 SDK／协议／网页宿主的精确兼容版本，以及规则、状态、玩法和策略版本。加载时核对实际导出，组装核对冻结元数据、完整单元、路径与哈希。缓存、预算和安全替换见 [开发环境](development.md#增量构建与分块组装需求)。规则、权限、存档外层格式不变；按需安装仍为 [未来计划](../tasks/README.md#多游戏按需安装未来计划未实现)。

## 面向对象与适度封装

第二款正式游戏 `games/modern-art/` 独立维护70卡拍卖、四轮估值、现金与暗标投影、三档策略及两端UI。规则与策略仅依赖SDK及自身纯数据；UI只读安全投影，不依赖宝可梦或桌面外壳。游戏CSS限定自身根节点，共享反馈只运输受限通用字符串。

第三款 `games/power-grid/` 独立维护经典德国城市图、电厂／经济数据、五阶段与三步、库存生产规划、现金投影、状态证明及三档策略。`MarketFlow`、`TurnFlow`、`AuctionFlow` 在单次原子动作内组合，持久状态为普通数据；最短路与生产资源规划为纯函数。UI 只读自身公开数据和授权投影，样式及 Portal 以 `pg-screen` 为根；资源与声音归本游戏。共享层只增加目录、Worker／构建与浏览器加载入口，不让平台会话依赖本游戏阶段或地图。

- 有生命周期、依赖或不变量的职责使用对象，组合优先、依赖显式传入，不引入深层继承或全局可变容器。
- `RoomCoordinator` 管理房间状态及统一命令入口；`BotScheduler` 负责任务节奏、取消与超时；`WorkerBotExecutor` 隔离计算；`SqliteSaveRepository` 执行存储事务，存档不变量校验单独维护。
- 规则变换、计分、投影与简单策略保留纯函数／无状态模块，React 使用函数组件；不把所有能力强制包进类。
- 所有游戏选择和 bot 意图共用权威动作入口；策略只返回意图，UI 和策略不能直接修改状态或访问数据库。
- 存档是普通 JSON：状态、版本、随机、身份摘要、策略记忆、有效历史和去重确认，不保存函数、连接、定时器或 Promise。
- 审查职责内聚、依赖清楚、策略可替换及无状态旁路；不为插件、难度或未来游戏铺空层级。

## 运行与入口

```text
C# WinForms / .NET Framework 4.8 / 共享 WebView2（窗口、主机身份与生命周期）
  └─ 包内 node.exe server.cjs --desktop-pipe（私有重定向 stdin / stdout）
       ├─ HTTP / Socket.IO → RoomCoordinator
       ├─ 本地网页、资源、二维码
       ├─ SqliteSaveRepository → room.sqlite
       └─ BotScheduler → 隔离 Worker → 授权意图 → 统一命令入口

/host、/public                管理／公共盒子（身份授权各自保持）
/、/player                   玩家盒子、加入与准备（根地址默认，旧路径兼容）
/host/game                   公共游戏投影 + 按需打开的房主管理
/public/game                 公共游戏投影，只读
/player/game                 独立玩家凭证 + 本人合法投影与意图
```

服务通过显式 `--desktop-pipe` 模式接收私有 JSON 行：第一条为 `{type:"start",config:ServiceConfig}`，就绪返回 `{type:"ready",port,health,hostToken}`；停止使用 `{type:"stop"}`，stdin EOF 也会正常关闭。配置、信封与每行 16 KiB 上限在服务端核验，错误安全输出，诊断走 stderr；普通独立启动的 stdout 只含无凭证就绪信息，不新增管理 HTTP 接口或改变网络协议。

服务就绪后打开主机窗口；普通启动20s超时；旧存档迁移收到实际进度后允许120s无进展、总计最多30分钟。端口占用、数据库损坏或版本不兼容时停止并提示。主机可打开另一只读公共屏，关闭它保留服务；关闭全部窗口或退出程序发送停止消息，等待保存和服务关闭，5s 后才兜底终止。原生壳先以暂停状态创建 Node 进程，加入带 `KILL_ON_JOB_CLOSE` 的 Windows Job Object 后再恢复执行；桌面异常退出也清理服务及后代。服务异常退出会停止桌面，避免保留失效管理界面。F11 切换全屏，Alt 打开“屏幕”菜单，可把当前窗口移到任一显示器；公共屏默认优先外接屏。实际外接屏和 DPI 验证范围见验收记录。

WebView2 不暴露 Node 或原生 host objects；`Bridge.js` 只保持 `window.tablemaxDisplay`／`window.tablemaxAudio` 的固定接口。原生端仅处理顶层 WebMessageReceived，核验受管理窗口、本源、当前文档 URL、host／public 对应路径和参数；拒绝手机路径、子 frame、其他源导航、任意新窗口和网页下载。主机随机凭证只由服务通过私有管道交给桌面，再通过 fragment 初始化 sessionStorage 并清理可见 URL；不进入命令行、公共输出或日志，重启后重新生成。网页路由不授予管理权限，普通浏览器直接打开 `/host` 仍只有公共授权。二维码只包含普通手机入口。

v1.0.3单EXE默认在旁边新建 `TableMax/` 专属目录，配置、数据和其中的 `app/` 运行资源均集中于此；ZIP版直接使用解压目录。数据目录由对应根目录内配置指定；保留手机身份和 SQLite／JSON 存档格式，迁移不改协议版本或数据版本。WebView2 缓存写入用户数据目录的 `desktop/webview2/`，独立显示设置仍为 `display-settings.json`。旧 Electron 写出的 SQLite 需在隔离副本上验证读取、继续保存和恢复；不以新建数据库代替兼容性验证。原生测试驱动及 CDP 仅由显式测试标志启用，正式启动不开放调试端口；验证使用后台不激活窗口与更新后的真实 WebView2 截图。

玩家身份用服务生成的随机凭证，服务器仅保存摘要；本人手机或电脑浏览器在同源 localStorage 保存凭证，排序不改变座位 ID，刷新／断线沿用身份。电脑管理员不参赛，电脑浏览器真人从网站根地址加入，旧 `/player` 保留兼容。2026-10-07 授权的换机由管理员批准，候选凭证加密与申请收据独立于 checkpoint，原子激活新凭证并撤销旧连接；跨源需申请接续。首局先手仍由游戏规则决定，旧 hostSeat 只兼容读取。主机管理权不扩展游戏秘密，线上状态来自当前有效连接，不入 checkpoint。具体接口与边界见[平台规格](phase-02-platform-spec.md#浏览器入座换机与外部连接2026-10-07)。

HTTP 提供加入、授权视图和网络地址；Socket.IO 握手绑定凭证，逐连接生成带运行期stamp／提示／互动水位的 `room:view`，`room:command` 校验信封并确认，`room:revoked` 撤销旧连接。`room:probe`一致时复用元数据，不生成权限投影；完整同步和只读动作状态查询由同一客户端票据调度。未确认的原意图先查询保存结果，显式重试沿用编号。视图序号、诊断和互动水位不进入领域修订或存档，运行时schema校验投影与ACK，不能靠UI隐藏完整状态。

1.2.0 引入的持久化加入请求回复由 RoomCoordinator 管理，`session-receipts.ts` 只负责凭证加密／解密；随机玩家凭证仍保存摘要，恢复密钥由申请浏览器持有。v1.0.4 新收据使用版本 02 的 AES-GCM 密文，密钥派生与持久化请求摘要使用不同域，摘要不能作为解密密钥；原 120 位十六进制旧密文继续读取兼容，旧格式的原有加密边界不倒写为已升级。可选 sessionReceipts 字段向前读取格式 1 旧存档；历史 bindings 兼容校验后丢弃，不再兑换，随同一次 SQLite 事务保存。当前网络协议为 7，增加目录、可空当前游戏、ownerSeatId、capabilities 和 selectionToken；历史协议 4 引入的人机等级与公开席位等级继续保留；浏览器 `useAdmission` 负责持久请求、超时和恢复确认；会话回到前台重新同步，主动换身份关闭旧 Socket 时不发送断网错误。详见 [采用理由](../decisions/005-platform-authority-and-recovery.md#加入确认与原班续局2026-10-02)。

服务 `NetworkDirectory` 每次读取系统网卡并标注、排序，保留手动选择；前端按需及定时刷新。原生 `DesktopContext` 管理服务与公共屏的防休眠生命周期，`Program.cs` 中的 `StartupError` 将安全服务错误转为中文排障提示。按数据目录取得单实例互斥锁后才启动服务；重复启动通过本地事件请求重开管理，公共屏保留时也可重新打开管理。正式窗口行为与后台验证分开。

正式网页 `App.tsx` 只组装按角色隔离的会话与页面。顶层玩家入口由 `components/PlayerFrame.tsx` 提供稳定同源手机视窗，子文档独占一份玩家会话；管理与公共页直接渲染，子文档不能使用原生桥接。窗口变化只改变视窗尺寸，不重建草稿。会话逻辑在 `session/useRoomSession.ts`，盒子和游戏外壳在 `screens/`，弹窗、邀请、管理及全屏等在 `components/`，共享素材与清单在根目录 `assets/platform/`；游戏资源及浏览器资源表在 `assets/games/<id>/`。游戏的场地、结算和选择维护在对应游戏 UI，不导入平台凭证或 Socket。页面切换不产生游戏命令；角色变化重建会话，防止沿用另一身份。

盒子 `RoomTable` 只呈现公开席位和围桌房间；开局／准备／等级设置仍由 BoxScreen 通过会话发送动作。所有真人控制入口属于浏览器 player，电脑 host/public 不参与游戏；电脑加入的真人仍是 player。SDK `BotDifficulty` 与策略可选 `difficulties` 声明支持范围，平台只保存等级、检验权限和兼容性，游戏入口按 `decide.difficulty` 分发不同算法；Worker 读取存档中的等级，不能依据 UI 昵称推断。座位与快照的等级必须一致，旧可选字段缺省为 default，checkpoint 同时恢复记忆与等级；详见 [人机边界](bot-players.md#三档智能与配置)。

## 游戏目录与授权（1.6.0）

服务的 GameRegistry 保存目录元数据和异步规则／策略加载器；RoomCoordinator.open 先读取一次存档，依据可空 manifest 加载并验证。新房间不加载游戏规则，选中时等待加载与保存完成后才发布新状态。进行中必须带明确的 `endCurrent: true`，先核验人数和 bot 等级并完成目标加载，再把旧局结束 journal 与新大厅一次提交；未知游戏、加载或保存失败都保留原状态。切换更新实例并取消旧 bot，保留座位凭证、头像及当前房主，清除准备与策略记忆。

前端 game-clients 注册游戏适配器（Screen、savedChanges、motionDuration），通用会话不导入具体游戏类型、动作或 CSS。盒子只引用小封面；进入 `/game` 后动态 import 对应 UI／资源。服务和 Worker 按同一 ID 加载独立构建入口，Worker 的随机工具使用轻量 random 子入口，避免加载平台和协议整包。模块缓存复用；退出场景释放播放器、队列、计时器和监听器。游戏 CSS 根范围同时覆盖游戏自己的浮窗内容；Portal 到 body 的共享浮窗不会继承原页面祖先，须显式附上游戏范围。

RoomView 的 self.role 保持 host／player／public。capabilities.manage 仅管理员，control 和 manageSeats 另授予 ownerSeatId 对应的真人；手机房主仍仅有本人游戏投影。set-owner 在服务校验并持久保存，owner 不进入 checkpoint。开局、暂停／恢复、replay、lifecycle 接受 control；移除其他座位与人机改名接受 manageSeats，手机房主不能移除自己。结束、切换、清空、指定房主及其他管理仍仅 manage。

上传头像由独立 HTTP 图片入口进入统一动作保存流程：锁定 pngjs 解码、检查 CRC 与尺寸／解压上限、重新编码并生成内容哈希 ID。SQLite `avatar_images` 保存 PNG BLOB，座位及 journal 只保存引用；图片插入、身份变更、确认回复与房间保存共用同一事务。只有图片请求提高限额，普通 Socket 命令不能借用别人的自定义头像。格式与数据库版本仍为 1，旧库首次上传时在事务中建表；PNG 引用缺失或哈希错误按损坏存档保护。

## 动作、随机与恢复

规则可选实现纯 `isLegalAction(state, action, seatId)`，用于无法穷举的参数化整回合动作。平台复制输入并要求明确返回 `true`，异常或其他返回值拒绝；未实现此接口的已有游戏仍按 `legalActions` 精确匹配。建议动作列表继续用于按钮与电脑玩家输入，不替代完整动作的权威校验。生命周期动作保留独立列表和管理授权，不能借此接口扩大权限。拉密的具体牌实例守恒、首出和百搭证据见[权限与决策规格](../games/rummikub/information-and-decisions.md)。

SDK 的可选纯 bot `observe` 接口在成功游戏动作／生命周期动作后运行；平台为每个 bot 复制本人的玩家投影及记忆，校验新记忆后与动作同一事务提交。观察不运行搜索，不取得完整状态；保存失败、回退和重启均沿用现有事务／checkpoint 语义。外层存档和平台协议无需增加字段。

| 能力              | 当前机制                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 串行／去重        | 单房间队列；实例、修订、分支及决策绑定；同编号同内容返回原 ACK，编号冲突拒绝，旧分支拒绝                                                 |
| 事务确认          | 副本执行规则，最新存档与修订 journal 同事务写入；COMMIT 后交换权威状态、广播、ACK；保存失败不推进状态                                    |
| 多人／多步决策    | SDK 返回逐座位决策数组，规则确定合法参数与行动者；平台不假定其等于正常 turnSeat                                                          |
| 管理生命周期      | 下一局等意图由规则列出，经房主授权走同一随机、事务与 checkpoint；暂停禁推进                                                              |
| before checkpoint | 每个接受的游戏／生命周期动作保留完整 before 游戏及策略数据，标签不含秘密意图值；自动步骤并入同一事务                                     |
| 回退              | 仅允许有效链目标；恢复 before、截断后续有效历史、递增 branch／revision；保留当前身份，先暂停，旧连接选择／bot 结果失效                   |
| 随机              | 平台 xorshift32 规则与策略状态分开保存，初始化种子由平台产生；回退重演同边界与意图，不偷偷重随机                                         |
| 存储／兼容        | SQLite WAL 与 FULL，分别核验平台格式、游戏／规则／状态与策略版本；完整历史也校验，损坏／不兼容保留原文件                                 |
| 重启              | 只恢复已提交记录，已进行对局先暂停并增加分支，身份沿用，等待真人重连和房主继续                                                           |
| bot               | 本人投影、合法动作和本人记忆输入，实际游玩 1500／1800／2200ms、测试 40ms，2s 计算预算；Worker 取消可终止同步循环，异常安全暂停，不代真人 |

追加 journal 保留旧分支及旧实例，但客户端没有完整历史查询接口。回退安全标签也仅给电脑管理员；游戏安全记录保存于状态，room:feedback 只在事务成功后发送，携带 instanceId／branch／revision 和公开事件；同步、重复确认和回退不重放。调试修改按 [需求第6.5节](../requirements/TableMax_需求文档_v1.0.md#65-跨游戏调试与纠错后续独立规划) 独立规划，未开放特权投影。

1.6.0 独立决策用 SDK concurrencyGroup 显式声明，初始翻牌 id 在同小局内按座位保持。gameWindow 保存组与最低修订，管理／暂停／恢复／换局等关闭窗口；readyWindow 还记录各座位最后准备修订，防止同人的旧准备覆盖新取消。只有对应窗口允许过时修订，其他冲突继续拒绝并同步。玩家本地选牌依赖 selectionToken，保存动画使用独立修订编号。

copySave 复制将变化的席位、凭证、receipt、历史数组等容器，共享不可变 before checkpoint；规则纯函数负责游戏状态变换。事务成功才替换 this.save，回退单独复制被恢复游戏和策略数据。格式仍为 1，旧版缺失 owner／窗口字段有明确默认；无游戏存档与 1.5.0 宝可梦存档均有测试。历史仍完整保留，SQLite journal 不在本轮重构。

## 独立原型与验证分层

`apps/web/prototype.html`、`vite.prototype.config.ts` 与 `src/prototype/` 继续独立构建合成状态到 `artifacts/phase-02/prototype/`，不连接服务或获取身份。正式平台复用既有封面、骰子和六个头像的 WebP 原图及来源清单，没有导入原型控制逻辑。首版主题资源位于 assets/games/pokemon-encounters，来源与生成记录独立维护。

核心验证包括授权、并发重复、故障、随机、回退、身份不倒退与策略替换；服务层使用真实 Socket.IO／SQLite、强制终止服务和 Worker 同步循环取消；桌面脚本检查正式首版混合人机完整游戏、回退、两次启动与服务退出。规则模块与完整人机测试在具体游戏内完成，宝可梦 D01–D13 逐边界恢复及实际能力崩溃另有专项测试；产品 AC 的证据和模拟范围见 [验收记录](acceptance.md)。适用命令、证据及实机限制统一见 [开发环境](development.md)。

## 资源与保存结果表现

根目录 assets 是全部运行／原型美术与声音的唯一归属，按 platform 和 games 分组，未采用候选归档在 artifacts；替换入口见 [资源说明](../../assets/README.md)。游戏 catalog 只供浏览器加载，规则、策略及存档不依赖素材文件名。

游戏 UI 的 savedChanges 从授权投影计算卡位与公开结果变化，SavedEffects 表现硬币、能力及结算；平台会话只在匹配实例／分支／修订的保存反馈到达后激活动画。任何新修订先清除旧动画，断开、同步、暂停和回退清理表现，不回放历史。表现层不生成随机结果，不阻塞合法动作。

1.4.0 协议 5 新增 `playMode` 与房主 `set-play-mode`。设置在房间层保存而不进入游戏 checkpoint；旧字段缺失默认 `play`，普通桌面启动显式 `play`，隐藏测试启动显式 `test`。BotScheduler 用当前实例／修订／分支／决策／策略／等级／模式识别同一任务，单纯在线状态通知保留等待和计算；正常替换取消与超时失败分开，不能因朋友重连误暂停，也不能因不断连接把等待无限延后。

SDK `PublicEvent.action` 及首版历史可选记录真实行动者、动词、公开类别／能力与公开目标格；`public-actions.ts` 只从已执行合法动作提取白名单信息，保存校验拒绝额外字段、未知座位／格号与私看细节。旧事件缺字段仍可加载。前端 ActivityFeed 用元数据和当前昵称组装静态播报与近期浮窗；peek／close 只带喷火龙类别及空位置列表，不带查看格、值或实例。目标边框与保存动效分别维护，测试模式禁动效／声音，静态授权结果仍可读。OverlayPanel 用原生 modal dialog 和 portal 管理焦点、遮罩及唯一标题；管理确认独立弹窗，显著结束入口只由电脑管理员可见。

原生 `DesktopContext` 管理游戏窗口的播放资格：公共屏优先，最后公共屏离开后交回管理员；保留固定 connect／disconnect／claimEvent／subscribe 接口，校验窗口、顶层、本源与路由。已保存事件键在桌面端统一去重，队列有界；文档已提交导航才清理资格，打开公共屏时被拦截的导航不能误清管理员。静音偏好保存在本地并跨同源窗口同步，手机不建立播放器；TypeScript 控制逻辑仍保留独立回归入口。

## 电脑显示控制

`DisplaySettings` 为盒子／游戏提供同一浮窗；`apps/desktop/native/NativeWindow.cs` 负责原生窗口与缩放，`DisplaySettings.cs` 负责几何与独立配置，TypeScript `display-types.ts` 保留网页契约。WebView2 桥接仅公开固定的读取／更新／订阅接口；原生端核验受管理窗口、本源、对应 host／public 路径及顶层，拒绝手机路径、子 frame 和无效配置。显示控制不经过游戏命令或数据库，`display-settings.json` 保留版本 1 及 host／public 偏好，与玩家存档分开；原子写入失败不会声明配置已保存。

当前使用独立 WebView2 控件的 `ZoomFactor` 与 PerMonitorV2 DPI，管理和公共窗口分别应用缩放。自动比例来自原生内容窗口的 DIP 宽高与 1920×1080 基准，不能读取已缩放的 `innerWidth` 再反馈计算。分辨率预设先按当前显示器 DPI 转为 DIP；界面大小叠加用户倍率，限制到窗口可用空间与三倍上限。resize／全屏／显示器变化重新计算，页面导航和刷新应用当前窗口偏好；房主管理与公共屏分别持久化最近选择，作为新开窗口／重启的默认值，不覆盖其他已打开窗口。关闭与迟到事件先判断窗口／浏览器存活，避免阻断退出。

此前 Electron 44 的 isolated zoom、utilityProcess 与 preload 属于旧实现；原交付证据保留，不作为新原生壳通过依据。迁移采用理由与重新验收责任见 [决策 008](../decisions/008-small-native-desktop.md)。

共享互动配置／协议位于`packages/protocol/src/interactions.ts`及相邻JSON；服务即时派发在`apps/server/src/interactions.ts`，只使用房间身份与实例／分支上下文。`apps/web/src/interactions/`独立组装手势、透明显示和浏览器音频，原生互动桥接与游戏声音通道分离。游戏规则／会话存档不依赖互动素材或播放。
