# 游戏模块

每款游戏独立使用 games/<id>/，规则／计分／投影、bot/index.ts、ui/public、ui/player 与测试分别维护；全部资源在根目录 assets/games/<id> 及来源清单管理。规则只依赖 SDK 和纯数据，不依赖 React、通信、数据库或 Electron；存档保持普通 JSON。平台负责身份、动作、事务、随机及恢复，策略只返回合法意图，不能直接写状态或代真人。

当前正式游戏为 [宝可梦奇遇](pokemon-encounters/index.ts)，已实现全部采用规则、三胜大局、独立基础 bot、本地资源与授权两端 UI；采用 tablemax-cn-s19-v1，官方原文认证和项目约定分开记录。规格入口见 [游戏主题](../docs/games/pokemon-encounters/README.md)，当前交付证据与模拟边界见 [验收记录](../docs/reference/acceptance.md)。

[幸运骰子](template/index.ts) 保留为开发验证模板，包含独立规则、纯计分、投影、两端 UI、原创 SVG 资源、独立策略与恢复测试，不作为另一款首版面向用户游戏。注册、资源、生命周期、策略替换／兼容和验证方法见 [扩展指南](../docs/reference/game-development.md)。

[现代艺术](modern-art/index.ts) 是独立第二款游戏，70 卡、五种拍卖、四轮估值与三档本地策略集中于自己的目录；其规则、bot、界面和资源不依赖宝可梦，规格和来源见 [游戏入口](../docs/games/modern-art/README.md)。

[电力公司](power-grid/index.ts) 是独立第三款游戏，经典德国地图、五阶段／三步、42 张电厂、公开市场、隐藏现金、三档本地策略及地图界面集中于自己的目录；规则、UI、声音和资源不依赖其他游戏。采用边界和当前验收见 [游戏入口](../docs/games/power-grid/README.md)。

[拉密](rummikub/index.ts) 采用经典版 2–4 人，106 张实例牌、私有牌架、公开桌面、整回合重组与百搭释放证据独立维护；规则、三档策略、界面及本地资源见 [游戏入口](../docs/games/rummikub/README.md)。完整构建及验收进度见 [当前任务](../docs/tasks/rummikub.md)。

具有生命周期或依赖的服务适度对象封装、组合优先；纯规则与计分不强制改成类。新模块必须提供覆盖全部选择的基础 bot，声明策略版本、授权输入和可恢复记忆；避免未来插件／难度／多房间空层级。第二阶段独立原型仍在 apps/web/src/prototype，不注册为正式游戏。
