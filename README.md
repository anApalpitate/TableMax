# TableMax

供自己和朋友线下聚会使用的 Windows 局域网全数字桌游平台。电脑负责本地服务与公共屏，玩家通过手机浏览器加入并操作；正式游玩不依赖互联网或实体组件。

## 当前状态

第一至六阶段已完成。1.0.0 默认运行《宝可梦奇遇：皮卡丘和朋友们》，支持 2–5 位真人／电脑混合、16 类 56 张牌、全部能力、独立计分、三胜完整大局、原创本地资源和声音。平台包含单房间大厅、独立身份及换绑、按身份投影秘密信息、保存后确认、决策点回退与重连／重启恢复。

48 项工程测试、全部 D01–D13 恢复、三处能力真实进程强制终止、7 组真实能力 UI、实际 Worker 混合整局与最终 Windows 便携验证通过。按用户 2026-10-01 授权，电视和手机采用当前电脑上的尺寸／触控／UA／后台及断网模拟；不声明实际手机 Safari、电视硬件或另一台无开发环境电脑已验收。证据与 AC-01–AC-23 见 [验收记录](docs/reference/acceptance.md)。

游戏按 `tablemax-cn-s19-v1` 项目采用规则实现；官方原文／印次认证缺口保留在 [来源页](docs/games/pokemon-encounters/sources.md)。卡面使用原创自然静物，名称、数值和能力由代码独立显示，素材不冒充出版卡图。后续《电力公司》德国地图和跨游戏调试按独立需求安排。

## 使用便携版

1. 解压 [TableMax-1.0.0-win-x64.zip](artifacts/phase-06/TableMax-1.0.0-win-x64.zip)，双击 `TableMax.exe`。无需预装 Node.js；默认端口 38473，数据保存在当前用户本地应用数据的 TableMax 目录。
2. 电脑和手机连接同一局域网，在主机地址列表选择手机可达的 IPv4；手机扫码或打开显示的地址，输入昵称、加入并准备。访客网络隔离或防火墙可能影响连接，折叠“连接帮助”可排查。
3. 房主可添加电脑、调整开局顺序；真人加电脑共 2–5 人，全部准备后开始。“房主用独立玩家身份参与”在当前窗口取得独立玩家身份；可返回管理，将该座位换绑到手机。房主作为玩家仍只看到本人授权信息。
4. 手机先选来源／卡位／能力，再“确认提交”；“已保存”表示服务确认。本人的暗牌默认不可看。喷火龙的临时查看仅本人可见，看完须确认关闭。
5. 公共屏可单独打开，F11 全屏，Alt 菜单可移动到电视所在显示器。提示音需本屏手势开启，可随时静音，手机不重复发声。游戏帮助及全部资源随包本地提供。
6. 房主管理在折叠区，可暂停、恢复、选择决策点回退或结束；回退可能涉及已看信息，确认后全端同步并暂停。小局结束未达三胜时由房主开始下一小局。
7. 正常退出或服务异常退出后重新启动，已确认游戏自动读档并暂停；房主继续、原手机同地址恢复。换地址／端口形成新浏览器源时可用房主换绑保留座位。

不兼容或损坏存档会停止启动并保留原文件，包括此前验证模板的存档。排障前备份数据目录及 SQLite 的 WAL／SHM；不要删除原存档。需要独立新数据目录时见 [开发环境](docs/reference/development.md)。

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
pnpm verify:game-ui
pnpm package:win
pnpm verify:portable
```

`pnpm start` 运行已有构建。网页热更新由 dev 提供，服务／桌面源码修改后重启。命令、数据位置及历史验证见 [开发环境](docs/reference/development.md)；完整接入、策略替换和故障处理见 [扩展指南](docs/game-development/README.md)。默认不 push，较大改动验证通过后自动提交。

## 项目入口与目录

- [文档索引](docs/README.md)、[任务与接续](docs/tasks/README.md#后续开发接续入口)、[需求基线](docs/requirements/TableMax_需求文档_v1.0.md)。
- [首版游戏规格](docs/games/pokemon-encounters/README.md)、[验收记录](docs/reference/acceptance.md)、[Agent 入口](AGENTS.md)。
- `apps/desktop` 管理窗口与独立服务，`apps/server` 适配通信／SQLite／Worker，`apps/web` 维护三条正式路由。
- `packages/protocol`、`game-sdk`、`platform-core` 维护契约和通用权威／恢复机制。
- `games/pokemon-encounters` 维护完整规则、计分、投影、策略、两端 UI、本地资源与测试；`games/template` 保留独立验证模板。
- `docs` 维护当前主题和阶段归档；`artifacts/phase-05` 保留原图，`artifacts/phase-06` 保留 ZIP 和验证 JSON／截图，Git 忽略但文件树可见。

第二阶段独立原型在 `apps/web/src/prototype`，用 `pnpm prototype:dev` 打开 `http://127.0.0.1:5174/prototype.html`，游戏参数为 `?game=pokemon-encounters`。原型为合成状态，不连接正式存档，不替代当前游戏验收；历史入口和证据见开发环境。
