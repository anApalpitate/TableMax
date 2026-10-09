# 首版交付与验收

## 1.0.5：经典 UNO 完整本地交付（2026-10-10）

新增 Mattel G7942 同版经典 108 牌、2–6 人 UNO：普通回合、两人特别规则、+4 质疑、UNO 抓漏、末张罚牌与 500 分累计，默认／豆包／绝悟独立本地策略，服务端秘密投影与保存恢复。三端采用自然织垫、木边和实体纸牌，包含原创图文规则、保存后的飞牌／功能牌／四色纸屑反馈与十条原创离线音效。规则、出版依据与数字适配从 [游戏主题](../games/uno/README.md) 进入。

当前 [运行 ZIP](../../artifacts/releases/TableMax-1.0.5-win-x64.zip) **41,625,580 字节**，[逐文件清单](../../artifacts/releases/TableMax-1.0.5-win-x64-manifest.json) **292 成员／实际解压 95,278,471 字节**，SHA-256 `08828727f5c6ce09d1d8283be4d1eec1f262c3f293c7264133e52a9d7923bdad`。114MB 工程预算及 ZIP／实际解压严格小于 120,000,000 字节通过。[独立审计](../../artifacts/maintenance/v1.0.5/uno-20261010/source-audit.json)核验 616 个冻结输入与实际 ZIP，四款旧游戏 200 成员逐字节未变。

规则／策略 39 项、真实服务／32MiB Worker 13 项、范围工具 10 项通过；类型、适用静态及格式检查通过。实际隐藏 WinForms／WebView2 完成 2／4／6 人自然 500 分比赛，共 32 小局，693 个本人权限 Worker 决定最长 304ms；每场真实暂停、回退、退出／重启和原身份恢复。开局、六人 30 牌、9 类特殊／结束状态、320px—4K、独立显示设置、秘密权限、十音轨解码与唯一公共声道、历史不补播和减少动态通过。

上述完整比赛与主要矩阵绑定保留的 `41881a…` 原包。最后仅修正短横屏互动浮球遮跟色标记，规则／策略／运行 JavaScript／音频／位图逐字节未变；当前包实际六人横屏和 320px 密集手牌返验通过，292 成员运行前后哈希一致。[当前便携证明](../../artifacts/maintenance/v1.0.5/uno-20261010/portable-final/results.json)明确当前实测、旧证据与 [增量等价](../../artifacts/maintenance/v1.0.5/uno-20261010/landscape-delta.json)边界，不把旧图改标为新图。全部验证仅监听 127.0.0.1、物理静音；实体手机、LAN、物理 DPI 和人耳听感不记为已认证。沿用 v1.0.5，源码分阶段提交／推送，本轮只交付本地 ZIP，不替换 GitHub Release。

