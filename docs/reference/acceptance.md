# 首版交付与验收

## 1.0.5：发言面板优化（2026-10-09）

按用户截图反馈，将六个大卡片改为紧凑单列，保留毛玻璃、独立短语图标和完整原文；修正标题不透明底色的样式覆盖。只改互动面板CSS。[同包结果](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/results.json)核验320×568、390×844、480×640、1280×720电脑玩家竖屏，六条完整可见、无横向溢出、按钮至少48px／正文至少18px；六条真实点击经服务端确认广播，关闭、Escape与焦点未困在浮窗内通过，房间修订不变。测试静音，不代替人耳或实体手机验收；缩放过渡、浮层尺寸与焦点断言的探针失败均保留；320px短屏底部裁切已修复。9项范围工具与格式、静态检查通过。

[当前运行ZIP](../../artifacts/releases/TableMax-1.0.5-win-x64.zip) 41015459字节，[清单](../../artifacts/releases/TableMax-1.0.5-win-x64-manifest.json) 275成员／实际解压94595489字节，SHA-256 `281f1bff587fc821dddb7af7a1f1dcaa293dddd115b14cf309a88deac1d74c75`。只重建平台网页560ms，21单元复用；包内文件运行前后哈希一致，均满足114MB预算和严格小于120MB门禁。前一盒子优化包保存在`speech-panel-20261009/delivery-before-change/`并保持历史结论。

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

本轮用户明确授权commit、push并发布v1.0.5，主题“互动效果与网络优化”。[完整EXE](../../artifacts/releases/TableMax-1.0.5-win-x64.exe)41,018,880字节，SHA-256 `359d2cd5bb184c61a737cf44598e939c66be450f7a59a9a702b13769d6c8216d`，内嵌本页已验证运行ZIP。实际提取267文件／94,410,471字节（含所有权标记），重复提取复用、逐文件哈希及原生安全验证通过，见[发布EXE检查](../../artifacts/maintenance/v1.0.5/github-release-20261005/shipping-executable-checks.json)。558项冻结运行输入均已提交且无工作区差异，用户未提交文档重构另行保留。

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

电脑竖屏采用390–480px宽度优先、9:20理想比例，横屏上下16px且框外按钮不占一行。座位身份连续排列、完整长昵称随内容增高，玩家窄屏两列防重叠；换手机入口180×48px居中。管理员短屏收紧间距并保留牌桌构图，页面仍可纵向滚动。电力公司定位下拉仅管理员、共用最小缩放0.64、玩家地皮进度仅行动页；四页内部重排选择／确认、市场和公司，厂景方形图集等比裁切。现代艺术以行情摘要、拍卖工作台与私有手牌组织，双拍所有参与者采用40%工作台／60%手牌，拍品、价格与合法主要动作短屏同见。规则、身份权限和存档字段未改。

[同包汇总](../../artifacts/maintenance/v1.0.4/layout-revision-delivery/results.json)绑定ZIP SHA-256 `bdb08d109de3047c5c9dd777e9c804ad0ffdc511acc811b31602e3ca283411fd`：**41,363,637字节**，248文件实际解压**94,955,779字节**，95MB预算余44,221字节，双100MB门禁通过。冻结快照`eba1cdb1…`，生产构建10,833ms、17／18单元缓存命中，完整打包22,535ms。返修候选`f7b46cbe…`、`af460437…`、`0df98d09…`及原失败报告独立保留，未改标为当前包。

[完整显示](../../artifacts/maintenance/v1.0.4/player-display/layout-revision-final-delivery/results.json)460布局／126检查／288实际截图，覆盖八个变体与合法最少／最多人数，720p／1080p／4K、800及子文档960／1200边界、125%／150%模拟密度、320–430手机、设备识别及偏好回退。[电力公司草稿](../../artifacts/maintenance/v1.0.4/player-display/layout-revision-final-power-drafts/results.json)104布局／32检查，真实键盘选中合法城市、报价／采购输入节点、地皮展开状态、分页与地图相机通过横竖切换；[现代艺术草稿](../../artifacts/maintenance/v1.0.4/player-display/layout-revision-final-art-drafts/results.json)108布局／26检查，包含同一报价节点、手牌排序、五类拍卖、双拍与结算。切换保持同一iframe、连接、凭证和revision，不提交动作。补充布局与完整矩阵有重复，不相加作为独立场景数。

[完整盒子](../../artifacts/maintenance/v1.0.4/debug-20261008/box/layout-revision-final-delivery/results.json)96布局／21浮窗／零几何问题，实际保存外部入口、只读公共帮助和管理员换机批准通过；[混合座位](../../artifacts/maintenance/v1.0.4/layout-revision-final-delivery/portable/mixed/results.json)32布局／4检查含真实默认Worker。[根入口](../../artifacts/maintenance/v1.0.4/root-entry/layout-revision-final-delivery/results.json)核验全部成员及HTTP／HTTPS非标准端口入座、刷新、准备、旧路径与权限。[等价远程故障](../../artifacts/maintenance/v1.0.4/layout-revision-final-delivery/remote/all-2026-10-08T05-12-57-791Z/results.json)通过禁止WebSocket、丢推送／同步与动作确认、原动作去重、断线、实际Frame暂停恢复、WSS、三阶段换机及重启，检查最新revision实际渲染。

[独立逐图审查](../../artifacts/maintenance/v1.0.4/layout-revision-delivery/visual-reviews.json)记录每图独立输入、图片SHA和协调裁定；最终盒子、电力公司选厂及现代艺术暗标未见必修问题。长昵称导致卡高不同及逐席暗标状态较密为P3，保留完整姓名和逐席信息，不恢复将状态推到底部的大空白。[地图专项](../../artifacts/maintenance/v1.0.4/layout-revision/power-grid/map-role-keyboard-complete/results.json)68.25秒通过角色、按钮／滚轮／触摸0.64缩放、实际抽屉遮挡、采购及城市键盘路径；此项为生产组件与规则夹具，不冒充同包服务对局。采购输入后点击地皮折叠的焦点移动缺陷已修复；旧定位选择器、旧滚动条断言、双拍等待窄列和原候选失败保留。类型、相关lint／Prettier和16项相机／玩家框架测试通过。

全部测试静音、隐藏窗口、仅127.0.0.1；实体手机、现场樱花穿透、Safari、物理Windows DPI与真实公网证书仍未认证。收尾安全清理见[瘦身记录](project-slimming.md)，按用户授权仅提交并push本次源码，不建标签或GitHub Release。

## 1.0.4：滚动条与电脑玩家横屏（2026-10-08）

本节保留上一轮提交`93334d3`对应的验收；最新布局与包以本页前节为准。

电脑玩家首次采用 9:19.5 优先竖屏，浏览器独立记住 portrait/wide；区域外右上角 48px 深绿／金色按钮切换。外层不足800px暂时使用移动布局，扩大后恢复；识别排除手机及桌面UA的iPad，触屏Windows仍提供按钮。盒子和四游戏变体在实际子文档960／1200px适配，电力公司保留四页及hidden/inert；共享圆角原生滚动条提供游戏配色，触摸与强制高对比使用系统回退。权限、规则、存档字段未变。

当前实际 ZIP SHA-256 `2b3439eca289c9e6fd7f98a86a865b0cde5f8ba5481c91dfe57d3c5116c4c5c2`，41,362,411字节，实际解压94,945,976字节、248文件，95MB预算剩54,024字节，ZIP／解压严格双100MB门禁通过。冻结快照 `5016d1a5…`，构建12,370ms、17缓存单元复用；上一已验 `a9ee8498…` 在[历史交付](../../artifacts/maintenance/v1.0.4/player-display/previous-delivery/TableMax-1.0.4-win-x64.zip)原样保留。候选 `75a39b14…` 的完整检查另留原证据，未改标为当前包。

[最终根入口](../../artifacts/maintenance/v1.0.4/root-entry/player-display-delivery/results.json)核验全部248实际解压成员及HTTP／HTTPS非标准端口真实入座、刷新、准备、旧路径与玩家权限。[最终远程](../../artifacts/maintenance/v1.0.4/player-display-delivery/remote/all-2026-10-08T03-49-49-662Z/results.json)在同一ZIP的HTTPS本机非标准端口代理实际切换横竖，检查禁止WebSocket、丢推送／同步确认、原动作编号重发一次保存、断线、实际Frame执行暂停后恢复、WSS、三阶段换机与同数据重启；最新revision实际渲染，旧身份持续撤销。

[显示汇总](../../artifacts/maintenance/v1.0.4/player-display/delivery-audit/results.json)绑定同一最终包：八个合法最少／最多人数场景，502布局、323张实际图（包含有界探针失败图，不冒充独立通过项）；核验720p／1080p／4K、800／960／1200边界、320–430手机、125%／150%模拟密度、识别缺失、iPad／触屏Windows、偏好与键盘切换。原版六格、扩展九格／投票／缓冲存取／能力及现代艺术拍卖草稿通过。[电力公司复验](../../artifacts/maintenance/v1.0.4/player-display/delivery-power-grid-precise/results.json)覆盖四页、采购、建城、供电，选城完成后记录视角，切换保留中心／缩放及分页，仅允许小于1e-6板坐标的浮点误差。[实际滚动输入](../../artifacts/maintenance/v1.0.4/player-display/delivery-scroll-input/results.json)通过键盘、滚轮、拖动原生滑块、浮窗切换与系统高对比回退。宝可梦模块3,730,495字节，4MiB预算通过。

测试默认静音、隐藏窗口、只监听127.0.0.1。真实公网樱花穿透、实体手机、Safari、现场LAN及物理Windows DPI仍未认证；125%／150%属于CSS视口与密度模拟。源码类型、9项显示识别／存储／可信路由测试、相关lint／Prettier通过。此前假固定390px根入口断言、屏外懒加载图片解码等待及选城前采样／浮点字符串比较属于验证器问题，失败／中断证据原样保留，修正后只重跑受影响项。[项目检查](../../artifacts/maintenance/v1.0.4/player-display-docs-final/project-checks.json)通过全部Markdown本地链接与当前包预算；收尾空间及安全退役见[瘦身记录](project-slimming.md)。

## 1.0.4：根入口、研究风险与公开缓冲重设计（2026-10-08）

默认分享及二维码使用网站根网址；旧 `/player` 和 `/player/game` 继续兼容，根入口只有玩家权限。扩展全部30项研究重设计条件、奖励及失败代价，包括正基础分折半／三分之一、负分放大、归零与复制奖励、额外胜局及失败授胜限制。效果读取同一原始计分，不连锁放大，失败不扣已有胜数；最低分赢家与本局新增0／1／2胜分别展示。

新小局采用单弃牌顶部来源，每人一格公开缓冲；仅原本合法可弃的暂持牌可存入，存入结束回合，后续只能取本人缓冲且必须换入。实例能力消耗随牌保留，缓冲不计场地、研究或三神齐聚。112／144张新牌组中阿尔宙斯、固拉多、盖欧卡、裂空座各一张。旧小局按原配置继续，下一小局升级，历史checkpoint不改写；这些是项目扩展规则，未认证真人平衡。

手机保留唯一本人动作、暂持与目标牌阵，研究详情与锁票分开，等待显示真实行动者；电脑浏览器玩家继续使用中央手机区域。实际审查修正奖励单位与括号拆行、短句／牌名孤字、R12数字压图、R23复制目标歧义、六人720p缓冲裁切及长昵称侵入邻区。短手机放入阶段将目标和确认排在弃掉／存入前，强制来源单行，完整能力可展开，本人身份／胜星与币面结果保留在操作之后。正文／主要动作／触控尺寸未缩小。[最新独立短屏图](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/visual-forced-final-independent.md)无P1／P2，P3为能力入口仍使用通用名称；[主协调者上下文复核](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/visual-forced-final-root.md)明确六席角色缩略图与观察边界。各旧候选审查保留其自身SHA，未改标为最终图。

[同一实际包汇总](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/results.json)对应ZIP SHA-256 `a9ee84989b051e69749698cb79e2f6b7f2fb404bd01506f7cfe740cb032905ec`，**41,359,962字节**；248文件实际解压**94,931,816字节**，95MB工程预算余68,184字节，宝可梦4MiB与双100MB门禁通过。[冻结输入核验](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/implementation/final-output-equivalence.json)18单元全部验证、236文件与上一已验包相同，现代艺术／电力公司规则与人机字节未变；最终构建14,897ms，17缓存命中，仅重建宝可梦客户端。上一已验`96518cad…`包[原样保留](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/previous-delivery/TableMax-1.0.4-win-x64.zip)。

[扩展实际阶段](../../artifacts/maintenance/v1.0.4/research-redesign-forced-final-20261008/portable/phases/results.json)405布局／34检查、全部30任务的60张参考图、27行动几何；六人长昵称、空缓冲及1–6占牌均覆盖。89个实际放入状态检查320×568首排三牌和编号，覆盖牌库、弃牌、缓冲及已用能力，最坏底边552.266px。[全游戏入口矩阵](../../artifacts/maintenance/v1.0.4/research-redesign-forced-final-20261008/portable/matrix/results.json)64布局／14检查，回归四变体最少／最多人数、1023／1024、720p／1080p／4K、125%／150%模拟密度以及390px玩家，包含HTTP／HTTPS禁止WebSocket、丢推送、断线、真实换机批准与外部二维码。

[普通模式](../../artifacts/maintenance/v1.0.4/pokemon-expansion-normal-play/research-redesign-forced-final-20261008/results.json)43次真实UI步骤、17次真实默认Worker行动，研究详情不投票、锁票后可查详情、缓冲存取／强制换入与实际授胜通过；无注入游戏状态。[授胜专项](../../artifacts/maintenance/v1.0.4/pokemon-expansion-awards/research-awards-forced-final-20261008/results.json)24张实际包组件截图，通过合法最后一步产生0授胜赢家及双赢家额外胜／达到三胜，明确属于受控组件夹具，不冒充完整服务对局。[根入口](../../artifacts/maintenance/v1.0.4/root-entry/research-redesign-forced-final-20261008/results.json)5检查核对全部解压成员、HTTP／HTTPS非标准端口真实入座／刷新、旧路由与玩家权限。[远程等价故障](../../artifacts/maintenance/v1.0.4/research-redesign-forced-final-20261008/remote/all-2026-10-07T23-09-27-335Z/results.json)覆盖丢推送、丢同步确认后重建、丢动作确认以原编号重发且只保存一次、断线、实际Frame执行暂停、WSS以及大厅／进行中／结束换机和同数据重启；断言最新授权revision实际渲染。

源码检查包括145项规则／SQLite／旧能力链兼容、47项根入口／网络／玩家框架、23项界面／研究展示、7项压缩载荷与真实32MiB Worker、22项原版回归及51项清理前缀保护；前轮124项含30研究正反例、15旧存档SHA，两次统计有重叠，不相加。审查修复新版存档混入无来源旧能力链绕过消耗的问题，红复现保留，旧测试使用真实legacy配置且不改断言。[文档逐字段审计](../../artifacts/maintenance/v1.0.4/research-redesign-20261008/core/final-doc-audit.md)和最终类型／相关格式／lint通过。

第一包95,035,481字节超95MB预算35,481字节，未作交付；宝可梦人机使用有界Brotli内存还原入口净省115,298字节，损坏／缺失失败关闭，不落盘解压。失败、返修及过渡包结论保留原身份，组装忙进程门禁未绕过。只导出本地运行ZIP及清单，按用户授权提交并push源码，不创建标签、EXE、source ZIP或GitHub Release。测试全部默认静音、只监听127.0.0.1；代理和模拟视口不代替实体手机、现场樱花／FRP、公网证书、物理DPI、真人听感、时长或平衡测量。进程退出后的安全清理及实际逻辑容量见[瘦身记录](project-slimming.md)。

## 1.0.4：电脑玩家手机视窗、盒子排版与远程续验（2026-10-08）

按用户最新纠正，电脑浏览器参赛者保持原手机界面，在窗口中央操作，四周使用桌游背景；服务电脑的管理员和公共屏继续使用大屏。稳定玩家子文档保留会话和跨宽度草稿，并限制管理／公共文档嵌入及原生桥接。盒子修正长昵称裁边、标题被挤成竖列、游戏库标题／版本折行、孤立说明尾字及控件对齐；现代艺术和电力公司手机顶栏按整组排列。游戏规则、人机策略和秘密权限不变。

最终本地运行 ZIP SHA-256 `96518caddac848de9dc93763480c9fd6ec15795f1c8a4948e00f5161bb6f45c6`，**41,341,886 字节**；247 文件实际解压 **94,899,175 字节**，95MB预算余100,825字节，双100MB门禁通过。[冻结快照](../../artifacts/maintenance/v1.0.4/debug-20261008/implementation/verified-final-snapshot.json)18单元命中17项、只重建盒子，生产构建13,989ms；组装门禁捕捉到正在结束的验证脚本检查进程，退出后沿用同一快照续装，没有重复编译或绕过保护。只导出运行ZIP与清单，不生成新单文件EXE／源码包，不push或发布GitHub Release。

[最终实际包入口](../../artifacts/maintenance/v1.0.4/debug-20261008/portable/matrix/results.json)64布局／14检查，覆盖四变体合法最少／最多人数、1023／1024、720p／1080p／4K、125%／150%模拟密度及390px玩家，包含HTTP／HTTPS禁止WebSocket、丢推送、断线、真实换机批准和外部二维码控件。[完整盒子](../../artifacts/maintenance/v1.0.4/debug-20261008/box/box-delivery/results.json)96布局／21浮窗对应前包 `3a4b…`；最后仅三个局部正文均衡换行，在最终包的[15受影响浮窗](../../artifacts/maintenance/v1.0.4/debug-20261008/box/box-refinements-external/results.json)另做真实截图复核。人工审查发现的竖列标题、孤字及版本拆行均已修正，不以几何零问题代替美观结论。

[游戏独立复核](../../artifacts/maintenance/v1.0.4/debug-20261008/portable/game-review/package-30af/results.json)36实际截图、22张人工代表图，覆盖普通360px玩家与原生主机／公共窗口720p至4K；[关键阶段](../../artifacts/maintenance/v1.0.4/debug-20261008/second-package/portable/phases/results.json)396布局／91检查、[草稿](../../artifacts/maintenance/v1.0.4/debug-20261008/third-package/portable/drafts/results.json)84布局／21检查、[混合真人人机](../../artifacts/maintenance/v1.0.4/debug-20261008/third-package/portable/mixed/results.json)32布局／4检查分别保留原包SHA。[逐文件与冻结输入核验](../../artifacts/maintenance/v1.0.4/debug-20261008/implementation/final-output-equivalence.json)证明游戏模块全部不变，按字节等价复用；不回写旧报告或把旧图称为最终包截图。扩展研究发布演出帧与稳定54格画面分别记录。

[HTTPS远程故障](../../artifacts/maintenance/v1.0.4/debug-20261008/remote/30af-final-summary.json)实际操作渲染474ms、丢同步ACK约5秒重建、丢动作ACK使用原编号重发两次且只保存一次、断线恢复592ms、玩家Frame执行暂停恢复2,606ms、WSS双向54ms；新增重启尾项漏点“进入牌桌”的验证器失败保留并窄重跑通过。[后续同服务包复核](../../artifacts/maintenance/v1.0.4/debug-20261008/remote/3a4b-final-summary.json)再次通过WSS、三阶段管理员换机及同数据目录实际重启，新入座和换机收据均为02格式，原密钥取回同凭证、旧凭证仍撤销。最终服务字节与这些报告相同，最新网页由最终入口／浮窗实测覆盖。

[加密回归](../../artifacts/maintenance/v1.0.4/debug-20261008/implementation/receipt-security-checks.json)先复现持久化摘要可解密旧收据的问题，再用独立域派生的新02密文阻断；相关11文件103测试和最终12项收据测试通过（有重叠，不相加），旧入座／批准换机收据真实重载兼容。旧120hex收据仍保留原有存储安全边界，不宣称旧备份已升级。全量类型、相关lint／格式及46项隔离清理前缀保护检查通过。验证默认静音、仅回环监听；本机TLS代理与Debugger执行暂停不替代实体手机锁屏、现场樱花／FRP、物理DPI或真人听感。收尾实际逻辑容量与安全退役见[瘦身记录](project-slimming.md)。

## 1.0.3：10.7 浏览器玩家、实时恢复与换机（2026-10-08）

按2026-10-07授权完成三游戏1024 CSS px宽屏玩家布局、polling优先与授权同步ACK、电脑管理员批准换机及持久化外部二维码。只改布局、连接与身份接续；游戏规则、人机策略和秘密投影保持原契约。此前“全部真人用手机／不恢复换机”当前约定已由最新规格替代，历史删除接口及发布结论保留。

