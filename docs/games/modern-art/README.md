# 现代艺术

采用经典3–5人、70牌、五种拍卖和四轮玩法；规则版本为 `tablemax-modern-art-classic-v1`，状态版本1，独立本地策略 `modern-art-local`／1.0.0。不采用《现代艺术：卡牌游戏》、两人／六人变体或三人炒作玩家；出版事实、跨版差异和项目自主采用项见[来源](sources.md)。

| 要查的问题                           | 唯一正文                                                       |
| ------------------------------------ | -------------------------------------------------------------- |
| 采用版次、原文与认证缺口             | [来源](sources.md)                                             |
| 发牌、五种拍卖、计分、授权与恢复     | [采用规则与信息权限](rules.md)                                 |
| 三端布局、规则说明、文字、提醒及声画 | [交互与视觉](interaction.md)                                   |
| 三档策略、记忆及合法信息边界         | [人机](bot.md)                                                 |
| 状态不变量、验证场景及历史证明       | [验证场景](validation-scenarios.md)                            |
| 图像、声音、提示词及资源核验         | [游戏资源清单](../../../assets/games/modern-art/manifest.json) |
| 当前完整EXE及真实设备边界            | [当前验收](../../reference/acceptance.md#当前源码与本地交付)   |

## 模块边界

规则、数据、投影、计分、电脑策略和界面集中在 [games/modern-art](../../../games/modern-art/index.ts)。它们不导入其他游戏的规则、类型、声音、素材或 UI；运行规则只使用游戏 SDK 的座位和可恢复随机源。普通数据存档与短生命周期 `AuctionFlow`／`MatchFlow` 分开，纯计分放在 [scoring.ts](../../../games/modern-art/rules/scoring.ts)。当前随完整 EXE 预装，新局和历史发行恢复遵循[统一模块边界](../README.md#模块交付与旧局恢复)。平台注册、通信、身份、保存、回退、暂停和游戏切换继续由平台负责。

UI 与策略只读 [view.ts](../../../games/modern-art/ui/view.ts) 投影契约及 [catalog.ts](../../../games/modern-art/data/catalog.ts) 公开目录。美术资源使用 `assets/games/modern-art/`；生成原图、替换资源、提示词和实际核验由资源清单维护。卡牌 `artIndex` 为画家内 1-based 序号，标题“作品 01”等为项目演绎。原创插画不能标为出版卡面或真实画家作品。

### 文字与画作辨识标准（2026-10-04）

已迁至[交互与视觉的同名章节](interaction.md#文字与画作辨识标准2026-10-04)。

## 采用玩法

已迁至[采用规则](rules.md#采用玩法)。

## 数字决策与信息权限

已迁至[规则与信息权限](rules.md#数字决策与信息权限)。

## 声音

已迁至[交互与视觉](interaction.md#声音)。

## 状态与验证

已迁至[验证场景](validation-scenarios.md#状态与验证)。
