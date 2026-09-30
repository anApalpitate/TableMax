# 游戏模块

每款游戏使用 `games/<游戏标识>/`，内部区分 `rules/`、`ui/public/`、`ui/player/`、`assets/` 与必要验证。规则入口与客户端入口分开；具体文件按实际需要创建。

本阶段不创建宝可梦游戏实现或空游戏包。对应版本规则与数据核验在第二阶段进行，完整游戏模板与恢复验证在第四阶段交付。

规则只能依赖游戏 SDK 和纯规则数据，不依赖 React、Socket.IO、SQLite 或 Electron；资源使用游戏标识作为命名空间。初始契约见 `packages/game-sdk`，职责与后续边界见 [代码结构设计](../docs/reference/architecture.md)。
