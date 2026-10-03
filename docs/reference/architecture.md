# 代码结构与工程边界

第一至六阶段已完成；正式运行宝可梦完整游戏，验证模板继续用于契约、策略替换和恢复回归。采用依据：[工程基础](../decisions/001-engineering-foundation.md)、[平台授权与恢复](../decisions/005-platform-authority-and-recovery.md)、[游戏目录与房主分权](../decisions/007-library-owner-and-concurrency.md)。

## 已建立的工程

| 路径                       | 当前职责                                                               | 依赖方向                                                          |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `apps/desktop`             | Electron 窗口、独立服务生命周期、主机凭证交接、显示器移动与全屏        | protocol、Electron；不访问数据库或规则                            |
| `apps/server`              | HTTP／Socket.IO、身份绑定、资源／二维码、SQLite 仓储与 bot Worker 适配 | protocol、platform-core、注册游戏；组合具体适配器                 |
| `apps/web`                 | 公共主机兼管理、只读公共屏、手机本人界面；独立合成原型                 | protocol、注册游戏 UI；不导入规则服务或完整状态                   |
| `packages/protocol`        | 平台信封、角色投影及确认、桌面／服务消息的类型与 Zod 校验              | Zod；不依赖应用、游戏或数据库                                     |
| `packages/game-sdk`        | JSON、规则／投影／多人决策、管理生命周期、受限策略纯类型契约           | 不依赖 UI、网络、数据库、Electron 或具体游戏                      |
| `packages/platform-core`   | 单房间、凭证摘要授权、串行动作、checkpoint／分支、兼容校验和 bot 调度  | SDK、protocol、Node 随机凭证；不依赖具体游戏、Socket.IO 或 SQLite |
| `games/template`           | 可玩验证游戏，独立规则、状态校验、计分、投影、策略和两端 UI            | 规则／策略仅 SDK，UI 仅 React 与投影类型                          |
| `games/pokemon-encounters` | 首版完整规则、独立计分、授权投影、基础策略、两端 UI 与本地资源         | 规则／策略仅 SDK 与纯数据，UI 仅 React 与投影类型                 |
| `scripts`                  | 构建、开发、桌面／便携／原型验证及隔离强制退出 fixture                 | 开发工具；不进入游戏规则                                          |

应用组装具体规则、策略和适配器，核心只依赖抽象契约。共享包使用 `workspace:*`，开发导出 TS 源码，Vite／esbuild 消费；严格类型检查统一覆盖 apps、packages 和 games。服务、桌面和 bot Worker 输出独立 CJS，网页输出本地静态资源。便携包收集 `main.cjs`、`server.cjs`、`bot-worker.cjs`、`games/*.cjs`、`bots/*.cjs` 与网页，不依赖电脑预装 Node.js。

当前没有实际复用需求支持独立 `packages/ui`，因此未创建空包。首版游戏集中在 `games/pokemon-encounters/`；模块编译打包、运行时按目录选择并懒加载，不实现外部插件安装或多房间。模板注册及策略替换入口见 [扩展指南](../game-development/README.md)。

## 面向对象与适度封装

- 有生命周期、依赖或不变量的职责使用对象，组合优先、依赖显式传入，不引入深层继承或全局可变容器。
- `RoomCoordinator` 管理房间状态及统一命令入口；`BotScheduler` 负责任务节奏、取消与超时；`WorkerBotExecutor` 隔离计算；`SqliteSaveRepository` 执行存储事务，存档不变量校验单独维护。
- 规则变换、计分、投影与简单策略保留纯函数／无状态模块，React 使用函数组件；不把所有能力强制包进类。
- 所有游戏选择和 bot 意图共用权威动作入口；策略只返回意图，UI 和策略不能直接修改状态或访问数据库。
- 存档是普通 JSON：状态、版本、随机、身份摘要、策略记忆、有效历史和去重确认，不保存函数、连接、定时器或 Promise。
- 审查职责内聚、依赖清楚、策略可替换及无状态旁路；不为插件、难度或未来游戏铺空层级。

## 运行与入口

