# 文档索引

第一至六阶段已完成。正式程序先选择游戏，游戏库提供宝可梦和现代艺术；每款游戏独立维护规则、三档 bot、界面及本地资源，共用身份与可靠恢复。交付验证按用户授权在当前 Windows 上运行，电视和手机采用模拟，证据与边界见 [验收记录](reference/acceptance.md)。当前规格从下列主题页读取，阶段完成过程见归档。

## 开始开发

当前源码与便携包为 v1.0.1（含《现代艺术》）：所有真人手机操作、电脑只管理／展示，支持六席围桌和三档本地人机。当前原生桌面交付与验证边界见 [当前交付验收](reference/acceptance.md#100原生桌面与小体积交付2026-10-03)，版本归一历史保留在验收页；后续独立需求见 [任务接续](tasks/README.md#后续开发接续入口)。

当前桌面采用 net48／x64 WinForms、系统共享 WebView2 与包内 Node；新增游戏前 ZIP 和解压程序均须小于 100,000,000 字节。采用理由及运行时前提见 [决策 008](decisions/008-small-native-desktop.md)，操作与双体积门禁见 [开发说明](reference/development.md#便携包体积与共享运行时)，实际新包验收见 [迁移记录](reference/acceptance.md#100原生桌面与小体积交付2026-10-03)。

| 阅读目的                                   | 当前入口                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------- |
| 游戏选择、管理员／手机房主、准备与首翻并发 | [1.6.0 平台规格](reference/phase-02-platform-spec.md#160游戏选择手机房主与独立提交) |
| 行动进度、待处理牌、能力声画、零分列与赢家 | [1.6.0 游戏交互](games/pokemon-encounters/interaction.md#160行动面板与声画反馈)     |
| 720p—4K、Windows DPI 与独立窗口缩放        | [电脑显示规格](reference/phase-02-platform-spec.md#电脑多分辨率显示150)             |
| 正式节奏、隐蔽测试模式与浮窗               | [运行模式](reference/phase-02-platform-spec.md#实际游玩与测试模式140)               |
| 人机等级、授权信息与决策算法               | [人机规格](reference/bot-players.md#三档智能与配置)                                 |

第一至六阶段及历次维护的历史范围和证据统一从 [验收记录](reference/acceptance.md) 与 [归档索引](archive/README.md) 追溯；新便携版和维护证据分别进入 `artifacts/releases` 与 `artifacts/maintenance`。

先读 [项目说明](../README.md) 了解现状，再从 [阶段接续入口](tasks/README.md#后续开发接续入口) 确认本阶段范围，按实现职责阅读规格和源码。运行与检查统一查 [开发环境](reference/development.md)，Agent 工作约定见 [AGENTS.md](../AGENTS.md)。

开发收尾使用 `Maintain-Project.ps1 -Apply` 检查 5 GiB／4 GiB 阈值；手动清理历史版本与测试／打包中间物使用根目录两个清理工具；默认预览、范围及执行前检查见 [清理说明](reference/development.md#清理本地中间物)，不按 Git 忽略规则批量删除资料。

| 开发问题                                         | 当前正文入口                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 产品范围、首版验收标准                           | [需求基线](requirements/TableMax_需求文档_v1.0.md)                                        |
| 依赖方向、进程、契约与适度封装                   | [工程结构](reference/architecture.md)                                                     |
| 大厅、主机／手机、提交与恢复交互、平台美术       | [通用平台规格](reference/phase-02-platform-spec.md)                                       |
| 艺术／UI 设计前必查的用户倾向与历史反馈          | [用户美术偏好](reference/art-preferences.md)                                              |
| 首版规则、卡牌数据、权限、决策、交互、资源与场景 | [宝可梦游戏规格](games/pokemon-encounters/README.md)                                      |
| 原文缺口、来源等级、历史裁定与项目方案依据       | [规则来源](games/pokemon-encounters/sources.md)                                           |
| 电脑座位、策略输入、调度与恢复要求               | [通用人机规格](reference/bot-players.md)、[首版人机覆盖](games/pokemon-encounters/bot.md) |
| 文件放置、现有与计划目录、产物边界               | [目录职责](reference/project-structure.md)                                                |

游戏玩法正文以游戏主题为唯一维护入口；通用规格定义跨游戏行为，任务索引负责阶段顺序与交接。原型历史证据与当前产品验收分别记录；首版项目采用规则与出版原文认证状态分别记录。

游戏模块接入、独立策略替换和模板验证见 [游戏开发指南](game-development/README.md)。第二款正式游戏《现代艺术》的规则、五种拍卖、秘密权限与项目采用缺口见 [游戏规格](games/modern-art/README.md)；已完成接入的过程与耗时见 [归档](archive/modern-art-2026-10-03.md)。

游戏数量增加后的拆包、按需下载与离线安装见 [未来计划](tasks/README.md#多游戏按需安装未来计划未实现)，当前尚未实现。

选择后续游戏时，查阅 [中文桌游候选与盒子接入评估](games/candidates.md)：区分中文人气线索、平台适配建议、已确认候选和未确定的实施范围。

## 维护与追溯

| 用途                           | 入口                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| 当前参考页总览                 | [参考索引](reference/README.md)                                                         |
| 游戏主题总览                   | [游戏索引](games/README.md)                                                             |
| 已确定选择及其理由             | [决策索引](decisions/README.md)                                                         |
| 分类、唯一正文、更新与归档约定 | [文档维护规则](reference/maintenance.md)                                                |
| 子 agent 职责与派工边界        | [职责索引与常用组合](subagent/README.md)                                                |
| 已完成阶段的范围与历史证据     | [归档索引](archive/README.md)                                                           |
| 后续跨游戏调试与纠错目标       | [需求第 6.5 节](requirements/TableMax_需求文档_v1.0.md#65-跨游戏调试与纠错后续独立规划) |

新增或迁移主题页时，同步更新本索引及所属分类索引。

全部资源与替换见 [assets 入口](../assets/README.md)；管理员、角色卡面与动画的当前行为见 [通用规格](reference/phase-02-platform-spec.md)和[游戏交互](games/pokemon-encounters/interaction.md)，已完成维护见 [归档](archive/maintenance-2026-10-01-to-03.md)。
