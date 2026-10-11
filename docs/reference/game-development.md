# 游戏接入与验证

新增 [阿瓦隆](../games/avalon/README.md)示例覆盖原版角色组合、全员秘密投票与队员匿名任务：仅游戏模块定义并发组及授权投影，平台保持统一动作保存与回退。其 `rulesByVariant`／`botsByVariant` 与公共网页客户端通过既有目录契约组装，不维护新的服务游戏名单。

游戏目录包括 [宝可梦奇遇](../../games/pokemon-encounters/index.ts)、[现代艺术](../../games/modern-art/index.ts)与[电力公司](../../games/power-grid/index.ts)；各游戏当前交付状态见 [规格索引](../games/README.md)。[幸运骰子](../../games/template/index.ts) 保留为开发验证模板，含独立资源、规则、两端 UI 与策略。通过注册目录按需加载游戏，新房间先选择游戏；外部插件、多房间和调试修改仍不在本阶段范围。

## 模块与契约

复制模板的职责布局到 `games/<id>/`，增加 `game-module.json`，填写稳定ID、目录、各部分入口、兼容版本和预算依据；正式游戏设 internal=false。开发初期由人工或agent设置文件与内存预算，超限仅警告，不自动增加。规则依赖 `@tablemax/game-sdk`，UI 依赖 React、授权投影及 `@tablemax/web-host`。清单由开发／组装加载器自动发现，不能逐项修改服务、Worker或盒子名单。规则、计分、投影、策略和界面独立维护：

| 入口                       | 责任                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `index.ts`                 | 导出规则和策略，由应用注册入口组合                                                  |
| `game-module.json`         | 作者唯一完整清单；浏览目录、运行描述和包内详情均由该来源生成，盒子不加载完整清单    |
| `web/index.tsx`            | 独立 GameClient，组合授权 GameHost 与本游戏UI；无凭证、Socket和完整平台会话         |
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

盒子目录分类在 `game-module.json` 的 `library.tags`维护，例如卡牌、家庭、策略；可选 `library.searchTerms`补充英文名、常用别名或玩法关键词。名称、分类、别名、玩法名称／摘要与ID参与检索，人数筛选使用 `catalog.min/max`。未安装时只保留这些浏览字段和小封面，完整图文规则、新手引导及人机说明不进入浏览目录或搜索数据；缺少分类时显示“未分类”，正式游戏应填写适用tag。