```text
Electron 主进程（窗口、主机身份与生命周期）
  └─ utilityProcess 独立服务
       ├─ HTTP / Socket.IO → RoomCoordinator
       ├─ 本地网页、资源、二维码
       ├─ SqliteSaveRepository → room.sqlite
       └─ BotScheduler → 隔离 Worker → 授权意图 → 统一命令入口

/host、/public、/player        盒子、加入与准备（身份授权各自保持）
/host/game                   公共游戏投影 + 按需打开的房主管理
/public/game                 公共游戏投影，只读
/player/game                 独立玩家凭证 + 本人合法投影与意图
```

服务就绪后打开主机窗口；20s 启动超时、端口占用、数据库损坏或版本不兼容时停止并提示。主机可打开另一只读公共屏，关闭它保留服务；关闭全部窗口或退出程序发送停止消息，5s 后才强制终止。服务异常退出会停止桌面，避免保留失效管理界面。F11 切换全屏，Alt 打开“屏幕”菜单，可把当前窗口移到任一显示器；公共屏默认优先外接屏。本轮按用户授权以电视尺寸模拟，未实际连接外接显示器。

窗口禁用 Node 集成，开启上下文隔离和沙箱，preload 只开放显示控制与单声源调度的窄 IPC 接口；限制其他源导航和任意新窗口。主机随机凭证只由服务交给桌面，再通过 fragment 初始化 sessionStorage 并清理可见 URL；重启后重新生成。网页路由不授予管理权限，普通浏览器直接打开 `/host` 仍只有公共授权。二维码只包含普通手机入口。

玩家身份用服务生成的随机凭证，服务器仅保存摘要。本人的凭证由手机 localStorage 保存，开局前排序不改变座位 ID；同设备同源刷新／断线沿用凭证，1.6.0 删除换手机及兑换接口。电脑房主仅为管理员，不提供参赛入口或加入参数；首局首位由服务随机选取，旧 hostSeat 字段只兼容读取。主机管理权不扩展游戏秘密。线上状态来自当前有效连接，不入 checkpoint。电脑地址／端口变化形成新浏览器源不会自动迁移身份。

HTTP 提供加入、授权同步和网络地址；Socket.IO 握手绑定凭证，逐连接生成 `room:view`，`room:command` 校验信封并确认，`room:revoked` 撤销旧连接。命令被拒绝后同步最新投影；未确认的原意图保留，重试沿用编号。运行时 schema 校验投影与 ACK，不能靠 UI 隐藏完整状态。

