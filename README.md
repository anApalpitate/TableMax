# TableMax

供自己和朋友线下聚会使用的 Windows 局域网全数字桌游平台。电脑负责本地服务与公共屏，玩家通过手机浏览器加入并操作；正式游玩不依赖互联网或实体组件。

## 当前状态

第一至六阶段已完成。当前版本 1.4.0 默认运行《宝可梦奇遇：皮卡丘和朋友们》，支持 2–6 位手机真人／本地人机混合、16 类 56 张牌、全部能力、独立计分、三胜完整大局、本地角色卡面和声音。电脑只负责房主管理与公共展示，所有真人各自在手机操作；盒子是有桌子、空座和玩家上桌的围桌房间，人机可选默认／豆包／绝悟。平台包含可靠入座／换绑、按身份投影秘密信息、保存后确认、回退与重连／重启恢复、原班续局及防休眠。

88 项工程测试、全部 D01–D13 恢复、三处能力真实进程强制终止、15 组真实游戏 UI、三档各 2–6 人的十五个固定种子完整大局，以及六真人自然小局、三档实际 Worker、模式时序、浮窗和聚会专项通过。最终 1.4.0 Windows ZIP 解压后，以仅系统目录的 PATH 检查完整三胜、原班续局、六席／三档、游玩呈现及聚会专项，见 [维护验收](docs/reference/acceptance.md#首版维护游玩节奏与六人提示)。按用户授权，电视和手机使用本机尺寸／触控／UA／后台及断网模拟；本机网卡 IPv4 访问验证通过，不声明真实 Wi-Fi、手机 Safari、电视硬件或另一台无开发环境电脑已验收。

游戏按 `tablemax-cn-s19-v1` 项目采用规则实现；六人是按用户要求采用的项目扩展（S21），不标为出版版本认证；官方原文／印次认证缺口保留在 [来源页](docs/games/pokemon-encounters/sources.md)。当前角色图及来源见 [资源记录](docs/games/pokemon-encounters/assets.md)，名称、数值和能力由代码独立显示，不冒充出版桌游卡图。后续《电力公司》德国地图和跨游戏调试按独立需求安排。

## 使用便携版

1. 解压 [TableMax-1.4.0-win-x64.zip](artifacts/releases/TableMax-1.4.0-win-x64.zip)，双击 `TableMax.exe`。无需预装 Node.js；默认端口 38473，数据保存在当前用户本地应用数据的 TableMax 目录。重复启动回到已有实例。
2. 电脑和手机连接同一局域网，在“连接帮助”选择 Wi-Fi／以太网地址；可手动刷新，选择会记住并跟踪网卡变化。手机扫码或打开地址，输入昵称、加入并准备。未收到入座／换绑确认时用“重试入座确认”，刷新也会恢复原请求。访客隔离、防火墙和错误地址的排查分步显示。
3. 每位真人用自己的手机入座、准备和操作，电脑房主只管理和展示、不占玩家座位；房主本人参赛也须用手机。加入后自动上桌，房主可调整开局顺序，或选择人机等级并“添加人机”：默认简单决策、豆包分析已知局势、绝悟结合获准记忆与局势作有界推演、比较当前优解。人机等级可在大厅的座位设置修改，开局后锁定；不调用外部模型或读取未授权暗牌。手机真人加人机共 2–6，全部准备后开始。
4. 盒子负责加入、准备和邀请；开局自动进入独立牌桌，可返回盒子再进入。手机直接点牌库／弃牌顶取牌，卡位选好后用“翻开位置”“换入位置”“交换位置”确认；弃牌和跳过能力一键执行。“已保存”表示服务确认。本人的暗牌默认不可看。喷火龙的临时查看仅本人可见，看完须确认关闭。
5. 游戏页尽量占满窗口，工具栏可切换全屏（浏览器不支持时使用自身全屏功能）。公共屏可在菜单中单独打开，F11 全屏，Alt 菜单可移动到电视所在显示器。提示音需本屏手势开启，可随时静音，手机不重复发声。全部资源随包本地提供，玩法教学在线下完成。
6. 连接帮助、游戏信息、座位设置和管理均点开悬浮窗口；游戏菜单同样以悬浮窗口打开，房主可直接找到“结束游戏”并确认。菜单还可暂停、恢复、选择决策点回退；回退可能涉及已看信息，确认后全端同步并暂停。牌桌顶部持续显示最新行动者、卡图／卡名、能力和目标位置，可点“记录”回看最近操作；临时暗牌信息仅本人查看。胜局用大星标表示，结算显示总分，计分明细在浮窗查看。小局结束未达三胜时由房主开始下一小局。
7. 正常退出或服务异常退出后重新启动，已确认游戏自动读档并暂停；房主继续、原手机同地址恢复。换地址／端口形成新浏览器源时可用房主换绑保留座位。
8. 大局结束点“再玩一局”，保留全部昵称、座位顺序、手机身份及人机等级；真人重新准备后开局。需要换一批朋友时，在管理中确认“清空牌桌”，再重新入座。
9. 程序运行期间防止电脑自动休眠，可见公共屏保持亮屏；退出释放保护，手动休眠仍可能中断服务。公共屏还在时关闭房主管理，可用 Alt → 程序 → 打开房主管理重新打开。启动失败会显示具体原因和日志路径，原生菜单也可打开日志目录。

默认启动为游玩模式：默认／豆包／绝悟人机每次行动先等待 1.5／1.8／2.2 秒，再计算并保存，桌面显示“正在思考”。房主管理页面按 `Ctrl+Shift+F12` 打开隐蔽运行模式窗口；测试模式等待 40ms，并省略动效／声音。手机和 public 不能切换模式，普通重启回到游玩模式。

不兼容或损坏存档会停止启动并保留原文件，包括此前验证模板的存档。排障前备份数据目录及 SQLite 的 WAL／SHM；不要删除原存档。需要独立新数据目录时见 [开发环境](docs/reference/development.md)。

1.1.0 已落实电脑房主仅管理、唯一牌桌的简约盒子、16 类角色卡面／统一角标和保存后的关键结果动画；全部美术及声音集中在 [assets](assets/README.md)，验证保持后台。当前来源、效果及证据见 [维护验收](docs/reference/acceptance.md#首版维护角色卡面与管理员体验)。

## 开发与验证

本机目标 Windows 11 x64；固定 Node.js 22.14.0、pnpm 10.12.1，依赖与锁文件在仓库内。

```powershell
pnpm install --frozen-lockfile
pnpm setup:desktop
pnpm dev
```

```powershell
pnpm check
pnpm build
pnpm verify:desktop
pnpm verify:party
pnpm verify:room-levels
pnpm verify:presentation
pnpm verify:game-ui
pnpm verify:cards
pnpm package:win
pnpm verify:portable
```

`pnpm start` 运行已有构建。网页热更新由 dev 提供，服务／桌面源码修改后重启。命令、数据位置及历史验证见 [开发环境](docs/reference/development.md)；完整接入、策略替换和故障处理见 [扩展指南](docs/game-development/README.md)。默认不 push，较大改动验证通过后自动提交。

## 项目入口与目录

- [文档索引](docs/README.md)、[任务与接续](docs/tasks/README.md#后续开发接续入口)、[需求基线](docs/requirements/TableMax_需求文档_v1.0.md)。
- [首版游戏规格](docs/games/pokemon-encounters/README.md)、[验收记录](docs/reference/acceptance.md)、[Agent 入口](AGENTS.md)。
- `apps/desktop` 管理窗口与独立服务，`apps/server` 适配通信／SQLite／Worker，`apps/web` 按会话、页面和通用控件组织；三种身份各有盒子入口与独立 `/game` 页面。
- `packages/protocol`、`game-sdk`、`platform-core` 维护契约和通用权威／恢复机制。
- `games/pokemon-encounters` 维护完整规则、计分、投影、策略、两端 UI、本地资源与测试；`games/template` 保留独立验证模板。
- `assets/platform` 保存共享平台资源；`apps/web/src/components/RoomTable.tsx` 维护盒子围桌房间，`games/pokemon-encounters/ui/table.tsx` 维护首版游戏场景。
- `docs` 维护当前主题和阶段归档；`artifacts/phase-05` 保留原图，`artifacts/phase-06` 保留 ZIP 和验证 JSON／截图，Git 忽略但文件树可见；新版 ZIP 在 `artifacts/releases`，本轮维护验证在 `artifacts/maintenance/six-player-presentation`，旧维护目录保留。

第二阶段独立原型在 `apps/web/src/prototype`，用 `pnpm prototype:dev` 打开 `http://127.0.0.1:5174/prototype.html`，游戏参数为 `?game=pokemon-encounters`。原型为合成状态，不连接正式存档，不替代当前游戏验收；历史入口和证据见开发环境。