元数据由[公共投影入口](../../packages/game-sdk/src/metadata.mjs)按用途生成：`GameCatalogEntry`是盒子浏览白名单，`RuntimeModuleManifest`供服务／Worker核验入口、兼容版本和预算，`GameWebManifest`只供浏览器加载网页入口及样式，`GameDetails`承载完整介绍、人机说明与引导能力。新发行将详情放在代码包 `web/details.json`，作者不维护第二份重复正文；安装后按实际发行读取。签名目录由安装器验证和保存，浏览器不读取整份安装索引或签名发行描述。具体四类职责见[工程结构](architecture.md#独立发行与公共契约2026-10-11)。

## 注册与策略替换

1. 给游戏建立 pnpm 工作区包和 `workspace:*` SDK 依赖，保持版本与锁文件在项目内。
2. 由 `game-module.json`声明规则、策略和网页入口；[构建发现器](../../tools/build/module-build.mjs)扫描 `games/*/game-module.json`，从同一作者来源生成[服务目录](../../apps/server/src/game-registry.ts)、Worker运行描述、盒子浏览摘要及包内详情。稳定ID、导出契约和兼容版本必须一致，不逐项修改服务、Worker或构建名单；正式目录不列内部模板，测试可用 `createGameRegistry(true)`。
3. 网页入口导出 `client`，有变体时另导出 `clientsByVariant`；[游戏客户端加载器](../../apps/web/src/game-clients/registry.ts)按模块清单懒加载对应入口。游戏CSS／资源由所属网页模块引入，规则／策略不进入网页；通用GameScreen与会话保持游戏无关。[便携打包脚本](../../tools/release/package.mjs)收集冻结后的规则、策略、网页与完整本地资源。

盒子的名称、玩法摘要、分类与小封面维护在每款游戏的 `game-module.json`，不能提前加载完整介绍、游戏主界面或规则。多玩法通过 `variants`及 `defaultVariantId`声明，平台统一 `GameplaySelector`展示摘要、安装状态与玩法选择；不新增按游戏命名的版本控件。设计前必须查询[用户美术偏好](art-preferences.md)。头像通过平台席位的稳定 `avatarId`传入游戏展示，规则和计分不依赖头像。在游戏内维护逐选择覆盖测试、固定随机输入、权限与规则不变量。修改源码后按[开发环境](development.md)检查和重建；独立Worker及游戏资源通过对应发行包本地提供。

桌面外壳现由C# WinForms／.NET Framework 4.8与共享WebView2承载，服务和策略仍使用包内Node 22.14.0；游戏规则、电脑策略与UI不直接依赖原生外壳或桌面桥接。新增游戏保持独立模块、资源归属和版本兼容边界；full／box EXE及实际提取各严格小于120,000,000字节，基础工程预警110,000,000字节，单玩法完整依赖传输／安装各严格小于64,000,000字节。按需下载、本机安装及离线导入已实现，剩余验收见[任务索引](../tasks/README.md#独立游戏包与按需安装宏伟大计进行中)；box不含完整游戏，full携带当前游戏预装包，当前实例通过不可变发行引用加载主机已安装资源，源码开发模式仍支持随仓资源。

`BotStrategy` 声明 `id,version,gameId,rulesVersion`，`validateMemory` 校验普通数据；模板和首版默认策略无记忆，使用 `null`。有记忆的策略需定义可恢复版本及初始 `null` 的转换。`decide` 只接收该座位的投影、合法动作、决策、本人记忆、策略随机源、取消信号及 `difficulty`，返回 `{action,memory}`。`difficulties` 可声明实际支持的 `default/doubao/juewu`；未声明时仅支持默认，旧输入／存档缺省等级也为默认。平台将座位等级复制到 bot 快照并传到隔离 Worker，各等级的行为及记忆兼容需有测试，不允许用不支持等级默默降级。不能读取牌库或别人秘密，不能提交管理动作。选择器输出必须经过平台再次校验；调试权限不扩大策略输入。

正式服务默认／豆包／绝悟分别等待 1500／1800／2200ms；测试模式 40ms、计算预算 2s，在 JavaScript 老生代内存预算 32MiB 的独立 Worker 中执行，暂停／回退／结束／切换游戏及决策变化会取消旧任务。异常／非法意图／超时暂停并显示安全原因；房主检查策略后显式恢复，不自动重试。Worker 是受信任编译模块的执行边界，不是第三方代码安全沙箱。修改策略版本后旧存档默认拒绝恢复，不静默换策略；需要迁移时另行实现、验证并保留原存档。

## 游戏切换与状态所有权

规则可选 `lifecyclePermission(state, action)` 声明某个游戏管理动作仅电脑管理员 `host` 可执行；未声明时继续沿用既有管理员／获授权房主 `control` 权限。平台按身份过滤公开动作，再在保存前核验权限。阿瓦隆仅对跳过当前发言使用该契约，不向房主扩大权限。可选反应计时契约见 [人机规格](bot-players.md#随机回退与存档)，不为竞争动作声明可交换并发组。

目录元数据必须可在不加载规则、策略或 UI 的情况下读取。当前游戏为 null 时不能准备／开局；已保存 manifest 决定读档时的模块。切换仅大厅或结束状态允许，先检查全部现有席位数量及人机等级兼容，再加载、校验并保存新实例；任何失败保持旧状态，不自动删人。身份与 ownerSeatId 保留，真人准备清零，旧动作／旧 bot 结果失效。

规则必须纯变换，不能修改传入状态、checkpoint 或 RuleContext 的历史对象。平台 copySave 仅复制可变容器并共享不可变历史；保存失败、回退及历史共享均有回归测试。退出 UI 要释放媒体、监听器、队列和计时器，装饰不得阻挡操作；反馈键与本地选择键分开，不能因别人的独立保存修订清空本地选择。

公开反馈 `kind`／`verb` 使用受限字符串，由各游戏解释；共享协议不维护任何游戏能力名单或棋盘格数。盒子统一从轻量封面目录取图，仅 `/game` 路由加载游戏客户端。游戏 CSS 须限定自己的根节点，包含从原通用目录移回的宝可梦场景样式；切换后已下载的 CSS 可能仍保留，不能依赖加载顺序获得隔离。

## 恢复与验证工具

存档以 SQLite WAL／FULL 事务同时写最新记录和修订 journal，包含权威游戏状态、规则随机、策略恢复数据、有效 checkpoint 链、动作确认及当前身份摘要。事务完成后才 ACK。历史回退恢复游戏和策略 before 数据，截断有效后续历史，增加 revision／branch，保留当前座位凭证与手机房主授权；恢复后保持暂停。重启已开始对局也先暂停并增加分支，待房主继续；真人离线保留座位，绝不交给 bot。

框架例子见 [核心测试](../../packages/platform-core/src/room.test.ts)、[真实通信与 SQLite 测试](../../apps/server/src/platform.test.ts)、[强制终止恢复](../../apps/server/src/crash.test.ts)、[Worker 取消](../../apps/server/src/bot-executor.test.ts)。`pnpm check` 跑全部工程检查，`pnpm build` 构建，`pnpm verify:desktop` 验证真实窗口／手机模拟／人机整局／回退／重启。具体证据与实机限制统一在开发环境维护。

首版的 [规则测试](../../games/pokemon-encounters/rules/rules.test.ts) 和 [恢复测试](../../games/pokemon-encounters/rules/recovery.test.ts) 是完整能力与 D01–D13 的接入例子；[强制退出测试](../../apps/server/src/pokemon-crash.test.ts) 用真实服务／SQLite 检查查看、传递和币面恢复。pnpm verify:game-ui 另运行合法存档 fixture 对应的真实能力 UI。当前交付与模拟边界见 [验收记录](acceptance.md)。

## 独立作者工具包（2026-10-11）

`tools/author/export-toolkit.mjs` 导出冻结的 SDK、公开类型与宿主控件、模板、CLI 和清单，工程无需 `apps/` 私有源码。工具包安装锁定的本地依赖后，运行 `node cli.mjs create <新目录>`；在作者目录安装模板声明的精确依赖，使用 `check`、`build`、`verify`、`package` 命令。`package` 生成供项目审核的候选包，没有生产签名私钥；候选不能直接作为正式安装包。构建和规则／投影／动作／人机契约验证不要求修改中心名单。

`node cli.mjs dev <作者目录> --platform=<冻结运行目录>` 只复制运行时白名单，为每次运行分配独立 runtime、data、browser、evidence 和回环端口。平台源码、正式数据库、其他游戏和凭证不复制；开发服务默认静音。共享 SDK 与锁文件由唯一维护者改动，作者工程验证冻结公共依赖哈希。不同游戏／作者任务可以并行，最终桌面组装与发布仍串行。

媒体按 `gameId/路径` 提供稳定 ID，使用公开 `resourceUrl`，CSS 与 glob 由资源构建插件迁移。代码、公共资源和玩法资源各自有完整逐文件哈希。作者必须声明实际版本、玩家权限、预算和资源来源，审核通过后由项目签名目录分发。游戏规则、状态及人机策略版本不能因拆包机械递增。平台接入验收、实际包与实体设备边界见[当前验收](acceptance.md)。

目录字段精简只影响新生成的投影与发行。旧签名目录、发行ID及原包不重写，旧包内嵌 `introduction`、`botIntroduction`或 `guidance`继续兼容读取；新包从 `web/details.json`加载相同用途内容。网络协议8与模块契约7继续独立，不因元数据拆分修改游戏规则／状态／策略版本。
