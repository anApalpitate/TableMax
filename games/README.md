# 游戏模块

每款游戏使用 `games/<游戏标识>/`，内部区分 `rules/`、`ui/public/`、`ui/player/`、`assets/`、独立电脑策略与必要验证。规则入口与客户端入口分开；具体文件按实际需要创建。

目前尚无宝可梦正式游戏实现、注册模块或空游戏包。第二阶段已建立 `pokemon-encounters` 的[完整主题规格](../docs/games/pokemon-encounters/README.md)，状态、权限、决策及布局按采用版本冻结；官方规则书、实体印次和勘误仍有[认证缺口](../docs/games/pokemon-encounters/sources.md#规则来源与核验缺口)。用户裁定及[项目方案](../docs/games/pokemon-encounters/rules.md#未明示细节的项目方案)形成采用基线，当前能力完整结算后才检查结束。采用版本与实体版认证分开记录。

第二阶段的[通用合成交互原型](../docs/reference/phase-02-platform-spec.md) 位于 `apps/web/src/prototype/`，不属于可注册游戏，也不提供规则测试数据。完整游戏模板与可靠动作／恢复验证在第四阶段交付，首版完整游戏与正式本地资源在第五阶段实现。

每款游戏必须提供能覆盖全部玩家选择的基础 bot，并独立维护电脑决策文件，与规则执行和计分分离；采用游戏内独立 `bot/index.ts` 默认入口，依据[决策004](../docs/decisions/004-phase02-game-spec-and-bot-file.md)，当前不创建空策略工程。策略只基于该座位授权视图和合法选择返回意图，不得读取他人秘密、直接写游戏状态或依赖网络。策略标识、版本、恢复数据及覆盖验证随模块交付，平台负责调度、身份、事务和旧分支失效，详见 [人机规格](../docs/reference/bot-players.md)。

采用面向对象的适度封装，具有生命周期或依赖的服务／策略按职责组合；规则、计分与投影可保留纯函数，状态是普通可序列化数据，不把全部能力塞进同一控制器或要求 React 改为类组件。

规则只能依赖游戏 SDK 和纯规则数据，不依赖 React、Socket.IO、SQLite 或 Electron；资源使用游戏标识作为命名空间。初始契约见 `packages/game-sdk`，职责与后续边界见 [代码结构设计](../docs/reference/architecture.md)。

首版游戏标识为 `pokemon-encounters`，完整采用规格与机器可读牌表／场景见 [游戏主题](../docs/games/pokemon-encounters/README.md)。此目录仍无首版规则／计分／策略源码，不把第二阶段原型当正式模块注册。
