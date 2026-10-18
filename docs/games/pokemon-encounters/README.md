# 宝可梦奇遇：皮卡丘和朋友们

本游戏含原版与项目自制扩展两个玩法。原版为16类／56张牌、三胜完整大局；当前扩展新局配置 `events-research-v3` 为统一144张牌、17项研究、单格超梦及六类等概率事件，Mega与羁绊仅有主题占位。扩展规格以[设计基线](expansion-design.md)为准，不能覆盖原版或旧发行。

游戏标识 `pokemon-encounters`，原版规则版本 `tablemax-cn-s19-v1`，扩展规则版本 `tablemax-cn-expansion-v1`，两版状态规格各为1，房间／存档／Worker携带权威版本身份。当前简体中文、2–6 人、公共屏横屏、手机竖屏；六人是 2026-10-02 用户明确要求的项目扩展，非出版原文认证。名称使用用户确认的完整游戏名；实体版出版信息／印次／勘误未认证，不从普通 Paper Safari 或其他语言版本替换。

| 要查的问题                             | 唯一正文                                                            |
| -------------------------------------- | ------------------------------------------------------------------- |
| 原文、来源等级、历史冲突与项目采用     | [来源](sources.md)                                                  |
| 原版动作、能力、结束与计分             | [规则](rules.md)、[卡牌／组件](cards.json)                          |
| 扩展牌组、事件、研究与旧配置边界       | [扩展设计](expansion-design.md)                                     |
| 状态、授权、决策、checkpoint与扩展投影 | [信息与决策](information-and-decisions.md)                          |
| 三端布局、声画、规则说明与操作         | [交互](interaction.md)                                              |
| 角色、牌面、声音及来源／制作缺口       | [资源](assets.md)                                                   |
| 原版／扩展验证、历史证据与真人待测     | [验证场景](validation-scenarios.md)、[原版场景数据](scenarios.json) |
| 两玩法三档策略与故障恢复               | [人机](bot.md)                                                      |
| 剩余验收和素材接续                     | [扩展任务](../../tasks/pokemon-encounters-expansion.md)             |
| 当前完整EXE与真实设备边界              | [当前验收](../../reference/acceptance.md#当前源码与本地交付)        |

正式模块位于[games/pokemon-encounters](../../../games/pokemon-encounters/index.ts)，UI与策略只使用授权投影；主机／公共屏不展示玩家缓冲区。预装与精确旧局恢复见[统一交付与旧局恢复](../README.md#模块交付与旧局恢复)，应用版本不替代规则版本。缺失出版认证继续标明，不把它变成再次追问未知事实的前提。

## 对局内规则说明

已迁至[交互的同名章节](interaction.md#对局内规则说明)。

## 按实现职责阅读

| 实现职责              | 最小阅读范围                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 规则与独立计分        | rules.md、cards.json，以及验证场景 V00–V11；来源存疑时回查 sources.md 的对应编号。                                                                                                                                                                           |
| 服务端授权与 SDK 接入 | [权威状态及不变量](information-and-decisions.md#权威状态及不变量)、[阶段动作](information-and-decisions.md#阶段动作与自动推进)、[字段授权](information-and-decisions.md#逐字段授权矩阵) 与 [契约缺口](information-and-decisions.md#正式初始契约缺口与交接)。 |
| 回退与持久化恢复      | [D01–D13](information-and-decisions.md#每项决策与恢复边界)，验证场景 V12–V15；策略取消与恢复另读 V19。                                                                                                                                                       |
| 公共主机与手机 UI     | interaction.md、assets.md，验证场景 V21–V22；渲染仅依赖授权投影。                                                                                                                                                                                            |
| 基础 bot              | bot.md、字段授权与 D01–D12，验证场景 V16–V20；D13 为房主管理生命周期。                                                                                                                                                                                       |

上表文件均可从主题表进入，场景正文及机器数据统一见 [验证场景](validation-scenarios.md)。源码、工具和验证入口见[扩展指南](../../reference/game-development.md)，剩余验收从本页主题表进入。

## 扩展版实施入口

现行采用内容查[扩展设计](expansion-design.md)、[权限与恢复](information-and-decisions.md#扩展版权限与恢复2026-10-05)、[交互](interaction.md#扩展版交互与演出规格2026-10-05)和[专项验证](validation-scenarios.md#扩展版专项场景2026-10-05)。早期批准及技术收尾移至[原日期历史边界](validation-scenarios.md#扩展版技术收尾2026-10-05至06)，剩余工作见[扩展任务](../../tasks/pokemon-encounters-expansion.md)。
