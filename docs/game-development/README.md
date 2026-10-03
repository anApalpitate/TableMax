# 游戏接入与验证

正式游戏是 [宝可梦奇遇](../../games/pokemon-encounters/index.ts)和[现代艺术](../../games/modern-art/index.ts)；[幸运骰子](../../games/template/index.ts) 保留为开发验证模板，含独立资源、规则、两端 UI 与策略。通过注册目录按需加载游戏，新房间先选择游戏；外部插件、多房间和调试修改仍不在本阶段范围。

## 模块与契约

复制模板的职责布局到 `games/<id>/`，规则依赖 `@tablemax/game-sdk`，UI 依赖 React 和投影类型。规则、计分、投影、策略和界面独立维护：

| 入口                       | 责任                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `index.ts`                 | 导出规则和策略，由应用注册入口组合                                                  |
| `rules/index.ts`           | manifest、初始化、合法动作、决策列表、原子执行、生命周期与结束判断                  |
| `rules/state.ts`           | 普通 JSON 状态与存档不变量校验，核对平台传入的稳定座位及顺序                        |
| `rules/scoring.ts`         | 独立纯计分与共同赢家解析                                                            |
| `rules/project.ts`         | public／本人投影，不能默认给本人全部暗牌；管理员使用 public，手机房主仍使用本人投影 |
| `../../assets/games/<id>/` | 游戏独立本地资源与来源清单；模板的 die.svg 是原创装饰，不编码秘密骰子结果           |
| `bot/index.ts`             | 独立版本的简单策略，只用本人授权输入选择合法意图                                    |
| `ui/public/`、`ui/player/` | 根据投影渲染两端；禁止导入完整规则状态或网络／数据库实现                            |

SDK 正文见 [源码](../../packages/game-sdk/src/index.ts)。`decisions(state)` 返回 `{id,seatId,concurrencyGroup?}[]`，支持多个初始选择和被动接牌者；平台不把正常回合者当作唯一行动者。独立决策使用稳定 id，并明确同一 concurrencyGroup；不要给相互冲突的选择声明并发。初始翻牌可按小局／座位稳定编号，别人的翻牌不能改写尚未提交者的 id。`legalActions(state,seatId)` 列举完整合法动作及参数，`validateAction` 验证并规范化意图。`apply` 必须原子完成本选择引发的确定性自动步骤，返回新状态和安全的 **before** 边界标签／揭示提醒。规则自动结算不等待 UI 动效。apply／applyLifecycle 可返回安全 PublicEvent；平台保存成功后另发 room:feedback，UI 按实例／分支／修订去重，完整同步不播放。

`lifecycleActions` 与 `applyLifecycle` 提供管理员或已授权手机房主驱动的下一小局等选择，同样经过校验、事务、随机源和 before checkpoint；没有此流程的游戏返回空集合并拒绝执行。模板结算后可开始下一局或重新准备牌桌，后者分配新实例并保留数据库历史。

每个动作信封携带 `actionId,instanceId,revision,branch`；游戏意图另携带 `decisionId`。服务根据真实凭证绑定座位，不接受客户端指定行动身份。实例／分支或独立提交窗口失效时同步后重新选择；除显式独立决策与按座位准备窗口外，旧修订仍拒绝；确认丢失时重发原信封，不生成新编号。动作记录和 checkpoint 不发送给客户端，电脑管理员只得到安全标签与历史 ID。

`validateState(input,seats)` 校验读档、初始化与动作后的状态。保存分别校验平台格式、游戏／规则／状态版本和策略版本。随机通过 `RuleContext.random.next()` 提供；不要调用 `Math.random()` 或时钟。电脑管理员只管理、不占玩家座位，手机房主是正常真人座位；规则上下文只有玩家座位与随机源，不从昵称或客户端参数推断管理权。平台保存规则与策略两个独立 xorshift32 状态，回退后相同边界和相同意图重演相同随机结果。

## 注册与策略替换

1. 给游戏建立 pnpm 工作区包和 `workspace:*` SDK 依赖，保持版本与锁文件在项目内。
2. 在 [服务目录](../../apps/server/src/game-registry.ts) 登记 manifest、规则／策略的异步加载器与公开状态，ID 与规则／策略声明必须一致；[平台注册表](../../packages/platform-core/src/game-registry.ts) 验证模块契约与加载错误。不要在 service 顶层静态导入游戏实现。正式目录不列内部模板，测试可用 createGameRegistry(true)。
3. 在 [构建脚本](../../scripts/build.mjs) 登记独立 games／bots 入口，并由 [便携打包脚本](../../scripts/package.mjs) 收集 games／bots 和构建后网页；[Worker](../../apps/server/src/bot-worker.ts) 根据已选择的游戏 ID 加载对应策略，不打入所有策略。浏览器 [game-clients](../../apps/web/src/game-clients/registry.ts) 为每款游戏添加动态加载器和适配组件；导出 Screen、savedChanges 与 motionDuration，游戏 CSS／资源由该入口引入。通用 GameScreen 与会话保持游戏无关，界面不能导入完整规则状态。目录封面应为小资源，不在盒子提前导入全部 catalog。