[同包汇总](../../artifacts/maintenance/v1.0.3/debug-20261007/results.json)对应最终ZIP SHA-256 `6761ef789e0d6644d1142d551f9c8dcf6f428f3fc0cb574542e5d03871a8dad5`：**41,340,186字节**，247文件，实际解压 **94,891,709字节**；95MB预算余108,291字节，双100MB门禁通过。最终18单元生产构建28,455ms、包含打包40,343ms；第一次实现包18单元35,571ms。最终格式规范后重新冻结输入，[逐文件等价](../../artifacts/maintenance/v1.0.3/debug-20261007/implementation/output-equivalence.json)证明247运行文件与第一次已验收包 `8ff98ede…` 完全相同，ZIP封装哈希变化单独记录。当前只导出运行ZIP及清单，未导出新EXE／源码包，未push或发布。

[关键阶段](../../artifacts/maintenance/v1.0.3/debug-20261007/portable/phases/results.json)426布局／79检查，覆盖原版、扩展、现代艺术和电力公司的合法最少／最多人数及结算；[草稿专项](../../artifacts/maintenance/v1.0.3/debug-20261007/portable/drafts/results.json)72布局／17检查，报价、采购数量、选城、卡槽在1023／1024px切换后保留，选卡不提交动作；[混合人机](../../artifacts/maintenance/v1.0.3/debug-20261007/portable/mixed/results.json)32初始布局使用真实Worker并通过管理暂停固定版本；[最终密度](../../artifacts/maintenance/v1.0.3/debug-20261007/portable/density/results.json)16布局补查125%／150%模拟像素密度。普通宽度范围包括1023／1024、720p、1080p、4K及390px手机。秘密隔离沿用玩家授权投影，并执行暗标、现金、私看专项。

[连接与真实入口](../../artifacts/maintenance/v1.0.3/debug-20261007/portable/connections/results.json)通过HTTP／HTTPS禁止WebSocket、丢推送及断线恢复，断言最新instance／branch／revision实际渲染；换机核对码、新设备身份、旧浏览器失效、管理员真实批准按钮、外部网址编辑及公共屏二维码同步通过，非法路径保持原配置。[丢确认与冻结](../../artifacts/maintenance/v1.0.3/debug-20261007/recovery/results.json)分别实测5,012ms重建及3,952ms无合成wake恢复；该轮末项因仅等待probe提前保存而未取得WSS广播，原失败保留，[独立WSS复查](../../artifacts/maintenance/v1.0.3/debug-20261007/recovery/wss-2026-10-07T16-28-07-673Z/results.json)等待完整升级及WSS同步确认后通过，保存广播与DOM版本一致且无CSP错误。局部22测试（含5项换机事务）和既有相关游戏29测试通过；全量类型、相关lint／格式通过。服务／核心广测202项先通过，另1项跳过，仅二维码未监听边界失败，修复后该文件2项通过；Windows沙箱依赖junction及临时worker限制的失败与获准执行结果分开保留。

[终局补查](../../artifacts/maintenance/v1.0.3/debug-20261007/portable/finals/results.json)216布局／45检查，实际完成扩展六人三胜和现代艺术五人四轮，另外复查电力公司六人终局；扩展梦幻两段目标在跨断点后也保持。验证器首次从普通玩家投影读取下一轮动作而被正确拒绝，改从管理员授权投影推进，原失败保留，未更改产品授权。

换机涵盖大厅、进行中、结束、拒绝／取消／过期、竞争批准、保存失败、丢回复和重启；24小时收据过期不使新设备身份过期，回退不恢复旧授权。证据使用隐藏原生WebView2与静音Edge、回环代理和隔离存档，不替代实体手机、现场FRP／樱花隧道、物理Windows DPI、公共受信任证书或真人听感。安全清理及最终逻辑体积见[瘦身记录](project-slimming.md)。

## 1.0.3：全量构建与GitHub发布交付（2026-10-07）

按用户最新指示重新[完整生产构建](../../artifacts/maintenance/v1.0.3/github-release-20261007/full-build-checks.json)：18单元全部重编译、零缓存命中、40,872ms，从冻结清单组装，没有再次编译。新ZIP SHA-256 `bdd69433cab5a2088155d839835ea6d282b858bf67ca4ce7c877426fcaa0d4a0`，41,331,905字节、247文件，实际解压94,864,409字节；与前包逐文件大小／SHA-256相同，封装哈希单独记录。95MB工程预算余135,591字节，宝可梦4MiB及双100MB门禁通过。

新包[普通静音游玩](../../artifacts/maintenance/v1.0.3/pokemon-expansion-normal-play/github-release-full-01/results.json)33步／12阶段、[三游戏v1／v2恢复](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/storage/github-release-full-01/results.json)通过；此前63姿态、布局、原版及规则策略检查只按逐文件等价复用，不声称重新执行。类型／相关lint及[5项共享反馈与播放测试](../../artifacts/maintenance/v1.0.3/github-release-20261007/ui-tests.json)通过。完整发布EXE为41,488,384字节，SHA-256 `41994ea59521d3ef042ad9ce72919a55ace73b38e5e2e8617c441002f928f3e3`；[同一EXE实际检查](../../artifacts/maintenance/v1.0.3/github-release-20261007/shipping-executable-checks.json)提取94,916,329字节、248文件，完整哈希、重复提取复用及原生安全通过。

本次按[Release流程](release.md)提交冻结运行输入、推送源码与 `v1.0.3` 标签，只上传完整EXE及该标签提交的source ZIP；标题 `TableMax v1.0.3`，正文总结后列更新内容。[GitHub v1.0.3](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.3)是正式下载入口，线上状态与附件以该页及本地发布记录为准。实体手机、现场局域网、物理DPI、真人听感和真人时长仍未替代技术模拟。

## 1.0.3：扩展需求复查与演出时序（2026-10-07）

