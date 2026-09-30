# 游戏模块

每款游戏使用 `games/<游戏标识>/`，内部区分 `rules/`、`ui/public/`、`ui/player/`、`assets/` 与必要验证。规则入口与客户端入口分开；具体文件按实际需要创建。

目前尚无宝可梦游戏实现、注册模块或空游戏包。[第二阶段](../docs/tasks/phase-02-rules-and-interaction.md) 正在核验用户指定简体中文版，完整规则与卡牌原文仍有[缺口](../docs/tasks/phase-02-rule-research.md)。游戏标识须在版本确认后确定，并与后续 `docs/games/<游戏标识>/` 一致；游戏专属状态、权限、决策和布局在规则关口通过后冻结。

第二阶段的[通用合成交互原型](../docs/reference/phase-02-platform-spec.md) 位于 `apps/web/src/prototype/`，不属于可注册游戏，也不提供规则测试数据。完整游戏模板与可靠动作／恢复验证在第四阶段交付，首版完整游戏与正式本地资源在第五阶段实现。

规则只能依赖游戏 SDK 和纯规则数据，不依赖 React、Socket.IO、SQLite 或 Electron；资源使用游戏标识作为命名空间。初始契约见 `packages/game-sdk`，职责与后续边界见 [代码结构设计](../docs/reference/architecture.md)。