收尾安全退役1,560,336,113字节到龄生成副本；当前交付、原资料、素材、正式存档和验收保留。实际维护结束11,065,160,003逻辑字节（10.305GiB），安全候选耗尽，近期与未知内容继续保护；不扩大删除或把NTFS物理节省计入逻辑目标，见 [清理范围与结果](project-slimming.md#uno-完整制作收尾2026-10-10)。

2026-10-10同版本发布附件替换完成：拉密游戏库按钮显示“开发中”且禁用，[同包盒子](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/release-rummikub-final-20261010/results.json)9项通过，[实际单EXE检查](../../artifacts/maintenance/v1.0.5/release-replace-20261010/shipping-executable-checks.json)通过逐文件哈希、重复提取复用、实际运行和原生安全。[当时运行ZIP](../../artifacts/maintenance/v1.0.5/uno-20261010/delivery-before-uno/TableMax-1.0.5-win-x64.zip) 41015483字节／实际解压94595648字节，SHA-256 `89e6412a799d7a076b0cde8e450a9593e027dd24df376ffc0c9809a99092e041`；单EXE 41177088字节，SHA-256 `3d7f5ff112ef5bb4035c463a38b7587a9181e12dbe48a42fe86da2f8907e747f`，带所有权标记的提取目录94653080字节，均满足114MB预算与严格小于120MB门禁。类型、格式及静态检查通过；卡片相对定位的探针失败保留。[原v1.0.5 Release](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.5)的EXE与source ZIP已替换，线上大小与SHA-256一致，标题、正文及原标签对象保持不变，见[发布审计](../../artifacts/maintenance/v1.0.5/release-replace-20261010/github-replacement.json)。源码ZIP对应已验证提交 `4943ca5cf89aabc850df3fb566519973913feb3e`，18550573字节，SHA-256 `57b6e9df5b28f98171b113fc2b4d795235b873e3f86bd73ea3886d03a986ba32`；后续审计文档提交不重导源码ZIP；前包保存在`release-replace-20261010/delivery-before-change/`，线上旧EXE／source ZIP在`online-before/`按原SHA256备份。

2026-10-10入口文案与协议回调：按钮改为“打开网址”，外部入口恢复必须显式HTTP／HTTPS前缀，示例保留脱敏。43项地址及保存权限回归、格式与静态检查通过。[当时运行ZIP](../../artifacts/maintenance/v1.0.5/release-replace-20261010/delivery-before-change/TableMax-1.0.5-win-x64.zip) 41015416字节／实际解压94595477字节，SHA-256 `3af6de317c3b5b9184d9eee6f575802feb27eb98c7ae52b4a4525c8abbc9bfdd`；[同包盒子检查](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/prefix-restored-20261010/results.json)8项通过。前包保留于`join-prefix-20261010/delivery-before-change/`，历史结论保持。

2026-10-09连接帮助示例脱敏：占位文案改为`example.com:12345`；运行网页已检索确认不再含原域名，真实地址保存逻辑保持。[当时运行ZIP](../../artifacts/maintenance/v1.0.5/join-prefix-20261010/delivery-before-change/TableMax-1.0.5-win-x64.zip) 41015461字节／解压94595489字节，SHA-256 `dd2019e403385220773bcb4644dbe2856dd660d55c8153a7a7798a26fe7dfc72`；[同包盒子核验](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/example-redacted-20261009/results.json)8项通过。前一发言面板包保存在`join-example-20261009/delivery-before-change/`，保留原验收。

## 1.0.5：发言面板优化（2026-10-09）

按用户截图反馈，将六个大卡片改为紧凑单列，保留毛玻璃、独立短语图标和完整原文；修正标题不透明底色的样式覆盖。只改互动面板CSS。[同包结果](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/results.json)核验320×568、390×844、480×640、1280×720电脑玩家竖屏，六条完整可见、无横向溢出、按钮至少48px／正文至少18px；六条真实点击经服务端确认广播，关闭、Escape与焦点未困在浮窗内通过，房间修订不变。测试静音，不代替人耳或实体手机验收；缩放过渡、浮层尺寸与焦点断言的探针失败均保留；320px短屏底部裁切已修复。9项范围工具与格式、静态检查通过。

[当时运行ZIP](../../artifacts/maintenance/v1.0.5/join-example-20261009/delivery-before-change/TableMax-1.0.5-win-x64.zip) 41015459字节，[清单](../../artifacts/maintenance/v1.0.5/join-example-20261009/delivery-before-change/TableMax-1.0.5-win-x64-manifest.json) 275成员／实际解压94595489字节，SHA-256 `281f1bff587fc821dddb7af7a1f1dcaa293dddd115b14cf309a88deac1d74c75`。只重建平台网页560ms，21单元复用；包内文件运行前后哈希一致，均满足114MB预算和严格小于120MB门禁。前一盒子优化包保存在`speech-panel-20261009/delivery-before-change/`并保持历史结论。

收尾经预览核对删除本轮六个便携解压／浏览器副本与三个发布过程目录，共1,361,631,219字节；保留当前与前一交付、全部截图、失败结论及原始资料。[逻辑空间维护](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/maintenance-final.log)实际统计8,569,192,538字节（7.981GiB），低于10GiB阈值。

## 1.0.5：盒子初始选择与网址入口（2026-10-09）

首次无存档启动直接选中宝可梦奇遇，存档恢复保持原选择；二维码按钮显示当前完整网址，长网址换行。连接帮助支持无协议的域名／IP与端口，默认HTTP，明确HTTPS保持。48项地址、外部入口及初始选择回归、9项范围工具检查、类型与静态检查通过；首轮沙箱SSR临时目录失败已修复，标题断言改用实际完整游戏名。

[当时运行ZIP](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/delivery-before-change/TableMax-1.0.5-win-x64.zip) 41015354字节，[清单](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/delivery-before-change/TableMax-1.0.5-win-x64-manifest.json) 275成员／实际解压94594995字节，SHA-256 `f1603f0fe175d4f0ede034ad447d1285c7f0b6967f76a64055eac1d8896e462a`。仅重建平台网页与服务（2.336／11.183秒），20单元复用；严格小于120,000,000字节并在114MB预算内。

[同包盒子验证](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/box-final-20261009/results.json)检查实际ZIP成员大小与哈希、静音隐藏主机／公共窗口、真实浏览器加入、裸地址表单保存、QR及按钮同步与320／390／1280px长网址。外部地址只捕获授权目标，不代表现场FRP或实体设备验收。前一声音修复包保存在`box-entry-20261009/delivery-before-change/`，其原验收结论保持。

本轮验证结束后，经预览核对清理两个便携解压／浏览器副本及发布过程目录，共454,317,974字节；当前交付、前包、截图与原始资料保留。[收尾维护](../../artifacts/maintenance/v1.0.5/box-entry-20261009/maintenance-final.log)实际统计8,523,745,211逻辑字节（7.938GiB），低于10GiB阈值。

## 1.0.5：玩家互动音效触摸解锁（2026-10-09）

严格浏览器播放策略下，首次触摸的 `pointerdown` 尚未获得用户激活，提前调用的 `resume()` 会挂起；原实现复用该 Promise，导致已激活的 `pointerup` 无法再次恢复音频。已通过[真实触摸红例](../../artifacts/maintenance/v1.0.5/player-interaction-audio/touch-cdp-input-clean-20261009/results.json)复现，修复为上下文尚未运行时允许后续手势同步重试。300ms过期丢弃、静音视觉及历史事件不补播保持原行为。

[当时运行ZIP](../../artifacts/maintenance/v1.0.5/box-entry-20261009/delivery-before-change/TableMax-1.0.5-win-x64.zip) **41,015,324字节**，[逐文件清单](../../artifacts/maintenance/v1.0.5/box-entry-20261009/delivery-before-change/TableMax-1.0.5-win-x64-manifest.json) **275成员／实际解压94,594,904字节**，SHA-256 `b23f340cab62674ed8a611d2fc526a50003d7e28868669717879cf934fa8aa35`。114,000,000字节预算及ZIP／实际解压严格小于120,000,000字节门禁通过，快照 `2e21656ca15fcf951c1a3e0161332ba1db6fa8c5a155296ca218048bd680c2f5`；仅平台网页重建2.044秒，其他模块复用缓存。构建中发现旧占用保护误拦下载目录中的独立TableMax，按已知绝对路径与参数缩窄，17项真实PowerShell库存检查通过，工作区／来源工作区及未知实例继续保护。原包与清单保存在 `player-interaction-audio/delivery-before-fix/`，下方拉密验收引用该历史副本。

[同包声音核验](../../artifacts/maintenance/v1.0.5/player-interaction-audio/portable-final-20261009/results.json)和[便携证明](../../artifacts/maintenance/v1.0.5/player-interaction-audio/portable-proof.json)通过。真实Edge采用严格自动播放策略、非激活CDP读取与可信触摸／鼠标输入；五射击和六发言逐项本地解码、从头启动并产生非零destination输入，两个玩家环境各16次播放，最长启动延迟分别5.5／1.8ms。刷新不补播、全新未激活接收页静音、可信手势后新音效、禁用／恢复、盒子与游戏页往返通过，275程序成员运行后哈希不变，无外部请求。玩家浏览器显式开启声音，桌面验证窗口保持静音；这是机器音频信号及设备模拟结果，不代表实体手机、扬声器或人耳听感验收。

18项相关音频／播放／恢复单测、类型检查及所改文件静态检查通过。首轮沙箱SSR临时路径与依赖类型读取失败已通过项目内临时目录及正常权限检查排除；旧探针的Playwright伪用户激活结果不计产品通过，保留各失败边界。当前声音与新验证入口见[开发环境](development.md#玩家互动音效解锁核验2026-10-09)。本次不发布GitHub，也不导出源码包。

## 1.0.5：拉密经典版本地完整交付（2026-10-09）

新增经典版拉密2–4人／106牌：私有牌架、公开桌面、整回合重组草稿及统一合法提交，保存／回退／重启／管理员批准换机，主机／公共／玩家三端图文规则、本地素材及默认／豆包／绝悟人机。按用户最新要求以2025官方经典原件为最高依据，不额外加入百搭先后释放限制；原文明文与数字解释分记，见[来源](../games/rummikub/sources.md)。本次仅本地交付，没有push、源码导出或GitHub发布。

[当时运行ZIP](../../artifacts/maintenance/v1.0.5/player-interaction-audio/delivery-before-fix/TableMax-1.0.5-win-x64.zip) **41,015,328字节**，[逐文件清单](../../artifacts/maintenance/v1.0.5/player-interaction-audio/delivery-before-fix/TableMax-1.0.5-win-x64-manifest.json) **275成员／实际解压94,594,942字节**，SHA-256 `2c5474f86a1b2282d1fd21bde1fd26868e1c055649e9c11ebd4d3ccfecdecf5f`。114,000,000字节预算及ZIP／实际解压严格小于120,000,000字节门禁通过。最终快照`1f8750626a45d378f0f59f311b5ab498c62400fed3724d3af5f1879c4233bc31`，22单元复用20项，组装24.393秒；完整包及275文件哈希、实际运行后的原字节与当前冻结源输入复核见[便携证明](../../artifacts/maintenance/v1.0.5/rummikub-20261009/portable-final.json)。前一同版交付保留在[原包清单](../../artifacts/maintenance/v1.0.5/rummikub-20261009/delivery-before-rummikub/TableMax-1.0.5-win-x64-manifest.json)，历史通过不自动成为新包证据。

同包[三端UI](../../artifacts/rummikub/validation/ui-preview/final-authoritative-20261009/results.json)四组通过：首出与私有草稿、百搭重组提交及回退、小局／整场结束和原班再玩，覆盖320–430px手机、短横屏、电脑720p–4K、六章规则与本地三WAV静音解码。[实际服务](../../artifacts/rummikub/validation/runtime-final-authoritative-fresh-20261009/results.json)2／3／4人完整大局共九小局通过，每场一次真实停服／重启／本人身份恢复，439次服务Worker启动维持32MiB老生代及两秒边界，最长受测真人身份Worker决定1162.18ms。Socket／SQLite保存失败、去重、私有权限、回退和换机，以及未变代码的81源码自然小局等证据入口见[游戏验证](../games/rummikub/validation-scenarios.md)。新增双百搭五项风险与原七项规则共12项通过，当前源码类型检查通过。

最终服务绝对heap峰值68,737,968字节；相对空盒基线最高采样增量51,240,264字节。前者超过初始64MiB标量，包含共享平台成本，后者是本次服务增量检查，不能混同两种指标；额度未提高。此前整页重载及连续4K截图的手机／进程私有内存压力警告保留，普通入桌／游戏三次采样通过不证明全生命周期或完整未GC往返。手机、LAN、物理屏幕与真人听感仍属人工设备边界，自动验收默认静音。

首次最终服务预检使用已启动Native的目录，因程序正常生成`TableMax.config.json`而不再是纯275程序成员，尚未开始任何对局即停止；改为同ZIP全新解压后只重跑服务项，原失败保留，新引用的Native报告路径同步纠正，没有改产品或重复通过的UI。

## 1.0.5：GitHub发布核验（2026-10-09）

本轮用户明确授权commit、push并发布v1.0.5，主题“互动效果与网络优化”。[当时完整EXE审计](../../artifacts/maintenance/v1.0.5/github-release-20261005/shipping-executable-checks.json)41,018,880字节，SHA-256 `359d2cd5bb184c61a737cf44598e939c66be450f7a59a9a702b13769d6c8216d`，内嵌本页已验证运行ZIP。实际提取267文件／94,410,471字节（含所有权标记），重复提取复用、逐文件哈希及原生安全验证通过，见[发布EXE检查](../../artifacts/maintenance/v1.0.5/github-release-20261005/shipping-executable-checks.json)。558项冻结运行输入均已提交且无工作区差异，用户未提交文档重构另行保留。

发布附件仅完整EXE与由标签提交导出的source ZIP；不上传运行ZIP、JSON清单或截图。正文以互动效果、声音播放、网络同步及菜单体验为主，不宣称实体手机LAN目标已达标。线上状态、标签提交与附件大小／SHA-256以[发布记录](../../artifacts/maintenance/v1.0.5/github-release-20261005/github-publication.json)和[GitHub v1.0.5](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.5)为准。

## 1.0.5：菜单、互动并发与手机同步（2026-10-09）

四游戏版本的游戏／视频设置归入菜单，声音入口为图标并保持原权限；互动采用三射击槽及独立最新发言，发言时音效压至30%，300ms启动窗口内从头播放，超时不补播。同步使用运行期stamp、轻量probe、15秒完整校验与800ms只读动作查询；真正恢复清空播放并退休互动水位，健康校验保持连续。

[当时运行ZIP](../../artifacts/maintenance/v1.0.5/rummikub-20261009/delivery-before-rummikub/TableMax-1.0.5-win-x64.zip) **40,859,424字节**，[逐文件清单](../../artifacts/maintenance/v1.0.5/rummikub-20261009/delivery-before-rummikub/TableMax-1.0.5-win-x64-manifest.json) **266文件／实际解压94,355,356字节**，SHA-256 `8a8c9c8ffe391eeefef19b496235bb535692bcd5b0e2d95fd19b7069b6b754f0`。114,000,000预算和ZIP／实际解压严格小于120,000,000字节门禁均通过，实际解压大小／哈希与清单一致；最终快照`85129453…`。保留[前一交付](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/delivery-before-optimization/TableMax-1.0.5-win-x64-manifest.json)，没有源码ZIP、push或Release。

[定向检查](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/checks/summary.json)覆盖66项产品单测、8项范围工具检查，类型和ESLint通过。共享互动[9项真实渲染检查／8截图](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/ui/portable-box-20261009-repair/results.json)通过；最终包[四版本菜单／12截图](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/ui/portable-menus-touch-repair-20261009/results.json)通过，涵盖三角色权限、嵌套设置、独立屏蔽记忆及三玩家视窗。首次路径错误、验收脚本误用旧HTTP视图接口和42px声音按钮失败均保留；修复仅更新受影响项。最后按钮修复只改变现代艺术UI，[逐文件依赖复核](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/checks/menu-repair-dependency-proof.json)确认共享互动等文件字节未变，复用其通过证据，没有重跑无关游戏规则。

[本机六Socket模拟](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/socket-performance/2026-10-08T18-12-06-412Z-ef1c02bc/results.json)在127.0.0.1对polling／WebSocket各执行30次合法保存及180个接收样本，保存至接收P95分别12.88／4.44ms，漏一推送后514.66／505.48ms恢复。[准备就绪后的音频启动](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/checks/audio-start-latency.json)本机玩家／公共P95为0.70／1.90ms；测试静音，只验证实际声源启动，不认证听感。这些数值不含真实手机、LAN、跨设备时钟误差或手机关键画面更新，真实设备目标仍待[手机同步任务](../tasks/mobile-room-sync.md)验收。

## 1.0.5：互动精修与即时覆盖（2026-10-09）

按本轮最新要求取消互动FIFO及间隔，新事件立即覆盖旧动画和声音；身份、实例／分支复核和有界去重保持独立于游戏状态。浮球可拖拽并记忆相对位置，240ms长按显示以球为中心的六格环盘，中间取消、发言图标；视频设置提供三端独立屏蔽按钮。异步手机解锁、预加载与迟到音轨守卫避免旧音抢播，射击只接收从射击层开始的同一pointer，弹窗迁移清理捕获手势。

[当时运行ZIP](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/delivery-before-optimization/TableMax-1.0.5-win-x64.zip) **40,851,905字节**，[当时逐文件清单](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/delivery-before-optimization/TableMax-1.0.5-win-x64-manifest.json) **266文件／实际解压94,333,009字节**，SHA-256 `a7574e9b6402b8bb42dd88c00e80f1a86a0f2fe8957d600ded3b4a989553c4bb`。硬上限120,000,000字节和工程预算114,000,000字节通过，预算余19,666,991字节；完整打包46,894ms，冻结快照`71eb694d…`，实际解压逐文件大小／哈希一致。[前一同版包](../../artifacts/maintenance/v1.0.5/interaction-refinement/delivery-before-refinement/TableMax-1.0.5-win-x64.zip)及原清单原样保留，以下初次交付结论仅对应旧包。没有源码ZIP、push或GitHub Release。

[同包实际UI](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/final/results.json) **10检查／12截图**通过：拖动持久化、六格与中心取消、取消滑出不误发、dialog迁移恢复、五射击及六语音即时覆盖、真实11音源decode／start／stop、三端独立视频设置、电脑公共屏优先／管理员接管、短屏横屏和四个游戏／版本共享入口；暂停不推进游戏，新房间清场且重连不补播。运行的是本轮ZIP实际解压EXE，非源目录或原型；只做受影响共享控件，不跑游戏规则或整局。服务派发／权限／去重及真实轮询／WebSocket集成13项、几何3项、音频引擎6项、范围门禁7项通过；针对本次文件的TypeScript和ESLint通过。

[命中阶段补拍](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/shot-visual-final/results.json)实际确认鸡蛋、杯子倾倒、番茄飞溅和送花绽放／花瓣；首次粑粑检查因64px Canvas采样要求Alpha恰为255而失败。原图有514个Alpha255像素，浏览器64px采样最大254，属缩放舍入；改用原尺寸采样并先保存诊断后，[仅粑粑精准复核](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/poop-visual-repair/results.json)通过飞行和命中后飞溅，未改产品或重新构建，原失败与历史次数保留。根已目视复核实际花朵、emoji及飞溅截图。

全部11MP3去掉首尾静音并保留自然尾声，时长750–4990ms；鸡蛋六蛋加两拖鞋按1.2x原音和配置发射／命中点同步，送花补原版发射与赠花声音，番茄／粑粑改为实录音效，粑粑替换透明emoji图。厚颜无耻来自央视1994版唐国强诸葛亮；carry实际执行已核验模型的背景音乐分离，邻接非语音区能量减少约28–31dB，此测量不代表听感或完全无残余。当前互动媒体195,117字节，低于500KB目标。来源、原件、处理、署名和哈希见[资源清单](../../assets/platform/interaction/manifest.json)与[处理记录](../../artifacts/maintenance/v1.0.5/interaction-refinement/audio-processing.json)。[11条显式试听页](../../artifacts/maintenance/v1.0.5/interaction-refinement/audio-review.html)默认静音、无自动播放；机器ASR／完整解码不能替代人耳试听，分离伪影与音效听感仍待确认。

首轮静态检查两次因React refs规则拒绝构造器闭包、一次因窄范围tsconfig漏Vite声明和首时间点缺少可选保护而失败；达到3项后停止并修复，仅复核受影响项，记录见[静态批次](../../artifacts/maintenance/v1.0.5/interaction-refinement/checks/static-initial-failures.json)。服务批次的C盘临时目录ENOENT以本项目TMP／TEMP隔离修复，原失败和历史次数保留。全部运行隐藏、静音且监听127.0.0.1，零外联／页面错误，[工程进程退出](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/final/process-exit.json)已核对。实体手机、LAN、物理DPI及人耳听感未作为已通过。

## 1.0.5：盒子调整与跨游戏互动（2026-10-08）

产品、原生程序集及manifest为1.0.5。真人玩家透明互动球在盒子和游戏共用六等分环盘，五种单次射击与六条固定语音通过独立临时通道发送。全桌1播放＋3等待FIFO、完整时长＋200ms、身份／实例／分支复核和有界去重不改变游戏修订、随机状态、存档或checkpoint。各端可独立屏蔽，电脑互动独立音频桥接优先公共屏；浏览器玩家沿用本地手势解锁。头像裁剪删除方向键，“取消／确定”紧接缩放条并适配短屏；网址入口统一“使用网址”。

[首次运行ZIP](../../artifacts/maintenance/v1.0.5/interaction-refinement/delivery-before-refinement/TableMax-1.0.5-win-x64.zip) **40,857,197字节**，逐文件清单 **265文件／94,363,202字节**，SHA-256 `ab27e4d31ea03d7dec2565d7d8bee11384f950c7375399e93dc07c66ce8f0815`。ZIP及实际解压均严格小于120,000,000字节，114,000,000工程预算余19,636,798字节；[同包根入口](../../artifacts/maintenance/v1.0.5/root-entry/v105-final/results.json)逐文件大小／哈希、实际解压和HTTP／HTTPS入口5检查通过。未导出完整安装EXE或源码ZIP，未推送／发布GitHub。

[互动实际界面](../../artifacts/maintenance/v1.0.5/interaction-ui/final/results.json)12检查：六格选择、五射击三端显示与防误触、六发言槽、本端即时屏蔽、不补播、公共屏优先／主机接管、player无桥接、真实dialog顶层、320×568／844×390／1280×720头像首屏按钮、三游戏及宝可梦两版入口；42个打包FLAC和11MP3离线WebView2解码。[同包游戏显示](../../artifacts/maintenance/v1.0.5/player-display/v105-final/results.json)quick范围 **22检查／34布局／34截图**，包含实际合法动作与四变体；不是完整整局或历史460布局重跑。5文件29项相关会话／服务／队列／几何测试通过，另新增长语音4352ms＋200ms和新实例清空边界通过；最终类型检查通过。

[素材清单](../../assets/platform/interaction/manifest.json)记录原件、来源、派生参数和哈希；互动运行媒体232,441字节，低于500KB目标。26头像从保留原图按quality80／method6派生，尺寸／alpha一致且全部更小，1,138,110→986,872字节，节省151,238字节；40运行WAV无损FLAC转换PCM逐项相等，净省711,478字节，原件保留。机器ASR、完整解码及真实浏览器时长核验通过，**尚未进行人耳试听**，不将模型音频输入失败或ASR同音字当作试听认证；显式试听页保留在素材证据目录。

首轮服务测试因验收读取不存在seatId失败，修正验证器后通过；两次互动页面脚本分别误用了管理员`/game`和select-game携带variantId，修正为`/player/game`与select-variant后通过。素材完成后首次冻结包输入变化被正确拒绝，重新冻结受影响单元后交付；所有失败记录保留。Windows依赖链接沙箱权限问题以本项目沙箱外检查解决，不更改全局工具。测试默认静音、隐藏窗口、仅127.0.0.1；实体手机、现场LAN、物理DPI及人耳听感仍是未测边界。

## 1.0.4：网络连接与多设备页面适配（2026-10-08）

连接区采用“扫码或打开网站”，二维码下方增加48px绿色图标按钮，连接帮助说明手机扫码与手机／电脑直接打开两种方式。二维码、按钮及帮助地址使用同一当前局域网／外部根入口，旧`/player`路由兼容。原生host／public仅将当前顶层邀请链接的可信用户点击交给系统浏览器；普通新页实际按真人玩家权限入座，无管理员凭证或原生桥接。盒子窄屏座位设置重新对齐，对局返回标题按进行中／暂停／结束显示。逐页审查收紧电力公司空厂位、修正现代艺术320px行情拆行，并将宝可梦原版归零提示移至牌下编号行，避免遮住牌值；原版宽屏结算将结果与授权继续入口置于左上，最新保存动作紧邻其下，牌阵位于右侧。游戏规则、投影权限和连接实例未改变。

当前[同包汇总](../../artifacts/maintenance/v1.0.4/network-adaptation/results.json)绑定ZIP SHA-256 `d08c299bce3cef019a8960af9bde1be4cd28cd0654552758ca002f6ce19f804b`：**41,365,985字节**，248文件实际解压**94,964,067字节**，95MB工程预算余35,933字节，双100MB门禁通过。冻结快照`4ae871de…`，完整打包20,571ms，17／18单元缓存命中。前一已验`bdb08d10…`与本轮各候选保留原包／清单及成功失败记录，不改标为最终包。

[最终入口](../../artifacts/maintenance/v1.0.4/network-adaptation/connection/release-delivery/results.json)7检查核验真实原生鼠标／键盘点击、禁止任意弹窗、普通浏览器新页入座／准备、外部地址保存／清空及开始游戏后刷新返回。[最终盒子](../../artifacts/maintenance/v1.0.4/debug-20261008/box/network-adaptation-release/results.json)96布局／21浮窗／118图；[完整玩家显示](../../artifacts/maintenance/v1.0.4/player-display/network-adaptation-release-display/results.json)460布局／126检查／288图覆盖四变体最少／最多人数、设备识别、偏好、720p／1080p／4K、800／960／1200边界、125%／150%模拟密度与320–430手机，检查同一iframe、连接和输入节点，切换不改变revision。[根入口](../../artifacts/maintenance/v1.0.4/root-entry/network-adaptation-release/results.json)5检查及[远程等价故障](../../artifacts/maintenance/v1.0.4/network-adaptation-release/remote/all-2026-10-08T07-10-49-141Z/results.json)11检查核验HTTP／HTTPS非标准端口、禁止WebSocket、推送／确认丢失、重发去重、断线及执行冻结恢复、WSS、换机三阶段和重启，最新revision实际渲染且能提交动作。

[游戏逐页评判](../../artifacts/maintenance/v1.0.4/network-adaptation/game-audit/page-review.json)区分全流程候选审查与最终受影响阶段：电力公司四页及收益、现代艺术五类拍卖／双拍／结算、宝可梦两版关键阶段和30研究说明。最终原版2／6人结算、归零及横屏结果单独补验；行情、收益与新入口独立审查通过[模块等价核验](../../artifacts/maintenance/v1.0.4/network-adaptation/checks/final-module-equivalence.json)明确原包边界，不将早候选截图当成最终ZIP证据。[新入口独立逐图复核](../../artifacts/maintenance/v1.0.4/network-adaptation/visual-review/final-entry-review.json)四图SHA匹配、无可见P1／P2，首屏外座位与帮助需正常滚动，观察范围明确保留。

原生点击首次候选的回调等待死锁已修复；首次完整显示320px瞬时3px溢出保留，验证器等待实际mobile标记、字体与渲染后复验通过，阈值未放宽。原版宽屏结算返修中，旧选择器命中了内部记录按钮而非动作根容器，实际间距检查失败，后续使用根容器实测修正。候选CSS诊断受CSP阻止的失败及后续CSSOM诊断单独保留，诊断状态不可作为便携通过，最终聚合显式拒绝注入和源码模式。受限沙盒依赖realpath／Edge管道失败和懒图片等待等验证器失败继续保留，未计作产品通过。

[完整EXE核验](../../artifacts/maintenance/v1.0.4/github-release-20261005/shipping-executable-checks.json)对应EXE SHA-256 `e14a822ff50453e883de35267f8ec38c843d06251e95eaa4319b01f0c13ad533`、**41,522,176字节**；实际提取含归属标记 **95,016,135字节**／249文件，逐文件哈希、重复提取复用及原生安全通过。95MB工程预算按冻结运行载荷计，100MB提取门禁包含标记。本轮用户明确授权提交／推送、`v1.0.4`标签及GitHub Release，主题为网络连接与多设备页面适配；仅上传该完整EXE与精确发布提交的source ZIP，发布记录由现有入口落盘，公开下载以[Release](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.4)为准。

全部测试隐藏、静音且仅监听127.0.0.1。类型、相关lint／项目Prettier及清理前缀57项检查通过；实体手机、Safari、现场樱花穿透、物理Windows DPI、真实公网证书与默认系统浏览器关联未认证，125%／150%属于CSS视口和密度模拟。工程实际空间与安全退役见[瘦身记录](project-slimming.md)。

## 1.0.4：玩家比例与游戏工作区修订（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104玩家比例与游戏工作区修订2026-10-08)。

## 1.0.4：滚动条与电脑玩家横屏（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104滚动条与电脑玩家横屏2026-10-08)。

## 1.0.4：根入口、研究风险与公开缓冲重设计（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104根入口研究风险与公开缓冲重设计2026-10-08)。

## 1.0.4：电脑玩家手机视窗、盒子排版与远程续验（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104电脑玩家手机视窗盒子排版与远程续验2026-10-08)。

## 1.0.3：10.7 浏览器玩家、实时恢复与换机（2026-10-08）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103107-浏览器玩家实时恢复与换机2026-10-08)。

## 1.0.3：全量构建与GitHub发布交付（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103全量构建与github发布交付2026-10-07)。

## 1.0.3：扩展需求复查与演出时序（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103扩展需求复查与演出时序2026-10-07)。

## 1.0.3：扩展版能力消耗、原版演出与全量构建（2026-10-07）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103扩展版能力消耗原版演出与全量构建2026-10-07)。

## 1.0.3：电力公司数量采购、进度与稳定反馈（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司数量采购进度与稳定反馈2026-10-06)。

## 当前源码与本地交付

当前本地交付为本页[经典 UNO 完整本地交付](#105经典-uno-完整本地交付2026-10-10)的[运行 ZIP](../../artifacts/releases/TableMax-1.0.5-win-x64.zip)及[逐文件清单](../../artifacts/releases/TableMax-1.0.5-win-x64-manifest.json)，SHA-256 `08828727f5c6ce09d1d8283be4d1eec1f262c3f293c7264133e52a9d7923bdad`；历史同版包及发布附件保留各自实际哈希、证据和结论，不当作当前包验收。

运行ZIP、逐文件清单、原图和实际验收证据均为本地文件，不随源码push上传。源码提交／推送不等于发布新程序；公开下载与附件以GitHub Releases为准。项目逻辑空间以[最新瘦身记录](project-slimming.md)为准，历次数字保留其统计时间与保护范围。

下文旧轮次的“原包保留”描述其当时状态；本轮已按授权退役23份更早运行ZIP，链接改指原清单或退役哈希记录，历史大小、版本及通过／失败结论不改写。当前包、前一份整合包和宝可梦独立旧验收包继续保留。

前一轮电力公司包 `201de235…` 未包含当时正在修改的宝可梦界面。当前包已整合这些修订，并分别核验实际包内画面、完整对局与恢复；未变化游戏采用下述逐文件等价证明复用既有检查。

## 1.0.3：宝可梦扩展深度界面与整合交付（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦扩展深度界面与整合交付2026-10-06)。

## 1.0.3：电力公司地图材质、动画与综合资料细化（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司地图材质动画与综合资料细化2026-10-06)。

## 1.0.3：电力公司地图与带图公司卡优化（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司地图与带图公司卡优化2026-10-06)。

## 1.0.3：宝可梦扩展版UI重设计（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦扩展版ui重设计2026-10-06)。

## 1.0.3：游戏介绍弹窗布局修复（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103游戏介绍弹窗布局修复2026-10-06)。

## 1.0.3：单EXE专属目录初始化微调（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103单exe专属目录初始化微调2026-10-06)。

## 1.0.3：便携存储配置与大存档启动修复（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103便携存储配置与大存档启动修复2026-10-06)。

## 1.0.2：测试静音与资源瘦身（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102测试静音与资源瘦身2026-10-06)。

## 1.0.2：扩展版一次性技术收尾（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版一次性技术收尾2026-10-06)。

## 1.0.2：普通前瞻三胜目标同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102普通前瞻三胜目标同包续验2026-10-06)。

## 1.0.2：三胜目标修复同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102三胜目标修复同包续验2026-10-06)。

## 1.0.2：累积能力模型同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102累积能力模型同包续验2026-10-06)。

## 1.0.2：火箭队能力估值与角色无损格式续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102火箭队能力估值与角色无损格式续验2026-10-06)。

## 1.0.2：普通收局前瞻与无损卡面续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102普通收局前瞻与无损卡面续验2026-10-06)。

## 1.0.2：扩展版三胜策略与叫声同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版三胜策略与叫声同包续验2026-10-06)。

## 1.0.2：电力公司地图背景与阶段抽屉（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102电力公司地图背景与阶段抽屉2026-10-06)。

## 1.0.2：前瞻均值修复与普通模式同包续验（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102前瞻均值修复与普通模式同包续验2026-10-06)。

## 1.0.2：扩展版续建、预算与同包复核（2026-10-06）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102扩展版续建预算与同包复核2026-10-06)。

## 1.0.2：本地宝可梦扩展版技术可玩包（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102本地宝可梦扩展版技术可玩包2026-10-05)。

## 1.0.2：完整EXE发布与维护规则更新（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102完整exe发布与维护规则更新2026-10-05)。

## 1.0.4：独立增量构建与分块组装（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104独立增量构建与分块组装2026-10-05)。

## 1.0.4：新手引导开关与同版本更新（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104新手引导开关与同版本更新2026-10-05)。

## 1.0.4：合并打包与实际便携检查（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#104合并打包与实际便携检查2026-10-05)。

## 1.0.3：任务完成后合并重打包与复核（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103任务完成后合并重打包与复核2026-10-05)。

## 1.0.3：电力公司人机、分页与声画 debug（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司人机分页与声画-debug2026-10-05)。

## 1.0.3：宝可梦操作引导、同值归零与动漫切入（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦操作引导同值归零与动漫切入2026-10-05)。

## 1.0.3：宝可梦原创图文规则页（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦原创图文规则页2026-10-05)。

## 1.0.3：宝可梦人机、能力演出与版本复用（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103宝可梦人机能力演出与版本复用2026-10-05)。

## 1.0.3：电力公司真实 UI 试玩与第二轮优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#103电力公司真实-ui-试玩与第二轮优化2026-10-05)。

## 1.0.2：合并深度检查与项目瘦身（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102合并深度检查与项目瘦身2026-10-05)。

## 1.0.2：电力公司界面与原创规则图解（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102电力公司界面与原创规则图解2026-10-05)。

## 1.0.2：宝可梦声画与手机优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102宝可梦声画与手机优化2026-10-05)。

## 1.0.2：现代艺术优化（2026-10-05）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102现代艺术优化2026-10-05)。

## 1.0.2：盒子 debug（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102盒子-debug2026-10-04)。

## 1.0.2：本地重新导出与 releases 清理（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102本地重新导出与-releases-清理2026-10-04)。

## 历史截图去重（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#历史截图去重2026-10-04)。

## 本地项目整理与瘦身（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#本地项目整理与瘦身2026-10-04)。

## 历史验收导航

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#历史验收导航)。

## 1.0.2：电力公司 debug，横向地图、价区与声画（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102电力公司-debug横向地图价区与声画2026-10-04)。

## 1.0.2：通用视觉、规则说明与项目瘦身（2026-10-04）

见[历史记录](../archive/acceptance-2026-10-05-to-08.md#102通用视觉规则说明与项目瘦身2026-10-04)。

## 1.0.2：现代艺术 debug 修复（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102现代艺术-debug-修复2026-10-04)。

## 1.0.2：版本导出与历史清理（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102版本导出与历史清理2026-10-04)。

## 1.0.1：电力公司经典德国版（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101电力公司经典德国版2026-10-04)。

## 1.0.1：现代艺术真实对局排查（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101现代艺术真实对局排查2026-10-04)。

## 1.0.1：现代艺术视听与共用倒计时（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101现代艺术视听与共用倒计时2026-10-04)。

## 1.0.1：盒子头像与游戏介绍（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101盒子头像与游戏介绍2026-10-04)。

## 1.0.1：宝可梦画面与动效返修（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101宝可梦画面与动效返修2026-10-04)。

## 1.0.1：应用图标更新（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101应用图标更新2026-10-03)。

## 1.0.1：GitHub Release（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#101github-release2026-10-03)。

## 执行与证据

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#执行与证据)。

## AC 对照

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#ac-对照)。

## 首版维护：独立牌桌与操作简化

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护独立牌桌与操作简化)。

## 使用与维护

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#使用与维护)。

## 首版维护：视觉纠错与场景打磨

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护视觉纠错与场景打磨)。

## 首版维护：角色卡面与管理员体验

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护角色卡面与管理员体验)。

## 首版维护：聚会可靠性与连续游玩

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护聚会可靠性与连续游玩)。

## 首版维护：手机围桌与三档人机

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护手机围桌与三档人机)。

## 首版维护：游玩节奏与六人提示

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护游玩节奏与六人提示)。

## 首版维护：电脑多分辨率显示

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#首版维护电脑多分辨率显示)。

## 1.6.0：盒子、对局体验与可靠性

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#160盒子对局体验与可靠性)。

## v1.0.0：版本归一与开发效率优化

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#v100版本归一与开发效率优化)。

## 1.0.0：同版本视觉优化（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100同版本视觉优化2026-10-03)。

## 1.0.0：独立视觉审查与返修（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100独立视觉审查与返修2026-10-03)。

## 1.0.0：便携包语言精简（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100便携包语言精简2026-10-03)。

## 1.0.0：原生桌面与小体积交付（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100原生桌面与小体积交付2026-10-03)。

## 1.0.0：现代艺术独立接入（2026-10-03）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#100现代艺术独立接入2026-10-03)。
