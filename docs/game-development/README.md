# 游戏接入与验证

当前可运行模板是 [幸运骰子](../../games/template/index.ts)，用于验证平台基础，不是首版宝可梦实现。正式工程已支持编译时注册一个游戏；外部插件、多房间和调试修改仍不在本阶段范围。

## 模块与契约

复制模板的职责布局到 `games/<id>/`，规则依赖 `@tablemax/game-sdk`，UI 依赖 React 和投影类型。规则、计分、投影、策略和界面独立维护：

| 入口                       | 责任                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `index.ts`                 | 导出规则和策略，由应用注册入口组合                                 |
| `rules/index.ts`           | manifest、初始化、合法动作、决策列表、原子执行、生命周期与结束判断 |
| `rules/state.ts`           | 普通 JSON 状态与存档不变量校验，核对平台传入的稳定座位及顺序       |
| `rules/scoring.ts`         | 独立纯计分与共同赢家解析                                           |
| `rules/project.ts`         | public／本人投影，不能默认给本人全部暗牌；房主也使用 public        |
| `bot/index.ts`             | 独立版本的简单策略，只用本人授权输入选择合法意图                   |
| `ui/public/`、`ui/player/` | 根据投影渲染两端；禁止导入完整规则状态或网络／数据库实现           |

SDK 正文见 [源码](../../packages/game-sdk/src/index.ts)。`decisions(state)` 返回 `{id,seatId}[]`，支持多个初始选择和被动接牌者；平台不把正常回合者当作唯一行动者。`legalActions(state,seatId)` 列举完整合法动作及参数，`validateAction` 验证并规范化意图。`apply` 必须原子完成本选择引发的确定性自动步骤，返回新状态和安全的 **before** 边界标签／揭示提醒。规则自动结算不等待 UI 动效。

`lifecycleActions` 与 `applyLifecycle` 提供房主驱动的下一小局等选择，同样经过校验、事务、随机源和 before checkpoint；没有此流程的游戏返回空集合并拒绝执行。模板结算后可开始下一局或创建新房间，后者分配新实例并保留数据库历史。

每个动作信封携带 `actionId,instanceId,revision,branch`；游戏意图另携带 `decisionId`。服务根据真实凭证绑定座位，不接受客户端指定行动身份。版本／分支／修订失效时同步后重新选择；确认丢失时重发原信封，不生成新编号。动作记录和 checkpoint 不发送给客户端，房主只得到安全标签与历史 ID。

`validateState(input,seats)` 校验读档、初始化与动作后的状态。保存分别校验平台格式、游戏／规则／状态版本和策略版本。随机通过 `RuleContext.random.next()` 提供；不要调用 `Math.random()` 或时钟。平台保存规则与策略两个独立 xorshift32 状态，回退后相同边界和相同意图重演相同随机结果。

## 注册与策略替换

1. 给游戏建立 pnpm 工作区包和 `workspace:*` SDK 依赖，保持版本与锁文件在项目内。
2. 在 [服务组装](../../apps/server/src/service.ts) 替换规则与策略导入；在 [Worker 注册](../../apps/server/src/bot-worker.ts) 注册同一策略；两个入口必须一致。
3. 在 [网页入口](../../apps/web/src/App.tsx) 注册该游戏的投影类型、主机／本人组件和帮助。界面不能从规则模块取得秘密状态。模板界面已位于游戏目录，平台仍负责大厅和管理控件。
4. 在游戏内维护逐选择覆盖测试、固定随机输入、权限与规则不变量。修改源码后按 [开发环境](../reference/development.md) 检查和重建；独立 Worker 随桌面构建／便携包本地打包。

`BotStrategy` 声明 `id,version,gameId,rulesVersion`，`validateMemory` 校验普通数据；模板无记忆，使用 `null`。有记忆的策略需定义可恢复版本及初始 `null` 的转换。`decide` 只接收该座位的投影、合法动作、决策、本人记忆、策略随机源及取消信号，返回 `{action,memory}`。不能读取牌库或别人秘密，不能提交管理动作。选择器输出必须经过平台再次校验；调试权限不扩大策略输入。

正式服务每步 bot 延迟 350ms、计算预算 2s，在 JavaScript 老生代内存预算 32MiB 的独立 Worker 中执行，暂停／回退／结束／状态变化会取消旧任务。异常／非法意图／超时暂停并显示安全原因；房主检查策略后显式恢复，不自动重试。Worker 是受信任编译模块的执行边界，不是第三方代码安全沙箱。修改策略版本后旧存档默认拒绝恢复，不静默换策略；需要迁移时另行实现、验证并保留原存档。

## 恢复与验证工具

存档以 SQLite WAL／FULL 事务同时写最新记录和修订 journal，包含权威游戏状态、规则随机、策略恢复数据、有效 checkpoint 链、动作确认及当前身份摘要。事务完成后才 ACK。历史回退恢复游戏和策略 before 数据，截断有效后续历史，增加 revision／branch，保留当前座位凭证；恢复后保持暂停。重启已开始对局也先暂停并增加分支，待房主继续；真人离线保留座位，绝不交给 bot。

框架例子见 [核心测试](../../packages/platform-core/src/room.test.ts)、[真实通信与 SQLite 测试](../../apps/server/src/platform.test.ts)、[强制终止恢复](../../apps/server/src/crash.test.ts)、[Worker 取消](../../apps/server/src/bot-executor.test.ts)。`pnpm check` 跑全部工程检查，`pnpm build` 构建，`pnpm verify:desktop` 验证真实窗口／手机模拟／人机整局／回退／重启。具体证据与实机限制统一在开发环境维护。

第五阶段按 [宝可梦决策边界](../games/pokemon-encounters/information-and-decisions.md) 实现 D01–D13，按 [验证场景](../games/pokemon-encounters/validation-scenarios.md) 运行 V12–V15、V19 等具体能力恢复。平台模板通过只证明恢复机制，不证明宝可梦规则、全部能力或产品 AC 已验收。
