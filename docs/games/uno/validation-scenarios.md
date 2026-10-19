# UNO 规则与策略验证

本页维护规则／信息／bot 的真实源码检查；三端视觉、真实服务、便携包与音频核验由游戏主题索引及验收记录引用，不将源码测试升级为实际包已通过。当前预装完整 EXE 及精确恢复见[最新验收](../../reference/acceptance.md#106唯一完整-exe2026-10-12)，以下各日期、ZIP 及报告保持原构建边界。

## 开局设置、抓漏宽限与手机重排（2026-10-20）

本次仅更新源码，不调整公开版本、不导出安装器。经典规则默认不叠罚；可选补牌传递、累计处罚与旧档边界见[规则](rules.md)，平台权威门控见[平台规格](../../reference/phase-02-platform-spec.md)。定向Vitest共169个不同用例的最新结果均通过，含配置19、传递9、原规则21、策略12、整场19、竞态2、手牌4、声画映射17，以及受影响共享平台／服务端66项；重复复验不另计。主要运行记录：`5dc4ffd8-c737-4c55-920c-5788c42cf7ce`、`e9829fd3-b6ae-4677-8f35-a9a9e28df87b`、`e77bf38a-bba5-4c7a-a477-3dda3b0a92ab`、`17378cd5-2a12-4405-8c78-9f995c705650`、`559d5983-f8de-451b-945d-fe15aa67eb50`，均在`artifacts/maintenance/test-history/runs/`。前两轮失败保留，不把整轮失败改标通过；对应项在修复后独立轮通过。

真实Socket／SQLite检查配置权限、保存失败、0／4999／5000ms边界与重启保留；平台定向检查暂停／恢复、回退新分支、缺失原发行后的精确修复、人机5秒等待不计入策略超时及等待期间元数据变化后重新决策。旧存档不补新设置或宽限；新局默认500ms，本人喊UNO和下一位合法动作保持即时。

源码布局夹具证据在`artifacts/maintenance/uno-source-20261020/`：`full-a4`覆盖11视口的普通／中文密集／无空格昵称及保存几何；其1280×720两项裁切失败经短桌面自然高度修复后在`short-a8`通过。后者另检查累计+2／+4响应和自动证据行关闭、恢复不弹与权限隔离。`smoke-a3`及`dialogs-a7`覆盖规则、菜单和游戏设置；`short-a8`与`baseline-phone-a10`完成11尺寸共22组隔离基线；普通320px页面scrollHeight从782降至622（−160px），390px从1039降至780（−259px）。320px长昵称密集场景734增至841（+107px，必要信息完整换行），不声称所有场景均缩短。a10的25项通过保留单项结果，500ms计时夹具起点误放在图片解码与几何测量之后，CPU并发时误判；改由render接收投影至真实disabled→enabled时刻测量，独立`delay-a11`三档延迟复验全部通过，不放宽断言。条件CSS修复只影响宽≥960且高≤760的玩家页，其他尺寸保留原输入边界及通过证据，不将旧报告整轮改标通过。

共享源码界面74组回归通过；最终UNO三端设置／保存几何及手机视频入口9组在`artifacts/maintenance/settings-and-save-20261020/uno-shared-final-r02/report.json`复验通过。当前TypeScript、ESLint、项目Prettier及平台／UNO源码构建通过，日志和失败／修复账在`artifacts/maintenance/uno-settings-20261020/`；范围登记工具回归另见`09a5cdba-2976-4b2d-9783-573f0ed02e4b`。

全部浏览器检查为隐藏、静音、127.0.0.1下源码模拟视口与合法投影，不能代替实体手机、Safari、实际安装包或人耳试听。24字长昵称仍可能需要纵向滚动；不为减少高度截断必要信息。音频13项无损解码与峰值核验见[资源](assets.md)，并未试听或改变日常静音偏好。文档链接审计665条无新错误；总审计仍因任务开始即存在的AGENTS.md 8432字节超过8192字节门限失败，该文件属其他任务改动，原样保留。

## 规则高风险场景

[rules.test.ts](../../../games/uno/rules/rules.test.ts) 21 项覆盖：

- 精确 108 个实体编号、四色各 25 张及完整牌组 1240 点；同色／同数字／同符号、禁止罚牌叠加。
- 自愿摸一张、只能出刚摸牌、可保留、不能出时自动交棒；非法身份、卡号、颜色和额外字段。
- 两人跳过／反转／+2 返回本人，三人方向和跳过。
- +4 原文诈唬、仅受罚者响应、旧颜色判定、成功罚出牌者 4、失败罚质疑者 6、接受罚 4。
- 私密证据仅质疑者可见；pending 证据删同色牌洗白拒绝；抓漏追加牌不污染原始证据。
- 末张 +2 先罚摸计分、末张 +4 待响应后计分、两人 +4 返回本人。
- 独立喊UNO、补喊／抓漏竞态、下一主动动作关闭窗口；规则保持纯函数，权威宽限由平台门禁实现；旧测试的已声明局面通过两次独立合法动作构造。
- 牌库耗尽重洗旧弃牌且保留顶牌；150 个六人初始化 seed 覆盖所有合法开局行动牌并排除开局 +4。
- 下一小局生命周期、积分与发牌者轮换、证据重置；缺牌、复制、错座位、伪造积分／赢家及额外字段读档拒绝；克隆状态不修改原输入。

## bot 场景

[strategy.test.ts](../../../games/uno/bot/strategy.test.ts)当前12项（经典8项及新增4个传递节点）逐一覆盖三档在开局颜色、普通出牌、摸牌、摸后出牌／保留、+4 响应、UNO 补喊／抓漏的合法出口。另验证默认／豆包危机拦截差异、豆包／绝悟授权末张记忆差异、所有档位不非法诈唬、本人证据与其他座位隔离、3 张／完整记忆差异、出牌删旧知识、重局重置、错身份／记忆／取消拒绝。

[matches.test.ts](../../../games/uno/bot/matches.test.ts)当前19项，另新增三档2／4／6人共9个传递整场；经典10项：三档分别以 2、4、6 人跑 seed `17`、`319`、`20261010` 共 27 场，全部实际推进到某人 500 分，每次动作核验规则合法性与 `validateState`；另以 seed `781` 重跑两场绝悟四人全局，核验完整结局一致。所有动作还核验传入状态保持不变。

## 2026-10-10 实际结果与修复记录

- 初轮规则 20／21 通过；失败断言把可抓漏 UNO 的受罚座位误认为完全无动作。该用例改为明确同时喊 UNO，再检验不能叠罚，规则 21／21 通过。
- 组合 Vitest 初轮后两个 Worker 无法读取 Windows 沙箱临时 SSR runner 文件（ENOENT），bot 测试未启动；保留工具失败统计。设置本轮 TEMP／TMP 到项目 `tmp/uno-tests`，按文件运行成功。
- 策略 8／8 通过，统计报告 `artifacts/maintenance/test-history/runs/7ea3b46d-627a-489f-90fa-d8c790ad873e.json`。
- 整场 10／10 通过，实际约 14.1 秒，报告 `artifacts/maintenance/test-history/runs/228ee217-8b66-4fb4-aab9-6668a7a11534.json`。
- 修改后最终组合检查 **39／39 通过**，包含 27 场和两场重复种子，实际 16.05 秒，报告 `artifacts/maintenance/test-history/runs/3f72869a-9ca7-4f4b-8022-5ccfe7a5c288.json`。窄范围 TypeScript、ESLint 与本页五份文档／规则策略的 Prettier 检查通过。
- 平台真实服务 3 项与 Worker 10 项通过：SQLite／Socket 的秘密权限、保存失败、去重、回退、重启及管理员批准换机；2／4／6 人与三档策略的实际 32MiB Worker、两秒边界和取消。报告 `artifacts/maintenance/test-history/runs/21fce2bb-9e5d-4094-a7e4-9b2cc1fdff2c.json` 包含 15 个测试／hook 统计节点，实际产品测试为 13 项。范围工具 10 项另计；合计 52 个 UNO 产品源码测试及 10 个工具测试通过。
- 实际三端、声画和便携比赛从 [当前便携证明](../../../artifacts/maintenance/v1.0.5/uno-20261010/portable-final/results.json)进入。当前包六人横屏／320px 密集手牌真实返验，旧包 2／4／6 人自然 500 分、32 小局和 693 个 Worker 决定按逐文件等价保留原哈希边界；不将源码比赛或旧包报告改标为新包完整实测。

正常验证保持 `TABLEMAX_TEST_SOUND=off`。统一范围为 `game:uno`，按[统一失败阈值](../../reference/validation.md#历史通过率与失败阈值)停线并先修复，不自动重试；结果统计沿用项目历史库。

## Bug第5条修复（2026-10-11）

独立抢按、拒绝新同时喊牌动作、第一保存竞争、下一主动动作关闭、秘密权限见 `race.test.ts`；真实Socket竞态及保存失败见 `apps/server/src/uno.test.ts`。规则／策略／手牌整理43项、真实服务及Worker受影响项、共享调度16项均通过；三档普通模式真实等待联测通过，实际4.512秒，未用测试模式40ms冒称普通反应空间。固定局面验证默认均匀选择实体牌与Wild随机选色，原27场自然500分比赛通过，不按单场胜负承诺难度。

实际运行包[事件与结算](../../../artifacts/uno/validation/bug-567-uno-events-fixed/results.json)验证本人UNO与对手抓漏同时可见、实际按钮保存、UNO／抓漏／+4质疑独立音效、小局及整场计分、正常布局保存条、减少动态与历史不重播。初轮脚本过早以出牌音效完成判断UNO音效，已改为等待指定cue；原失败报告保留，未修改产品声音规则。

[最终包布局与结算](../../../artifacts/uno/validation/bug-567-uno-final-layout/results.json)覆盖320px、390px、横屏、720p至4K、首末牌可操作、长按整理及小局／整场保存条不重叠，实际84.25秒／21截图。初次短屏保存条被长昵称挤出首屏，改为根布局正常流并在短屏置于摘要上方；后续截图发现结果容器仍压缩溢出，改为内容自然高度并添加不重叠断言后通过。未改变本地整理与稳定DOM。实体手机触控／听感及Safari仍待现场验收。

最终包补齐[两人](../../../artifacts/uno/validation/bug-567-uno-layout-2/results.json)、[三人](../../../artifacts/uno/validation/bug-567-uno-layout-3/results.json)、[五人](../../../artifacts/uno/validation/bug-567-uno-layout-5/results.json)密集手牌与手机／电脑布局，各3截图、约12.2秒；四人两行摘要见上述事件与结算截图，六人覆盖完整尺寸矩阵。

## 手牌右侧白边回归（2026-10-11）

[旧实际包](../../../artifacts/uno/validation/edge-baseline-2-20261011/results.json)复现320px下手牌右端250px、内容右端310px，额外60px空位。检查增加根节点空槽与手牌内容边界断言，并专门启用390×844电脑指针模式，不能以触屏媒体查询代替电脑滚动条验证。最终两人初始手牌及六人密集手牌覆盖320×568、390×844、390×640、844×390，以及主机／公共屏720p至4K和100／125／150%显示比例，验证首末牌命中、排序及长按拖动。报告见[两人](../../../artifacts/uno/validation/edge-verified-2-20261011/results.json)、[六人](../../../artifacts/uno/validation/edge-verified-6-20261011/results.json)。

宽度修复后的两项初验暴露浮球遮牌，已改为底部独立留位与新默认位置；随后两人检查把容器外已裁切的牌误判为可见，实际截图确认后增加真实滚动容器裁切边界。原失败报告保留，仅重跑受影响项。独立TypeScript探针初次缺少Vite与本地音频声明，补齐项目已有声明后通过。测试静音、隐藏、仅回环地址，实体手机与Safari未验。

## UNO 专项构建与验证

新增游戏通过模块清单发现，独立构建 `node tools/build/build.mjs --only=game:uno`；单测入口 `node tools/test/runner/test-scoped.mjs --scope=game:uno`，只选择 UNO 规则、策略、UI 与 UNO 服务／Worker 测试。范围隔离工具变化另运行 `node --test tools/test/runner/scopes.test.mjs`，不启动其他游戏。实际结果与设备边界见 [UNO 验证](#2026-10-10-实际结果与修复记录)。

`node tools/test/games/uno/verify-uno.mjs --mode=ui --seats=6 --executable=<实际解压的TableMax.exe> --zip=<匹配EXE的内部payload.zip> --evidence=<安全独立名称>` 在实际隐藏 WinForms／WebView2 核验三端、秘密、完整108牌场景、图文规则、触控和保存声画；`--only=opening,dense,reverse,skip,draw-two,wild,draw-four,uno,challenge,round-finish,match-finish` 选择受影响项。`--compact` 只做320px／720p，`--landscape` 定向844×390；`--sample` 只取初始样本，不能代替完整 UI。普通节奏和减少动态分别核验，原生物理静音。

v1.0.6 交互专项：`--layout-only --only=dense` 保留三种手机尺寸及720p—4K主机／公共屏矩阵，支持 `--seats=2|3|4|6`，核验叠牌暴露宽度、浮球与整个中央状态区的避让。`--hand-interactions` 增加可信触摸长按、非法牌调位、横滑隔离、边缘滚动／取消、摸牌追加、稳定DOM、排行榜同分、刷新和回退；整理期间核验无游戏命令及声画。`--legacy-executable=<保留的v1.0.5程序>` 先由旧程序加载并保存对局与显示设置，再由当前程序恢复，不能将新夹具单独冒称旧版自然对局。仅游戏UI改变时不重跑规则或自然完整比赛；模拟手机、缩放及机器音频不等同实体设备／人耳验收。

同一入口 `--mode=runtime --seats=2|4|6` 推进自然500分比赛、下一小局与真正退出／重启 Native；包内32MiB Worker只收到本人授权信息，服务端bot走原统一动作流程。每次选择新证据名，保留原失败和包哈希。首次完整检查后只返验实际变化；若最终仅条件 CSS 改变，使用实际成员等价证明复用未受影响组件，旧报告仍对应旧 ZIP。运行前后核验全部程序成员，监听固定为127.0.0.1，不改玩家声音偏好、系统 DPI 或防火墙。

运行与依赖按[锁定环境](../../reference/build-and-run.md#环境与依赖)准备；旧Corepack缓存处理仅保留为[历史方法](../../archive/tooling-delivery-organization-2026-10-15.md#旧corepack环境处理)，不能据旧成功改变全局环境。
