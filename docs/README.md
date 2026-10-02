# 文档索引

第一至六阶段已完成。正式程序默认运行宝可梦完整游戏，包含全部能力、三胜结算、独立 bot、本地美术与声音及可靠恢复。交付验证按用户授权在当前 Windows 上运行，电视和手机采用模拟，证据与边界见 [验收记录](reference/acceptance.md)。当前规格从下列主题页读取，阶段完成过程见归档。

## 开始开发

当前源码为 1.5.0，所有真人手机操作、电脑只管理／展示，支持六席围桌和三档本地人机。电脑 4K／多分辨率显示设置见 [任务接续](tasks/README.md#150电脑多分辨率显示)、[显示规格](reference/phase-02-platform-spec.md#电脑多分辨率显示150) 和 [1.5.0 验收](reference/acceptance.md#首版维护电脑多分辨率显示)。游玩／隐蔽测试模式、浮窗、明确行动提示与六人布局见 [运行模式](reference/phase-02-platform-spec.md#实际游玩与测试模式140)、[游戏交互](games/pokemon-encounters/interaction.md#游玩节奏行动播报与六人布局140) 和 [1.4.0 验收](reference/acceptance.md#首版维护游玩节奏与六人提示)；算法见 [人机等级](reference/bot-players.md#三档智能与配置)。可靠入座、网卡刷新、原班续局与运行保障的 [1.2.0 验收](reference/acceptance.md#首版维护聚会可靠性与连续游玩) 及旧视觉记录保留。第一至六阶段历史证据继续保留；新便携版和维护证据分别进入 `artifacts/releases` 与 `artifacts/maintenance`。

先读 [项目说明](../README.md) 了解现状，再从 [阶段接续入口](tasks/README.md#后续开发接续入口) 确认本阶段范围，按实现职责阅读规格和源码。运行与检查统一查 [开发环境](reference/development.md)，Agent 工作约定见 [AGENTS.md](../AGENTS.md)。

清理历史版本与测试／打包中间物，使用项目根目录两个清理工具；默认预览、范围及执行前检查见 [清理说明](reference/development.md#清理本地中间物)，不按 Git 忽略规则批量删除资料。

| 开发问题                                         | 当前正文入口                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 产品范围、首版验收标准                           | [需求基线](requirements/TableMax_需求文档_v1.0.md)                                        |
| 依赖方向、进程、契约与适度封装                   | [工程结构](reference/architecture.md)                                                     |
| 大厅、主机／手机、提交与恢复交互、平台美术       | [通用平台规格](reference/phase-02-platform-spec.md)                                       |
| 首版规则、卡牌数据、权限、决策、交互、资源与场景 | [宝可梦游戏规格](games/pokemon-encounters/README.md)                                      |
| 原文缺口、来源等级、历史裁定与项目方案依据       | [规则来源](games/pokemon-encounters/sources.md)                                           |
| 电脑座位、策略输入、调度与恢复要求               | [通用人机规格](reference/bot-players.md)、[首版人机覆盖](games/pokemon-encounters/bot.md) |
| 文件放置、现有与计划目录、产物边界               | [目录职责](reference/project-structure.md)                                                |

游戏玩法正文以游戏主题为唯一维护入口；通用规格定义跨游戏行为，任务索引负责阶段顺序与交接。原型历史证据与当前产品验收分别记录；首版项目采用规则与出版原文认证状态分别记录。

游戏模块接入、独立策略替换和模板验证见 [游戏开发指南](game-development/README.md)。

## 维护与追溯

| 用途                           | 入口                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| 当前参考页总览                 | [参考索引](reference/README.md)                                                         |
| 游戏主题总览                   | [游戏索引](games/README.md)                                                             |
| 已确定选择及其理由             | [决策索引](decisions/README.md)                                                         |
| 分类、唯一正文、更新与归档约定 | [文档维护规则](reference/maintenance.md)                                                |
| 子 agent 职责与派工边界        | [职责索引](subagent/README.md)                                                          |
| 已完成阶段的范围与历史证据     | [归档索引](archive/README.md)                                                           |
| 后续跨游戏调试与纠错目标       | [需求第 6.5 节](requirements/TableMax_需求文档_v1.0.md#65-跨游戏调试与纠错后续独立规划) |

新增或迁移主题页时，同步更新本索引及所属分类索引。

全部资源与替换见 [assets 入口](../assets/README.md)；当前管理员、角色卡面与动画维护见 [任务索引](tasks/README.md)。