历次扩展需求已整理为[32项有序对照](../games/pokemon-encounters/expansion-design.md#当前需求有序对照2026-10-07)，冲突明确采用较新的要求；保留真人听感、实体设备与时长目标的待测身份。修复首次挂载／快速重入补播旧回执，以及能力／研究演出尚未结束时提前增加胜局星标的问题；暂停取消后的旧回执也不重播，共同赢家在结果阶段统一显示新星标及赢家标记。

[20项播放专项](../../artifacts/maintenance/v1.0.3/pokemon-requirements-audit/clock-tests.json)、类型与相关lint通过。[实际ZIP演出](../../artifacts/maintenance/v1.0.3/pokemon-expansion-effects/requirements-audit-01/results.json)完成14套／63姿态，增加快速重入及终局星标顺序检查；[普通游玩](../../artifacts/maintenance/v1.0.3/pokemon-expansion-normal-play/requirements-audit-01/results.json)两手机身份及真实Worker完成33步／11阶段，[原版回归](../../artifacts/maintenance/v1.0.3/portable/requirements-audit-01/results.json)14阶段通过。此前规则、策略与存储专项按[17单元逐文件等价](../../artifacts/maintenance/v1.0.3/pokemon-requirements-audit/build-equivalence.json)复用；本轮仅增量重编译宝可梦客户端，从冻结快照 `ca55b3bd…` 组装，无重复全量构建。

当前运行ZIP SHA-256 `511ab39171f57e697070c773664801c58ae2222ab37ed7b7188bb1235021ef29`，41,331,905字节；实际解压94,864,409字节、247文件，95MB预算及模块4MiB、ZIP／解压严格100MB门禁通过。相对前包解压净增336字节。[三游戏v1／v2实际恢复](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/storage/requirements-audit-01/results.json)通过，迁移原件及备份保留，工程进程退出。版本仍为v1.0.3，默认静音、本机回环；[当时运行包验证](../../artifacts/maintenance/v1.0.3/pokemon-expansion-normal-play/requirements-audit-01/results.json)保留该包哈希与通过边界，当前交付见[本地交付](#当前源码与本地交付)。

## 1.0.3：扩展版能力消耗、原版演出与全量构建（2026-10-07）

本轮十一项修订完成：两／三人高卡面、四人对称2×2及五／六人重排；圆形数字按字形居中，稳定牌桌底边，手机三牌源加全宽“卡牌换位”；接齐原版全屏构图、金色引线、两面硬币和共同赢家皇冠／烟花／扫光。主动能力按实例失星，路卡利欧仅摸牌库；旧存档当前副本惰性规范化，历史checkpoint不改写，暗牌使用状态保持秘密。新增规则均为项目约定，详见游戏规则与[真人交接](../games/pokemon-encounters/validation-scenarios.md)。

规则与旧链／SQLite兼容53项、策略专项69项通过；[150固定种子小局](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/strategy/run-1791304949711-c6c20bad/seeded-rounds.json)及[五场混合大局](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/strategy/mixed-1791305488575/mixed-matches.json)共17,114动作通过，重组耗时618.11秒。真实Worker内存／截止／取消／暂停和旧结果失效、配置与恢复55项、表现19项及原版差分通过。策略源码未因最后反馈修复改变，重测试结果继续有效。

实际[最终布局](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/ui/layout-slices-07/results.json)和[独立美术复核](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/ui/independent-review.json)检查手机320–430px、720p–4K、125%／150%、三人高卡／四人对称、视觉数字中心及稳定底边。[同包演出](../../artifacts/maintenance/v1.0.3/pokemon-expansion-effects/final-revision-03/results.json)14套63姿态、连续队列、取消／减少动态及结算次序通过；[真实普通对局](../../artifacts/maintenance/v1.0.3/pokemon-expansion-normal-play/final-revision-03/results.json)35次手机操作／12阶段、真实Worker及已保存能力／引线／赢家演出通过。[原生原版回归](../../artifacts/maintenance/v1.0.3/portable/final-revision-03/results.json)和[三游戏v1迁移／v2恢复](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/storage/final-revision-03/results.json)使用同一ZIP，实际解压、逐文件哈希、离线、切换／恢复与进程退出通过；迁移样本另存，不随临时目录清理。

本轮全量生产构建18单元、零缓存，32,027ms。首次模块超预算19,172字节，随后目录小封面派生和两段原声无损FLAC编码仅重建metadata／客户端。真实保存验收还发现临时feedback误携带严格协议不接受的effect；[先失败再通过的协议回归](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/rules/feedback-fix-regression.json)修复后，仅重建规则单元，其余17项复用。保存事件的effect继续完整保留，未改网络协议。component样板未能检出该断链，因此最终以真实保存同包复验为准；早期超预算和普通对局失败记录保留。

最终冻结快照 `6993a1af…` 直接组装，无重复编译。[当时运行ZIP审计](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/final-checks.json) **41,331,808字节**，SHA-256 `99f3be469bfd86f14ef4a1d00dee4f80520fd43de2ad91afb96f28133b2d86b1`；[逐文件清单](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/final-package-manifest.json)247文件、实际解压 **94,864,073字节**，95MB余135,927字节，宝可梦4MiB及ZIP／实际解压双100MB门禁通过。测试默认静音、本机回环；实体手机、现场局域网、物理DPI、真人听感和真人时长仍独立交接。版本保持v1.0.3，无新标签或GitHub Release；[安全深度瘦身](project-slimming.md)后仅提交本轮改动，并按用户授权push当前分支。

## 1.0.3：电力公司数量采购、进度与稳定反馈（2026-10-06）

删除底部重复保存消息，保留地图白底最新记录及局部声画，连续保存不改变地图／公司抽屉几何。收益全部单行，0–9左列、10–19右列、20+末行横跨两列居中，保留唯一绿档和18px数字。手机原料选择数量，＋1／−1及输入均不保存，跨价阶累计总价，一次确认原子采购；现金、现货与混燃共用容量仍由服务器校验，旧单份动作兼容、人机保持单份策略、存档版本不变。声音改居中SVG及hover／聚焦提示；滚动条适配纸色与工业绿，用户原话已并入[美术倾向](art-preferences.md#电力公司附图反馈与滚动条适配2026-10-06)。新增真实地皮计数轨道及第二阶段／终局门槛，顶部显示“第N阶段”，规则卡明确与轮内行动阶段区别，第三阶段仍按第三步牌触发。

[最终六人](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/power-grid/compact-six/results.json)和[两人](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/power-grid/compact-two/results.json)各108布局通过，覆盖854×480至4K及320／360／390和手机横屏。专项证明单行收益完整顺序、20+跨列、连续反馈逐帧零位移、声音SVG可见轮廓居中、提示／本地静音零命令、主题滑块、跨价阶报价、数量草稿同步保留和确认仅一条合法动作。[六人短屏暂停](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/power-grid/short-paused-six/results.json)与[两人短屏暂停](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/power-grid/short-paused-two/results.json)实际点击菜单、完整城市列表和城市详情通过；未缩信息字体。规则41项回归含9个三档／2、3、6人完整守恒对局，UI25项、类型、相关Lint、Prettier与diff通过。

[同包原生显示](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/quantity-final-display/results.json)62.20秒通过720p、1080p、4K与125%／150%显示请求；[同包完整对局](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/quantity-final-match/results.json)73.87秒通过真实手机数量确认、准确扣款／入库／市场变化、单条日志、过时采购拒绝、整笔checkpoint回退与再次确认、SQLite重启恢复及终局／续局。416状态核验、383条合法动作独立重放，覆盖STEP1／2／3、换厂与待安置。最终审计数据库及源码已从临时目录[另存](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/quantity-final-match/saved-audit-inventory.json)。全部使用静音隐藏窗口与127.0.0.1，模拟视口／显示请求不代替实体手机、物理DPI或现场LAN认证。

初次原生验收暴露短屏空厂占位挤出城市详情入口，已压紧空位并让工具栏整行换行；[失败记录](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/purchase-progress-display/results.json)保留。回退脚本初次误读手机无权查看的管理记录，改由管理员读取checkpoint，采购保存本身正确，保留[脚本失败](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/purchase-progress-match/results.json)。修正后只重建受影响客户端，未更改权限、放松点击检查或绕过保存。

[冻结快照](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/build-snapshot.json)为`0d93c551…`，最终18单元17缓存复用、只重建客户端356ms，构建10,292ms。[输出核对](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/output-equivalence.json)验证18单元源码未漂移，其他游戏和平台240文件字节相同，目录聚合文件随本游戏指纹更新。[当时运行ZIP（已退役）](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/previous-delivery/TableMax-1.0.3-win-x64.zip.retired.json)41,261,674字节，SHA-256 `15a0dd459a71eb34d8ed46bd91d792ddc1a8b571cfa5eff4b0eef1f9463704b6`；[当时清单](../../artifacts/maintenance/v1.0.3/pokemon-final-revision/previous-delivery/TableMax-1.0.3-win-x64-manifest.json)246文件、实际解压94,859,028字节，95MB预算及ZIP／解压双100MB门禁通过。沿用v1.0.3，只导出本地运行ZIP／清单，不推送或发布；收尾实际水位见[瘦身记录](project-slimming.md)。

## 当前源码与本地交付

当前本地交付为本页[拉密经典版本地完整交付](#105拉密经典版本地完整交付2026-10-09)的[运行ZIP](../../artifacts/releases/TableMax-1.0.5-win-x64.zip)及[逐文件清单](../../artifacts/releases/TableMax-1.0.5-win-x64-manifest.json)，SHA-256 `2c5474f86a1b2282d1fd21bde1fd26868e1c055649e9c11ebd4d3ccfecdecf5f`；历史同版初包及v1.0.4大小、证据、发布附件及结论保留在对应章节，不当作当前包验收。

运行ZIP、逐文件清单、原图和实际验收证据均为本地文件，不随源码push上传。源码提交／推送不等于发布新程序；公开下载与附件以GitHub Releases为准。项目逻辑空间以[最新瘦身记录](project-slimming.md)为准，历次数字保留其统计时间与保护范围。

下文旧轮次的“原包保留”描述其当时状态；本轮已按授权退役23份更早运行ZIP，链接改指原清单或退役哈希记录，历史大小、版本及通过／失败结论不改写。当前包、前一份整合包和宝可梦独立旧验收包继续保留。

前一轮电力公司包 `201de235…` 未包含当时正在修改的宝可梦界面。当前包已整合这些修订，并分别核验实际包内画面、完整对局与恢复；未变化游戏采用下述逐文件等价证明复用既有检查。

## 1.0.3：宝可梦扩展深度界面与整合交付（2026-10-06）

先考察原版生产实现与真实画面，再修正六人卡面透明留白、固定文字区挤占角色、公开区标签重叠和双在线点。扩展复用原版桌面材质、牌背与操作层级；34类角色按原图有效边界归一化，手机只在本人行动时展示操作，投票只留选项且标题固定“投票选择研究任务”。阶段按实际牌类顺序标明，弃掉采用独立颜色；公开区包含牌库、两张可选弃牌、暂持牌及保存后的移动轨迹，研究置于下方。30项研究采用宝可梦主题名、趣味短句及本地角色构图，ID、条件、奖励、牌堆、秘密权限和存档字段不变，顶层规则同步更新。

116项相关测试、类型及局部Lint通过；研究覆盖全部正反例、固定图示、2–6人旧文案下完整轨迹／RNG／回退、真实SQLite v1迁移及v2恢复。源码渲染与[同包全部界面](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/ui/depth-portable-03/results.json)分别记录：手机320–430px、六人54格、720p–4K、125%／150%、空弃牌、等待他人、私看隔离、投票和共同赢家。新增六人720p共同赢家通过实际规则结算，54格及两位赢家同屏；[独立美术审查](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/audit-final-portable.md)实际观察角色、配色、编号、留白、图标及公开区。720p角色长边中位45.64px，相比早期样板增32.4%；这是本机实际画面测量。

[原生同包](../../artifacts/maintenance/v1.0.3/pokemon-expansion-runtime/depth-final-r2/results.json)通过10流程，含实际解压、包内Node、离线资源、身份、暂停／重启恢复及原版／扩展切换；[真实普通对局](../../artifacts/maintenance/v1.0.3/pokemon-expansion-normal-play/depth-final-01/results.json)通过31次手机控件与13阶段，包含Worker、私看、接力和结算。原生首轮随机牌局过早结束而未覆盖能力，失败证据保留；仅调整验证行动先换明牌直到合法能力出现后重跑，不改产品包。新增共同赢家检查曾读取不存在的几何字段，修正验证器后通过，旧失败仍保留。[声画](../../artifacts/maintenance/v1.0.3/pokemon-expansion-effects/depth-final-01/results.json)覆盖63姿态、14时间轴、十种普通主题、取消、减少动态及研究→结算；[静音](../../artifacts/maintenance/v1.0.3/test-silence/pokemon-depth-final-01/results.json)五项通过。测试使用静音隐藏窗口和127.0.0.1；模拟视口／密度不代替实体手机、现场LAN、物理DPI或真人听感。

[输出等价](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/output-equivalence.json)确认237文件与 `201de235…` 相同，平台运行、原生、Node、现代艺术及电力公司输出字节一致；目录聚合文件仅随宝可梦样式指纹变化。复用上一包对应游戏的恢复／对局证据，不重跑未变化完整游戏。三张新研究背景压缩后，30背景135,570字节；原PNG和原角色素材保留，生成与编码边界见[资源](../games/pokemon-encounters/assets.md#研究插画与下载叫声再派生2026-10-06)。

首次组装宝可梦模块超4MiB 6,485字节，保留[失败记录](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/budget-attempt/result.json)，三背景再派生节省11,100字节后只重建受影响客户端；未提高预算。[正式快照](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/build-snapshot.json)为 `6068ffef…`，续组装18缓存单元复用、9,882ms构建／22,168ms含打包。[当时运行ZIP](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/previous-delivery/TableMax-1.0.3-win-x64.zip.retired.json)41,259,719字节，SHA-256 `6df0feb58951e3f547e415b3c667dbcf6d5208abd52dadc1a5d3425435ca3d39`；[逐文件清单](../../artifacts/maintenance/v1.0.3/power-grid-purchase-progress-20261006/previous-delivery/TableMax-1.0.3-win-x64-manifest.json)246文件，实际解压94,850,050字节，宝可梦模块4,189,689字节。4MiB、95MB工程预算及ZIP／实际解压双100MB门禁通过。只生成本地运行ZIP／清单，安全清理与最终逻辑空间见[瘦身记录](project-slimming.md)。

## 1.0.3：电力公司地图材质、动画与综合资料细化（2026-10-06）

收益档位统一两行：左0–9、右10–19，20+全宽居中，仅一个绿档。市场／收益／公司抽屉双向滑动、快速反向连续，减少动态和测试模式直接切换；SVG按实际可见轮廓居中。内置imagegen编辑原地图，补全边缘海面和地形，当前1086×1448原生尺寸、四边无原纸条空框，原图与生成PNG保留。精确1200×900／42城／六区／83边数据未变；路线价格由16px随缩放缓增至21px。取消选城后再完成边栏操作的事件顺序及目标宽度避让已修正。移除顺序入口，放大镜打开更宽综合公司资料；顶部阶段／当前公司与轮步并列，倒计时并入工具栏，收束旧空状态带。现金保持本人及终局授权，不推算对手资金。

[最终六人](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/power-grid/final-six/results.json)和[两人](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/power-grid/final-two/results.json)各108布局通过，覆盖854×480至4K、320／360／390及手机横屏。[详情专项](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/power-grid/final-details/results.json)补查真实动画中间帧、快速反向、减少动态／测试模式、四向极限、连续滚轮／双指、临时避让与恢复、三厂／四厂／临时第五厂／待安置、公开零现金／本人一份／终局全现金及查看零命令。价格在1→1.8倍缩放中实测约16→18.1px；本机动画和帧间隔不泛化为实体手机帧率。相关UI19项测试、类型、局部Lint、项目Prettier与diff通过。独立截图审查发现旧空状态带与320px指标单字换行，已收束状态带并明确“燃料／可供电”换行，修正后实际渲染通过；横向玩家条带仍提供浏览按钮及滚动。

[同包原生显示](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/refinement-display/results.json)67.46秒通过静音隐藏WebView2／127.0.0.1的720p、1080p、4K和125%／150%显示请求。[同包完整对局](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/refinement-match/results.json)89.28秒通过真实手机控件、Worker、SQLite保存／重启恢复与跨游戏切换，467状态核验、431条合法动作独立重放，覆盖STEP1／2／3、换厂、转存及最终结算；自有桌面与服务正常退出。浏览器窗口／手势与模拟密度不代替实体手机、现场LAN或物理DPI认证。宝可梦规则／策略／客户端／元数据[135项输出](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/pokemon-output-equivalence.json)与其先前验收包逐字节一致，沿用其原有专项边界，没有重跑宝可梦完整专项。

[冻结构建](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/build-snapshot.json)18单元中17项复用，只重建电力公司客户端376ms。首次组装被仍运行的旧验收程序门禁拦截；用户关闭后按同一快照续组装，19,485ms完成，没有重复编译或绕过门禁。[当时整合ZIP](../../artifacts/maintenance/v1.0.3/pokemon-ui-depth/previous-delivery/TableMax-1.0.3-win-x64.zip.retired.json)41,243,018字节，SHA-256 `201de235e92fd763cf016bbbb526b407dd8a51aed4c76bb3849beb7e0259128e`；[逐文件清单](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/package-manifest.json)246文件，实际解压94,808,641字节，95MB预算及ZIP／解压双100MB门禁通过。只导出运行ZIP／清单，不生成新EXE或源码包、不推送发布。安全维护实际水位见[瘦身记录](project-slimming.md)，本轮汇总见[核验记录](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/final-checks.json)。

## 1.0.3：电力公司地图与带图公司卡优化（2026-10-06）

完整1200×900地图采用铺满后1.06倍最低比例，硬边界四向拖动无空白；普通滚轮指针锚点平滑缩放，单层身份色选城、外部取消及临时抽屉避让。市场为图标入口、窄／宽／收起三态；公司恢复带图厂牌和左上数字徽章，三厂一行、两人四厂2×2、手机逐厂横条，待替换第五厂保留。收益仅两列地皮到电币，0–10左列、11–20+右列及唯一绿档。本人资金及终局按已有授权显示，规则／投影／存档格式不变。

[最终六人组件](../../artifacts/maintenance/v1.0.3/power-grid-ui-polish-20261006/power-grid/verified-final/results.json)108布局涵盖854×480至4K、320／360／390手机及844×390横屏；[两人矩阵](../../artifacts/maintenance/v1.0.3/power-grid-ui-polish-20261006/power-grid/final-render-2/results.json)96布局及20组交互。零厂、混燃、满厂、临时第五厂、待安置、零库存、长昵称、首轮重排／普通同步不重排及现金权限通过。[地图专项](../../artifacts/maintenance/v1.0.3/power-grid-ui-polish-20261006/power-grid/wheel-final/results.json)覆盖四向极限、连续滚轮、真实双指缩放、跟随暂停／恢复、外部取消、单框与无空城十字、临时避让恢复及新手动操作优先，读取不发送命令。35帧采样32个中间缩放值，p95帧间隔12.4ms属本机组件样本，不泛化为实体手机帧率。相关UI／德国数据23项单测、类型、局部Lint、项目Prettier及diff通过。

[原生显示](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/polish-shipping-display/results.json)以同一ZIP的实际解压、静音隐藏WebView2／127.0.0.1服务覆盖主机／公共屏720p、1080p、4K及125%／150%显示请求与模拟密度；记录有效缩放、CSS／窗口／截图几何，未改OS显示设置。[原生整局](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/polish-shipping-match/results.json)121.31秒通过真实手机控件、Worker、SQLite保存／重启恢复与跨游戏切换，510状态验证、480条合法动作独立重放，覆盖STEP 1／2／3、换厂、待安置及现金权限。查看外部顺序会取消选城，旧脚本因此找不到建设按钮；按新交互重新选城后核验，原失败证据保留。模拟窗口和浏览器手势不替代实体手机、现场LAN或物理DPI认证。

最终包使用03b7430基线加本次电力公司源码的隔离输入，排除其他任务未提交内容；[冻结构建](../../artifacts/maintenance/v1.0.3/power-grid-ui-polish-20261006/build-snapshot.json)与[清单](../../artifacts/maintenance/v1.0.3/power-grid-ui-polish-20261006/package-manifest.json)保留。最终组装26,506ms、18缓存单元复用（电力公司UI在前序重建）；[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.3/power-grid-ui-refinement-20261006/previous-delivery/TableMax-1.0.3-win-x64-manifest.json)40,916,814字节，SHA-256 `7946907f4423f6e0c399d14c083dabb7faa2164a25377d523ccfa92cff277963`，实际解压216文件94,386,899字节，95MB预算及ZIP／解压双100MB门禁通过。前一份完整交付保留于 `artifacts/maintenance/v1.0.3/power-grid-ui-polish-20261006/previous-delivery/`；未生成新EXE或源码包、未推送或发布。安全维护实际水位见[瘦身记录](project-slimming.md)。

## 1.0.3：宝可梦扩展版UI重设计（2026-10-06）

卡面复用原版骨架与蓝色牌背，34类配色、卡外深青编号、完整角色与独立牌名；手机统一四牌源和单操作牌阵，暂持只展示一次，按钮等宽居中。结算采用居中赢家横幅、头像／三星／九格及可展开总分。30项研究各有独立imagegen主题插画与固定公开精确图示，图片总125,986字节；角色／牌堆／研究配置独立JSON，玩法、ID／顺序、112／144、授权投影、旧存档与协议兼容。27项下载叫声完成当前音量×0.6、轻高频削减与5ms淡化，用户原声／主题不变，测试默认静音。

[配置核验](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/config/audit-results.json)覆盖30项正反例／图示、2–6人15固定种子1091合法步骤及106恢复重放、30,000研究判定／2030完整计分对照；[真实SQLite](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/config/persistence-results.json)覆盖v1迁移／v2重启、投票边界回退与身份／当前房主授权。[相关回归](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/root-unit-results.json)134项通过，类型／局部lint及格式通过。并行电力公司改动由隔离源码排除；该任务随后更新共用release，本次已验ZIP／清单固定保留在本轮delivery，下面哈希只适用于该包；包基于03b7430加本次宝可梦改动，冻结输入与实际同包边界留证，不混入其他任务。

[最终包真实UI](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/ui/portable-02/results.json)核对实际解压全部文件，覆盖320–430px、720p至4K、125%／150%模拟缩放、空弃牌、短能力、单牌阵、共同赢家、计分明细、研究暗投／30图及私看隔离；截图等待全部角色图片成功加载。独立视觉审查修正了研究编号歧义、双人角色大小、卡位徽章与横幅布局。[原生同包](../../artifacts/maintenance/v1.0.3/pokemon-expansion-runtime/ui-redesign-final-02/results.json)10项通过保存、重启恢复、身份、原版切换、包内Node与零外部请求；短／高缩放或暂停提示占空间时保留54格并逐格实际滚动验证可达，720p常规结算54格与六个总分完整在窗内。

[普通模式](../../artifacts/maintenance/v1.0.3/pokemon-expansion-normal-play/ui-redesign-final-01/results.json)真实34次手机控件操作与人机完成一小局，自动化墙钟50,905ms，包含私看、整行交换及接力；下载叫声实际解码／播放调用与自有进程退出通过，不代表真人时长或听感。[声画同包](../../artifacts/maintenance/v1.0.3/pokemon-expansion-effects/ui-redesign-final-02/results.json)63姿态／14时间轴／十主题、秘密、取消、减少动态、能力→研究→结算透明度及双槽通过。旧原生失败断言沿用“所有短窗口54格同屏”，按最新单轴滚动口径改为实际逐格可达；旧声画检查定位h2而动画已由整个横幅承载，修正定位并实查透明度后通过。早期弱几何／未等图片截图与失败报告保留，不能作最终证据。

[同包汇总](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/final-checks.json)核对五份通过报告、235项最终宝可梦输入及30项原图／派生图哈希；[默认静音](../../artifacts/maintenance/v1.0.3/test-silence/pokemon-ui-redesign-final-01/results.json)五项检查覆盖主机／公共／手机、重载、显式播放状态与偏好隔离。

本次仅一次正式`package:win`，18单元命中12项（隔离路径令部分平台指纹重建，输出字节未变），完整构建／组装38,555ms。[运行ZIP](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/delivery/TableMax-1.0.3-win-x64.zip.retired.json)41,067,266字节，SHA-256 `943071cec128b4ef9e8951459b2ccfca7b26b381f58654892c3e66cc5a455812`；[清单](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/delivery/TableMax-1.0.3-win-x64-manifest.json)246文件、实际解压94,619,465字节。宝可梦模块3,949,898字节、净增175,588字节，4MiB／250KB目标、95MB预算和ZIP／解压严格100MB门禁均通过；182文件字节不变，现代艺术及电力公司模块沿用未变证据。原EXE／ZIP／清单完整保留在本轮`previous-delivery`，本轮不生成EXE／源码包，不发布。真人设备／现场LAN／物理DPI／听感与时长仍按[交接](../games/pokemon-encounters/validation-scenarios.md#本次真人验收交接2026-10-06)独立填写；本次安全清理1,164,752,173字节，229项清理保护回归通过，最终工作区11.2411GiB，仍未达到10GiB；保护内容与候选耗尽边界见[瘦身记录](project-slimming.md)。

## 1.0.3：游戏介绍弹窗布局修复（2026-10-06）

用户截图中的纵向文字挤压来自共享弹窗遗留的 `.game-introduction` 横向flex样式：运行时CSS在独立盒子CSS之后加载时覆盖新版分节布局。删除失效样式，并明确介绍／头像浮窗的宽度选择器优先级，封面、简介、步骤与胜负按正常段落排列，手机步骤保持单列；玩法、资源、权限和存档不变。

[真实组件回归](../../artifacts/maintenance/v1.0.3/game-introduction/corrected/results.json)覆盖三端、三游戏及宝可梦两个版本、320–3840px共108布局，检查分节顺序、可读宽度、文字下限、横向溢出、滚动关闭与Escape焦点恢复、读取不发送命令。按生产CSS加载顺序执行的[旧版复现](../../artifacts/maintenance/v1.0.3/game-introduction/before-fix-cascade/results.json)确实断言 `flex`／`block` 失败；首轮夹具因未包含宝可梦版本组件所需capabilities而失败，原结果保留，完善夹具后执行完整回归。[最终包原生检查](../../artifacts/maintenance/v1.0.3/game-introduction/portable/results.json)在该EXE实际解压的隐藏静音WebView2／127.0.0.1服务中，通过真实入口切换三游戏及640／934／1280窗口共九布局，介绍分节、关闭与revision／branch不变均通过。模拟尺寸不代替实体手机认证。

沿用v1.0.3，[最新EXE](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/previous-delivery/TableMax-1.0.3-win-x64.exe)41,064,960字节、SHA-256 `68b0a767936b96b88b9da28bd3eb57c8406ad933c1c60d0b266afd2f02d73fac`；[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.3/pokemon-ui-redesign/previous-delivery/TableMax-1.0.3-win-x64-manifest.json)40,914,627字节、SHA-256 `1d0d835b3f313a9efec52210185229d16a7fd77f16e3840afb401c094fc36c1a`。18构建单元命中16项，仅共用runtime／盒子重建；[包比对](../../artifacts/maintenance/v1.0.3/game-introduction/package-impact.json)212文件字节不变，其他变化限CSS与关联哈希／入口引用。[同包交付检查](../../artifacts/maintenance/v1.0.3/game-introduction/shipping-executable-checks.json)34,633ms通过完整文件哈希、重复解压与原生生命周期；实际解压217文件94,423,625字节，95MB预算和双100MB门禁通过。原包及验收证据保留，不发布GitHub或导出源码。局部lint、格式与diff通过；安全维护见[瘦身记录](project-slimming.md)。

## 1.0.3：单EXE专属目录初始化微调（2026-10-06）

按用户最新要求沿用v1.0.3：单EXE在旁边新建 `TableMax/`，配置、存档、缓存及 `app/` 运行资源默认集中其中；ZIP直接使用解压目录。配置路径仍可指定，已有散落文件不自动搬移。[当时完整EXE](../../artifacts/maintenance/v1.0.3/game-introduction/previous-delivery/TableMax-1.0.3-win-x64.exe)41,064,960字节，SHA-256 `5fe41e76a007da855028eb6390470c1df2df7c38aa6233645e5f3d1c07f76638`；ZIP及包内216文件与上次交付字节一致，只重编译外层启动器。[前一份交付](../../artifacts/maintenance/v1.0.3/initialization-folder/previous-delivery/TableMax-1.0.3-win-x64.exe)及原验收结论保留。

[实际初始化验证](../../artifacts/maintenance/v1.0.3/initialization-folder/results.json)九项通过，覆盖两种默认目录、自定义配置、旧存档字节保留、缓存、重复启动复用和运行中目标导出保护。[同一EXE交付验证](../../artifacts/maintenance/v1.0.3/initialization-folder/shipping-executable-checks.json)33,058ms通过准确文件集／逐文件哈希、重复解压、实际WebView2／Node生命周期及双100MB门禁。用户在下载目录运行的旧实例保持运行；导出保护只允许已知无关实例，目标目录、未知路径及工程验证仍受保护。迁移与ZIP程序未变，复用上一节3GB存档验收，不重复宣称本轮执行迁移。

## 1.0.3：便携存储配置与大存档启动修复（2026-10-06）

按用户明确指示升级v1.0.3，数据路径配置、运行资源位置和变更入口见[开发环境](development.md#v103-便携存储与启动迁移2026-10-06)。[当时完整EXE](../../artifacts/maintenance/v1.0.3/initialization-folder/previous-delivery/TableMax-1.0.3-win-x64.exe)为41,064,960字节，SHA-256 `4c4f5e664a457d97f4ca3344462a260a65f028846a580929f14058961839d28d`；[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.3/initialization-folder/previous-delivery/TableMax-1.0.3-win-x64-manifest.json)为40,914,712字节，SHA-256 `36baa7e84b8173b5fe54d4c07f3ace82c124ae063181d74dd8e63443c601c07f`。[当时逐文件清单](../../artifacts/maintenance/v1.0.3/initialization-folder/previous-delivery/TableMax-1.0.3-win-x64-manifest.json)记录216文件／94,378,077字节，含启动器所有权标记的实际EXE解压217文件／94,424,014字节，95MB工程预算和双100MB硬门禁均通过。

[实际同包存储验证](../../artifacts/maintenance/v1.0.3/portable-storage/results.json)通过默认EXE同级写入配置、存档与WebView2缓存、配置切换重启、旧数据字节保留、外层单EXE就近解压／自定义目录共九类检查。用户3,037,777,920字节旧v1库只读复制至隔离目录；迁移启动309,584ms，3233条历史修订完整比对，新库76,144,640字节并成功重启。正式原库及隔离迁移备份SHA-256一致，原C盘存档没有改写。隔离对局、配置边界与自动检查不等于真人设备认证。

[EXE实际交付验证](../../artifacts/maintenance/v1.0.3/github-release-20261005/shipping-executable-checks.json)34,419ms通过全部冻结文件哈希、准确文件集、重复解压复用和真实WebView2／Node生命周期安全；没有发布到GitHub或生成源码ZIP。相关服务／存储31项回归、207项清理保护回归、类型检查、局部lint及格式检查通过。首轮配置验证在SQLite关闭前取哈希，WAL关闭落盘导致测试断言失败；采样点修正为关闭后，再执行完整流程通过，没有以修改生产存档消除失败。首次封装也发现共用配置类不兼容Framework自带C#5编译器，改为兼容语法后重新构建并验证同一最终包。

旧同名下载指针改为[退役记录](../../artifacts/maintenance/v1.0.3/portable-storage/old-release-retirement.json)，历史原哈希、固定清单与验收结论仍按原日期／构建保留；旧版资源清理及最终空间见[瘦身记录](project-slimming.md)。

宝可梦扩展版本次技术收尾已完成，按最新授权沿用v1.0.2。矢量动作、绝悟战术、SQLite v2、音源记录及同包交付均通过；真人设备与体验按[独立清单](../games/pokemon-encounters/validation-scenarios.md#本次真人验收交接2026-10-06)交接，历史位图及胜率门槛已由[最新口径](../tasks/pokemon-encounters-expansion.md#一次性技术收尾2026-10-06)取代。

## 1.0.2：测试静音与资源瘦身（2026-10-06）

当前[运行ZIP](../../artifacts/maintenance/v1.0.3/portable-storage/old-release-retirement.json) SHA-256 `a9080180366c6d7976ab0bc04d63fa9b235f25b22a792de574ff7ead87a8f590`，ZIP40,911,321字节、216文件实际解压94,371,298字节，95MB预算余628,702字节，双100MB硬门禁通过。[逐文件清单](../../artifacts/maintenance/v1.0.3/portable-storage/old-release-retirement.json)与[改动比对](../../artifacts/maintenance/v1.0.2/slimming-test-silence-20261006/package-impact.json)证明仅原生EXE／电力公司前端变化，其余214文件字节相同；18构建单元命中16项，实际组装21,626ms，仅执行一次package:win。规则、策略、保存及全部原声画资源沿用未变证据，下述原收尾报告保持其原包边界。

[同包静音核验](../../artifacts/maintenance/v1.0.2/test-silence/complete-r3-20261006/test-silence.json)通过5项：实际解压全部文件哈希／体积、包内Node22.14.0／版本、主机／公共／模拟手机在游玩模式默认静音、显式试听开关、重载及电力公司测试／暂停／游玩切换保持用户声音偏好；直接Edge默认静音参数及显式开启也实际读回。零页面错误／外部请求，自有进程退出；显式开启仅核验静音状态，没有真人听感声明。两次浏览器参数核验失败和修正结果分别保留，没有覆盖早期通过记录。

清理回归通过206项路径／进程／包与资料保护、34项维护阈值和34项精确退役检查。按本次授权审计旧模拟主库，保留原结果／源码哈希、只读数据库摘要、逐文件SHA及近期辅助文件；正式存档、原素材、当前截图与交付保留。具体删除清单和最终逻辑体积见[瘦身记录](project-slimming.md)。测试默认静音和长任务结束后体积检查／安全瘦身已纳入入口与维护规则；不推送或发布。

## 1.0.2：扩展版一次性技术收尾（2026-10-06）

该收尾包已由下述静音维护包更新；本节数值与报告属于当时的 `1cf5e5c4…`，对应ZIP及清单完整保留在[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/slimming-test-silence-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)。当前包以测试静音节为准。

当时[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/slimming-test-silence-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json) SHA-256 `1cf5e5c4a912022262fdeab7fcfc69cd41f5d3f047dcae110afbffaa70a48bef`，ZIP40,911,077字节、216文件实际解压94,370,680字节，95MB余629,320；相对旧包净增68,189字节，宝可梦模块3,906,502字节，小于4MiB。运行ZIP／实际解压双100,000,000字节硬门禁和≤300,000字节净增目标全部通过。[逐文件清单](../../artifacts/maintenance/v1.0.2/slimming-test-silence-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)与[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/final-checks.json)绑定最终源码、18单元冻结及所有报告；迁移故障修复后的正式增量组装17缓存命中，仅服务重建。此前一次全量编译由构建输入walker修正触发，未预先重复全量build。

[原生便携](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/completion-final-portable-20261006-r2/results.json)通过10流程／11显示、包内Node、版本／游戏切换、原版恢复与离线媒体，16项浏览器RGBA与原件一致。[普通模式](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/completion-final-normal-20261006-r2/results.json)由生产手机控件、真实默认Worker、私看隔离和实际声音播放完成小局。[声画专项](../../artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/effects/final-portable-06/results.json)直接加载同一ZIP的扩展客户端和共享React，逐套观察63关键姿态／14时间轴、十普通主题、两复制局部演出、末步能力→研究→结算、取消／减少动态及720p–4K／125%／150%模拟缩放／320–430px手机。独立视觉修正复审通过。以上均零页面错误／外部请求，自有程序进程退出；模拟viewport、DPI和播放事件不代替实体设备或人耳试听。

[三游戏实际服务迁移与重启](../../artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/storage/portable-three-games-02/results.json)使用同一解压EXE及隔离数据，宝可梦扩展／现代艺术／电力公司全部历史、身份／座位、快照及v1备份字节一致，v2重启恢复通过。固定载荷500／1000／2000保存增长近线性；服务API、外层Save及授权／回退兼容，游戏自身日志不裁剪。首次候选的真实迁移GC故障已用包内Node红绿复现并修复，旧库未替换；[失败边界](../../artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/failure-history.json)、失败候选和原资料继续保留。

策略13新增战术与65相关测试、150固定种子16,666动作、2–6人五场完整混合大局、32MiB／两秒真实Worker及17项最新服务集成通过。六人绝悟单个整局超时的原失败和独立重跑如实保留；各档假设／深度／软预算仍1／8／32、0／1／2、120／400／750ms，不宣称普遍胜率优于豆包。全部现有音源原字节保留，来源说明、派生编码、已播放与未知世代／使用依据分开记录，不宣称官方授权。详细口径和证据统一见[收尾任务](../tasks/pokemon-encounters-expansion.md#一次性技术收尾2026-10-06)。

本地交付仅运行ZIP与清单，旧ZIP／清单及既有发布EXE／source ZIP已按哈希完整保留到原包证据目录；未导出新源码包、推送或发布。工程进程退出后执行安全维护，实际结果见[瘦身记录](project-slimming.md)。

收尾清理已通过：releases仅保留当前运行ZIP与清单；受近期保护的暂存及既有发布文件可恢复移入证据目录，原件未删。自动维护安全候选耗尽，维护结束统计44,582,166,411逻辑字节（约41.52GiB），仍超过10GiB而未扩大清理范围。相关类型、lint、格式、本地链接及diff检查通过后，自动提交仅纳入本次源码／资源记录／文档，默认不推送或发布。

## 1.0.2：普通前瞻三胜目标同包续验（2026-10-06）

当时[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-completion-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json) SHA-256 `e802355117e8c94288d786bc64024864757567ec465171fb5d6181709cf2405c`，ZIP40,887,000字节、实际解压94,302,491字节，95MB余697,509。源码f2b745c，18单元／17缓存命中、无预算告警；[固定清单](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-match-20261006/final-delivery-manifest.json)与[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-match-20261006/final-checks.json)核对冻结源码、报告输入与包哈希。相对71248726仅策略CJS变化，其余215项字节相同；旧[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-match-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)完整保留，既有发布EXE／source ZIP未改，不推送、发布或另导出源码。

普通前瞻在同一授权模型内比较全桌最终分，识别第三胜／负及共同赢家，复用即时终局效用。[三项有效先失败／五项新测试／47项相关回归](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-match-20261006/red-green.json)通过，保留普通第二胜及额外低分对手边界；这是前瞻目标缺口，未证明完整choose误选或旧胜率差的因果解释。15种子小局1,318动作／18阶段、最长772.396ms，实际16通过／135未选，初始零累计胜数不独立覆盖赛点分支。[17项真实集成](../../artifacts/maintenance/v1.0.2/pokemon-expansion-verification/integration/run-1791253703079-e8237f07/results.json)通过，三胜部分五小局／266次Worker／374步、最长856.546ms、175.682秒；32MiB／两秒不变。[五场完整大局](../../artifacts/maintenance/v1.0.2/pokemon-expansion-flow-audit/forecast-match-five-counts-retry-20261006/report.json)2–6人22小局／1894动作、无封顶、源码稳定；7次盖回／0次重复／0次自然闭环为小样本观察。[原版差分](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-match-20261006/original-compatibility.json)仍对照b973bbc通过。旧144场分级属于c019e11，不用于当前源码。

同一ZIP的[实际原生便携验证](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-e802355117e8/results.json)10流程／11显示、18卡面／八主题／27叫声离线解码、16项浏览器RGBA相等通过。[普通模式实际控件](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/forecast-match-final-20261006/results.json)36次手机操作／14阶段、真实默认Worker、私看与实际播放通过，55.352秒为自动化时间。两项页面错误／外部请求零、自有进程退出；模拟viewport不能代替实体手机／真实Windows DPI，播放不能代替真人听感。

完整多姿态仍缺62帧，当前策略全人数三级顺序与真人手机／听感／原版2–3倍小局时长待验，音源世代／项目使用依据缺口保留。三胜完成也不证明SQLite历史长期有界；完整计划未完成。

## 1.0.2：三胜目标修复同包续验（2026-10-06）

当时[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-match-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json) SHA-256 `7124872618e34296718af69f95f78ab86df11442b3c7fe7cc76cdfa959739088`，ZIP40,886,844字节、实际解压94,302,053字节，95MB余697,947。源码c019e11，18单元／15缓存命中、无预算告警；[固定清单](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/final-delivery-manifest.json)及[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/final-checks.json)通过。相对79ace只有策略CJS和原生EXE不同，其余214文件相同；原生两项输入仅换行字节不同、归一C#相同，构建目录指纹不同，未修改原生内容，[原生核对](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/native-baseline-audit.json)保留准确边界。网页重建输出相同，原[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)完整保留。

三胜评价改为在授权假设内优先完整大局胜负，共同赢家计胜，长局紧迫度不能抵消失败。[三项有效先失败／42项通过](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/red-green.json)核对74对94反例、共同第三胜和普通小局区别，保留夹具错误。[15种子小局](../../artifacts/maintenance/v1.0.2/pokemon-expansion-verification/bot/run-1791245026795-7de11915/seeded-rounds.json)1,378动作／21阶段、最长799.349ms，实际16通过／135未选；不冒充全150小局重跑。[17项真实集成](../../artifacts/maintenance/v1.0.2/pokemon-expansion-verification/integration/run-1791245210566-0ffa1cea/results.json)379.574秒通过，混合四席六小局／346次Worker／472步，最长862.654ms；32MiB／两秒与整场十分钟限制不变。[完整五场](../../artifacts/maintenance/v1.0.2/pokemon-expansion-flow-audit/match-outcome-five-counts-20261006/report.json)覆盖2–6人26小局／2,564动作，无封顶；旧144场强度属于旧策略，不能作为本修正证据。[原版差分](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/original-compatibility.json)仍对照b973bbc通过。

同一ZIP的[实际原生便携结果](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-7124872618e3/results.json)10流程／11显示、18卡面／八主题／27叫声离线解码、16张原PNG与运行WebP浏览器RGBA相等通过。[普通模式实际UI](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/match-outcome-final-20261006/results.json)34次手机控件／十阶段、真实默认Worker、秘密与播放通过，47.232秒为自动化时间；页面错误／外部请求零、相关进程退出。全源码／冻结输入与当前包逐项匹配，安全维护零候选，不扩大删除范围。未推送、发布、另导出源码包；根目录原有EXE／source ZIP继续保护，不绑定为新包。

完整透明动作仍缺62帧，新策略全范围分级、真人手机／听感／实际时长和音源依据继续待验；实际第六局约3.52GB的SQLite历史增长风险保留，完成对局不证明长期有界。没有以静图变换或统计样本替代完整要求。

## 1.0.2：累积能力模型同包续验（2026-10-06）

当时[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json) SHA-256 `79ace556cf314e9fc15a73e5d063f2e464c242e3e15c1794d82e50087200c331`，ZIP40,886,874字节、实际解压94,302,060字节，95MB余697,940字节。[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/final-checks.json)绑定源码6566680、18单元冻结及全部原件／派生哈希，16单元复用缓存，仅宝可梦规则与策略重建，无预算告警。与旧 `42205330…` 相比仅两项CJS文件变化，其他游戏、平台与全部网页／媒体字节相同；旧包及其清单已[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)。版本仍1.0.2／协议7，未推送或发布，未导出源码ZIP。

[151项完整种子测试](../../artifacts/maintenance/v1.0.2/pokemon-expansion-verification/bot/run-1791234062981-fc6294a3/seeded-rounds.json)通过，包含2–6人三档150小局／14,231动作／21种阶段，源码前后稳定，最长策略797.358ms，实际命令1163.25秒，无小局封顶。[17项真实服务集成](../../artifacts/maintenance/v1.0.2/pokemon-expansion-verification/integration/run-1791233569902-1307806b/results.json)与当前源码逐文件一致，混合四席五小局三胜、288次真实Worker／389步，最长850.961ms；32MiB／两秒不变。[原版2–6人差分](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/original-compatibility.json)对照上次b973bbc通过。验证器原输出目录仍带历史v1.0.3名称，审计保留原路径并复制到本轮1.0.2证据目录，不表示产品升版。先前冻结失败记录继续保留，不升级为最终通过。

同一ZIP的[实际便携结果](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-79ace556cf31/results.json)通过10流程／11显示，18卡面、八主题、27叫声离线解码，16张运行无损图与原PNG浏览器RGBA逐字节相同，页面错误／外部请求为零。[普通模式实际UI](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/combined-model-final-20261006/results.json)33次手机控件操作／九阶段、真实默认Worker、私看隔离、主机播放事件与进程退出通过；48.422秒为自动化用时，不是人类节奏或听感证明。

完整要求未缩小：真实透明动作仍缺62帧，当前源码三级强度顺序、进一步能力近似、实体手机／真人听感／原版2–3倍小局时长与音源使用依据继续待验。源码现已进入上述运行包，后续改动必须重新绑定精确源码与实际同包证据。

本轮本地交付为运行ZIP与清单。目录内原有同版本EXE与source ZIP由清理脚本保护，已保留其原字节；本轮未重建、上传或把它们绑定为新ZIP的产物。

## 1.0.2：火箭队能力估值与角色无损格式续验（2026-10-06）

当时[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-combined-model-delivery-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json) SHA-256 `42205330f5d0c8f93f1bda2203b1a73990fbeaf03643a34ce3ed67fc11860216`，ZIP40,886,136字节、实际解压94,300,018字节，95MB余699,982字节。[冻结与同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-ability-review-20261006/final-checks.json)核验18单元、当时服务源码及全部原件／派生哈希；相对上次正式包，仅宝可梦策略、网页入口及15张图像运行格式变化，其他游戏字节不变。原包完整保留，未推送或发布。

火箭队皮卡丘面从错误的本人12分换入估值改为全桌同格依次补牌，三个先失败／边界测试通过；近期17项策略复核、17项真实服务集成、类型与相关lint通过。150种子小局实际完成，但六人绝悟组的首次整组测试超时；拆为每种子独立边界后，仅失败组十个种子重跑全部通过，不将首次完整命令称为全绿。新18场／70小局三胜对照未证明绝悟优于豆包，具体限制与证据见[人机页](../games/pokemon-encounters/bot.md#扩展版三档策略2026-10-05)。

新增15张角色与硬币运行WebP净省235,843字节，原PNG全部保留。[实际便携验收](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-42205330f5d0/results.json)通过10项流程／11项显示，16张无损运行图与原PNG在浏览器中每个显示RGBA字节一致，18扩展卡面、八主题及27叫声离线解码通过。[普通模式同包](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/ability-final-normal-20261006/results.json)完成37次手机控件动作与九种阶段，真实默认Worker参与，保存／私看隔离／离线与进程退出通过；自动化46.022秒不是人类时长或听感验证。

首次同步被自动审批拒绝后，逐文件确认目标与本聊天上次提交一致，备份再同步；同步在未跟踪Rocket文件断言处结束，首次试包漏闪电鸟素材，未交付，失败清单与原因保留。补齐并核对16素材后重新构建，实际验收只绑定上述 `42205330…` 包。完整计划仍进行中：缺62帧真实透明动作，三档强度／能力预测、真人手机／听感／实际时长及音源使用依据待完成。

## 1.0.2：普通收局前瞻与无损卡面续验（2026-10-06）

当时[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-ability-review-20261006/previous-delivery/TableMax-1.0.2-win-x64-manifest.json) SHA-256 `d13522ddd11cf7220e5ff7d3576c7e7873fca6156522e2720afe47ea301b5b47`，ZIP41,114,571字节、实际解压94,535,185字节，95MB余464,815字节。隔离18单元／16缓存命中、冻结输入及源哈希复核通过；[固定清单](../../artifacts/maintenance/v1.0.2/pokemon-expansion-terminal-delivery/final-delivery-manifest.json)与[最终核对](../../artifacts/maintenance/v1.0.2/pokemon-expansion-terminal-delivery/final-checks.json)绑定同一包。相对上一包，仅扩展策略产物、宝可梦网页入口及火箭队图像编码变化，其他游戏文件字节不变，不重复升级其完整对局验收结论。

普通换牌全明后停止后续虚构取牌，两项先失败的边界与既有策略共20测试通过，类型、相关lint通过。[17项真实服务集成](../../artifacts/maintenance/v1.0.2/pokemon-expansion-verification/integration/run-1791226208005-22393822/results.json)通过；混合四人三胜154次真实Worker，最长487ms、三局完整对局约80.03秒。保留两次180秒整场超时；覆盖四席最多九局的整场测试边界改为十分钟，每次Worker仍32MiB／两秒硬截止，3,000步上限保留。330日志时约1.7GB的失败存档也保留，未宣称存档长期增长有界。

[实际原生同包](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-d13522ddd11c/results.json)10流程／11显示、18扩展卡面／八主题／27叫声及火箭队WebP离线解码通过。无损转换242,110字节，较原PNG省118,891字节，完整RGBA一致；源PNG保留，未将同图编码变化计作新姿态。[普通模式](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/terminal-final-normal-20261006/results.json)35次生产手机控件动作、15次默认Worker保存、七阶段通过，主机实际播放新增叫声，页面错误／外部请求为零，相关进程退出。47.263秒是自动化用时，不是真人节奏或听感证明。

本轮现有中文来源13张候选图未取得完整合格动作序列，真实透明姿态仍缺62帧。三级强度顺序、实体手机／真人听感／原版2–3倍小局时长及音源世代／使用依据继续待验；旧72场三胜统计属于本轮收局前瞻修复前源码，不能作为当前精确强度统计。完整计划保持进行中，未标完成，当前接续见[扩展任务](../tasks/pokemon-encounters-expansion.md#普通收局前瞻与无损卡面续验2026-10-06)。

## 1.0.2：扩展版三胜策略与叫声同包续验（2026-10-06）

本轮完成对手第三胜、共同大局胜利及忍蛙中对手全明的策略修复，63项相关策略／声画／资源测试、最新完整基线类型检查、相关Lint／格式及17项真实服务集成通过。规则、牌量、研究奖励和秘密权限未改。[72场完整三胜大局](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/match-aware-all-counts-20261006/report.json)覆盖2–6人、308小局／27,064动作，源码前后稳定，无封顶，三神任务自然触发1次，阿尔宙斯发动0次。[分人数种子块分析](../../artifacts/maintenance/v1.0.2/pokemon-expansion-matches/match-aware-all-counts-20261006/match-strength-analysis.json)支持本组两档优于默认，仍未证明绝悟稳定优于豆包；每人数仅四个独立种子，不作普遍强度保证。

27个中文百科来源游戏叫声已用于扩展版公开抽牌，原件270,112字节完整保留，播放派生版本24kbps／99,544字节，原用户音源不变。第一次原始码率试包使模块超4MiB约169KB，已保留[试包与冻结记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-delivery/module-budget-provisional/)，压缩后模块 **4,192,421字节**，低于4,194,304预算；未提高预算。来源世代、使用许可及人耳听感仍待核验，详见[资源](../games/pokemon-encounters/assets.md#续建素材与反馈2026-10-06)。

[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-terminal-delivery/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)与[固定清单](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-delivery/final-delivery-manifest.json) SHA-256 **`49a3e58484e8bd9787b82dd8f19939e3290850b39f84d423fe59a32b24e648a8`**，ZIP **41,231,620字节**，216文件实际解压 **94,653,981字节**，95MB预算余 **346,019字节**。18单元17次缓存命中、无预算告警，打包实耗以固定清单为准。另一项电力公司工作在本轮中途完成提交 `123fbaf`，隔离工作树快进该提交后重新构建；与其已验清单相比，电力公司、现代艺术及全部旧媒体输出哈希一致，最终不交付旧基线试包。

同一ZIP的[宝可梦实际便携结果](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-49a3e58484e8/results.json)通过9项流程、11项显示、18张卡面、八主题音和27叫声离线解码；[普通模式真实UI](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/match-cries-final-normal-20261006/results.json)63次手机操作、23次真实默认Worker保存结果及16阶段通过，喷火龙私看隔离，实际主机23次新增叫声 `playing` 事件、15种不同角色，页面错误／外部请求为零，进程退出。自动化85.580秒不是真人时长或听感认证。[电力公司同包显示](../../artifacts/maintenance/v1.0.2/power-grid/runtime/portable/pokemon-matches-combined-20261006/results.json)72.54秒通过，保留地图与抽屉；不是再跑完整三人对局，原完整对局对应原 `da2dd…` 包，证据继续保留。

冻结输入、音频原件／派生哈希、集成源码、跨游戏逐文件比较和三胜分析集中在[续验审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-delivery/final-checks.json)。上一同版本已验电力公司包 `da2dd…` 及清单保留在[原包目录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-delivery/previous-delivery/)，旧基线已验试包及模块超额试包另存。旧工作树归档恢复实际失败，源码提交和原包未丢失；新工作树保持活动以便继续。

完整计划仍未完成：62帧真实透明姿态、真人设备／听感／实际时长和三级强度收敛待完成。素材生成累计16次、15次输出被拒绝，不能把代码补间或来源截图计作真实姿态。沿用1.0.2，仅本地运行ZIP与清单，不推送或发布。

## 1.0.2：电力公司地图背景与阶段抽屉（2026-10-06）

电脑持续铺满经典德国地图，世界坐标相机最低比例可四向拖动，自动聚焦避让市场／收益边栏和底部玩家抽屉；手动暂停与恢复跟随、阶段默认及同阶段手动选择保持。紧凑公司按playerOrder排列，稳定头像／身份色、四格基础厂信息、四类零库存、待安置燃料及新购待替换厂完整显示；两人临时第五厂不截掉。手机四页、本人高亮、完整价阶／城市列表、具体费用与逐厂确认保持。无规则、服务端接口、存档类型或地图42城／六区／83边变更。

[六人实际渲染](../../artifacts/maintenance/v1.0.2/power-grid-layout-20261006/power-grid/matrix-final/results.json)通过96布局、15交互及5声音调用检查，覆盖720p／短桌面、4K、320／360／390宽手机与横屏；[两人检查](../../artifacts/maintenance/v1.0.2/power-grid-layout-20261006/power-grid/two-player-complete/results.json)通过9交互；[地图标注](../../artifacts/maintenance/v1.0.2/power-grid-layout-20261006/power-grid/map-readable/results.json)通过4项；[真实双指输入](../../artifacts/maintenance/v1.0.2/power-grid-layout-20261006/power-grid/phone-touch/results.json)通过10项，确认他人建城不移动本人地图、双指缩放不切页、查看零动作。新保存重排、同轮不重播、减少动态／测试模式、公共现金隐藏和本人现金可见通过；信息16px、关键状态18px、电脑标题20px和手机44px触控按实际DOM核验。6测试文件46项窄回归通过，45项未修改人机长时压力场景排除；全量类型、相关Lint／格式及独立游戏web构建通过。

[当前运行ZIP](../../artifacts/maintenance/v1.0.3/portable-storage/old-release-retirement.json) SHA-256 **`da2dd77f0805cd00768fe725e58f2647f4763e3285eb1e5f13966fce9e3e0af3`**，ZIP **41,124,739字节**，实际解压 **94,548,279字节**，95MB预算余量 **451,721字节**，双100,000,000字节门禁通过；[固定逐文件清单](../../artifacts/maintenance/v1.0.2/power-grid-layout-20261006/final-delivery-manifest.json)保留本包边界。打包24.115秒、18单元全部缓存命中。[实际便携程序](../../artifacts/maintenance/v1.0.2/power-grid/runtime/portable/map-drawers-20261006/results.json)70.7秒通过，22组主机／公共原生布局覆盖720p／1080p／4K、125%／150%显示请求与模拟Windows DPI，城市费用详情／菜单／公司浮窗和地图操作不改变身份或对局。

[三人完整便携对局](../../artifacts/maintenance/v1.0.2/power-grid/runtime/portable/map-drawers-match-20261006/results.json)另在同包122.51秒通过，独立真人手机与默认电脑玩家完成全部八种阶段及三个步；SQLite审计497行、469份合法状态、442次保存动作重放，含41次建设、109次购料、56次发电、16次换厂和24次转存。阶段转换逐次核对公开顺序与完整价阶，手机具体确认按钮触控／遮挡核验通过。

便携检查使用隐藏WinForms／WebView2、真实混合房间和独立触控模拟手机，核验包哈希、逐文件解压、服务进程及公开权限；display-only记录仅证明暂停房间显示，完整对局证明来自上面的独立运行。两者均不宣称实体手机／Wi-Fi／电视验收。原同版本验收结论保留其固定哈希。共享工作区中其他任务的既有宝可梦策略改动随本次快照构建，但不纳入本次提交；后续并发改动不因本包通过自动获得认证。仅提交电力公司UI、验证器与对应文档，不推送／发布。

## 1.0.2：前瞻均值修复与普通模式同包续验（2026-10-06）

本轮修复扩展人机前瞻只用首个未知牌假设的错误，按完整候选批次平均已采样的授权假设，保留预算、权限、规则、牌量及奖励。4项新增与11项既有策略测试、17项真实服务／SQLite／Worker集成、隔离源码类型检查及相关Lint／格式通过。相同32组假设倒序的120个场景，决策变化由12次降到零；只证明该错误修复，不认证三级胜率顺序。

[当前运行ZIP](../../artifacts/maintenance/v1.0.3/portable-storage/old-release-retirement.json)与[固定清单](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery/final-delivery-manifest.json) SHA-256为 `676f9e75fb1927ad3548f3accf26207444ab061d2aa541a33af6fb6381e46b0d`。ZIP **41,120,054字节**，189文件实际解压 **94,532,561字节**，95MB预算剩 **467,439字节**，双100,000,000字节门禁通过。打包实耗35.940秒，18单元16次缓存命中，无预算告警。因电力公司地图同时在共享工作区修改，正式包从 `0dad279…` 隔离工作树加入本轮改动构建；与上一已验包逐文件比较，仅宝可梦策略和重新编译的原生启动器变化，其他187文件完全一致，未纳入或提交其他任务改动。原生源码不变，目录改变导致原生指纹失效而重编译。

同一ZIP的[真实原生便携结果](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-676f9e75fb19/results.json)通过8项流程、11项三端显示、18张卡面与8项离线主题音解码；[普通模式小局](../../artifacts/maintenance/v1.0.2/pokemon-expansion-normal-play/forecast-final-normal-20261006/results.json)通过两台独立手机身份的40次真实UI动作、13次真实默认Worker保存结果和16种阶段，私看只出现在本人授权页面，零页面错误／外部请求，进程退出。57.976秒是自动化点击时间，不能算真人小局时长、实体手机、Wi-Fi或听感认证。

[149小局统计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-balance-continuation/averaged-forecast-smoke5-strength144-20261006/report.json)与最终策略源码哈希一致，无封顶；48独立种子×三次座位轮换的144局中，分摊获胜数为默认20／豆包58／绝悟66。[按种子块的分析](../../artifacts/maintenance/v1.0.2/pokemon-expansion-balance-continuation/averaged-forecast-smoke5-strength144-20261006/strength-analysis.json)支持本组三人样本的两档优于默认，绝悟对豆包分差区间仍跨零，三级顺序待独立多人数与三胜对照。均值修复前264扩展＋15原版及120自然局作为历史频率保留，不转写为新策略证据。

失败边界保留：[混合试包](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery/provisional-mixed-package/)含其他任务地图改动，虽通过宝可梦便携流程但未交付；正式包第一次[暂停冲突](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-676f9e75fb19-pause-race/results.json)是服务正确拒绝人机保存后的旧版本请求，脚本只对同实例／分支暂停意图增加有界重取版本，重跑同包通过。最终审计与收尾集中在[本轮证据](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery/)。

完整计划仍未完成：透明真实动作姿态仍缺62帧，生成／编辑累计16次中15次输出被拒绝；真人听感、物理设备、原版2–3倍实际时长与三级强度顺序待验。没有降低素材要求、升级产品版本、推送或发布；上一已验ZIP与清单保留在[原包目录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery/previous-delivery/)。

## 1.0.2：扩展版续建、预算与同包复核（2026-10-06）

本地扩展技术包继续补齐公开棋盘轨迹、八段原创能力／研究主题音和人机估值修复。产品版本仍为1.0.2，既有GitHub发布、标签及附件保持原状。完整多姿态演出和真人验证尚未完成，接续见[阶段任务](../tasks/pokemon-encounters-expansion.md)。

[续建同包汇总](../../artifacts/maintenance/v1.0.2/pokemon-expansion-continuation-delivery/final-checks.json)对应[当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)与[当次逐文件清单](../../artifacts/maintenance/v1.0.2/pokemon-expansion-forecast-delivery/previous-delivery/TableMax-1.0.2-win-x64-manifest.json)：ZIP **41,119,920字节**，189文件实际解压 **94,532,267字节**，严格小于100,000,000字节；95MB工程预算剩 **467,733字节**。SHA-256为 `99514d30221a05dfe249a7fd6d16223b755f3937d72979c22127c393166bb7be`。18单元、385个唯一输入路径逐一核验冻结，16单元命中缓存，打包含实际解压实耗21.475秒，无游戏体积预算告警。全部旧媒体及其他游戏核心文件共143项保持字节／哈希不变；未重复宣称执行未受影响的其他游戏完整对局。

服务CJS采用Brotli侧文件及内存恢复，保留CommonJS入口、模块解析与官方Node22.14.0。原服务1,655,164字节变为354,905字节载荷和717字节入口，净省1,299,542字节；4项新测试覆盖原字节／路径／导出、缺失、损坏和错误原文。实际原生隔离验证通过四个Worker保存、再次启动恢复及故障时不监听／存档不变；[最终ZIP实际运行](../../artifacts/maintenance/v1.0.2/pokemon-expansion-runtime/portable-99514d30221a/results.json)另外完成8项流程、11项三端显示、18张新卡面及八个Ogg/Opus离线解码。零页面错误／外部请求，保存恢复一致；电脑六席54格全部在视口内，手机本人九格自然滚动。4K请求与实际窗口尺寸分别记录，不能算实体手机、现场Wi-Fi或实际Windows DPI验收。

公开交换、盖回与随机翻明只根据已保存公开事实播放轨迹，私看不生成公开目标；减少动态隐藏轨迹，取消后移除。相关表现／声音43项测试和实际组件7场景通过。[逐图独立复核](../../artifacts/maintenance/v1.0.2/pokemon-expansion-trajectories/corrected/independent-visual-review.md)未发现P2问题；忍蛙金色轨迹与1号位编号局部重叠属于P3改进项。新主题音明确为原创反馈，运行文件总32,604字节，229,152字节PCM原件保留；原声身份与真人听感不因解码通过而认证。

人机修正未来换入后朝向及调位随牌移动的评分，也修正弃牌取牌必须换入的估值；规则、记忆权限、牌表、奖励和档位参数未改。11项窄回归、全量类型与Lint检查通过，最终类型调用显式化后17项真实服务／SQLite／Worker集成重新通过。[修复前228小局](../../artifacts/maintenance/v1.0.2/pokemon-expansion-balance-continuation/natural-120-strength-108-20261005/report.json)保留为旧策略证据：120自然局中24项研究全部候选／当选，三神齐聚1局、阿尔宙斯发动1局；[修复后41小局](../../artifacts/maintenance/v1.0.2/pokemon-expansion-balance-continuation/after-strategy-fix-smoke5-strength36-20261006/report.json)含2–6人及36次三档座位平衡，共2,988合法动作、49.24秒、零封顶。测量后仅为TypeScript缩窄显式构造相同reposition参数，精确源码哈希差异和回归边界已记录。这些样本不足证明绝悟稳定强于豆包或参数已收敛；不能以CPU耗时认证真人小局为原版2–3倍。

素材续检取得中文官方公开视频，并提取4个真实卡比兽动作参考；新透明编辑请求仍被输出审核拒绝。累计16次生成／编辑仅1个候选成功、15次被拦截，63个真实关键姿态仍缺62个，不能把静态卡面位移或此次轨迹称作完整多姿态演出。当前预算余量未覆盖剩余素材，正式导入后须重新测量预算及最终ZIP。真人手机、听感、实际小局时长和更充分强度对照继续待测，完整计划保持未完成。收尾维护与文档检查证据补入同包汇总；仅本地提交，不推送。

## 1.0.2：本地宝可梦扩展版技术可玩包（2026-10-05）

本地新增同入口 `original`／`expansion` 权威版本，默认原版；管理员仅在大厅／结束后切换，身份、座位与房主保留。扩展九宫格、112／144张牌、十四类特殊牌、24＋6研究任务、秘密投票、联合复制计分、三档策略、三端操作与保存恢复已实施。协议升至7，原版规则指纹与旧存档兼容；产品仍为1.0.2。下节既有GitHub发布、标签、EXE及源码附件保持原状，此次仅导出本地运行ZIP与清单。

[当次同包汇总](../../artifacts/maintenance/v1.0.2/pokemon-expansion-delivery/final-checks.json)保留历史包边界：ZIP 41,163,255字节、180文件实际解压95,793,403字节，均严格小于100,000,000字节；95MB工程预算当时超793,403字节。ZIP SHA-256为 `dfa46de6d93ca60acf95556421544baef83a45b035282afc283a387aba826161`。18个构建单元、375个唯一输入路径逐一核验冻结；盒子不导入游戏源码，共享CSS加载与失败重试纳入输入。运行ZIP与清单的当前位置现由上节续建包使用，不将旧通过结果转移到新哈希。

规则50项、17项真实服务／SQLite／Worker集成、150种子小局与14,274合法动作、原版2–6人完整差分及相关声画／加载检查通过。最终实际ZIP在包内Node、WinForms／WebView2中通过7项流程、11项显示矩阵、18张新卡面本地解码，零页面错误／外部请求；恢复前后结果一致，原版切回保留身份并清准备。电脑六席54格均在视口内，手机本人九格自然滚动；公共屏实际3840×2160，主机4K请求的实际视口2880×1620，如实保留。横向与字号检查遗漏纵向可见性的过渡包已记录为显示缺陷，不能代替此次同包证据。

首轮30小局统计可复跑，无封顶／重复桌面，但三神追加和阿尔宙斯未自然出现，尚不足以收敛事件频率、策略强度或真人2–3倍时长。完整声画要求未达成：63个真实关键姿态仅1个候选成功、62个仍缺，生成15次中14次被工具输出审核拦截；当前演出采用已核验卡面与代码主题动效，不能算作真实多姿态交付。角色原声、真人听感、实体手机／现场局域网与实际Windows DPI仍待验证。完整扩展计划保持未完成，接续见[阶段任务页](../tasks/pokemon-encounters-expansion.md)。

## 1.0.2：完整EXE发布与维护规则更新（2026-10-05）

用户指定最新发布编号为v1.0.2，保留此前本地v1.0.3／v1.0.4已完成的三游戏、引导和独立构建功能，历史验收不改号。[发布入口](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.2)仅提供完整EXE与发布提交导出的source ZIP；运行ZIP、逐文件清单和过程报告留作本地审计，旧版误传JSON按精确附件名退役。附件核验与来源提交见 [发布审计](../../artifacts/maintenance/v1.0.2/github-release-20261005/github-publication.json)。

线上发布已完成并确认为Latest：标签与source对应提交 `26bb74788f2d48d4a67a34873a7a6c18c905ade0`，源码ZIP13,735,768字节；两份附件的远端大小／SHA-256与本地一致。v1.0.1的 `TableMax-1.0.1-manifest.json`、`TableMax-1.0.1-win-x64-manifest.json` 已移除并修正旧版说明；其有效运行ZIP和source ZIP哈希保持不变，见 [附件退役审计](../../artifacts/maintenance/v1.0.2/github-release-20261005/retired-github-assets.json)。本段为发布后文档记录，发布标签不移动、包不重建。

最终运行ZIP为40,730,282字节，162文件实际解压95,278,750字节；完整EXE为40,865,792字节，实际提取目录含校验标记为163文件／95,313,076字节。均严格低于100,000,000字节；原运行资源超95MB工程预算278,750字节，含标记超313,076字节，如实记录，不以压缩或调整预算抵扣。内置ZIP SHA-256为 `90efd63a9df22eed61a773aa186851e98196f12b995b8e2198141d64bd3b184c`；EXE为 `7fadb97745fd7cdc59b5a23ca9aa8b8616da3506722a1210bdef548fe7590a9c`。

[同包汇总](../../artifacts/maintenance/v1.0.2/github-release-20261005/final-checks.json)核验6份报告使用同一ZIP：宝可梦全部14阶段、两种币面及引导设置；现代艺术五席、三手机、四轮拍卖与回退／恢复；电力公司六席、552条动作重放及显示；盒子、房主与声音播放权4项；三端规则27项；从最终EXE实际提取的原生程序／包内Node／WebView2安全10项。343个构建输入逐一冻结，118媒体文件与上一已验交付哈希一致，交付文件仅package.json及原生版本字节变化。未变的玩法策略单测与专项结论复用，未重新宣称执行。

类型、Lint、格式和PowerShell解析通过；[启动器6项实际编译回归](../../artifacts/maintenance/v1.0.2/github-release-20261005/launcher-tests.json)覆盖并发、复用、修复、占用、未知目录与路径穿越拒绝；[最终EXE检查](../../artifacts/maintenance/v1.0.2/github-release-20261005/shipping-executable-checks.json)核验完整哈希、精确文件集、重复提取及真实原生运行。清理覆盖元数据5项、进程保护及窄范围截图预览／删除；保护素材、正式存档和当前验收。回环服务与后台WebView2、手机尺寸／触控模拟不等于实体手机或现场Wi-Fi认证。

README按产品介绍、游戏、快速开始、运行要求和常见问题重写。自动维护超过10GiB触发、目标8GiB；全库只在开始／结束实测，候选删除前保留一次必要元数据／链接／进程复核。当前包及上一已验ZIP／清单保留，源代码仅提交本次改动；扩展草案及其他未提交内容不混入发布。收尾见 [瘦身记录](project-slimming.md#v102发布收尾2026-10-05)。

当前合并便携包与同包验证见下节；各任务历史结果保留原哈希与边界。旧包退役后从同位置记录和 [瘦身方案](project-slimming.md#历史包退役)追溯，不将原通过结论转移到当前包。线上已发布包见 [v1.0.1 GitHub Release](../archive/acceptance-2026-10-01-to-04.md#101github-release2026-10-03)；更早完整对局、AC 对照与证据集中在 [历史验收](../archive/acceptance-2026-10-01-to-04.md)。

2026-10-05 已按用户新授权清理 maintenance 中历史运行截图，保留当前 v1.0.3 验收、原素材、存档与文字结果。本页较早章节的截图保留描述仅表示当次状态，最新退役范围与哈希见 [全量退役记录](project-slimming.md#历史运行截图全量退役2026-10-05)。

## 1.0.4：独立增量构建与分块组装（2026-10-05）

平台六单元及每游戏规则／人机／网页／轻量目录四单元已独立构建。正式包默认三游戏共18单元，开发含内部模板共22单元；服务、Worker、盒子由版本清单发现，额外验证游戏无需修改平台名单。游戏网页通过授权 web-host 和固定本地 ESM 共享 React／React DOM／通用控件，盒子只读轻量目录和小封面。玩法、策略版本、权限及存档格式保持兼容；下载、安装和差分更新未实现。

类型、Lint、全库代码格式及117项平台／服务／协议相关测试通过。[缓存11项](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/cache/results.json)验证独立失效、跨目录牌表、数组／排除素材glob新增重命名删除、损坏、并发、第五验证游戏实际发现、版本拒绝、增量与干净全量组装文件完全一致及失败回滚；[失败边界6项](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/cache/failure-boundaries.json)检查非法单元路径、提前完成单元后续变化、编译失败、陈旧描述、编译途中变化及共享契约失效。实际暖构建13,453ms、强制全量29,928ms；最终18单元全命中，组装9,656ms，含构建／压缩／实际解压的打包31,031ms，各单元耗时在冻结清单中。并行验收时间不相加冒充总开发耗时。

最终同一ZIP实际解压通过 [宝可梦14阶段、引导开关与恢复](../../artifacts/maintenance/v1.0.4/portable/modules-final-v104/results.json)、[现代艺术五人四轮／切换／权限与恢复](../../artifacts/maintenance/v1.0.4/modern-art/portable/modules-final-v104/results.json)、[电力公司六人三档Worker／STEP1–3／显示与恢复](../../artifacts/maintenance/v1.0.4/power-grid/runtime/portable/modules-final-v104/results.json)、[盒子加载及唯一声音窗口4项](../../artifacts/maintenance/v1.0.4/experience-portable/modules-final-v104/results.json)、[三款图文规则27项](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/rules/modules-final-v104/results.json)和[原生安全10项](../../artifacts/maintenance/v1.0.4/webview2/modules-final-v104/results.json)。电力公司同包流程233.11s，重放581动作；规则页92.80s。118个原媒体文件与旧已验包逐哈希一致，路径按独立模块输出；正式包没有内部模板。早期独立模块缺失的旧崩溃fixture、HTTP随机禁用端口、重复头像／控件和公共页相对资源路径失败均已修复并保留原因，不改变规则规避检查。

三款预算以独立文件×1.10及三个真实场景峰值最大值×1.25向上取整至MiB，一次初始化后固定，当前均无警告。文件预算宝可梦4MiB、现代艺术3MiB、电力公司2MiB；服务堆分别80／65／122MiB，电脑堆36／25／41MiB，手机堆24／24／43MiB，进程私有内存增量857／1894／1338MiB。设备、原始采样、三次完整最高等级Worker对局和共享基线见 [预算结果](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/budgets/results.json)。共享运行时只计一次，服务／渲染上限包含共享基线，不能跨游戏相加；私有内存增量包含验证所开的模拟手机WebView。另完成 [20次牌桌往返](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/memory/results.json)，GC后堆中位增量107,388字节，及 [重特效9项与100ms堆采样](../../artifacts/maintenance/v1.0.4/effects/module-effect-heap-final/results.json)，峰值10,194,692字节，未超宝可梦电脑堆预算。采样不称为分配分析器最大值或无泄漏证明，32MiB老生代限制不是整款游戏总内存预算。

该轮运行ZIP已退役，历史 **40,730,284字节**，实际解压 **162文件／95,278,750字节**，均严格小于100,000,000；95MB工程预算超 **278,750字节**。SHA-256：`cbadd0e114854455f9f09a54188dbdee0f1773287d5321e9f83e5edc0c0a14cb`；[冻结清单](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/final-delivery-manifest.json)及[最终审计](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/final-checks.json)保留逐文件与验收边界。上次已验ZIP及清单保留在本轮 previous-delivery；下节保留其原结果。本机回环、隐藏WebView2、手机尺寸和显示缩放模拟不等于实体手机、Wi-Fi或真人听感验收。验收后仅更新文档，不再打包；扩展草案与无关改动保留，仅提交本次改动、不推送。

空闲后预览并受保护清理旧构建缓存577,310,720字节、打包临时目录231,322,093字节及38个已结束验证目录32,240,861,318字节；release只留当前ZIP与清单。工作区仍约32.44GiB，安全候选耗尽，近期数据、依赖缓存和材料继续保留，不扩大删除范围。首轮进程误判已通过六项回归修正，343个冻结运行输入在提交后仍逐哈希一致，收尾脚本变化未影响运行物；原包没有重新构建。详细保护、删除及提交记录见本轮最终审计。

## 1.0.4：新手引导开关与同版本更新（2026-10-05）

宝可梦在盒子及牌桌菜单的“游戏设置”中新增默认关闭的新手引导，普通手机玩家也可调整；偏好按本设备保存，刷新和同设备窗口同步。关闭时保留当前能力短语及规则入口，隐藏完整步骤、触发条件和补充说明；普通取牌不保留冗余说明块，必要状态、选择与确认仍可见。开启后恢复完整提示。不发送房间动作，不改变计时权限、存档或原版玩法。

[实际组件检查](../../artifacts/maintenance/v1.0.4/pokemon-polish-20261005/layout/guidance-toggle-v104-final/report.json)通过48组顶栏、36组操作栏、12组按钮及开关专项；320px喷火龙说明区由约169px缩为56px，切换保留选位。类型、Lint、格式及3项引导单测通过。新ZIP实际解压后完成 [新手设置与完整流程／恢复](../../artifacts/maintenance/v1.0.4/portable/guidance-toggle-v104/results.json)两次运行、12种自然阶段，以及 [三款游戏图文规则27项](../../artifacts/maintenance/v1.0.4/guidance-setting-20261005/rules/portable-final/results.json)，两份报告均核对同一包哈希。未变规则、策略、Worker及118个媒体文件沿用既有核验，不称为重新执行全部策略测试。回环服务、隐藏WebView2和手机尺寸模拟不等于实体手机或Wi-Fi验收。

该轮 [当时逐文件清单／退役记录](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/previous-delivery/TableMax-1.0.4-win-x64-manifest.json) **40,630,608字节**，实际解压 **153文件／95,145,272字节**，均严格小于100,000,000；95MB工程预算超 **145,272字节**。SHA-256：`2b082190a56c058c2f4a9ec2ad6625a98ec8345762543bc85818dfc78227acd8`；[冻结清单](../../artifacts/maintenance/v1.0.4/guidance-setting-20261005/final-delivery-manifest.json)及 [审计与收尾](../../artifacts/maintenance/v1.0.4/guidance-setting-20261005/delivery-checks.json)。上一份已验证同版本ZIP及清单保留在本轮证据目录，下节仍记录其原有验收边界。验收后仅更新文档，不再次构建；仅提交本次明确改动，不推送，用户扩展草案及其他已有改动保留。

空闲后受保护清理回收打包目录230,947,904字节及旧验证目录582,967,116字节；当前包、素材和验收证据保留。工作区仍为7,521,971,653逻辑字节，安全候选已耗尽，不扩大清理范围；详见上述审计与收尾记录。

## 1.0.4：合并打包与实际便携检查（2026-10-05）

按用户指定更新为v1.0.4，汇总三款游戏已完成的改动，原版玩法、秘密权限和存档格式保持不变。根版本与原生程序集版本同步；桌面runtime的appVersion改为读取程序集版本，避免继续写死1.0.3。最初候选发现桥接仍报旧版本，未作为验收包；修复后重新生成正式包，候选构建记录与清单保留在本轮证据中。用户扩展草案及原有未提交文档改动保留，相关文档仅更新当前版本行。

[运行ZIP](../../artifacts/maintenance/v1.0.4/guidance-setting-20261005/previous-delivery.zip) **40,627,069字节**，实际解压 **151文件／95,141,960字节**，均严格小于100,000,000。95MB工程预算仍超 **141,960字节**。SHA-256：`18e7f704638ad9b7c2944398125c89570616db53a3191944a5bf2dfba48c821a`；[冻结清单](../../artifacts/maintenance/v1.0.4/final-delivery-20261005/final-delivery-manifest.json)。[逐文件审计](../../artifacts/maintenance/v1.0.4/final-delivery-20261005/payload-audit.json)确认与最后已验证v1.0.3包相比，仅package.json和TableMax.exe变化；118个媒体资源、全部规则／策略／Worker／服务／前端文件字节及哈希均不变。上一份已验ZIP与清单在证据目录保留。

类型、Lint、代码格式重新通过。正式ZIP实际解压后通过 [宝可梦完整流程与恢复](../../artifacts/maintenance/v1.0.4/portable/final-v104/results.json)两次运行、自然覆盖13种阶段；两次runtime均报告1.0.4，本轮未自然出现的皮卡丘币面仍以字节未变的v1.0.3完整14阶段证据及专项结果复用。另通过 [三款规则27项](../../artifacts/maintenance/v1.0.4/final-delivery-20261005/rules/portable-v104/results.json)、[电力公司六人原生显示](../../artifacts/maintenance/v1.0.4/power-grid/runtime/portable/final-v104/results.json)、[现代艺术四轮与恢复](../../artifacts/maintenance/v1.0.4/modern-art/portable/final-v104/results.json)及 [原生安全10项](../../artifacts/maintenance/v1.0.4/webview2/final-v104/results.json)。原生安全新增运行时版本断言，确认桥接与根版本一致；五份便携报告核对同一正式ZIP哈希。电力公司45场策略、宝可梦48组顶栏／36组操作栏／12组按钮等未变模块的既有结果明确复用，不称为v1.0.4重新执行。

回环服务、隐藏WebView2及手机尺寸／DPI模拟不代表实体手机、Wi-Fi或真人听感。验收后仅更新文档，不再次打包。当前包、旧包、素材和验收证据受保护，release只保留当前运行ZIP与清单；空闲收尾及保护结果见 [合并验收汇总](../../artifacts/maintenance/v1.0.4/final-delivery-20261005/final-checks.json)。仅提交本次版本、验证与文档改动，不推送。

## 1.0.3：任务完成后合并重打包与复核（2026-10-05）

待电力公司任务完成并提交9012f1b后，重新构建一次v1.0.3运行包，包含宝可梦简短能力说明、手机按钮和电力公司最终改动。上一份已验证合包及清单保存在 [本轮证据目录](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/previous-delivery-manifest.json)，保留原验收边界；用户扩展版草案与七份未提交文档均原样保留。

新 [运行ZIP](../../artifacts/maintenance/v1.0.4/final-delivery-20261005/previous-delivery.zip)为 **40,626,992字节**，实际解压 **151文件／95,141,448字节**，两者严格小于100,000,000。95MB工程预算仍超 **141,448字节**。SHA-256：`2028e42f4311a8bc9e5329bcf413c028dee4465413fc98d14477541d95fa3ca2`；[冻结清单](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/final-delivery-manifest.json)。[逐文件核对](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/payload-audit.json)确认150个文件与上一合包字节和哈希一致，包含全部游戏、策略、服务、前端和118个媒体资源。仅TableMax.exe变化：SDK程序集信息版本中的Git修订号由7d441d7更新为9012f1b，原生源码未变，见 [编译元数据](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/native-rebuild-metadata.json)。初次“151文件全相同”的审计断言因该程序失败，已保留原因，修正为区分程序和其余文件后核对通过。

类型、Lint和全库代码格式重新通过。 [宝可梦手机专项](../../artifacts/maintenance/v1.0.3/pokemon-polish-20261005/layout/combined-repackage-v103/report.json)重新检查48组顶栏、36组操作栏及12组简短说明／按钮场景。新ZIP实际解压后通过 [宝可梦完整流程与恢复](../../artifacts/maintenance/v1.0.3/portable/combined-repackage-v103/results.json)两次运行、14种阶段， [三款规则27项](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/rules/portable-final/results.json)， [电力公司六人原生显示](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/combined-repackage-v103/results.json)及 [原生安全10项](../../artifacts/maintenance/v1.0.3/webview2/combined-repackage-v103/results.json)；四份记录均核对同一新ZIP哈希。电力公司45场策略与现代艺术完整四轮等上一合包结果，只对已核验字节未变的模块复用，不称为重新执行。电力公司本次display-only只检查显示与入口，不替代完整对局。

全部验证使用回环地址、隐藏WebView2和手机尺寸模拟，不代表实体手机、Wi-Fi或真人听感。验收后仅更新文档，不再次构建；运行包目录和空闲维护按受保护脚本收尾，结果见 [合并验收汇总](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/final-checks.json)。

## 1.0.3：电力公司人机、分页与声画 debug（2026-10-05）

当前合并运行包包含另两个对话已完成的现代艺术／宝可梦改动，电力公司采用稳定预算的三档跳价和分级有限规划；手机四页单层阅读、主要动作停靠，电脑按阶段突出决策，普通声画改为局部反馈。经典德国数据、秘密权限、存档及策略版本保持兼容，细节见 [人机](../games/power-grid/bot.md)及[交互](../games/power-grid/interaction.md)。

[45 场规则对局](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/strategy-final-metrics.json)覆盖 2–6 人、三档、三个种子，共 25,619 个动作，最长计算 1051.84ms；74 项完整测试及新增终局扩城回归通过。固定竞价案例由旧策略本人追加 7／9／10 次降至每档 3 次；共享思考节奏不变，不将减少循环数称作实际人类等待计时。完整应用另外 295 项测试中一项既有宝可梦种子测试在并发负载下超时，隔离重跑通过；原失败及经济停滞、终局扩城修复保留于 [诊断](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/debug-findings.json)。类型、Lint、相关格式通过。

2–6 人实际生产组件共 472 组布局检查覆盖 854×480 至 4K、320／360／390 手机、全部阶段与价阶；最后公司卡压紧后另完成 96 组、14 项交互、5 项音频检查。查看／分页不发动作，草稿、地图和滚动保持，键盘／滑动冲突及全部价格档核验通过。合法规则 fixture 与自然完整对局分开记录。两位手机 UI 身份加默认 Worker 的 [普通节奏试玩](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/phone-play/review.json)完成采购、竞价、建城、运行和主动少供电；策略、效率、可读性、视觉、声音分别记录。独立截图审查及修复保留证据；公司页厂号单行和长昵称仍有非阻断压紧空间，见 [最终逐图审查](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/company-visual-review.json)。

同一个最终 ZIP 实际解压通过 [六人混合 Worker／恢复／原生显示](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/debug-final-r2/results.json)、[41 项／六类声画](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/native-audio/portable-final-r2/results.json)、[三款规则 27 项](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/rules/portable-final/results.json)、[宝可梦完整流程](../../artifacts/maintenance/v1.0.3/portable/power-grid-debug-final/results.json)、[现代艺术四轮与恢复](../../artifacts/maintenance/v1.0.3/modern-art-audit-20261004/runtime/power-grid-debug-final/results.json)及[原生安全 10 项](../../artifacts/maintenance/v1.0.3/webview2/power-grid-debug-final-r2/results.json)。电力公司 740 行日志／703 状态／670 回放动作覆盖全部阶段与 STEP 1–3，4K 和模拟 125／150% DPI 下操作保持身份及对局；检查末尾恢复到 playing 为回退验证，不表示原整局未结束。首轮旧常驻公司断言、短声画截图错过和原生重启加载失败记录保留，验证器按新版入口及并发即时捕获修正，同包重跑通过。

该轮 [运行 ZIP](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/previous-delivery.zip.retired.json)为 **40,626,986 字节**，实际解压 **151 文件／95,141,448 字节**，严格低于 100,000,000；95 MB 工程预算仍超 **141,448 字节**。SHA-256：`d5227cc8bee2827e6fa5ab1c5ce7a3846e91cbdd55b9de4a87b54bac7431d190`。游戏／策略 CJS 与 Worker 采用锁定 esbuild 压缩，118 个媒体文件与上一包大小及哈希完全相同；[冻结清单和同包审计](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/final-delivery-checks.json)记录各检查哈希，没有验收后重新打包。本机回环、隐藏 WebView2 及手机尺寸模拟不等于实体手机、局域网或人耳听感认证。历史包／临时目录清理见 [瘦身记录](project-slimming.md#电力公司-debug-收尾2026-10-05)，保留当前交付、原素材、规则、失败文字及逐文件哈希。

## 1.0.3：宝可梦操作引导、同值归零与动漫切入（2026-10-05）

随操作可见的能力说明与详细规则定位、同值归零标记、1500／1650／1800ms动漫侧面切入及稳定复用边界完成。原版2×3／16类56张／三胜、能力、身份及存档保持兼容。−2／2贡献仍为0但不标记；全公开投影新增派生publicMatchedColumns。卡比兽／喷火龙继续局部授权效果，币面／叫声保持1200ms。扩展入口禁用，未实现扩展玩法。用户原有草案和索引未纳入本次提交。

[游玩视觉报告](../games/pokemon-encounters/validation-scenarios.md#游玩过程视觉审查2026-10-05)覆盖手机／电脑各阶段，21张实际生产组件截图及9张手机切入截图。火箭队青色底、角色比例、材质层级、重复信息和结算差异等只分析，不实施整体改造。截图fixture不是自然整局；实际保存流程另核验。

类型、Lint、本次代码／改动文档格式、72项相关单测、13项策略／32MiB Worker检查通过；[固定随机源差分](../../artifacts/maintenance/v1.0.3/pokemon-guidance-cutin-20261005/original-compatibility.json)以219ae95d基线验证2–6人发牌／状态／合法动作／计分／生命周期，旧投影仅排除新增派生字段后比较。原版资源118个媒体文件均与上一包哈希一致，其他两游戏规则／策略、Node和Worker模块字节不变，见 [交付差异](../../artifacts/maintenance/v1.0.3/pokemon-guidance-cutin-20261005/delivery-checks.json)。

源码 [手机检查](../../artifacts/maintenance/v1.0.3/pokemon-polish-20261005/layout/guidance-cutin-v103-final/report.json)48组顶栏／36组操作栏通过，320–430px、横屏、长昵称、离线、测试模式及章节只读定位；短屏明确自然滚动后检查按钮可达／无遮挡。 [特效](../../artifacts/maintenance/v1.0.3/effects/guidance-cutin-v103/results.json)9组认证actual animationstart、0%／45%CSS轨迹采样、持续时间和权限／清理；[音效](../../artifacts/maintenance/v1.0.3/pokemon-polish-20261005/audio/guidance-cutin-v103/results.json)4组认证八WAV解码、双槽和1200ms同步，两段原WAV与已保留source-originals哈希一致，未修改声音。

最终同哈希运行ZIP已实际解压并通过 [完整对局／恢复](../../artifacts/maintenance/v1.0.3/portable/guidance-cutin-v103-final/results.json)的14种阶段、[显示](../../artifacts/maintenance/v1.0.3/display/guidance-cutin-v103-final/results.json)44张720p–4K／100–150%／暂停六人画面、[窗口交接](../../artifacts/maintenance/v1.0.3/experience-portable/guidance-cutin-v103-final/results.json)的公共优先唯一播放与恢复、[真实保存后表现](../../artifacts/maintenance/v1.0.3/presentation-portable/guidance-cutin-v103-final-r2/results.json)的自然42步小局与三档Worker实际节奏。首次表现检查的旧“牌桌管理”定位失败保留在 [首轮记录](../../artifacts/maintenance/v1.0.3/presentation-portable/guidance-cutin-v103-final/results.json)，仅改验证脚本为现有“管理设置”，同包重跑通过。隐藏WebView2／Chromium尺寸与DPI模拟不等于实体手机、显示器或真人听感认证。

[该轮冻结清单](../../artifacts/maintenance/v1.0.3/pokemon-guidance-cutin-20261005/final-delivery-manifest.json) **40,624,792字节**，实际解压 **151文件／95,163,216字节**，两者严格小于100,000,000。超过95,000,000工程预算 **163,216字节**，如实记录。SHA-256：`8701cff952eee381175bb0ca14c31b95bccc626d16b7d127fa4ddc544bf49638`；[冻结清单](../../artifacts/maintenance/v1.0.3/pokemon-guidance-cutin-20261005/final-delivery-manifest.json)。只构建一次最终包，验收后不重打包，没有源码包或推送。上一已验包及清单保存在本轮证据目录，历史结论保持原哈希。

最终全库格式复查发现另一会话新建的未跟踪 `games/power-grid/bot/planner.ts` 格式不通过；本次文件单独格式检查通过，未修改或提交该文件。此前全库类型、Lint与格式检查通过的时间边界保留，不将并行文件的状态归为本次已修复。

## 1.0.3：宝可梦原创图文规则页（2026-10-05）

按用户要求参照现代艺术与电力公司的规则页，重写八章并 imagegen 制作九张新图，规则、计分、身份、人机与存档均未改变。原版两行三列、56 张、三胜以及六种能力的触发／完整结算边界逐项核对。数字、箭头、牌位与胜场由代码排版，百变怪复制右侧 9、同列归零后总分 14 的例子由真实计分单测通过，优于复制左侧 3 的 26。页面不读取实时暗牌。

角色题材三次被内置图像工具输出阶段拒绝，停止角色生成后制作全新无角色主题场景；无旧图替代新图或出版方图稿声明。[九图与提示词清单](../../assets/games/pokemon-encounters/manifest.json)、[原图及生成记录](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/imagegen/generation.json)保留失败请求、实际工具返回、960×480 WebP／1774×887 PNG、转换与逐文件哈希。新图合计 **347,266 字节**；原三张规则截图及 PNG 保留，退出当前导入。

[源构建规则验收](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/rules/source-v103/results.json)通过 9 组合，23.53 秒；[最终同哈希 ZIP 规则验收](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/rules/final-v103/results.json)通过 9 组合，27.10 秒、27 张真实渲染截图。覆盖 host／public／player、手机 320／360／390、电脑 720p／4K 与 150% 显示缩放、九图本地解码、八章逐项导航、16px 图解／18px 正文／44px 触控、320px 减少动态、关闭／Escape 焦点及查看不改变 revision／身份。无页面异常或外网请求；隔离服务退出后不可达。本机隐藏 WebView2 与手机尺寸模拟不等于实体设备认证。

当次 [已退役包清单](../../artifacts/maintenance/v1.0.3/pokemon-guidance-cutin-20261005/previous-delivery-manifest.json) **40,620,970 字节**，实际解压 **151 文件／95,150,329 字节**，两项严格低于 100,000,000；超过 95,000,000 工程预算 **150,329 字节**，保留已核验图像质量，如实记录。SHA-256：`29d6b15e2a1dbb7b8701dcdd3db67bd4271c6ae6ec9081d4ca2a5c1f75b3686d`；[冻结逐文件清单](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/final-delivery-manifest.json)与实际验收对应，没有验收后重打包。[交付差异核验](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/delivery-checks.json)确认服务、规则、策略 CJS 及 Node 与上次已验包字节相同；同版本原生程序重新构建，哈希变化独立记录并使用新程序实际验收，不将上次整局通过冒充本轮重跑。类型、Lint、格式、图例单测与文档检查通过；本次只导出运行包与清单，无源码包或推送。

收尾维护先预览后执行，删除过期隔离验证数据约 9.48 GiB，工作区降至约 4.157 GiB；原图、当前验收及上一已验包保留，近期打包目录继续保护，详见 [收尾记录](project-slimming.md#宝可梦原创规则图解收尾2026-10-05)。首轮文档审计缺交付差异文件的失败记录保留，补齐 UTF-8 审计产物后重新核验。

## 1.0.3：宝可梦人机、能力演出与版本复用（2026-10-05）

当次 [已退役包清单](../../artifacts/maintenance/v1.0.3/pokemon-rules-redesign-20261005/previous-delivery-manifest.json) **40,452,032 字节**，145 个文件实际解压 **94,975,611 字节**，两者严格小于 100,000,000；95,000,000 工程预算余量 **24,389 字节**。SHA-256：`83234cf77c1cfa7e920699b2ff604a21f7b4748928f7c1539a332e7120695fa3`。本轮冻结 [逐文件清单](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/final-package-manifest.json) 保留该实际包边界；没有源码包、没有升级版本或推送。

三档改为局势比较与分级历史记忆；默认不再固定盲换，豆包／绝悟用 8／32 个未知牌假设、最多一／两个本人后续回合。观察记忆随规则动作同事务保存，回退和重启不保留撤销知识。外部策略标识、规则、六格、牌组、三胜和存档外层未改变。五种能力分别采用短全屏或授权局部表现；共用资源和原版元数据拆出，盒子提供只读“版本：原版”，扩展版筹备中，未实现九格玩法。规格见 [人机](../games/pokemon-encounters/bot.md)、[交互](../games/pokemon-encounters/interaction.md) 和 [资源](../games/pokemon-encounters/assets.md)。

[25 个固定种子完整大局](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/fixed-seeds.json)覆盖 2–6 人、三档、混合等级及旧默认基线。下表各档合计 5 局；盲换比例按普通换入次数，弃牌率按普通回合数。混合样本获胜座位为默认 1/8、豆包 3/7、绝悟 1/5；席次、人数和随机样本不同，不作为档位胜率排序或现实保证。

| 策略   | 普通回合 | 盲换暗格比例 | 弃牌率 |
| ------ | -------: | -----------: | -----: |
| 旧默认 |      369 |         100% |     0% |
| 默认   |      703 |        58.0% |  19.6% |
| 豆包   |      647 |        61.2% |  13.6% |
| 绝悟   |      598 |        56.2% |  15.7% |
| 混合   |      625 |        59.0% |  15.5% |

源码累计 **321 项测试通过**：[最终策略、观察记忆及平台事务 39 项](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/strategy-summary-final.log)一并通过，包括 25 大局、前瞻差异及默认跨小局目标选择；[其余全工程回归](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/tests.log) 306/307 通过，其中混合恢复测试因并行负载超过旧 5 秒时限，[单独重跑 3 项](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/recovery-retry.log)通过，未放宽产品截止。策略整局总测试时限为十分钟，最终组合实测约 296 秒；真实 32MiB Worker 取牌／梦幻为 505／450ms、9.6／11MiB，低于 1.5 秒目标，二秒硬截止不变。类型、Lint、源码格式检查通过。

当次重构前后固定随机源差分对照基线提交 `1b3930c`，2–6 人状态、发牌、能力、计分、生命周期、合法动作及所有投影一致；[实际 BoxScreen 版本检查](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/version/results.json)三个端零命令、房间不变、扩展禁用，盒子构建不含完整卡图和音频。八个原音源未修改；集中映射仍由声画单测核验，未新增真人试听结论。原兼容JSON在本轮被同名验证脚本覆盖，旧基线与通过结论保留于本段；本轮219ae95d报告另冻结在新任务证据目录，脚本增加独立证据目录参数防止再次覆盖。

[实际组件手机布局](../../artifacts/maintenance/v1.0.3/pokemon-polish-20261005/layout/bot-variant-v103/report.json)通过 48 顶栏／36 选位栏；[隐藏 WebView2 声画 fixture](../../artifacts/maintenance/v1.0.3/effects/bot-variant-v103-final/results.json)覆盖三种全屏、两种局部、多阶段／连续币面、快速切换、共同赢家、减少动态、授权私看，并补 320px／720p／4K 演出渲染。最后补齐默认历史决策后，[逐文件差异](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/final-package-delta.json)确认仅两个宝可梦服务／bot 包改变，143 个其余文件（含实际前端）与前次已验包相同；[前次冻结清单](../../artifacts/maintenance/v1.0.3/pokemon-bot-variant-20261005/previous-verified-package-manifest.json)保留原哈希。fixture 不冒充自然对局。

[最终同哈希 ZIP 便携验收](../../artifacts/maintenance/v1.0.3/portable/bot-variant-v103-summary-final/results.json)完成全部能力、两种币面、混合三胜大局、回退、重启及服务退出；[最终显示验收](../../artifacts/maintenance/v1.0.3/display/bot-variant-v103-summary-final/results.json)通过六人大厅／36 张牌的 720p–4K、100/125/150% 缩放、暂停、浮窗和独立窗口，保留 44 张实际隐藏渲染截图。第一次候选因版本按钮另起行导致 720p 大厅滚动，失败保留于 `display/bot-variant-v103/`；修正为同排后才验证最终哈希。并行原生 fixture 占用 EXE 的打包失败也保留日志，退出后重新导出。物理手机、Wi-Fi、电视和真实多屏未重新认证；原版火箭群像缺口仍按既有记录保留。

## 1.0.3：电力公司真实 UI 试玩与第二轮优化（2026-10-05）

按用户明确版本指示导出 **v1.0.3**。试玩 agent 使用两个独立真人座位类型的手机身份（由 agent 通过实际 UI 操作）与一个默认人机，普通节奏走完第一轮并进入第二轮；没有读取隐藏牌堆、他人现金或数据库作决定。[基线试玩](../../artifacts/maintenance/v1.0.2/power-grid-agent-review-20261005/phone-play/review.md)保留 27 张截图、几何与退出证明，发现采购按钮埋在价阶下方、跨大阶段深滚动、重复市场入口和候选区域未映射地图四项 P2。逐份跨价、明确建城费用、发电默认最大合法供电及主动少供电都正常，未复现启动后仍默认 0 城，未据源码猜测修改发电逻辑。[多维度结论](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/review-summary.json)区分决策、操作效率、短屏、地图、隐私与未测边界。

优化将手机采购与仓储放到完整价阶前，合并同名市场入口；新大阶段回到页首，同阶段保存保留阅读位置及手动展开。选区草稿在本人棋盘／清晰地图联动，查看不提交。短屏建城先显示所有公司公开网络；地图道路与费用底片分层，房屋按城市加轻底座，当前公司与选中城市采用不同强调。采购短手机收起插画但保留厂号、耗料、供电及仓位。规则、数据、权限、存档和策略版本未改变，没有新增路线／选城建议或服务端字段。源码行为见 [交互](../games/power-grid/interaction.md#v103-试玩后的操作优化) 与 [地图](../games/power-grid/map.md)。

[返修真实试玩](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/phone-play/review.md)通过 5 项，保留 21 张截图：320×568 首购按钮下沿 **551.33px**；390×844 混燃煤／油按钮下沿 **648.27／745.85px**，均完整首屏。两次购买分别保持 scrollY 150／200，大阶段切换归零；候选地图查看、切换及关闭发送游戏动作 0 次，确认才提交。两玩家实际购料、建城和供电 1 城，收入 22 E。该试玩对应当时已加载构建，随后地图绘制层级另行返修，最终包由下述同哈希检查认证。独立逐图审查在第二轮发现后绘道路穿过费用数字；返修后的 [854×480 六人图](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/power-grid/map-layer-final-6/host-clear-map.png)通过静态审查，结论不扩大到点击或整局。

最终 [冻结交付清单](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/delivery-manifest.json) **40,443,579 字节**，实际解压 **145 文件／94,945,348 字节**，95 MB 工程预算余 **54,652 字节**，两项严格低于 100,000,000 字节。SHA-256：`661bbf7fef4470355027dc4ab00eea3190b4637c793906d902021ed9be785f87`；[当时清单](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/delivery-manifest.json)与 [冻结清单](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/delivery-manifest.json)一致；未在便携通过后重新打包。

[同包记录](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/results.json)绑定以下结果及各结果哈希：

| 范围                 | 实际验证                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 完整六人混合局与恢复 | [15 项检查](../../artifacts/maintenance/v1.0.3/power-grid/runtime/portable/v103-play-review-final/results.json)，367.95 秒；三个独立手机身份、真实三档 Worker，完整终局、秘密现金、逐次保存、暂停、回退、旧动作拒绝、SQLite 重启、手机房主再玩与跨游戏身份／样式。重放 1,098 个动作、验证 1,125 个状态。本局 STEP 1 直接进入 STEP 3，未把 STEP 2 记为本局覆盖；规则未变及先前 STEP 2 证据保留。 |
| 原生显示             | 同上报告含 22 个实际隐藏窗口布局与 22 个浮层检查，覆盖 720p／1080p／4K、界面 100／125／150% 和模拟 Windows 125／150% 密度，查看及设置不改变对局。                                                                                                                                                                                                                                               |
| 三端规则             | [9 项](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/rules/v103-final-rules/results.json)，42.40 秒；六组原创图解、本地资源、章节导航、关闭／Esc 焦点和查看不保存。                                                                                                                                                                                                        |
| 原生安全             | [10 项](../../artifacts/maintenance/v1.0.3/webview2/v103-final-safety-accepted/results.json)，实际 ZIP 解压程序；私有凭证、桥接角色／路由／子框架校验、重复启动、服务／父进程崩溃和 Job Object 清理。                                                                                                                                                                                           |
| 源组件人数矩阵       | [2–6 人／472 布局](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/ui-matrix.json)，每人数 15 交互／5 声音调用检查；854×480 至 4K、320／360／390 手机、密集网络、长城名、价阶、收益及手动展开。最终六人增加道路先于费用牌的防回归断言，27.52 秒通过。合法 fixture 不替代真实服务。                                                                                           |

[类型／Lint／格式](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/static-final.log)通过；44 文件／310 项源码测试经相关重跑全部通过。首次 [检查](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/check.log)为 309 通过、1 个头像测试因随机监听端口被 fetch 报 `bad port` 失败；该文件未修改，[单独 3 项重跑](../../artifacts/maintenance/v1.0.3/power-grid-play-review-20261005/avatar-retry.log)通过。320px 竞拍出口首屏退化及打包时构建 EXE 正在试玩占用的失败记录保留；返修布局和试玩退出后才重新导出。规则、原生与整局验证均关闭自己的窗口，完整局关闭后服务不可达。

非阻断限制：320px 地图部分区域标签可能被视图／缩放控件盖住，候选正文仍显示完整名称；完成采购在该短屏需要略下滚。agent 普通试玩仅一轮，整局验证采用测试节奏并另外抽查普通 UI／Worker；本机 WebView2／浏览器与模拟密度不等于实体手机、Wi-Fi、电视、物理多屏或人耳试听认证。当前包延续 v1.0.2 三游戏功能，历史 13 组全应用回归不冒充 v1.0.3 新执行。旧包及本轮临时资源按预览清理，实际结果见 [瘦身记录](project-slimming.md)。

[交付／文档检查](../../artifacts/maintenance/v1.0.3/power-grid-v103-final-passed/project-checks.json)通过 64 份 Markdown、1,359 个本地链接、267 个章节锚点及实际包门禁；首次发现三处历史下载入口，按各自原哈希改指既有退役记录和冻结清单，不把它们指到新包。原失败保留于独立证据名。

## 1.0.2：合并深度检查与项目瘦身（2026-10-05）

确认宝可梦及现代艺术对话均已完成并提交后，对三游戏合并工作区执行检查，沿用 **v1.0.2**。修复地图视图偏好在手机断点切换时丢失、1080×800 六人大厅底部座位超出首屏，以及 150% 缩放短屏终局中长昵称使再玩入口遮住现代艺术资产。前两项保留现有身份／规则，终局收起市场价格拆分说明，保留每幅收益和行情入口；不缩小信息字号。

服务生产压缩仅作用于生成代码，开发源码保留可读形式，原素材及用户指定 WAV 保持原字节。当时 [运行 ZIP（已退役）](../../artifacts/maintenance/v1.0.2/full-audit-20261005/TableMax-1.0.2-win-x64.zip.retired.json) **40,442,642 字节**，实际解压 **145 文件／94,941,528 字节**，95 MB 预算余 **58,472 字节**，双 100 MB 硬门禁通过。SHA-256：`7b013ad0b9da74b862469bfddeecba36e0955672565c43bfc22d265a47cd5c68`；[冻结验收清单](../../artifacts/maintenance/v1.0.2/full-audit-20261005/delivery-manifest.json)保留逐文件记录，原通过结论仍归属此旧包。

[同包完整记录](../../artifacts/maintenance/v1.0.2/full-audit-20261005/results.json)保存 13 组通过结果的稳定副本及原结果 SHA-256：

| 范围       | 实际检查与证据                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 宝可梦     | 包内 Node、实际 WebView2 与完整小局／大局；身份、秘密投影与已保存声画。另有 48 个手机操作栏、36 个授权选择布局、3 项音频与 9 项效果源组件检查。                     |
| 现代艺术   | 五人四轮、176 个合法动作、8 项保密／并发／断网／回退恢复与身份切换检查，305.50 秒；长昵称终局实际截图复核。                                                         |
| 电力公司   | 六人完整局、13 项检查、STEP 1／2／3，1,161 个保存状态校验与 1,117 次动作重放，466.02 秒；三档真实 Worker。                                                          |
| 盒子与聚会 | 上传头像、座位授权、原子切换与三游戏头像 6 项／19 布局；六席围桌、三档人机、手机身份与续局 7 项；网卡地址、加入重试、重启及故障诊断 10 项。                         |
| 显示与规则 | 电脑 720p–4K、两窗口独立缩放和恢复，44 张显示截图；三游戏顶层规则 27 项，关闭焦点与查看不改变对局。电力公司独立显示 22 布局／22 浮窗。                              |
| 结算布局   | 最终同包三／四／五人结算及终局 96 布局／2,102 断言，164.92 秒；此前瘦身包全阶段 411 布局通过，保留当时包归属。地图源组件 96 布局／12 交互／5 声音检查含跨断点偏好。 |
| 原生与声音 | 私有凭证、路由／框架拒绝、重复启动、崩溃／Job Object 清理 10 项；全屏与 F11／菜单／Esc 5 项；现代艺术到时音、静音、暂停、刷新不补播与到时继续操作 9 项。            |

合并源码 [类型／Lint／格式及 44 文件／310 测试](../../artifacts/maintenance/v1.0.2/full-audit-20261005/check.log)通过，修复后的类型／相关 Lint／格式检查通过；本地文档文件与章节、中文路径以及包门禁由 [项目检查](../../artifacts/maintenance/v1.0.2/full-audit-20261005/project-checks.json)核验。清理保护回归通过 **200 项**、自动维护 **34 项**、截图 **19 项**、显式退役 **19 项**及无损压缩 **15 项**。压缩夹具改为兼容 Windows 自带 PowerShell 的随机数 API，并将新工具证据独立保存，避免覆盖旧记录。

首轮隐藏头像副本误选、窄大厅和长昵称终局失败及对应返修日志保留在 [专项目录](../../artifacts/maintenance/v1.0.2/full-audit-20261005/)。测试器未把失败改记通过；原生／服务退出在通过记录中核验。手机、DPI 与电视仍为本机 Chromium／WebView2 模拟，未声称实体手机、物理多显示器或人耳试听认证；局域网地址检查不等于 Wi-Fi 跨硬件认证，未修改防火墙。

完整检查通过后按本次授权进行旧包、已结束验证副本、重复截图与废弃缓存清理，逐文件哈希及实际容量／压缩结果统一见 [瘦身执行记录](project-slimming.md#执行结果)。已保留旧包中的独有源码／素材、原清单、失败结论和独有图片。宝可梦火箭队新配图仍有 [既有缺口](../tasks/README.md#宝可梦火箭队配图缺口)，当前旧图继续随程序提供。

## 1.0.2：电力公司界面与原创规则图解（2026-10-05）

沿用 **1.0.2**，完成四条完整燃料价阶、逐份采购与混燃共仓摘要、公司概览与详情、按阶段默认展开且保留手动展开、棋盘／清晰地图和独立收益浮卡。地图仍为经典德国修正版 42 城／六区／83 边，缩放、拖动、选城和建设确认沿用既有流程；房屋用六种颜色与稳定符号区分，不增加路线或选城辅助。收益复用完整收入表和纯生产计算，排除已启动厂的重复运行，结合剩余库存、已产生电力与城市上限；本人未提交选择只出现在本人手机。规格见 [交互](../games/power-grid/interaction.md) 与 [地图](../games/power-grid/map.md)。

八章导航改用六组原创规则图解，准确数字／箭头／价阶／城位由 HTML／SVG 和现有数据绘制；新增燃料及木屋透明 WebP 共 **223,148 字节**，厂景复用既有图集。行政阶段抽到第三步牌时最后一次仍用第二步补给，项目解释单列；旧截图、原 PNG 及历史证据保留。完整提示词、哈希和导入核验见 [资源](../games/power-grid/assets.md) 与 [清单](../../assets/games/power-grid/manifest.json)。

本次固定 [运行 ZIP（已退役）](../../artifacts/maintenance/v1.0.2/power-grid-polish-20261005/delivery/TableMax-1.0.2-win-x64.zip.retired.json)为 **40,500,050 字节**，实际解压 **145 文件／95,582,607 字节**，双 100 MB 硬门禁通过；95 MB 工程预算超 **582,607 字节**，如实保留为体积限制。SHA-256：`0741a3931b497b677e621e4ac29b5303823cd01d4d1b6ef45d2ff507d366cc26`；[固定逐文件清单](../../artifacts/maintenance/v1.0.2/power-grid-polish-20261005/delivery/TableMax-1.0.2-win-x64-manifest.json)与当时共享 ZIP 同哈希，原副本当时用于固定本次验证版本，现已按本次授权退役。包从当时共享工作区构建，本节验证范围为电力公司；其他任务源码与历史验收保留。

[最终人数矩阵](../../artifacts/maintenance/v1.0.2/power-grid-polish-20261005/ui-matrix.json)通过 **2–6 人／472 布局**，各人数 12 项交互、5 项声音检查；覆盖 854×480 至 4K、320／360／390 宽手机、密集网络、长城名、完整价阶库存、摘要及手动展开、双地图视图、hover／聚焦／固定／手机收益与查看不发送动作。最终六人矩阵耗时 **40.14 秒**，[地图专项](../../artifacts/maintenance/v1.0.2/power-grid-polish-20261005/power-grid/map-final/results.json)耗时 **32.13 秒**。[独立逐图审查](../../artifacts/maintenance/v1.0.2/power-grid-polish-20261005/visual-review.json)记录燃料、规则、收益和密集地图的实际截图、修正及主 agent 裁定，不扩大为实机交互证明。

[源码真实服务](../../artifacts/maintenance/v1.0.2/power-grid/runtime/development/pg-polish-source-complete/results.json)通过整局、三步、现金投影、逐次动作保存、回退、SQLite／Worker 重启恢复、终局、手机房主再玩与跨游戏身份／样式隔离，耗时 **442.16 秒**，核验 **1111 次规则重放**。同一最终 ZIP 的 [完整对局恢复](../../artifacts/maintenance/v1.0.2/power-grid/runtime/portable/pg-polish-package-complete/results.json)通过，耗时 **419.69 秒**、**1101 次规则重放**；该自然局观察第一、第三步，第二步另由源码整局覆盖。最终 ZIP 的 [原生显示](../../artifacts/maintenance/v1.0.2/power-grid/runtime/portable/pg-polish-display-accepted/results.json)通过 **22 组窗口／DPI 与浮层检查（51.66 秒）**，记录 720p／1080p／4K、界面 100／125／150% 和模拟 Windows 125／150% 的实际几何，显示查看不改变状态。测试关闭各自原生窗口并确认服务不可达。

最终 ZIP 的 [规则验收](../../artifacts/maintenance/v1.0.2/power-grid-polish-20261005/rules/rules-portable-final/results.json)通过 **9 项（52.67 秒）**：三端六组图解、背景图集本地解码、章节定位、关闭／Esc 焦点返回及保存不变。类型、Lint、Prettier、diff 检查与 **44 文件／310 项测试**通过，含 7 项收益纯计算边界测试（0 城、20+ 城、混燃、不重复运行、少供电及私密选择）。旧验证器依赖逐份圆点和固定截图数量的断言已替换为价阶余量及六组图解语义；早期布局失败、过时首屏断言和悬停预览阻挡自动化点击的失败证据均保留，整体失败不记作通过。浏览器／后台原生窗口及模拟密度不等于真实手机、电视、物理 DPI 或真人听音验收；本轮仅回环地址，未改防火墙。

收尾 [release 清理](../../artifacts/maintenance/cleanup-history/records/20261004-183802-280-releases.json)保留当前 ZIP／清单并删除四个已完成打包目录（约 **0.86 GiB**）；[全库维护](../../artifacts/maintenance/cleanup-history/records/20261004-184146-225-maintenance.json)清掉 **53 个安全候选／19.684 GiB**，剩余 **49.887 GiB**。安全候选已耗尽，原始资料、原图、正式存档、历史截图、依赖与缓存继续保留，未扩大清理范围。固定交付副本与当时共享 ZIP 哈希复核一致；本轮已保留记录并退役旧包。

## 1.0.2：宝可梦声画与手机优化（2026-10-05）

完成关键保存事件短全屏、普通动作局部轨迹与精灵主题点缀、手机四列顶栏及右侧固定取消列、八个用户 WAV 的映射和双槽声音调度。取消仅清除本地选牌；喷火龙公共演出不泄漏私看位置。手机静音，测试模式关闭装饰声画，减少动态、暂停／断线／回退／恢复及播放权交接沿用权限和清理边界。协议、规则、存档及版本号不变，行为和来源见 [交互](../games/pokemon-encounters/interaction.md)及 [资源](../games/pokemon-encounters/assets.md)。火箭队透明三人新图未完成：一次内置生成被 `moderation_blocked / other` 拒绝，官方替代检索未找到完整匹配；旧图保留，缺口见 [任务索引](../tasks/README.md#宝可梦火箭队配图缺口)。

本任务保存的 [共享运行 ZIP 固定副本（已退役）](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-delivery/TableMax-1.0.2-win-x64.zip.retired.json)为 **40,499,662 字节**，实际解压 **145 文件／95,581,336 字节**，配套 [清单](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-delivery/TableMax-1.0.2-win-x64-manifest.json)；SHA-256：`d8882770c1ab2aa4bcfcc43355cc2b374a487edeec4f29f289208f7e69e48d0d`。超过 95 MB 工程预算 **581,336 字节**，ZIP 与实际解压均严格小于 100,000,000 字节。共享 releases 会被其他任务继续更新，固定副本用于绑定本次结果，不覆盖其他任务新包；其中八个用户音源均匹配本次来源哈希。该包包含当时共享源码的其他改动，本节只认证宝可梦及下述跨窗口检查，不替代其他游戏的独立验收。

同一 `d888…` ZIP 的 [真实整局验收](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-runtime/pokemon-polish-shared-final/results.json)通过：六席混合对局、手机本地选择／取消、全部五种能力阶段、两种币面、结果、回退、两次启动恢复与服务退出，零外站请求、零页面错误。[声音交接验收](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-runtime/experience-portable/results.json)通过 4 组：真实公共屏优先、管理员接替、跨窗口事件去重、六独立手机与房主权限。均为隐藏 WebView2 和 Chromium 视口模拟、回环网络；不声明实体手机、Safari、硬件 DPI、局域网或真人听感通过。

为不混入其他聊天正在开发的源码，本次另外构建一次 HEAD `e20a89a` 加本任务改动的 [独立运行 ZIP（已退役）](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated-delivery/TableMax-1.0.2-win-x64.zip.retired.json)：**40,789,996 字节／解压 142 文件、95,808,982 字节**，超过工程预算 **808,982 字节**，双硬门禁通过，SHA-256 `eb983992f2c7084c2a8af4583073b2c5a6dd7d44f86fc5972ab52f3b6771f7df`。[独立整局](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated/portable/pokemon-polish-final-03/results.json)及 [交接](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated/experience-portable/results.json)均通过；独立构建的类型、Lint、格式与 [41 文件／297 项测试](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated-tests.log)通过（130.74 秒）。原共享工作区和现代艺术／桌面／电力公司改动保持原样。

[真实 PokemonScreen 手机专项](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/layout/isolated-layout-final/report.json)通过 **48 个顶栏场景、36 个选位栏布局、38 个合法规则命令**，覆盖 320／360／390／430px、短屏／横屏、长昵称、连接／断线、全屏可用／不可用、普通玩家菜单及测试模式。共享源码的首次横屏失败与修正结果分别保留。[特效专项](../../artifacts/maintenance/v1.0.2/effects/pokemon-polish-fixed-20261005/results.json)通过 **9 组**，包括真实动画启动、共同赢家、连续相同币面、减少动态和喷火龙私看投影；首次轨迹端点受暂持牌动画移动影响的失败记录保留。[音效专项](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/audio/development-01/results.json)通过 **3 组**：八 WAV 解码、六类别取牌映射、双槽并行、1200ms 币面同步及清理／不补播，两段原 WAV 哈希一致。其播放权限由 fixture 提供，真实交接仅以上述便携结果认证。

整局脚本首次被过时的“牌桌管理”按钮名阻断，第二次误用游戏内“菜单”定位大厅；确认实际大厅“管理设置”后仅修订测试驱动，取消定位更新为完整可访问名称，增加独立 `--evidence` 目录。失败与成功输出均保留，不因此重建 ZIP。两段用户要求不处理的音频保留原字节；六段精灵声的处理参数、原件和核验详见资源表，合成再生成会保留用户素材记录。

本任务验证进程已退出，独立工作区已归档并保存源码快照，正式 ZIP／清单及证据已复制回主工作区。[releases 清理预览](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/releases-preview.log)发现三个打包目录候选；收尾只读检查先后发现其他工程运行窗口，因此延期 Apply，不结束其他任务进程。后置 [全库维护预览](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/maintenance-preview.log)计量为 **40,346,391,653 逻辑字节／37.576 GiB**，因共享当前 ZIP 再次更新后缺少匹配哈希的便携通过记录而被工具门禁阻止，零删除，不为达到 4 GiB 扩大清理范围。原始素材、原图、历史证据和其他任务当前包保持原位。

## 1.0.2：现代艺术优化（2026-10-05）

沿用 **1.0.2** 更新行情历史／本轮价值拆分、五画家总量徽章、Daniel 梅紫识别、辅助提示轮播、紧凑收藏与手机摘要、图形座号、五类拍卖主题、合法双拍呼吸虚线，以及不显示秒数的提醒进度条。规则帮助使用九张原创逻辑场景和代码排版的准确规则；原图和旧截图保留。原生窗口全屏控制与网页状态同步属于本次共同修改，游戏协议、存档和采用规则版本保持不变。

最终 [运行 ZIP（已退役）](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/final-release/TableMax-1.0.2-win-x64.zip.retired.json)为 **39,928,133 字节**，实际解压 **143 文件／94,852,920 字节**，95 MB 工程预算余 **147,080 字节**，双 100 MB 硬门禁通过；SHA-256：`29c09c1de2db60d6cd33d627b56122dd13c5092719a02c6c8e1fa762371886d2`。[包记录](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/package-final.json)及 [逐文件清单](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/final-release/TableMax-1.0.2-win-x64-manifest.json)对应同一包。其他聊天正在修改宝可梦／电力公司，当前交付使用 [隔离构建快照](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/build-snapshot.json)：HEAD 基线加本次现代艺术及原生全屏源码，保留其他聊天工作但不混入本包。[隔离构建](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/build-isolated.log)与 [打包日志](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/package-isolated.log)保留实际执行记录。

同一 `29c09…` ZIP 的 [规则验收](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/rules/portable-final-02/results.json)通过 **9 项／9 张截图／33.66 秒**：九图本地解码、三端及九组尺寸／密度、章节定位、焦点恢复和保存状态不变。[到时声音验收](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio/portable-timer-final-02/results.json)通过 **9 项／41.06 秒**：17 个 WAV 原生解码、一次提醒、暂停、静音消耗、重复零采样／刷新不补播及到时后仍可合法竞价。实际 WebView2 播放事件不等于真人听感或实体手机扬声器验证。九图 **288,028 字节**加提醒音 **16,364 字节**共 **304,392 字节**，满足 370 KB 生产资源预算；提示词、原图与哈希见 [素材证据](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/imagegen/evidence.json)及游戏资源清单。

同一 `29c09…` ZIP 的 [结算／终局 UI 矩阵](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/ui-v2/portable-lifecycle-final-02/results.json)通过 **96 布局／96 截图／2,102 断言／204.23 秒**，覆盖三／四／五人、720p 至 4K、125%／150% 密度和短手机，包含底部冠军及现金可达性；逐一核对全部 143 个解压文件。[全屏包完整性](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/fullscreen-portable-integrity-final-02/results.json)将同哈希 ZIP 与实际运行的解压目录绑定；该目录的 [隐藏原生全屏](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/fullscreen-portable-final-02/results.json)通过 **5 项**，以及 [普通窗口前台全屏](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/fullscreen-portable-foreground-final-02/results.json)通过 **4 项**，核对网页按钮、F11、菜单同步、Escape 浮窗优先、原窗口尺寸与最大化恢复、两窗口独立状态。尺寸与密度模拟不等于实体手机、硬件 DPI 或多显示器验收；本轮网络为回环地址，未修改防火墙。

同一 `29c09…` ZIP 的 [五人完整对局及恢复验收](../../artifacts/maintenance/v1.0.2/modern-art-audit-20261004/runtime/modern-polish-final-04/results.json)通过 **143 个合法动作／四轮／81 张截图／230.97 秒**：冠军首屏及再玩、并发暗标保密、公开旧价拒绝、独立手机身份断网、回退／SQLite 重启、房主授权与两游戏切换后五身份保留、主题 CSS 隔离；测试桌面已关闭，服务不再可达。[最终原生桥接安全检查](../../artifacts/maintenance/v1.0.2/webview2/safety-portable-final-02/results.json)通过 **10 项**，绑定同一最终包哈希。

[隔离类型检查](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/typecheck-isolated.log)、[Lint](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/lint-isolated.log)及 [6 项相关测试](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/tests-isolated-focused.log)通过；此前 [42 文件／285 项测试](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/tests-source.log)通过（87.07 秒），保留当时源码验证范围。[source-06 失败结果](../../artifacts/maintenance/v1.0.2/modern-art-audit-20261004/runtime/modern-polish-source-06/results.json)继续保留：四轮流程完成后两条本地 WAV 的导航／停止取消被测试器记为 `net::ERR_ABORTED`，不将其整体记为通过。随后仅修订测试器对同源已知 WAV 的明确停止／导航取消分类，生产播放实现未因此修改；上述 `final-04` 重新验收通过，该次未发生 WAV 取消。

旧 `04e28ddfc9f047b2e5e44dcc6a16d420ce5bc9bd7ab19744e504c93879a20d02` 包的 [完整 UI 矩阵](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/ui-v2/portable-final/results.json)通过 **411 布局／423 截图／12,353 断言／583.08 秒**；该包的 [规则](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/rules/portable-final/results.json)与 [声音](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio/portable-timer-final/results.json)结果保持历史归属，不作为最终 `29c09…` 包全矩阵通过结论。

本次测试进程全部退出后，[releases 清理预览](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/releases-preview-final.log)核对保留当前 ZIP／清单，发现两个旧打包目录候选共 **459,560,533 字节**。其他聊天的宝可梦隔离验证仍运行 `TableMax.exe`（PID 13200），触发工具全局进程保护，故延期 Apply，零删除，不结束其他聊天进程。收尾维护仅执行 [只读预览](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/maintenance-preview-final.log)，不将 releases 记为已经只剩两个文件，也不为达到容量目标扩大清理范围；功能与本次提交不因跨聊天清理延期而改记未验收。

共享 `artifacts/releases/` 随后被其他聊天更新；本节的固定 ZIP／清单副本逐字节匹配已验收 `29c09…` 包，不将后续共享目录中的新包自动视为本节验证产物。

## 1.0.2：盒子 debug（2026-10-04）

按用户批准计划完成座位移除与人机改名、外层生命周期操作、原子结束并切换、上传裁剪头像、状态徽章、图标与两种设置界面、游戏特异人机说明。管理员及手机房主的权限边界、结束后移除生成准备大厅、头像同事务保存和宝可梦无计时分别更新在 [平台规格](phase-02-platform-spec.md)、[工程结构](architecture.md)及 [人机规格](bot-players.md)。版本沿用 **1.0.2**，不推送。

最终 [运行 ZIP（已退役）](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/previous-release/TableMax-1.0.2-win-x64.zip.retired.json)为 **40,030,975 字节**，实际解压 **137 文件／94,928,396 字节**，95 MB 工程预算余 **71,604 字节**，双 100 MB 硬门禁通过。SHA-256：`467e841f18717c11176aa23ae940b21ccf44f46a190c7fe1eec44d124b7ab35c`。只生成一次最终 ZIP，实际解压逐文件大小与哈希匹配 [清单](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/previous-release/TableMax-1.0.2-win-x64-manifest.json)；上一 `e665…` 包和清单保留在 `artifacts/maintenance/v1.0.2/box-debug-20261004/previous-release/`，原有历史结论仍归属原包。

最终 [40 文件／279 项测试](../../artifacts/maintenance/v1.0.2/box-debug-20261004/tests-final.log)通过（90.95 秒），覆盖权限／撤权／迟到动作、结束移除恢复、加载与保存失败、跨实例丢确认重试、规范 PNG／CRC／尺寸与伪装输入、实际 SQLite 图片／身份／journal 回滚、重复图片、重启和入座重试。类型、Lint、格式及构建通过，日志位于同一证据目录。首轮旧宝可梦计时断言失败已按新要求修订；早期界面驱动错误和 720p 间距失败保留原结果，成功复测不覆盖失败记录。

[盒子开发验收](../../artifacts/maintenance/v1.0.2/box-debug-20261004/development-06/results.json)通过（18.23 秒）：实际隐藏 WebView2 核验上传预览／取消／拖动／缩放、房主改名／移除、结束后新大厅、进行中提示和原子切换、三款实际牌桌头像、320／360／390px 手机、720p 至 4K 和 125%／150% 设置界面。完整 [显示矩阵](../../artifacts/maintenance/v1.0.2/box-debug-20261004/display/development-02/results.json)通过，六真人牌桌、四分辨率、两窗口独立保存及重启、原生桥接与密度模拟共 44 张截图。模拟密度与手机窗口不代表实体手机或物理多显示器验收；本次网络均为回环地址，未修改防火墙。

同一 `467e…` ZIP 的 [盒子便携验收](../../artifacts/maintenance/v1.0.2/box-debug-20261004/portable-final/results.json)通过（24.33 秒），使用系统 PATH、包内 Node 和实际解压资源；[完整便携显示矩阵](../../artifacts/maintenance/v1.0.2/box-debug-20261004/display/portable-final/results.json)通过，含实际桌面重启、六真人牌桌及 44 张截图。两项结果均记录最终包 SHA-256，关闭后各自退出测试桌面与服务。修改文档的 [本地链接](../../artifacts/maintenance/v1.0.2/box-debug-20261004/doc-links.json)存在性检查通过。

releases 清理已预览唯一打包中间目录 **229,911,685 字节**。首次自动审批因发现运行中解压版程序而拒绝；[只读路径审计](../../artifacts/maintenance/v1.0.2/box-debug-20261004/cleanup-process-audit.json)证明该程序在 D 盘、工程与候选目录无进程后允许重试，但 [清理脚本自身保护](../../artifacts/maintenance/v1.0.2/box-debug-20261004/releases-apply.log)仍因用户运行中的 TableMax 拒绝，零删除。等待用户关闭程序或明确暂缓，未绕过保护；当前 ZIP、清单与历史程序继续保留。

[收尾维护](../../artifacts/maintenance/v1.0.2/box-debug-20261004/maintenance.log)同样返回 `blocked`／零删除；只读预览为 **0 安全候选、13,900,833,475 字节（12.946 GiB 逻辑字节）**。不为达到 4 GiB 扩大范围。功能交付完成，程序运行期间的清理单独待处理。

## 1.0.2：本地重新导出与 releases 清理（2026-10-04）

按用户要求沿用 **1.0.2** 重新导出当前本地 Windows 包，本次不改游戏实现。日常本地导出只提供程序 ZIP 和逐文件清单，源码 ZIP 仅在用户明确要求发布 GitHub 时导出；本轮未生成或向 releases 复制源码 ZIP。

当时 [Windows ZIP（已退役）](../../artifacts/maintenance/v1.0.2/box-debug-20261004/previous-release/TableMax-1.0.2-win-x64.zip.retired.json)为 **40,023,501 字节**，实际解压 **136 文件／94,899,866 字节**，95 MB 工程预算余 **100,134 字节**，双 100 MB 硬门禁通过。SHA-256：`e6656e8d08b9fc1afa2242400844175e793637081635fe45bd41ce368d6b6fe6`；[逐文件清单](../../artifacts/maintenance/v1.0.2/box-debug-20261004/previous-release/TableMax-1.0.2-win-x64-manifest.json)与该包配套。最终 [打包记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-run.json)为 **16.488 秒／exit 0**。首次外层 PowerShell 日志包装器触发 `NativeCommandError`，未写完成记录，[失败日志](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-wrapper-failed.log)及 [记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-wrapper-failed.json)保留；修正外层记录后成功，不将其归为产品构建错误。

[包对比](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-audit.json)核对上一 `7801…` 包：135 文件大小与 SHA-256 相同，无新增或删项；只有重新构建的 `TableMax.exe` 哈希不同，大小仍为 **183,808 字节**。该比较确定变化文件，尚未逐字节定位 EXE 内部差异，不能据此断言只变了 Git 编译标记。旧程序与清单保留在 `reexport-20261004/before/`，完整电力公司验收见 [历史记录](../archive/acceptance-2026-10-01-to-04.md#102电力公司-debug横向地图价区与声画2026-10-04)。

新哈希的 [便携启动检查](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/portable-startup/results.json)通过，**12.217 秒**：全部 136 解压文件匹配清单，仅系统 PATH 下使用包内 Node，隐藏真实 WebView2 渲染与 `127.0.0.1` 回环服务返回 200；关闭后服务不可达，记录 `closed: true`。这是本次包内容与启动验证；旧完整对局、媒体和规则结果仍归属历史 `7801…` 包，没有机械重跑完整游戏矩阵，也不将旧通过结论改记为新包通过。

`KeepLatestOnly` 工具 [最终检查](../../artifacts/maintenance/v1.0.2/reexport-20261004/tools/completion.json)通过 **194 项／45.21 秒**手动测试与 **34 项／15.34 秒**自动维护测试，独立只读审查通过。此模式仅处理 `artifacts/releases` 直属项，核对当前便携通过记录与配套清单后保留当前程序 ZIP／清单，沿用全部路径、链接、嵌套仓库、进程、近期、指纹和互斥保护；其他手动模式及自动维护不混用。

首次清理预览因实际启动证明的原文件名不是 `results.json` 而被门禁拒绝，未发生删除，[拒绝记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/cleanup-preview-first.json)保留。随后将该通过结果逐字节一致地保存为上述规范入口，在打包／验证进程全部退出后，以相同 `-KeepLatestOnly -MinimumAgeMinutes 0` 先预览、再 Apply，路径与内容检查仍全部执行。[实际清理](../../artifacts/maintenance/cleanup-history/records/20261004-141732-483-releases.json)通过，**15.957 秒／554,455,887 字节**，耗时见 [执行记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/cleanup-run.json)：删除两个本次打包目录各 **229,846,976 字节**，及旧同版解压目录 **94,761,935 字节**。`releases` 恰保留新 ZIP **40,023,501 字节**与配套清单 **23,743 字节**，两文件在删除前后均核对路径、大小、时间与 SHA-256；其他历史证据、素材与正式存档保持原位。

本轮启动检查自建的隔离副本另按精确名单预览后 [回收](../../artifacts/maintenance/cleanup-history/records/20261004-141851-055-intermediates.json) **107,657,726 字节**，未纳入既有 `tmp/` 内容。后置全项目 `Maintain-Project.ps1 -Apply` 因最新用户限定 releases 而被自动审批拒绝，未执行；改为 [只读收尾检查](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/maintenance-run.json)，结果为 **0 安全候选／零删除**，工作区 **15,109,256,634 字节（14.072 GiB 逻辑字节）**，未为达到 4 GiB 扩大范围。

## 历史截图去重（2026-10-04）

用户进一步授权适当清理 `artifacts/` 历史内容，包括不再需要的验收截图。本次只处理旧 v1.0.0／v1.0.1 中与保留 PNG 大小和 SHA-256 完全一致的副本；独有截图、正文直接引用图、素材来源、JSON／日志、原存档及历史程序包继续保留。旧结果中引用的退役 PNG 不再占第二份空间，其同字节保留位置可从 [逐文件清单](../../artifacts/maintenance/v1.0.2/history-tidy-20261004/duplicate-screenshots.json)查询；原验收结论不因本次清理改写。

新增手动清单模式在实际操作前通过 18 项专用保护检查及既有 **194 项手动／34 项自动维护回归**，不扩大默认或自动清理范围；收尾补充父级嵌套仓库保护并复测，专用检查最终为 [19 项](../../artifacts/maintenance/v1.0.2/history-tidy-20261004/tests/results.json)。相同参数先预览、后 Apply，保持默认 30 分钟近期保护；[实际清理报告](../../artifacts/maintenance/cleanup-history/records/20261004-144015-137-intermediates.json)为 **137 组／3,230 文件／2,480,203,343 字节（2.31 GiB）**，零跳过，执行 **199.07 秒**。操作仅删除显式 PNG，不递归删除父目录，记录每张副本的原路径、哈希与保留位置。

[清理后完整性复核](../../artifacts/maintenance/v1.0.2/history-tidy-20261004/integrity-results.json)通过：全部 3,230 个选中副本已移除，**1,467 个对应保留 PNG**逐 SHA-256 与原副本相同；受影响目录的结果／日志及当前 ZIP／清单合 **172 文件**与清理前逐字节一致。当前运行包仍是上节 `e665…`，未修改游戏实现、版本号或重新导出源码。

工程进程退出后的 [安全收尾维护](../../artifacts/maintenance/v1.0.2/history-tidy-20261004/maintenance-apply.log)为 `no-candidates`／零额外删除，工作区约 **11.77 GiB 逻辑字节**；保留资料仍超过容量阈值，不为达到 4 GiB 扩大删除。文档检查与范围见 [本轮检查](../../artifacts/maintenance/v1.0.2/history-tidy-20261004/doc-checks.json)。

## 本地项目整理与瘦身（2026-10-04）

本节记录本次重新导出前的 `7801…` 包与项目整理结果，保持当时产物及已完成事实。

按用户要求审计跟踪文件、历史程序包、中间物与文档入口。当前说明按主题维护，阶段／旧 Electron／旧版本开发记录移入开发历史，原验收正文、失败、哈希与证据保留；旧章节用短转链维持引用。文档格式、本地文件／锚点和索引覆盖检查通过，具体结果见 [文档检查](../../artifacts/maintenance/v1.0.2/project-tidy-20261004/root/doc-checks.json)。没有修改游戏实现、版本号或当前便携包，用户原有两处 Node／防火墙新增仍独立保留。

经预览和安全门禁清理既有打包／构建／隔离验证中间物，以及电力公司音频验收中七个精确解压／浏览器副本，共 **9,400,359,939 字节（8.75 GiB）**。音频的 39 个 SQLite、源码、截图与结果文件逐 SHA-256 核验未变；原素材、正式存档、历史截图／原交付包、依赖与缓存继续保留。[审计与取舍](../../artifacts/maintenance/v1.0.2/project-tidy-20261004/audit/audit-summary.md)记录未采用的清理候选。`build/` 已删除，从源码启动需先 `pnpm build`。新增手动精确副本入口不扩大自动维护范围，[工具检查](../../artifacts/maintenance/v1.0.2/project-tidy-20261004/tool/completion.json)为最终 **146 项／57.50 秒**及 **34 项／13.99 秒**，并通过独立只读审查。

[透明压缩](../../artifacts/maintenance/workspace-compression-20261004-133502-884/compression.json)检查 389 个候选、压缩 387 个，逐文件内容哈希一致，额外节省 **51,484,496 字节实际分配**，59.06 秒；不将该节省计入 ZIP 门禁。[压缩后隐藏原生启动](../../artifacts/maintenance/v1.0.2/project-tidy-20261004/root/compression-runtime-smoke.json)在当前 `7801…` ZIP 上检查全部 136 文件、实际 WebView2 与回环服务，11.51 秒，并确认退出；仅为启动检查，不替代已有完整对局验收。这次检查自身的隔离目录在确认退出后单独回收。

[收尾维护](../../artifacts/maintenance/v1.0.2/project-tidy-20261004/root/final-maintenance.json)仍为 `no-candidates`，剩余约 **14.032 GiB 逻辑字节**，主要由历史证据和保留资料占用；不为达到 4 GiB 扩大删除范围。以上阶段分别记录实际耗时，不相加冒充总任务时间。

## 历史验收导航

以下保留原标题锚点，旧引用仍可定位；详细结论移入唯一历史正文。

## 1.0.2：电力公司 debug，横向地图、价区与声画（2026-10-04）

见 [原始验收记录](../archive/acceptance-2026-10-01-to-04.md#102电力公司-debug横向地图价区与声画2026-10-04)。

## 1.0.2：通用视觉、规则说明与项目瘦身（2026-10-04）

[原始结论与证据](../archive/acceptance-2026-10-01-to-04.md#102通用视觉规则说明与项目瘦身2026-10-04)。

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