1.2.0 引入的持久化加入请求回复由 RoomCoordinator 管理，`session-receipts.ts` 只负责凭证加密／解密；随机玩家凭证仍保存摘要，恢复密钥只由手机持有。可选 sessionReceipts 字段向前读取格式 1 旧存档；历史 bindings 兼容校验后丢弃，不再兑换，随同一次 SQLite 事务保存。当前网络协议为 6，增加目录、可空当前游戏、ownerSeatId、capabilities 和 selectionToken；历史协议 4 引入的人机等级与公开席位等级继续保留；手机 `useAdmission` 负责持久请求、超时和恢复确认；会话回到前台重新同步，主动换身份关闭旧 Socket 时不发送断网错误。详见 [采用理由](../decisions/005-platform-authority-and-recovery.md#加入确认与原班续局2026-10-02)。

服务 `NetworkDirectory` 每次读取系统网卡并标注、排序，保留手动选择；前端按需及定时刷新。桌面 `RuntimeGuard` 负责服务与公共屏两种防休眠请求的独立生命周期，`startup-error.ts` 将具体服务错误转为中文排障提示。单实例保护在启动服务前取得；公共屏保留时可重新打开管理，正式窗口行为与隐藏验证分开。

正式网页 `App.tsx` 只组装按角色隔离的会话与页面。会话逻辑在 `session/useRoomSession.ts`，盒子和游戏外壳在 `screens/`，弹窗、邀请、管理及全屏等在 `components/`，共享素材与清单在根目录 `assets/platform/`；游戏资源及浏览器资源表在 `assets/games/<id>/`。游戏的场地、结算和选择维护在对应游戏 UI，不导入平台凭证或 Socket。页面切换不产生游戏命令；角色变化重建会话，防止沿用另一身份。

盒子 `RoomTable` 只呈现公开席位和围桌房间；开局／准备／等级设置仍由 BoxScreen 通过会话发送动作。所有真人控制入口属于手机 player，电脑 host/public 不参与游戏。SDK `BotDifficulty` 与策略可选 `difficulties` 声明支持范围，平台只保存等级、检验权限和兼容性，游戏入口按 `decide.difficulty` 分发不同算法；Worker 读取存档中的等级，不能依据 UI 昵称推断。座位与快照的等级必须一致，旧可选字段缺省为 default，checkpoint 同时恢复记忆与等级；详见 [人机边界](bot-players.md#三档智能与配置)。

## 游戏目录与授权（1.6.0）

服务的 GameRegistry 保存目录元数据和异步规则／策略加载器；RoomCoordinator.open 先读取一次存档，依据可空 manifest 加载并验证。新房间不加载游戏规则，选中时等待加载与保存完成后才发布新状态。进行中的选择被拒绝；人数和 bot 等级不兼容、未知游戏、加载或保存失败都保留原状态。切换更新实例并取消旧 bot，保留座位凭证及当前房主。

前端 game-clients 注册游戏适配器（Screen、savedChanges、motionDuration），通用会话不导入宝可梦类型、动作或 CSS。盒子只引用小封面；选中后动态 import 对应 UI／资源。服务和 Worker 按同一 ID 加载独立构建入口，Worker 的随机工具使用轻量 random 子入口，避免加载平台和协议整包。模块缓存复用；退出场景释放播放器、队列、计时器和监听器。

RoomView 的 self.role 保持 host／player／public。capabilities.manage 仅管理员，control 另授予 ownerSeatId 对应的真人；手机房主仍仅有本人游戏投影。set-owner 的权限在服务校验并持久保存，owner 不进入 checkpoint，不随回退倒退。开局、暂停／恢复、replay、lifecycle 接受 control；其他管理仅 manage。

## 动作、随机与恢复

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

桌面 AudioOutputController 管理游戏窗口的播放资格：公共屏优先，最后公共屏离开后交回管理员；固定 connect／disconnect／claimEvent／subscribe 接口校验窗口、主 frame、本源与路由。已保存事件键在桌面端统一去重，队列有界；文档已提交导航才清理资格，打开公共屏时被拦截的导航不能误清管理员。静音偏好保存在本地并跨同源窗口同步，手机不建立播放器。

## 电脑显示控制

`DisplaySettings` 为盒子／游戏提供同一浮窗，`apps/desktop/src/display-controller.ts` 负责窗口缩放、配置读写和生命周期，`display-types.ts` 只定义显示契约。隔离 preload 仅公开固定的读取／更新／订阅接口；主进程核验受管理窗口、本源、对应 host／public 路径及主 frame，拒绝手机路径、子 frame 和无效配置。显示控制不经过游戏命令或数据库，`display-settings.json` 与玩家存档分开，写入失败不会声明配置已保存。

使用 Electron 44 的 [isolated zoom](https://www.electronjs.org/docs/latest/api/web-contents#contentssetzoommodemode) 将缩放限定于单个 webContents；不通过共用 origin 的默认缩放传播到其他窗口。自动比例来自原生内容窗口的 DIP 宽高与 1920×1080 基准，不能读取已缩放的 `innerWidth` 再反馈计算。分辨率预设先按当前显示器 DPI 转为 DIP；界面大小叠加用户倍率，限制到窗口可用空间与三倍上限。resize／全屏／显示器变化重新计算，页面导航和刷新应用当前窗口偏好；房主管理与公共屏分别持久化最近选择，作为新开窗口／重启的默认值，不覆盖其他已打开窗口。注册时缓存 webContents，关闭／停止使用缓存清理，先判断存活再访问原生对象，避免销毁后的 getter 或迟到事件阻断退出。