盒子的玩法介绍由每款游戏自己的 `ui/introduction.ts` 维护，包含简短玩法、主要步骤和胜利目标；在 [轻量介绍目录](../../apps/web/src/game-clients/introductions.ts) 装配，不能用通用设备分工替代玩法，也不能因此提前加载游戏主界面或规则。设计前必须查询 [用户美术偏好](../reference/art-preferences.md)。所选头像由平台公开席位的稳定 `avatarId` 映射为图片，在客户端适配层传给游戏 UI；规则和计分不依赖头像。
4. 在游戏内维护逐选择覆盖测试、固定随机输入、权限与规则不变量。修改源码后按 [开发环境](../reference/development.md) 检查和重建；独立 Worker 随桌面构建／便携包本地打包。

桌面外壳现由 C# WinForms／.NET Framework 4.8 与共享 WebView2 承载，服务和策略仍使用包内 Node 22.14.0；游戏规则、电脑策略与 UI 不直接依赖原生外壳或桌面桥接。新增游戏应保持当前独立模块、资源归属和版本兼容边界，并检查便携 ZIP／实际解压体积；新增游戏前的交付双门禁为各自严格小于 100,000,000 字节，95 MB 为工程预算。多游戏按需下载、本地安装及离线导入仍为 [未来计划](../tasks/README.md#多游戏按需安装未来计划未实现)，当前模块懒加载继续读取随包本地资源。

`BotStrategy` 声明 `id,version,gameId,rulesVersion`，`validateMemory` 校验普通数据；模板和首版默认策略无记忆，使用 `null`。有记忆的策略需定义可恢复版本及初始 `null` 的转换。`decide` 只接收该座位的投影、合法动作、决策、本人记忆、策略随机源、取消信号及 `difficulty`，返回 `{action,memory}`。`difficulties` 可声明实际支持的 `default/doubao/juewu`；未声明时仅支持默认，旧输入／存档缺省等级也为默认。平台将座位等级复制到 bot 快照并传到隔离 Worker，各等级的行为及记忆兼容需有测试，不允许用不支持等级默默降级。不能读取牌库或别人秘密，不能提交管理动作。选择器输出必须经过平台再次校验；调试权限不扩大策略输入。

正式服务默认／豆包／绝悟分别等待 1500／1800／2200ms；测试模式 40ms、计算预算 2s，在 JavaScript 老生代内存预算 32MiB 的独立 Worker 中执行，暂停／回退／结束／切换游戏及决策变化会取消旧任务。异常／非法意图／超时暂停并显示安全原因；房主检查策略后显式恢复，不自动重试。Worker 是受信任编译模块的执行边界，不是第三方代码安全沙箱。修改策略版本后旧存档默认拒绝恢复，不静默换策略；需要迁移时另行实现、验证并保留原存档。

## 游戏切换与状态所有权

目录元数据必须可在不加载规则、策略或 UI 的情况下读取。当前游戏为 null 时不能准备／开局；已保存 manifest 决定读档时的模块。切换仅大厅或结束状态允许，先检查全部现有席位数量及人机等级兼容，再加载、校验并保存新实例；任何失败保持旧状态，不自动删人。身份与 ownerSeatId 保留，真人准备清零，旧动作／旧 bot 结果失效。

规则必须纯变换，不能修改传入状态、checkpoint 或 RuleContext 的历史对象。平台 copySave 仅复制可变容器并共享不可变历史；保存失败、回退及历史共享均有回归测试。退出 UI 要释放媒体、监听器、队列和计时器，装饰不得阻挡操作；反馈键与本地选择键分开，不能因别人的独立保存修订清空本地选择。

公开反馈 `kind`／`verb` 使用受限字符串，由各游戏解释；共享协议不维护任何游戏能力名单或棋盘格数。盒子统一从轻量封面目录取图，仅 `/game` 路由加载游戏客户端。游戏 CSS 须限定自己的根节点，包含从原通用目录移回的宝可梦场景样式；切换后已下载的 CSS 可能仍保留，不能依赖加载顺序获得隔离。

## 恢复与验证工具

存档以 SQLite WAL／FULL 事务同时写最新记录和修订 journal，包含权威游戏状态、规则随机、策略恢复数据、有效 checkpoint 链、动作确认及当前身份摘要。事务完成后才 ACK。历史回退恢复游戏和策略 before 数据，截断有效后续历史，增加 revision／branch，保留当前座位凭证与手机房主授权；恢复后保持暂停。重启已开始对局也先暂停并增加分支，待房主继续；真人离线保留座位，绝不交给 bot。

框架例子见 [核心测试](../../packages/platform-core/src/room.test.ts)、[真实通信与 SQLite 测试](../../apps/server/src/platform.test.ts)、[强制终止恢复](../../apps/server/src/crash.test.ts)、[Worker 取消](../../apps/server/src/bot-executor.test.ts)。`pnpm check` 跑全部工程检查，`pnpm build` 构建，`pnpm verify:desktop` 验证真实窗口／手机模拟／人机整局／回退／重启。具体证据与实机限制统一在开发环境维护。

首版的 [规则测试](../../games/pokemon-encounters/rules/rules.test.ts) 和 [恢复测试](../../games/pokemon-encounters/rules/recovery.test.ts) 是完整能力与 D01–D13 的接入例子；[强制退出测试](../../apps/server/src/pokemon-crash.test.ts) 用真实服务／SQLite 检查查看、传递和币面恢复。pnpm verify:game-ui 另运行合法存档 fixture 对应的真实能力 UI。当前交付与模拟边界见 [验收记录](../reference/acceptance.md)。
