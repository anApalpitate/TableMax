# 验证范围与证据

本页维护检查范围、证明要求、失败阈值和证据复用；具体脚本参数见[测试工具](../../tools/test/README.md)，实际交付和未测边界只在[验收](acceptance.md#当前源码与本地交付)维护。历史标题保留为导航，不据旧命令中的版本词推定当前产物。

## 阿瓦隆专项构建与验证

经典2012原版接入平台5–10人，现行新局只用 `configured` 人数配置，旧 `classic`／`court` 仅恢复原局，见[游戏主题](../games/avalon/README.md)。独立构建 `node tools/build/build.mjs --only=game:avalon`；单测 `node tools/test/runner/test-scoped.mjs --scope=game:avalon`仅选本游戏规则、策略、UI与实际服务／Worker项。涉及共享调度、目录或恢复时按实际依赖增加 `shared` 范围，不因其他未提交改动增加游戏项。范围隔离工具单独运行 `node --test tools/test/runner/scopes.test.mjs`。

`node tools/test/games/avalon/verify-avalon.mjs --executable=<实际解压的TableMax.exe> --zip=<匹配EXE的内部payload.zip> --seats=6 --variant=configured --only=all --evidence=<安全独立名称>` 启动实际隐藏WinForms／WebView2及包内Socket／SQLite服务，显式监听127.0.0.1，使用隔离 `tmp/game-review-<六位随机后缀>`。`--seats=5|6|7|8|9|10`，现行新局使用 `--variant=configured`；`classic`／`court` 仅用于对应历史实际程序；`--only=layout|success|failure|rejections|assassination|long-quest|all` 定向选择三端布局、三成功梅林幸存、三失败、五否决及梅林遇刺流程。`long-quest` 额外按成功／失败交替推进五次任务后刺杀，检查五张已结算任务牌；`all` 保留原四种终局。终局通过真实合法动作进入，不改写秘密存档；首项身份确认、表决、任务及刺杀用实际UI按钮核验，`success` 另含提名及暂停／回退。

人数与阶段计划通过 `node tools/test/runner/test-scoped.mjs --scope=game:avalon --plan=<计划JSON>` 排序运行，沿用[统一失败阈值](#历史通过率与失败阈值)与不自动重试。`artifacts/avalon/validation/portable-plan.json` 和 `grid-final-plan.json` 是历史参数记录；重新执行时先核对实际 EXE、匹配载荷及当前配置，复制计划到新名称并更新路径、玩法和证据名，不能直接沿用旧 `court` 参数，历史临时目录可能已安全退役。验证包括实际提取成员前后哈希、公开秘密边界、保存／暂停／回退、320px—4K与横屏、图文规则、正确事件全屏特效／减少动态、12条本地音频解码、真实播放调用和原生单窗口播放权、刷新不重播。最窄玩家画面以实际 `documentElement.clientWidth` 断言横向溢出，并检查终局；不以包含滚动条的 `innerWidth` 放宽边界。原生物理输出始终静音，隔离数据中的音频偏好只用于观察调用，不修改日常设置；不把模拟手机、DPI或解码／播放调用作为实体手机、LAN或真人听感认证。实际证据与原失败见[阿瓦隆验证](../games/avalon/validation-scenarios.md)。

原双版本／离线导入的阿瓦隆验证方法见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md#阿瓦隆旧双版本验证)，不作为当前完整安装器要求。

## UNO 专项构建与验证

新增游戏通过模块清单发现，独立构建 `node tools/build/build.mjs --only=game:uno`；单测入口 `node tools/test/runner/test-scoped.mjs --scope=game:uno`，只选择 UNO 规则、策略、UI 与 UNO 服务／Worker 测试。范围隔离工具变化另运行 `node --test tools/test/runner/scopes.test.mjs`，不启动其他游戏。实际结果与设备边界见 [UNO 验证](../games/uno/validation-scenarios.md)。

`node tools/test/games/uno/verify-uno.mjs --mode=ui --seats=6 --executable=<实际解压的TableMax.exe> --zip=<匹配EXE的内部payload.zip> --evidence=<安全独立名称>` 在实际隐藏 WinForms／WebView2 核验三端、秘密、完整108牌场景、图文规则、触控和保存声画；`--only=opening,dense,reverse,skip,draw-two,wild,draw-four,uno,challenge,round-finish,match-finish` 选择受影响项。`--compact` 只做320px／720p，`--landscape` 定向844×390；`--sample` 只取初始样本，不能代替完整 UI。普通节奏和减少动态分别核验，原生物理静音。

v1.0.6 交互专项：`--layout-only --only=dense` 保留三种手机尺寸及720p—4K主机／公共屏矩阵，支持 `--seats=2|3|4|6`，核验叠牌暴露宽度、浮球与整个中央状态区的避让。`--hand-interactions` 增加可信触摸长按、非法牌调位、横滑隔离、边缘滚动／取消、摸牌追加、稳定DOM、排行榜同分、刷新和回退；整理期间核验无游戏命令及声画。`--legacy-executable=<保留的v1.0.5程序>` 先由旧程序加载并保存对局与显示设置，再由当前程序恢复，不能将新夹具单独冒称旧版自然对局。仅游戏UI改变时不重跑规则或自然完整比赛；模拟手机、缩放及机器音频不等同实体设备／人耳验收。

同一入口 `--mode=runtime --seats=2|4|6` 推进自然500分比赛、下一小局与真正退出／重启 Native；包内32MiB Worker只收到本人授权信息，服务端bot走原统一动作流程。每次选择新证据名，保留原失败和包哈希。首次完整检查后只返验实际变化；若最终仅条件 CSS 改变，使用实际成员等价证明复用未受影响组件，旧报告仍对应旧 ZIP。运行前后核验全部程序成员，监听固定为127.0.0.1，不改玩家声音偏好、系统 DPI 或防火墙。

运行与依赖按[锁定环境](build-and-run.md#环境与依赖)准备；旧Corepack缓存处理仅保留为[历史方法](../archive/tooling-delivery-organization-2026-10-15.md#旧corepack环境处理)，不能据旧成功改变全局环境。

## 拉密专项构建与验证

经典版 2–4 人只选择 `game:rummikub` 范围；实际动作契约影响共享层时另选 `shared` 的精确文件，不展开其他游戏矩阵。首次针对规则、完整回合、草稿、真实服务及实际 Worker 检查后，仅重跑修改或失败相关项；完整大局耗时与每次决定的两秒／32MiB 限制分别记录。来源及边界见[拉密验证](../games/rummikub/validation-scenarios.md)。

`node tools/test/games/rummikub/verify-rummikub-ui.mjs --executable=<实际解压的TableMax.exe> --evidence=<安全独立名称>` 在真实生产程序的合法 106 牌 SQLite 场景核验三端、草稿、导航、尺寸、图文规则和小局／大局结果；`--only=opening,reorganization,finish,finish-final` 可选择所需场景，`--navigation-only --rack-size=30` 专查大牌架。`--skip-verified` 仅供本轮已通过项的接续，不能替代首次完整检查。测试静音、隐藏窗口、仅监听 `127.0.0.1`；模拟视口不能记为实体手机验收。

`node tools/test/games/rummikub/verify-rummikub-runtime.mjs --evidence=<安全独立名称>` 默认只生成并静态检查测量脚本，显式加 `--run` 才启动实际包。运行入口核对当前 ZIP／逐文件清单，使用包内 Node、原字节服务／规则／三档 Worker及真实 Socket／SQLite推进自然完整大局、下一局和重启续局；只读 preload 采样实际服务／Worker 堆，报告明确标注观测边界，不用 Native 的绝对 private bytes 代替服务堆。可用 `--seats=2,3,4` 定向未完成人数；单次决定两秒不放宽。实际 Native／UI 检查单独绑定同包证据。

需要测量渲染堆与应用进程增量时，给 UI 验证进程设置独立 `TABLEMAX_BUDGET_TRACE` 目录及 `TABLEMAX_BUDGET_GAME=rummikub`，沿用现有只读采样；盒子首样本、完整页／iframe 堆、服务 private 和本应用进程树分别记量。无权限或缺样本不能写零值通过；额外窗口及导航缓存的增量不称为游戏净分配。正式打包与清理仍使用下文统一入口。

## 扫码与直接打开入口验证（2026-10-08）

`node tools/test/platform/verify-connection-entry.mjs --sha256=<当前ZIP哈希> --evidence=<独立名称>` 解压并核验实际包，检查二维码与“打开网站”使用同一当前根网址、局域网／外部入口切换、窄屏排版和键盘操作。原生窗口只接受当前顶层邀请链接的真实用户点击；验证模式记录系统浏览器目标，普通浏览器实际新窗口继续入座、准备及游戏返回，不向新页传递管理员凭证或桥接。

`node tools/test/desktop/verify-player-display.mjs --visual-audit --game=<游戏id> --evidence=<独立名称> --sha256=<当前ZIP哈希>` 通过真实服务与合法动作审查三端、关键阶段和规则／菜单浮窗；可用 `--audit-phase=<阶段>` 定向补验，原版使用 `--variant=original`，最少人数使用 `--audit-min`。完整显示矩阵与远程故障入口继续使用下节命令。全部隐藏、静音、仅监听127.0.0.1；候选包与最终包报告分别绑定各自SHA，不将旧模块检查改标为新包通过。

## 玩家横屏与滚动条验证（2026-10-08）

`node tools/test/desktop/verify-player-display.mjs --source --quick --evidence=<名称>` 用已构建源码进行静音隐藏窗口与实际浏览器快查；完整实际包检查用 `--sha256=<当前ZIP哈希> --evidence=<名称>`，不加 `--source/--quick`。只监听 `127.0.0.1`，临时目录沿用已审计的 `tmp/debug-portable-<六位后缀>`，证据在 `artifacts/maintenance/v1.0.4/player-display/`。检查四变体合法最少／最多真人、关键阶段、真实授权动作、宽度边界、CSS视口／密度、设备识别、偏好、键盘、浮窗、高对比和切换草稿；不宣称实体手机或物理DPI通过。截图仅等待已加载图片，屏外懒加载规则图不会阻塞探针。

同包根入口用 `tools/test/platform/verify-root-entry.mjs --sha256=<哈希> --evidence=<名称>`；远程故障用 `tools/test/platform/verify-debug-remote.mjs --sha256=<哈希> --evidence=<名称> --scenario=all`，后者在本机HTTPS非标准端口代理下实际切换玩家模式，再检查禁WebSocket、丢推送／确认、断线、冻结恢复、WSS与换机。只保存版本与操作摘要，不记录凭证或秘密载荷。实际结果及未测范围见[验收](acceptance.md)。

2026-10-08显示修订：桌面竖屏宽390–480px、9:20理想比例；横屏16px上下边距及96px总横向留白，因此外层1055／1056、1295／1296分别检查子文档960／1200边界。玩家显示验收还断言按钮不占顶部行、电厂图集内部方形、地图定位下拉仅管理员、玩家地皮进度仅行动页；现代艺术短屏同时检查拍品、价格及主要操作实际可见，双拍也包含在内。完整盒子继续检查超长昵称全部可读和卡片不重叠。电力公司独立夹具须加载正式网页的共享scrollbars.css，Chromium检查10px圆角伪元素而非要求标准scrollbar-color覆盖；地图最小0.64后按实际抽屉遮挡判断目标可见，不强求每次选城都触发避让标记。

## 根加入入口与研究重设计验证（2026-10-08）

默认分享网址与二维码使用网站根地址，`/player` 及 `/player/game` 保留兼容；根页面属于玩家，不能取得管理员或原生桥接权限。`node tools/test/platform/verify-root-entry.mjs --sha256=<冻结包SHA256> --evidence=<独立名>` 审核实际 ZIP 全部成员、HTTP／HTTPS 非标准端口根入口真实 UI 入座／准备／刷新、旧路由与身份权限；证据在 `artifacts/maintenance/v1.0.4/root-entry/`。代理仅监听 `127.0.0.1`，不配置真实穿透服务。

`node tools/test/platform/verify-debug-20261007.mjs --phases-only --expansion-only --max-first --evidence=<独立名>` 从实际包推进扩展最少／最多人数合法阶段，检查 320／360／390／430、1023／1024、720p、1080p及4K的 CSS 几何，保留玩家、主机与公共屏截图及全部30研究参考卡。六人场景包含长昵称，按合法取牌／存牌动作逐步填满六个缓冲，再合法取出本人缓冲强制换入；检查空缓冲及1–6张占牌的完整视口边界、16px文字、实际图片解码及各玩家九格不侵入相邻场地。每个实际放入状态另查320×568首排三目标及位置编号完整可见，包含特殊牌能力说明和强制来源；存入按钮检查18px单行文字。这条受控动作路径不是普通模式体验测量。`--max-first`只调整验证顺序；`--placement-only`只做六人首个放入场景的诊断，不替代完整验收。完整默认矩阵另回归原版及其他游戏。`--evidence` 仅接受独立安全名称，避免覆盖旧同版本验收。

`node tools/test/games/pokemon-encounters/verify-pokemon-expansion-play.mjs --portable --sha256=<同一包SHA256> --evidence=<独立名>` 通过实际生产玩家子文档控件与真实默认 Worker，检查研究详情不提交投票、单弃顶、本人缓冲存入／取出／强制换入、保存确认与最新渲染版本；普通模式仍默认静音。根入口的 HTTPS 丢推送、丢同步／动作确认、WSS、执行暂停和换机另由 `verify-debug-remote.mjs --sha256=<同一包SHA256> --evidence=<独立名>` 检查。隐藏浏览器与代理等价情形不能代表实体手机、真实樱花隧道、公网证书、物理 Windows DPI、真人听感或新任务平衡测量。

`node tools/test/games/pokemon-encounters/verify-pokemon-expansion-awards.mjs --portable --sha256=<实际EXE的SHA256> --evidence=<独立名>` 补查v3稀有结算：实际包规则执行最后一笔合法动作并验证状态，实际包客户端与共享运行时展示R23折半、R24暗行逐牌折半、共同赢家及每位赢家一胜，在320／390px和主机／公共屏检查明细。这是受控结算组件夹具，不是服务端完整对局，也不代替普通模式、真实存档或平衡测量；报告按当前版本保存在 `artifacts/maintenance/v<版本>/pokemon-expansion-awards/`。本地头像／角色图片须实际解码。

## 10.7 浏览器玩家与穿透恢复验证（v1.0.3）

本标题保留历史锚点。旧版本与当时输出位置见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md#浏览器玩家验证的旧版本口径)。现行验证核对实际冻结输入与逐成员清单；DOM断言来自稳定同源子文档，外层只用于窗口尺寸与实际截图。

运行 `node tools/test/platform/verify-debug-20261007.mjs` 检查当前实际运行 ZIP：隐藏原生 WebView2、静音 Edge、真人授权投影及仅监听 `127.0.0.1` 的 HTTP／HTTPS 代理。默认检查各版本最少／最多人数、1023／1024px、720p、1080p、4K、125%／150%模拟像素密度和手机视口；`--phases-only` 通过合法动作推进关键阶段／结算，`--drafts-only` 检查数量、选城和卡槽草稿，`--mixed-only` 用真实 Worker 人机并以管理员暂停固定验收版本，`--connection-only` 单独检查丢推送、断线、换机批准及二维码配置。当前证据在 `artifacts/maintenance/v1.0.4/debug-20261008/portable/`，凭证不输出到报告。网页根节点仅提供公开的 instance／branch／revision 属性，断言实际渲染版本，不以连接标记替代。

`--finals-only` 从管理员投影取得下一轮动作，完成最大人数的现代艺术四轮和扩展三胜终局；`--density-only` 可只补查125%／150%模拟像素密度。HTTPS 代理证书仅在隔离目录生成；验证器使用本机 OpenSSL 3.4.1，并传入自己的配置，不安装证书或修改全局环境。模拟像素密度及隐藏浏览器不能替代实体手机、现场穿透软件、物理 Windows DPI 与真人听感。`node tools/test/platform/verify-debug-recovery.mjs` 另查丢确认、执行暂停恢复和 WSS 升级，核对交付清单哈希和全部解压成员；各报告分别说明证明范围。

`node tools/test/platform/verify-debug-remote.mjs --sha256=<当前包SHA256>` 增补 HTTPS 非标准端口根入口的 polling／WSS 双向实际操作，丢推送、同步 ACK、动作 ACK、原动作编号去重、断线与玩家子文档执行暂停恢复，以及真实管理员换机入口。CDP Debugger 暂停实际玩家 Frame，以暂停前后计时差分证明其停止执行；恢复时不合成前台事件、不刷新页面。这是执行暂停模拟，不是实体手机锁屏验收。代理、证书和存档均隔离在仓库内并只监听 127.0.0.1；不访问示例穿透站点、不配置隧道或安装证书。`--self-test` 只核验滤包，`--preflight-only` 只核验包，均不等同于产品连接验收。

`node tools/test/box/verify-box-layout.mjs --sha256=<当前包SHA256> --evidence=<本轮名称>` 从同一运行包检查盒子四种游戏版本、主机／公共／未入座玩家／已入座房主及关键浮窗，输出实际截图、字体／溢出／裁剪／操作可达结果。原生窗口记录实际 CSS 尺寸、缩放和模拟密度，不能把请求的物理窗口大小直接当作 CSS 视口；电脑玩家外层尺寸与内层手机区域分别检查。自动几何检查后人工复核代表截图，竖排标题等虽无溢出仍需修正。

日常使用：电脑管理员的“连接帮助”可保存外部 HTTP(S) 根地址、IP／域名及端口，也兼容旧 `/player` 地址；局域网和外部默认分享／二维码均使用根地址，旧玩家路由继续可用，清空后恢复网卡入口。网址保存在数据目录的 `network-settings.json`，与 checkpoint 分离。樱花等穿透软件仍由用户映射实际服务端口；TableMax 不自动配置隧道，不支持 `/tablemax/` 路径前缀。换设备时在未入座盒子申请原真人座位，电脑管理员在管理设置核对六位码后批准。

本轮 Windows 沙箱曾使 pnpm dependency junction 的 realpath 返回 EPERM，导致 TypeScript 出现依赖类型缺失的误报；沙箱多 worker 的临时转换和 SQLite rename 也受限。使用获准的项目内直接 Node 入口执行相同只读检查及隔离测试，未修改依赖版本或全局配置；失败日志与后续真实检查分开保留。

## 宝可梦三胜大局与叫声续验（2026-10-06）

`node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-matches.mjs --seeds=4 --evidence=match-run` 使用真实扩展规则与策略模拟2–6人完整三胜大局。两人对每个种子作六种配对／座位反转，3–6人作三次循环档位轮换；每座独立策略随机源，检查授权知识、守恒、规则RNG和输入不变，逐小局走下一局生命周期。结果包含精确源码前后哈希、每轮计分／胜场和档位暴露。`node tools/analysis/games/pokemon-encounters/analyze-pokemon-expansion-matches.mjs 路径/report.json` 重算三胜终点和每种子完整配对，按人数以整种子块作10,000次描述重采样。四种子是探索样本，不能保证普遍强度顺序。运行期间保持测量依赖源码不变；CPU／自动化时间不作真人节奏证据。

`node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-flow.mjs <独立证据名>` 补充2–6人各一个固定种子的混合档位三胜大局，结果在 `artifacts/maintenance/v1.0.2/pokemon-expansion-flow-audit/<证据名>/report.json`。仅在独立测量进程串行安装观察钩子，原规则结果原样返回，成功或异常退出均恢复钩子；不修改既有完整对照测量器或生产规则／策略。统计按同一小局内的牌身份追踪盖回，行交换不误算盖回，阿尔宙斯同一步盖回再翻明计零动作间隔闭环，结算用 `preReveal` 排除强制揭牌；离场与结算未翻明分别记为中断／未闭环。公开统计不含暗牌身份或分值，延迟单位是已保存游戏动作数，不能视作回合数、秒数或全人数强度重复认证。纯观察器边界检查用 `node --test tools/analysis/games/pokemon-encounters/pokemon-expansion-flow-observer.test.mjs`；测量期间冻结其全部输入，检查源码前后哈希和逐牌盖回事件守恒。

`node tools/test/games/pokemon-encounters/verify-pokemon-expansion.mjs --portable` 对当前ZIP实际解压并运行隐藏WebView2，新增27项本地叫声哈希／单声道／时长／非静音解码检查，保留八项原创主题和原有流程／显示。`node tools/test/games/pokemon-encounters/verify-pokemon-expansion-play.mjs --portable --evidence=normal-run` 通过正式普通模式控件和真实默认Worker完成小局，观察主机 `HTMLMediaElement.play` 及 `playing` 事件，要求至少一个新增叫声实际播放；解码／播放观测均不是真人试听认证。每次使用独立证据名，后台只监听127.0.0.1。叫声原件与派生编码依据见[资源页](../games/pokemon-encounters/assets.md#续建素材与反馈2026-10-06)，同包边界见[验收](acceptance.md)。

扩展集成的四席三胜完整大局使用十分钟整场测试上限，仍限制3,000步、每次真实32MiB Worker两秒截止。原三分钟两次超时记录保留；其中一次在330条日志、第五局开局时存档约1.7GB，合法对局仍推进，不能把整场超时认定为单次Worker超限。四席最多九小局，历史／SQLite工作也计入整场耗时；放宽整场测试边界不等于证明存档长期增长有界，实际耗时另记结果。

共享工作区有其他任务改动时从明确提交的隔离工作树构建；其他任务完成提交后可快进接续基线，不复制尚未完成内容。工作树本地依赖通过 `pnpm install --offline --frozen-lockfile --store-dir E:/Proj/TableMax/.pnpm-store --package-import-method copy` 复用仓库缓存并生成独立依赖副本；无需全局安装。归档工具返回成功不等于恢复已验证：本轮恢复旧 `pokemon-expansion-forecast` 工作树实际返回“snapshot is missing”，源码已在Git提交、包和冻结清单已另保留；新建 `pokemon-expansion-matches` 工作树接续，完整计划期间保留为活动工作树，不能宣称旧快照可恢复。

## 宝可梦引导与动漫切入验证（2026-10-05）

本轮沿用v1.0.3。相关单测用 `pnpm exec vitest run games/pokemon-encounters/shared games/pokemon-encounters/ui games/pokemon-encounters/rules games/pokemon-encounters/bot/memory.test.ts --testTimeout=120000`，72项通过；120秒是整局集成测试容限，不放宽32MiB Worker两秒硬截止。策略专项13项通过，未重复此前耗时的三级整局统计。`node tools/test/games/pokemon-encounters/verify-pokemon-original-compatibility.mjs --reference=219ae95d165974a35a738d49fb175f5fe8acbcd5 --evidence=pokemon-guidance-cutin-20261005` 从Git实际读取基线规则及shared／variants，固定随机源比较2–6人完整状态、合法动作、计分及投影，仅排除本轮新增派生 `publicMatchedColumns`。

`node tools/test/games/pokemon-encounters/verify-pokemon-polish.mjs --evidence=guidance-cutin-v103-final` 使用真实PokemonScreen和合法规则状态，48顶栏／36操作栏通过，另检查详情章节只读定位和手机切入安全区。新引导短屏允许自然滚动，检查按钮滚动后可达和无遮挡。`verify-pokemon-effects.mjs --evidence=guidance-cutin-v103` 9组检查分开记录实际animationstart、CSS时间线0%／45%采样与TTL；`verify-pokemon-audio.mjs --evidence=guidance-cutin-v103` 4组核验八WAV解码／播放、双槽及1200ms同步，原音频从已保留source-originals核对哈希，外部D盘目录当前不可用。解码及播放调用不称为真人试听。

初次运行曾遇到整局测试超过默认5秒、旧首屏操作栏假设不适用于可见引导、fixture始终换同一格而未结束，以及外部音源目录不可达。分别采用整局适用测试容限、显式自然滚动核验、合法优先换暗格的fixture驱动和已有原始素材哈希；未改玩法、字号或音源内容规避失败。最终证据和包边界见 [验收](acceptance.md)，视觉分析见 [游戏验证](../games/pokemon-encounters/validation-scenarios.md#游玩过程视觉审查2026-10-05)。

2026-10-05 宝可梦人机／复用专项：`node tools/test/games/pokemon-encounters/verify-pokemon-original-compatibility.mjs --reference=1b3930cae9ffa66c480a26b69e4cbf6f6ac59827` 在固定随机源下比较重构前后的真实规则模块，覆盖 2–6 人完整小局／大局、合法动作、状态、计分及全部授权投影。未传 reference 时使用当前 HEAD，提交后复查本轮应显式传上述基线；只读取本地 Git，不联网。`node tools/test/games/pokemon-encounters/verify-pokemon-version.mjs` 用实际 BoxScreen 及样式检查三个端的只读版本面板和资源懒加载。源码策略固定种子统计、真实 Worker、最终 ZIP 与显示证据见当前验收；整局测试总时限与单次 Worker 两秒硬截止分开。原生 fixture 退出后再构建，避免占用 `build/desktop/TableMax.exe`。

当前桌面依赖与游戏组装边界见[架构](architecture.md)，实际产品、游戏覆盖和设备未测范围见[验收](acceptance.md#当前源码与本地交付)。

本页只维护当前运行、检查和本地维护方法；阶段结果、旧版本命令及 Electron 证据集中在 [开发与验证历史](../archive/development-2026-10-01-to-04.md)。工程依赖见 [工程结构](architecture.md)，文件归属见 [目录职责](project-structure.md)。

## 独立视觉审查截图

`pnpm verify:game-ui '--only=L6,V00,V00-discard,V03,V04,V05,V06,V07,V08' --evidence=independent-review --review-stages` 为每次提交前的公共屏及当前玩家手机保存带步骤编号的截图；手机另记录滚动到操作牌阵的帧，不覆盖同阶段多次接牌。`capturePage` 继续使用隐藏窗口；仅截图滚动，不修改服务状态。每轮使用新的 `--evidence` 名称，保留修正前后证据。

`pnpm verify:effects --evidence=independent-review-final` 将声画 fixture 截图及结果写入独立子目录，默认入口保持原样。自然对局与效果 fixture 的证明范围不可混用。审查者每图新建、`fork_turns: "none"`，只接收单张图片及中性提示；具体提示、审查边界和证据路由见 [游戏验证场景](../games/pokemon-encounters/validation-scenarios.md#当前界面的独立视觉审查)。

短手机返修加 `--compact-check`：真实手机视口固定为 360×640，在本地选择前及确认前等待有限卡牌动画结束后测量，断言六格牌面／号位、合法牌堆、确认／取消入口均在首屏且可点，不滚动到目标。`L6-mew` 补充六人梦幻：完整牌库排牌后执行原规则的六次首翻、取牌、最后对手第六格及己方第六格，核验五个对手入口；未把场景或全状态端点加入正式服务。公共尺寸和二人结果断言保留，截图与几何在断言前落盘。默认入口仍保留原横屏检查；短屏专项通过不能代替默认流程和最终 ZIP 显示矩阵。

能力 UI 补查可用 `--verify-deal` 检查真实下一小局的发牌动效，`--only` 用逗号选择场景，PowerShell 中为完整参数加引号。参数不命中已知场景时直接失败；卡面、能力 fixture、自然整局和最终 ZIP 的证明范围分别保留。

## 真实命令

### 内容绑定的验收计划（2026-10-11）

统一入口新增version 2计划，version 1和直接Vitest命令保持兼容。先使用`--list`预览；新计划默认复用完整通过证据，`--force`强制执行选中项。`--changes=<文件>`只消费本任务路径及当前SHA-256，不自动读取全部工作区diff；清单为`{"version":1,"files":[{"path":"仓库相对路径","sha256":"当前内容SHA-256"}]}`，已删除路径使用`null`。变化清单过期即停止，不能把其他任务改动记成本任务。

[操作命令唯一入口](../../tools/test/README.md#开发环境操作内容绑定的验收计划2026-10-11)

每项仍明确`id`、`runtime`、`script`和`args`；`runtime`可选node、powershell或vitest。输入用`inputs.files`、`inputs.directories`登记，源码静态依赖自动展开，目录成员增加／删除也改变指纹。动态读取、Worker入口、PowerShell点引入、资源及旧报告必须显式登记；完成依赖审查后才能标记`inputs.complete:true`，缺口项执行但不缓存。`combination`登记游戏、玩法、人数、控制器／难度、种子或局面和验证类别；固定局面、快速自然整局、普通节奏检查点及完整自然整局不能互用。Vitest仅允许准确测试文件及`--testNamePattern=`，保持生命周期和失败统计。Node额外启动参数仅允许`nodeArgs:["--import=tsx"]`或`--test`。

计划先检查范围，再按历史低通过率排序；相同内容、方法、参数与组合合并，报告保留全部选择来源。输出逐项执行／复用／不适用及理由。复用不会增加attempt或通过率分母。Vitest可加入父轮次的累计失败账本；独立脚本仍以命令为一项，不从退出码推算其内部用例统计。达到[统一失败阈值](#历史通过率与失败阈值)后停止派发，保留未执行项；修复后按该节规则新建轮次定向复验，无变化不自动重试；本轮不启用执行并行。

证据索引在`artifacts/maintenance/test-history/evidence/<内容指纹>.json`，运行计划及原始证据在`test-history/runs/<轮次>/`。绑定输入字节、方法与助手代码、参数、Node／OS／架构、声明的环境变量及运行时文件；`environmentProviders`支持实际PowerShell与WebView2版本查询。现行EXE只使用full，自动绑定实际交付、EXE、payload和manifest，并要求WebView2环境绑定；box只供原历史交付。安装候选显式读取candidate交付，不从尚未推广的current推定候选身份。EXE改变重新执行其实际受影响验收，未变且完整绑定的规则／游戏证据可按原范围复用，不能替代新基础程序接入检查。

检查执行前后重核输入。复用前核对全部日志、报告、截图等证据哈希，缺失、失败、未完成、损坏或环境不符均拒绝；`resultFile`可要求本项输出目录中的通过JSON，`evidence`可登记其他精确报告路径，旧文件没有刷新不算本次证据。审计导入只接受原始报告已证明的绑定及原文件SHA，不能以当前字段追补旧方法／环境；目前旧整局缺字段时继续保留原历史结论，不导入自动缓存。

同一EXE会话助手顺序执行相关界面，主机／公共屏／玩家采用独立native partition，并核验Cookie隔离。首次、重启、迁移、异常退出与不同edition仍独立。回环下载夹具使用生产PackageStore和人工签名小包，记录真实接收字节、请求头／正文EOF及安装总耗时；模拟故障、已安装缓存命中和真实线上下载分别记录。源码夹具、隐藏窗口、模拟视口及三个事务注入点不能冒称实体设备、真实磁盘满或完整故障验收。

version 2子检查关闭各自自动维护，父轮结束只尝试一次。多阶段属于同一任务时设置`TABLEMAX_AUTO_MAINTENANCE=0`，最后统一一次既有安全收尾；若已删除，不追加第二轮。当前唯一完整EXE从实际指针／候选记录精确读取适用报告，不扫描历史目录；缓存预览清单由SHA绑定供Apply消费，删除前仍重查进程、路径／链接、锁、引用、近期修改及成员SHA。

### 按变更范围选择检查

2026-10-08 最新要求：仅改盒子只运行盒子项，仅改游戏只允许对应游戏项；测试、检查、构建与优化都按本次实际变化收敛。共享变化列明依赖后选择受影响项，不能依据工作区其他未提交内容扩大范围。规则改动按需检查规则，UI改动按需检查UI；纯文档／配置／素材记录只做格式、链接、配置、来源或解码等适用检查。

`pnpm test -- --scope=box` 或 `node tools/test/runner/test-scoped.mjs --scope=<范围>` 是统一范围入口；`--list` 只列选中／排除／未分类文件，不启动产品。支持 `box`、`game:pokemon-encounters`、`game:modern-art`、`game:power-grid` 和 `shared`，逗号组合仅用于实际受影响的多个范围。可追加准确的 `.test.ts` 文件继续收窄；遗漏范围的宽泛执行会拒绝。直接Vitest命令可指定准确文件，或设置当前进程的 `TABLEMAX_TEST_SCOPE`，配置仍会过滤越界文件。`full` 仅用于本次确实涉及全部范围或明确要求全量验收的任务，不能用于绕过盒子／单游戏限制。

范围归属在 `tools/test/runner/scopes.mjs` 维护，游戏目录归对应游戏，其他测试按实际内容登记：服务端单游戏集成也归游戏；目录元数据和模板夹具可归盒子。混合文件／验证脚本涉及的全部范围必须被允许，不能仅有交集；窄范围排除未分类文件，列单时显示缺口，新增或改变测试覆盖内容须同步登记。独立脚本未知时拒绝窄范围执行，先登记实际范围或加入真实筛选；不能仅向不支持筛选的脚本添加 `--game` 假定矩阵已缩小。

盒子通知专项：`node tools/test/runner/test-scoped.mjs --scope=box apps/web/src/components/notifications/notification-center.test.ts` 检查限额、重复续时、淡出、独立暂停和清理；`tools/test/box/verify-box-notifications.mjs` 登记为box，可纳入独立批次计划。后者使用当前源码构建的盒子与真实入座hook、模拟HTTP拒绝响应，隐藏静音Edge仅监听127.0.0.1；覆盖320px、390px、横屏、桌面与4K、重试入口、原生浮窗、触控尺寸、自动退出及减少动态。证据在 `artifacts/maintenance/v1.0.5/box-notifications/`，不代表实物手机、局域网或便携包验收，隔离副本沿用 `tmp/box-layout-<六位后缀>` 清理边界。

盒子操作稳定专项：`tools/test/box/verify-box-layout.mjs --actions-only --zip=<实际ZIP> --sha256=<包SHA256> --evidence=<唯一名称>`只运行真实入座、添加／删除人机前后几何、提交时手动滚动、存续座位DOM、隔离SQLite保存失败与同动作ID重试，以及主机／公共视频面板。登记为box，不跑全量布局或游戏玩法矩阵；先核验实际解压每个成员，结果沿用 `artifacts/maintenance/v1.0.6/debug-20261008/box/`。仅暂缓测试页真实命令包，未伪造ACK；数据库写锁仅用于当次私有 `tmp/box-layout-*`，finally解除。

独立验证使用 `node tools/test/runner/test-scoped.mjs --scope=<范围> --plan=<计划.json>`；先校验整份计划，再交给独立批次统计，运行后保存 `scope.json`。`verify-rules-guides.mjs --game=<id>` 为对应游戏；`verify-player-display.mjs` 须同时指定 `--game=<id> --visual-audit` 才为单游戏，默认及`--quick`仍包含盒子检查，且不支持`--game=all`。工具机制回归用 `node --test tools/test/runner/scopes.test.mjs`，不启动产品。

[操作命令唯一入口](../../tools/test/README.md#开发环境操作按变更范围选择检查)

### 历史通过率与失败阈值

所选Vitest测试已接入逐项历史统计：通过率为累计通过次数／累计完成次数，同时保存分子、分母与百分比。身份由测试类型、Vitest项目名、仓库相对文件路径及完整组／用例名称组成；独立场景使用稳定且唯一的名称，改名或移文件会形成新身份。范围字段不加入身份，不重置历史。历史库在 `artifacts/maintenance/test-history/history.sqlite`，跨版本及重启保留，不随版本导出或历史截图退役清空，也不进入运行包。每轮明细在同目录的 `runs/<随机运行编号>.json`；SQLite事务保证并发写入与重复回执不会重复计数。

先按改动选择相关测试，文件按其中最低历史通过率排序，文件内按组及用例递归排序，保留 `beforeAll`／`afterAll` 等钩子的原作用域。同通过率保持声明顺序；已失败的0%项优先于未知项，未知项优先于已有通过记录的项。为确保达到阈值后不会抢先启动其他项，本入口串行执行文件和用例，关闭无变化的自动重试。每轮默认累计失败10项即停止派发后续检查，轮报告退出码非零，保留全部旧账本、原始输出和未执行项，转入依据证据修复。阈值是本轮累计失败数，不是历史失败数或连续失败数。2026-10-15用户将默认阈值由3改为5，2026-10-16要求继续上调，现采用10：为同一轮的多个独立检查及修复留出空间，同时保留停止诊断边界。调整不清零原失败，旧阈值下已停止的执行须先修复，再定向复验受影响项，不能借阈值变化直接重试未修复的问题。历史按3或5失败停止的原记录保持原事实。

有实质源码／方法修复或针对失败原因的环境纠正后，记录原因、变更输入及受影响范围，自动建立独立预算的新轮次并定向复验；新轮关联原轮账本和证据，旧失败仍保留在历史及通过率分母中，未执行项继续明确列出。用户已授权范围内不为另开新轮再次询问；确需新增权限时才询问。没有实质变化不得仅换轮次盲重试，不得放宽断言、扩大范围或跨越权限。未受影响且完整绑定的已有证据继续复用，不能重复全套检查来替代定位，也不能省掉受影响的必需验收。

一次完整结束的用例调用计一次，跳过、取消和未开始的用例不计入分母；失败的收集／模块或组生命周期单独记录，不能把未运行的测试正文补记为失败或通过。显式用例 `retry`／`repeat` 的最终调用结果计一次，重试／重复次数另留诊断，不自动添加重试。运行器未捕获的错误留在本轮报告并使本轮失败，不伪造有名称的用例。默认 reporter 与自定义 runner 配套使用，使用CLI自选 reporter 时须同时保留 `tools/test/runner/vitest-history.mjs`。

[操作命令唯一入口](../../tools/test/README.md#开发环境操作历史通过率与失败阈值)

没有逐项结果的旧汇总报告不能推算各项次数，初始未知保持未知；已有逐项Vitest JSON可按上例导入。`TABLEMAX_TEST_HISTORY_DIR` 可将本次隔离统计改到项目内部的独立目录，不能指向项目外部。临时环境变量只作用于当前终端／子进程，不修改系统配置。测试工具回归的实际日志和独立数据库保存在 `artifacts/maintenance/v1.0.4/test-history-verification-20261008/`；首次跨文件回归曾遇到沙箱Vite临时转换文件缺失，改用各自项目内临时目录后通过，原失败日志保留。

独立的 `verify-*.mjs`／PowerShell检查用 `node tools/test/runner/test-scoped.mjs --scope=<范围> --plan=<计划.json>`，先校验整份计划的实际覆盖范围，再交给底层 `test-batch.mjs` 统一记录和排序；`--list` 可预览，真正运行后保存 `scope.json`。计划须明确测试ID、运行器、仓库内脚本及参数数组。每个计划项对应一次独立检查命令，其内部矩阵不能由退出码推算逐场景通过率；需要逐场景排序时应拆成脚本实际支持的独立选项。`verify-rules-guides.mjs --game=<id>` 为对应游戏；`verify-player-display.mjs` 须同时指定 `--game=<id> --visual-audit` 才为单游戏，默认仍检查盒子布局及共享显示，`--quick`也包含盒子。不指定游戏仍属多游戏矩阵。示例盒子计划如下，执行前填入本轮实际包哈希和独立证据名：

[操作命令唯一入口](../../tools/test/README.md#开发环境操作历史通过率与失败阈值)

批次串行、隐藏启动且沿用各脚本默认静音，达到同一失败阈值即停止派发，原始输出／错误／运行明细保存在历史目录的 `runs/<编号>/`。未执行或范围排除项不计次数；非零退出、启动失败及异常结束均为失败。阈值停止后依据证据在已有授权内修复，记录实质变化后自动新建轮次定向复验，不放宽断言或重复全套测试。底层批次API保留给工具夹具，日常执行用上述范围入口；单独验证命令同样必须满足本次范围约束。

### 游戏介绍弹窗布局检查

`node tools/test/platform/verify-game-introduction.mjs --evidence=<独立名称>` 使用真实BoxScreen、GameIntroduction、OverlayPanel及生产样式，在隐藏静音Edge覆盖三端、三游戏／宝可梦原版与扩展版、320–3840px共108布局；额外按实际分包顺序晚加载共用弹窗CSS，避免夹具默认导入顺序掩盖冲突。检查分节顺序、步骤宽度、16px下限、无横向溢出、滚动关闭、Escape恢复焦点与零命令。测试服务仅监听127.0.0.1，输出留在对应版本 `game-introduction/<名称>/`，模拟视口不是实体设备验收。本次同一最终EXE的真实WebView2九布局及导出哈希见[验收](../archive/acceptance-2026-10-05-to-08.md#103游戏介绍弹窗布局修复2026-10-06)。

便携验收器遇到真实人机保存造成的 `stale-revision` 暂停请求时，只对同实例／同分支的暂停意图最多重取版本8次；其他命令不重试，异常原因继续失败。逐次重试计数进入报告，不放宽服务校验或修改规则，首次冲突证据单独保留为 `portable-676f9e75fb19-pause-race`。

宝可梦扩展版普通模式验证：`node tools/test/games/pokemon-encounters/verify-pokemon-expansion-play.mjs --portable --sha256=<实际EXE的SHA256> --evidence=<独立名>` 从当前完整EXE提取载荷到隔离目录，绑定EXE、内部ZIP、manifest与冻结快照的哈希，启动隐藏原生WebView2。开局前通过房主隐藏快捷键切到 `play` 并核验模式；两台独立手机身份点击真实生产控件，第三席采用真实默认Worker。管理设置使用权威Socket动作，不注入游戏状态。手机动作须收到保存成功回执，私看只在本人页面显示，其他手机、公共屏及管理员均无私看投影；记录实际阶段、公开人机动作、截图、页面错误、外部请求及进程退出。自动点击间隔不是真人思考时间，隐藏窗口和触控视口不是实体手机验证。

2026-10-12 v3专项入口均使用 `tools/test/support/shipping-input.mjs` 绑定同一实际完整EXE，不再猜测旧三位ZIP文件名。`verify-pokemon-expansion.mjs --portable --evidence=<独立名>` 检查新局、六事件、单张超梦及真实旧发行恢复；可用 `--legacy-fixture=<实际旧EXE生成的夹具目录>` 指定旧SQLite、checkpoint与不可变发行。受控六事件场景和自然对局分别记录，不能据一次自然事件声称覆盖全部六种。`verify-player-display.mjs --portable --game=pokemon-encounters --variant=expansion --visual-audit --evidence=<独立名>` 仅检查本玩法手机及电脑竖横屏、真实按钮几何和点击命中；模拟缩放与DPI不替代物理设备。`verify-pokemon-expansion-effects.mjs --portable --evidence=<独立名>` 使用同包规则和客户端检查六事件、原版喷火龙／卡比兽入场、路卡利欧画像波导及减少动态；组件夹具技术通过不代表真人美术认可。单游戏构建用 `node tools/build/build.mjs --only=game:pokemon-encounters`，最终完整EXE仍预装全部正式游戏。长任务中设置仅本进程的 `TABLEMAX_AUTO_MAINTENANCE=0`，集中结束后按既有保护入口执行一次维护，避免追加清理。

扩展三档对照用 `node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-continuation.mjs --natural-seeds=24 --strength-seeds=48 --original-seeds=3 --seed-base=616200 --evidence=<独立名>`，保留源码前后哈希、完整合法动作、研究与能力自然频率、座位轮换及封顶。随后 `node tools/analysis/games/pokemon-encounters/analyze-pokemon-expansion-strength.mjs <report.json路径>` 审计结算算术和每个种子三次座位轮换，按完整种子块进行10,000次确定性bootstrap，保留块内相关性；输出同目录 `strength-analysis.json`。95%区间为单项描述区间，未作多重比较调整，只适用这组三人混合对手；不能据模拟CPU或三人样本认证真人时长、所有人数或整场三胜强度。

宝可梦 2026-10-05 声画／手机专项：`node tools/test/games/pokemon-encounters/verify-pokemon-polish.mjs --evidence=名称` 用真实 PokemonScreen 与合法规则状态检查 320–430px、横屏、顶栏及选位栏；`node tools/test/games/pokemon-encounters/verify-pokemon-audio.mjs --evidence=名称` 在隐藏 WebView2 检查八音源解码、固定双槽、保存事件映射和硬币落定同步。后者 fixture 的播放权限桥接只证明表现层，实际公共屏优先与交接由 `pnpm verify:experience --portable` 核验。既有 `pnpm verify:effects --evidence=名称` 已扩展能力短全屏、局部路径、共同赢家、减少动态及私看边界。三种专项都不能代替最终 ZIP、真实网络或人耳试听。

| 命令                                                                   | 行为                                                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                             | 先构建，启动 Vite、原生壳与包内 Node 独立服务；前端热更新，服务与桌面源码修改后重启该命令                                                                                   |
| `pnpm start`                                                           | 运行已有 `build/desktop`；先执行 `pnpm build`                                                                                                                               |
| `pnpm typecheck`                                                       | 严格 TypeScript 检查，不生成文件                                                                                                                                            |
| `pnpm lint`                                                            | ESLint 与 React Hooks 规则检查                                                                                                                                              |
| `pnpm format:check` / `pnpm format`                                    | 检查格式／按项目配置格式化                                                                                                                                                  |
| `pnpm test -- --scope=<范围>`                                          | 先按盒子／对应游戏／实际共享依赖筛选，再执行所选Vitest测试；可追加准确文件或`--list`                                                                                        |
| `pnpm check`                                                           | 全工程聚合入口，仅适合明确全工程核验；测试范围须通过`TABLEMAX_TEST_SCOPE`设置，局部改动分别执行适用检查                                                                     |
| `pnpm build`                                                           | 构建网页、独立服务、游戏模块与 net48 原生壳，收集到 `build/desktop`                                                                                                         |
| `pnpm verify:desktop`                                                  | 隐藏窗口验证开发构建，包括真实大厅、宝可梦六人混合整局、回退、两次启动恢复、独立进程与退出协调                                                                              |
| `pnpm verify:modern-art`                                               | 隐藏原生窗口执行现代艺术五席四轮、五类拍卖与真实手机控件，验证保密、回退／重启及两游戏切换；加 `--portable` 验证匹配的内部payload／历史ZIP                                  |
| `pnpm verify:power-grid --seats=3 --evidence=source-3`                 | 隐藏原生桌面与各自手机、真实 Worker 的电力公司混合整局；`--seats=6` 覆盖六席，`--portable` 验最终同一 ZIP                                                                   |
| `pnpm verify:power-grid-ui --evidence=fixture`                         | 独立实际 React 授权 fixture 的短屏至 4K、320–390 手机、地图操作与保存声音；不替代原生 DPI 或真实整局                                                                        |
| `pnpm verify:party`                                                    | 隐藏窗口验证加入丢回复、真实重启、网卡 IPv4、弱网恢复、原班续局、回退定位和桌面运行保障；可加 `--portable` 验证历史ZIP档案输入                                              |
| `pnpm verify:room-levels`                                              | 隐藏窗口验证手机各自入座、电脑仅管理／展示、六席围桌尺寸与三档人机配置、实际混合小局／续局／重启；可加 `--portable` 验证历史ZIP档案输入                                     |
| `node tools/test/box/verify-box-avatars.mjs`                           | 隐藏窗口核验 26 个本地头像、占用／并发／身份恢复与游戏介绍尺寸；先用 `--compact-only` 检查 360×640 首屏，`--portable` 对应匹配的内部payload／历史ZIP，`--run=名称` 分开证据 |
| `pnpm verify:presentation`                                             | 隐藏窗口验证六真人、游玩／测试时序、浮窗焦点／结束、公开行动及星标；可加 `--portable` 验证历史ZIP档案输入                                                                   |
| `pnpm verify:display`                                                  | 隐藏窗口验证电脑 720p／1080p／1440p／4K、独立缩放、显示浮窗、设置恢复与 DPI；可加 `--portable` 验证匹配的内部payload／历史ZIP，`--box-debug` 独立保存本次盒子证据           |
| `node tools/test/box/verify-box-debug.mjs`                             | 回环服务、隐藏真实 WebView2 检查上传裁剪、房主座位操作、原子切换、三游戏头像、320–390px 手机与电脑设置；`--run=名称` 分开证据，`--portable` 检查匹配的内部payload／历史ZIP  |
| `pnpm verify:experience`                                               | 隐藏窗口验证游戏库按需加载、管理员指定手机房主、并发初始翻牌和准备、连接／显示控件及声音归属；可加 `--portable` 验证历史ZIP档案输入                                         |
| `pnpm verify:effects`                                                  | 后台 WebView2 用实际游戏组件和授权投影 fixture 验证主题、同币面、暗牌交换、零分列、共同赢家和减少动态；不冒充自然对局                                                       |
| `pnpm verify:memory`                                                   | 独立 Node 比较存档复制开销，再用后台 WebView2 执行 20 轮游戏切换的 heap／DOM 回归；可加 `--copy-only` 或 `--desktop-only`                                                   |
| `node tools/test/desktop/verify-shutdown.mjs`                          | 检查关闭窗口、后台进程、DLL占用与删除生成目录后重建；`--native=<隔离编译目录>`仅用于候选壳                                                                                  |
| `node tools/test/desktop/verify-native-safety.mjs --evidence=<独立名>` | 检查桥接拒绝、重复启动、缺运行时、生产 CDP 关闭及服务／父进程崩溃清理                                                                                                       |
| `pnpm verify:game-ui`                                                  | 正式能力／2–6 人保存 fixture 的十五组 UI、多尺寸触控／隐私、已保存动效和声音                                                                                                |
| `pnpm verify:cards`                                                    | 正式六人保存状态的全部 16 类卡面及公共／手机十三种布局、图像／文字／分区几何                                                                                                |
| `pnpm package:win -- --candidate`                                      | 构建预装全部正式游戏与玩法的Windows x64安装候选和本地清单，保留原current；内部payload只供封装／验收，本地不导出发布source ZIP                                               |
| `pnpm verify:portable`                                                 | 历史运行ZIP专用跨层验证，默认读取旧release ZIP；现行完整EXE先运行 `node tools/release/verify-shipping-executable.mjs`，专项按实际支持的载荷参数绑定                         |
| `pnpm prototype:dev`                                                   | 启动独立原型开发服务，入口 `http://127.0.0.1:5174/prototype.html`，不启动正式桌面或本地服务                                                                                 |
| `pnpm prototype:build`                                                 | 使用独立 Vite 配置构建原型到 `artifacts/phase-02/prototype/`                                                                                                                |
| `pnpm prototype:preview`                                               | 预览已有原型构建，入口 `http://127.0.0.1:4174/prototype.html`；先执行原型构建                                                                                               |
| `pnpm prototype:verify:game`                                           | 对游戏原型执行 Playwright／后台 WebView2 能力、角色、恢复、尺寸和动效走查，证据在 `artifacts/phase-02/verification/game/`                                                   |
| `pnpm prototype:verify`                                                | 对已有原型构建运行 Playwright／后台 WebView2 走查，生成 JSON 和截图；先执行原型与桌面构建                                                                                   |

表中保留的旧 `--portable`验证方式须遵守[实际载荷绑定](development.md#两种exe与内部载荷2026-10-11)，表内“匹配的内部payload／历史ZIP”指验证器的档案输入，不是现行用户下载。重新封装当前完整载荷使用 `pnpm package:release`，不传任何edition参数。

服务 CJS 构建使用 esbuild `minify`，随后执行[服务载荷无损压缩](development.md#服务载荷无损压缩2026-10-06)；规则和策略 CJS 使用 `minifyWhitespace`，源码及规则／状态／策略版本保留，`bot-worker.cjs` 保持原构建选项。该构建配置不改变游戏规则，也不以源码或预估字节代替匹配的内部payload／历史ZIP／实际解压双体积核验；当前包与清理结果见验收记录。

### 服务载荷无损压缩（2026-10-06）

`tools/build/service-brotli.mjs` 将生产服务CJS编码为Brotli质量11的 `server.cjs.br`，生成小型 `server.cjs` CommonJS入口；只在精确还原且净节省时接受。启动先核对载荷SHA-256，再以限定输出长度解压、核对原源码长度与SHA-256，最后在当前模块内 `_compile`。不在用户存档、缓存或程序目录落盘还原源码；缺失或损坏载荷直接失败。官方Node PE不压缩、裁剪或升级，Worker和媒体字节不变。

`tools/build/module-build.mjs` 对platform-server与宝可梦人机单元应用该步骤，helper纳入各自指纹，入口和载荷共同进入缓存哈希、冻结和组装；`tools/release/package.mjs` 白名单同时收集两者，游戏载荷预算计入 `bots/pokemon-encounters.cjs.br`。其他游戏人机、规则和媒体保持原构建。相关单测命令为 `node --import tsx --test tools/build/service-brotli.test.mjs tools/build/pokemon-bot-brotli.test.mjs`，覆盖原字节还原、CommonJS路径／exports／require.main、依赖加载、无落盘，以及缺失、载荷损坏、合法压缩但源码哈希错误。宝可梦原版／扩展三档另经实际32MiB生产Worker执行合法决定，保持原2秒取消边界。

早期预算超限与定向压缩过程见[整理归档](../archive/tooling-delivery-organization-2026-10-15.md#早期预算超限与定向压缩)，当前容量结论见[验收](acceptance.md#当前源码与本地交付)。

隔离[实测](../../artifacts/maintenance/v1.0.2/pokemon-expansion-size-continuation/runtime.json)以历史实际解压程序为输入：1,655,164字节服务变为717字节入口＋354,905字节载荷，净省1,299,542字节。隐藏原生窗口经父子私有管道启动包内Node，真实Socket恢复／保存、bot Worker行动和再次重启通过；故障入口不监听端口、不改存档，正常退出后Job关联服务已停止。原始官方Node字节保持一致。

[缓存检查](../../artifacts/maintenance/v1.0.2/pokemon-expansion-size-continuation/cache.json)验证helper输入、两文件清单、再次命中及损坏缓存拒绝。以旧包95,793,403字节推算为94,493,861字节，仅为隔离收益估算；续建素材与代码仍会改变最终大小。最新[同包验收](../../artifacts/maintenance/v1.0.2/pokemon-expansion-continuation-delivery/final-checks.json)已实际核对94,532,267字节解压体积及离线原生运行，95MB余额467,733字节；本隔离测量仅解释服务收益，当前余额未预留完整62帧或3.1MB素材空间。

当前便携包和使用流程见 [项目说明](../../README.md#快速开始)。旧工程验证包与阶段结果见开发归档。

现代艺术自然对局深查可加 `--audit --long-names --seats=5 --evidence=audit-run`，全程保留普通 `play` 节奏；`--seats=3`／`4` 覆盖其他人数，`--portable` 改验当前 ZIP。审计在原有五类拍卖、真实手机控件与恢复断言之外，增加窄屏长昵称、非法金额、暗标并发草稿、旧价确认、排序、倒计时和公开资金账本检查。真实结束页覆盖 720p／1080p／4K 主机与公共屏、320／360 手机，逐字核验完整姓名的布局、裁切与实际命中，不能只凭 DOM 或 title 完整判定可读；最终资产／冠军对应公开账本，有管理权限的主机／手机房主再玩按钮须在首屏完整可用，公共屏则核验没有该控制。每次启动保存实际脚本副本与 SHA-256，失败和返修分开证据目录；截图仍使用后台真实渲染，不将测试提速当作普通对局。

`node tools/test/games/modern-art/verify-modern-art-empty-gallery.mjs --evidence=empty-gallery-run` 定向检查三／四／五位真人入座后的空收藏拍卖布局，使用真实开局、出画、追加同画家第二幅及决策点回退；不直接写游戏状态。单幅／双幅、主机／公共屏分别覆盖 720p／1080p／4K 和 100%／125%／150% 显示请求，记录空间保护后的实际 CSS 尺寸与缩放；加 `--portable` 验证当前 ZIP。先用 `--short-only` 检查最短桌面，`--scale-only` 仅补 4K 125%／150%，两者互斥，默认运行完整矩阵。它只证明这些真实准备场景的排版，不能替代自然四轮整局、资金账本或恢复验证。

`node tools/test/games/modern-art/verify-modern-art-debug.mjs --seats=5 --run=debug-run` 使用合法隔离示例局检查现代艺术选画无倒计时、行情文字、纵向两列画廊、规则四图及关闭焦点恢复，模拟其他手机两次加价并核验原金额控件、草稿和焦点保留。`--seats=4` 检查四人，`--portable` 检查当前实际解压 ZIP；源运行加 `--capture-rules` 保存四个实际区域 PNG，随后用 `python tools/assets/rules/compress-rule-captures.py --game=modern-art` 生成并逐像素核验无损 WebP，保留原 PNG。更新配图后同步游戏资源清单与图文卡片，再构建和验收。

`node tools/test/games/modern-art/verify-modern-art-audio.mjs --evidence=audio-run` 检查真实桌面归属、盒子重进、手机手势解锁、刷新不补播、独立静音及 WAV 解码／媒体播放。`--entrances-only` 专查五种实际上拍的声音、全屏特效、刷新、测试及减少动态；`--reentry-only` 只验重进，`--portable` 改验当前 ZIP。每次选择新的安全证据名，源与便携结果在 `artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio/` 分开；播放观测不等于实体手机自动播放政策或真人试听认证。以上本机检查全部显式监听回环并隔离存档。

电力公司原接入验证在 `artifacts/maintenance/v1.0.1/power-grid/` 分别保存 `ui/` 的组件 fixture 与 `runtime/` 的自然混合局、恢复和最终便携证据。整局测试可采用平台测试节奏，但每个动作仍经过身份、合法动作、SQLite 与真实 Worker；普通游玩节奏另取真实保存动作样本，不能将提速局写成全程普通节奏。SQLite 审计在隔离数据上逐 checkpoint／随机源重放，核对电厂分区、燃料和资金，公开报告不导出隐藏现金或牌堆。所有本机启动显式使用 127.0.0.1 与随机端口。新工作区包加入后执行冻结锁文件离线安装以建立本地依赖链接，仅更新 lockfile 不足以保证 React 构建解析。

`node tools/test/games/power-grid/verify-power-grid-audio.mjs --portable --maintenance=power-grid-debug-20261004 --evidence=<独立名>` 在真实隐藏原生 WebView2 与包内运行时检查六种保存结果。准备器只从本游戏合法规则和两真人对局取得隔离 checkpoint，真实 Socket 动作写入 SQLite 后检查原生 `claimEvent` 单一归属、原 `HTMLMediaElement.play` 返回与 `onplaying`、WAV 解码及有限 FX 帧；不伪造反馈或直接调用音效冒充保存。还核验公共屏优先／主机回退、普通同步、刷新、盒子重进、暂停恢复、静音与测试模式不补播。省略 `--portable` 使用当前构建；`--prepare-only` 只预检合法素材和 checkpoint，不能写成原生播放通过。结果在 `artifacts/maintenance/v1.0.2/<维护名>/native-audio/<名称>/`，真实媒体观察不等于实体手机自动播放政策、人耳或扬声器试听认证。

Vitest 的测试文件并发限制为 4：完整种子局增加后，无界 CPU 并发曾使既有 Socket 和宝可梦整局测试超过原来的 5 秒期限。保留原超时与断言，限制本项目测试并发；不提高测试超时掩盖故障，也不修改全局工具环境。

## 提示文案与游戏库维护

[`apps/web/src/content/feedback.zh-CN.json`](../../apps/web/src/content/feedback.zh-CN.json) 集中盒子入座、保存、连接、上传、换机、显示、准备、计时、座位管理及操作确认的短文案。手动维护只改字符串值，保留组名、键名和 `{game}`、`{player}`、`{code}`、`{seconds}`、`{count}`、`{step}` 等占位符；源码修改后重新构建运行包生效。`feedbackText` 插值按普通文字渲染，`feedbackReason` 映射服务原因码，`feedbackKind` 分类保证改中文文字不改变状态行为。完整帮助、游戏规则与纯控件名称不在此文件范围。

游戏分类和搜索别名分别放在各 `games/<id>/game-module.json`的 `library.tags`、`library.searchTerms`，不需要改盒子名单；名称、分类、别名、玩法名称／摘要和ID可检索，多个词按共同匹配处理，支持全角及大小写归一。浏览目录只携带检索字段和小封面，完整说明按精确发行读取，搜索不依赖详情。玩法选择共用 `apps/web/src/components/GameplaySelector.tsx`，按照 `variants`显示可选玩法；下载进度和安装状态已移除，权限和切换条件不因组件名称改变。精确单测入口：`node tools/test/runner/test-scoped.mjs --scope=box apps/web/src/components/game-library/filter.test.ts`；文案分类测试使用 `--scope=box,shared apps/web/src/content/feedback.test.ts`。

`tools/test/box/verify-box-seats.mjs` 登记为box，使用实际源码 BoxScreen 的合成目录和座位输入，核验1／6席原布局及7／9／12席网格、长昵称、真人与三档人机、本人第12席、各端状态和320px至4K的滚动／字号／重叠。结束动作只检查“恢复加入”发出既有 `replay`；人数筛选随目录最高人数生成至最多12。隐藏静音Edge与夹具仅监听127.0.0.1，证据保存于 `artifacts/maintenance/v1.0.6/box-seats/`，隔离构建使用现有 `tmp/box-layout-<六位后缀>`。合成12人输入仅验证盒子显示兼容，现有游戏仍按原人数限制；不代表实物设备、游戏规则或便携包验收。

`tools/test/box/verify-game-library.mjs` 登记为box，通过源代码 BoxScreen、模拟会话及隐藏静音 Edge 检查组合筛选、无结果重置、权限／容量限制、进行中切换确认、GitHub 新窗口与320px至4K布局。证据使用独立名称并绑定实际源码与输入。它们是源码渲染与模拟回复验证，不代表物理设备、局域网或便携包验收。原生 GitHub 精确白名单、可信顶层点击及失败回执由 `tools/test/box/verify-box-repository.mjs --native-fixture` 单独检查；独立编译不覆盖共享桌面构建输出。

## 图文规则维护与验证

三款游戏均已采用原创图解：现代艺术九张逻辑场景，电力公司六组代码图解与两项透明插画，宝可梦九张主题场景与八章代码图解。准确规则文字、数字和箭头由代码排版；旧截图捕获命令仅用于历史 UI 证据，不再生产当前规则配图。新素材提示词、原图、导出参数与哈希见各游戏资源清单，[实施归档](../archive/completed-tasks-2026-10-10.md#原创规则图解重做已完成)保存完成入口；原素材与规则参考资料保留，maintenance 中历史运行截图按下述手动全量退役入口清理。

`node tools/test/games/modern-art/verify-modern-art-polish-v2.mjs --evidence=<独立名>` 核验三／四／五人的市场拆分、五种拍卖、密集收藏、合法双拍描边、减少动态、三端字号／滚动／规则图和桌面密度；`--representative` 先查三人短屏及短手机，`--diagnostic` 仅取短屏密集收藏几何信息。加 `--portable` 检查实际当前 ZIP、逐文件清单和包内运行时。证据留在 `artifacts/maintenance/v1.0.2/modern-art-polish-20261005/ui-v2/`。

`node tools/test/games/modern-art/verify-modern-art-audio.mjs --timer-only --evidence=<独立名>` 检查时间到只响一次、暂停冻结、静音消费、刷新不补播及到时后合法报价，沿用真实媒体观察和原生声音归属；加 `--portable` 验最终运行包。`node tools/test/desktop/verify-fullscreen.mjs --run=<独立名>` 检查盒子／现代艺术视频设置三种模式、桥接校验、F11／菜单／Escape、窗口与无边框恢复及两窗口独立，登记范围box＋shared＋game:modern-art；`--foreground` 补充正常前台边框／任务栏，仍只在隔离测试模式运行。`--executable=<绝对路径> --zip=<实际ZIP>` 指定实际解压程序及包哈希，结果进入 `artifacts/maintenance/v1.0.6/window-modes/`。测试服务仅监听 `127.0.0.1`，媒体观察与密度模拟不等于实体手机、人耳试听或物理多显示器认证。

三款游戏均可按需打开规则顶层卡片，教学不自动触发；设计、截图权限与维护要求见 [通用视觉](visual-design.md#顶层图文规则说明)，具体规则依据和区域说明分别维护在游戏主题。本节列运行方法，命令存在不表示已通过，实际源／便携结论与包哈希从验收记录查询。

宝可梦专项用 `node tools/test/platform/verify-rules-guides.mjs --game=pokemon-encounters --maintenance=pokemon-rules-redesign-20261005 --evidence=<独立名>`，加 `--portable` 检查最终同哈希 ZIP。九图实际解码、八章逐项导航、准确六格／百变怪／共同赢家图例、三端 9 组合与 320px 减少动态均被核验，首次短手机及 720p 保存九种场景真实渲染。只改图文 UI 的任务不机械重跑未变的人机整局；规则图例单测使用真实计分模块，不能把原图预览当作运行验收。

`node tools/test/platform/verify-rules-guides.mjs --evidence=rules-source-run` 使用真实隐藏原生 WebView2、隔离合法规则示例和独立手机身份，检查三款游戏的 host／public／player 在三种对应尺寸下共 27 个规则浮层：图片实际解码、文字下限、44px 目标、章节导航、关闭／Escape 后焦点恢复，以及查看规则不改变 revision 或身份。`--game=power-grid` 等可限定单个游戏的 9 组合；默认 `--game=all`。加 `--portable` 解压当前最终 ZIP，用包内 Node 与原生程序运行同一检查；每次选择独立的安全证据名。`--maintenance=<安全名称>` 可分开本次证据，默认仍为 `shared-visual-20261004`；证据在 `artifacts/maintenance/v1.0.2/<维护名>/rules/<名称>/`。本机服务显式监听 `127.0.0.1`。这是本机真实运行与手机尺寸／触控模拟，不是实体手机、Safari、电视或现场网络认证。

更新配图先源后包：

[操作命令唯一入口](../../tools/test/README.md#开发环境操作图文规则维护与验证)

旧规则截图及原 PNG 保留在各游戏 `assets/games/<id>/rules/`，历史无损 WebP 继续保留对应像素核验记录；现代艺术当前入口仅加载 `rules/illustrations-v2/` 的九图，宝可梦仅加载 `rules/illustrations-v1/` 九图。原创场景与真实 UI 验收截图分别记录，不能把生成图标为真实渲染。新图 WebP 为有损导出，记录实际质量和哈希，不标成与原 PNG 像素相同。源图／组件检查不替代最终同 ZIP 规则浮层检查。电力公司视觉专项仍用 `pnpm verify:power-grid-ui --maintenance=<安全名称> --evidence=<独立名>`，`--map-only` 定向核验横向地图的 42 个正向城市、83 边、坐标转换和键盘／指针；完整矩阵另核验阶段顺序、竞拍草稿、价区及容量。`node tools/test/platform/verify-power-grid.mjs --seats=6 --display --evidence=<独立名>` 走真实混合局／恢复／三游戏切换，保存五阶段 host／public 游玩图与手机操作前后帧，并在三端投影上核对实际顺序、价区和同步时的报价控件。加 `--portable` 验同一最终 ZIP，不能将组件 fixture 写成完整对局证据。

## 按改动范围选择验证

| 改动范围               | 适用检查与证据                                                                                                                                                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档、索引或目录说明   | 相对链接与锚点、正文归属、命令／配置一致性、改动文件的 Prettier 格式及 `git diff --check`。`docs/` 默认被格式命令忽略，需要格式化改动页时对明确路径使用 `pnpm exec prettier --check --ignore-path .gitignore <文件路径>`，将 `--check` 改为 `--write` 可格式化。 |
| 独立原型源码           | 类型、静态、格式与独立构建，再执行受影响的通用／游戏走查；`pnpm prototype:verify:game --layout-only` 仅补查布局，不能替代流程走查。                                                                                                                              |
| 正式平台与共享契约     | 选择实际受影响的共享及对应游戏范围，按行为补真实服务、授权及恢复检查；类型、静态与构建也按依赖选择必要项，桌面生命周期变化才选相应验证。                                                                                                                         |
| 正式游戏、计分或策略   | 只允许对应游戏项，并按规则／投影／人机／恢复／UI的实际改动继续收窄，覆盖 [游戏场景](../games/pokemon-encounters/validation-scenarios.md) 的适用项；混合脚本先增加真实过滤或拆分，不运行其他游戏。                                                                |
| 完整安装候选与程序更新 | 冻结candidate／配方／三PE／全部成员与预算；按实际影响选择原生验签／控制器／保存／事务／迁移／向导。正式安装、Apply、登记、卸载及current推广须下文真实隔离账户链，不能用portable提取代替。                                                                        |
| 历史便携交付           | 仅核对原EXE／ZIP、原清单及其适用验证协议；复用保留原版本／来源，不重新封旧字节或写成当前installer通过。                                                                                                                                                          |

新报告只声明本次执行的范围。历史证据保留对应构建、日期与限制，不因更新说明或局部补查而改成完整产品验收。

## 当前维护验证

原生专门试听还需显式选择游玩模式，例如 `launchDesktop({ soundEnabled: true, args: ['--tablemax-play-mode'] })`；游戏测试模式本身仍省略声音。显式开启状态核验不等于真人试听。

直接Edge验证统一通过 `tools/test/support/browser-test.mjs` 启动，默认追加 `--mute-audio`，保留调用方其他参数；对应入口专门试听时加 `--sound`。这仅关闭实际音频输出，不屏蔽网页播放事件与解码检查。

`node tools/test/platform/verify-test-silence.mjs --evidence=<独立名称>` 实际解压当前ZIP、核对逐文件哈希及体积，用包内Node和隐藏WebView2检查主机／公共／模拟手机默认静音、显式试听选项、重新加载和电力公司暂停／测试／游玩声音按钮。显式试听检查仅核验窗口静音状态，不实际播放音频；证据在当前版本 `test-silence/<名称>/`，失败和修正用不同名称保留。

测试默认静音：原生 `--foundation-test` 及安装健康的 `--foundation-check` 窗口在导航前硬静音，包括主机、公共屏、模拟手机及游玩模式节奏检查。`tools/test/support/desktop-test.mjs` 默认强制 `TABLEMAX_TEST_AUDIO=0`；专门试听使用 `launchDesktop({ soundEnabled: true })`，直接测试启动需显式 `TABLEMAX_TEST_AUDIO=1`。声音调用、解码及播放权仍可验证；测试静音不修改用户偏好，普通启动沿用原声音设置。电力公司测试／暂停／离线的声音按钮显示关闭且禁用。

先执行适用的工程检查，再按改动选专项；命令存在不代表已通过。使用 `verificationOutput` 的入口按实际读取的公开版本写入 `artifacts/maintenance/v<版本>/`，当前公开版本为1.0.6；旧固定版本目录与原证据位置保留。部分游戏专项仍有自己的维护子目录，以脚本参数和实际报告为准。每次选择新的证据名，保留失败、返修和历史记录。安装与更新通过须绑定同一实际installer及完整证明，历史便携通过绑定原EXE／ZIP，均不能由开发构建推定；已通过且未受影响的功能不机械重跑。

短屏布局返修可先运行 `pnpm verify:display --paused-720p-only`，只在真实六手机开局并暂停后检查主机 1280×720 首屏，证据进入当前版本的 `display/paused-720p`。该入口用于固定失败场景，不能替代完整显示矩阵或最终 ZIP 验证。

### 游戏库、并发与内存

作者完整清单由 `packages/game-sdk/src/metadata.mjs`按白名单生成浏览目录、运行描述和详情，各用途字段见[工程结构](architecture.md#独立发行与公共契约2026-10-11)。盒子只需要名称、分类、人数、玩法摘要和小封面；完整介绍、引导能力及人机说明从已安装发行的 `web/details.json`加载，旧包内嵌详情保留兼容读取。服务注册表与 `apps/web/src/game-clients/registry.ts`分别使用运行描述及最小网页加载描述；安装器签名目录不整份发给UI。

`pnpm verify:experience`覆盖按需加载、手机房主与并发操作。进入 `/game`后按实际发行加载对应客户端、样式和资源，服务按选择或存档manifest加载规则，Worker按任务加载策略；已加载模块可在进程内复用，回盒子卸载游戏界面不等于清除JavaScript模块缓存。当前局更新期间继续固定原包，旧签名发行ID与原字节不因元数据精简改变。内部 `template`用于切换、容量及策略兼容验证，不作为正式产品游戏。

`pnpm verify:memory` 从当前源码提取 `copySave`，与脚本指定历史 Git 基线的整份 `structuredClone` 在独立 `--expose-gc` Node 进程比较；可用 `--baseline-ref=<Git修订>` 指定另一份确实包含旧复制方式的基线。六席／1,200 checkpoint／1,200 receipt fixture 由合法六席快照扩展并经生产存档校验，不宣称实际游玩了 1,200 步。随后用实际后台 WebView2 连续执行 20 轮开始、结束、回盒子及重新选择同游戏，记录 GC 后 renderer heap、DOM、监听器和本应用进程内存。结果在对应版本的 `memory/results.json`，临时数据在 `tmp/runtime-memory-*`。`--copy-only` 不启动桌面，`--desktop-only` 保留已有复制测量并追加桌面结果，后者需先构建；不同运行时的绝对工作集不能直接比较为游戏优化收益。

内存结果只说明测量配置下的复制分配、耗时和导航回归；并行工程负载可能影响耗时与工作集，不使用整台电脑 RAM 评价本应用。当前按字段复制仍保留全部有效回退历史，完整存档序列化和历史体积仍随对局增长，不能写成长期有界内存。磁盘阈值维护使用清理工具，与运行时 RAM 分开。

### 聚会可靠性

`pnpm verify:party` 使用隔离数据、后台 WebView2 和实际本机网卡 IPv4（监听 `0.0.0.0`），覆盖网卡名称／刷新／选择保持、加入回复丢失与同请求确认重试、刷新／真实程序重启后确认、250ms 延迟和带宽限制、断网／冻结恢复、回退上下文、原班第二大局、重复启动、公共屏保留时恢复管理员窗口及真实端口占用错误；并确认已删除的兑换接口拒绝请求。启动前执行 `pnpm build`，加 `--portable` 新目录解压当前 ZIP、仅系统 PATH 运行，证据独立进入 `party-portable`。它不修改防火墙、路由器或默认玩家存档；本机网卡可达不证明真实手机或实际 Wi-Fi 通过。网络范围按下文 [Node 运行与防火墙规则](development.md#node-运行与防火墙规则) 执行。

普通便携启动保持端口 38473，占用时停止并展示具体原因。手机身份仅在原浏览器源恢复，地址或端口变化后的新源不能自动沿用；换手机／绑定码已删除，确需重新入座时由管理员处理旧座位。服务运行期间防自动休眠，公共屏可见时保持亮屏，退出恢复系统电源行为；手动休眠或关机仍可能中断服务。身份和房主边界见 [通用平台规格](phase-02-platform-spec.md)。

原生 Alt → 程序菜单提供“打开房主管理”“打开日志目录”。所选数据目录内的 `logs/desktop.log` 保存启动失败原因，`service.log` 保存服务生命周期。损坏／不兼容存档保持原文件，排障前备份 `room.sqlite` 及 WAL／SHM。

### 手机围桌与等级

`pnpm verify:room-levels` 使用真实桌面／独立服务和本地 Worker，手机采用独立 Chromium partition、触控视口和普通二维码加入 URL。实际 UI 添加三档人机、调整等级、由各手机准备和行动，检查 host／public 不占座且无游戏动作或私牌；尺寸矩阵检查席位、名字、按钮与横向溢出并保存实际隐藏帧。真实混合小局后原班续局，再重启确认身份及等级保留；加 `--portable` 对当前 ZIP 新目录解压、仅系统 PATH 运行同一检查。结果仍限于 Windows 和 Chromium 模拟，不证明 Safari、真实手机／Wi-Fi／电视通过。

### 游玩节奏与显示

正常启动采用游玩模式；房主在盒子或游戏页按 `Ctrl+Shift+F12` 打开隐藏运行模式窗口。测试模式沿用权威动作、持久化和恢复链路，只加速人机并省略动效／声音。桌面 `--tablemax-test-mode` 显式选择测试，`--tablemax-play-mode` 显式选择游玩；隐藏验证的 `--foundation-test` 默认测试，验证生产节奏时同时加 `--tablemax-play-mode`，不能把隐藏启动写成可见普通启动实测。

`pnpm verify:presentation` 验证六真人自然小局、浮窗焦点／确认、星标和公开行动、保存动画／音频调用，以及真实 Worker 在两模式的时序和取消。`pnpm verify:game-ui` 使用正式能力／2–6 人保存 fixture；`pnpm verify:cards` 直接用正式六人保存状态渲染全部 16 类卡面并检查图像、文字和分区，组件或 fixture 通过不能替代完整对局。

`pnpm verify:display` 覆盖电脑 720p／1080p／1440p／4K、100%／125%／150% 显示请求、主机与公共屏独立缩放、浮窗及设置恢复，手机无电脑显示设置。当前原生几何与 DPI 口径见 [原生桌面后台验证](development.md#原生桌面后台验证)，行为见 [电脑显示规格](phase-02-platform-spec.md#电脑多分辨率显示150)。显示偏好在数据目录 `display-settings.json`，与 `room.sqlite` 分开；损坏时采用自动适配，写入失败提示且不改变已保存偏好。`--portable` 必须检查最终 ZIP，历史 Electron 显示证据保留原运行时边界。

## Agent入口迁入的执行约束

以下为原入口的有效约束，2026-10-13按主题迁入；不是新增产品要求。入口仅保留关键规则与阅读路由。

- 测试默认关闭声音，包括以游玩模式核验节奏的自动窗口；专门试听显式开启，保持日常游玩声音偏好。入口和选项见开发环境。

- 测试、检查与优化按本次实际变更范围执行：仅改盒子只运行盒子项，仅改游戏只允许对应游戏项；共享层按实际依赖选择受影响项，纯文档／配置仅做适用检查，不因其他未提交改动扩大范围。先筛选再按累计通过次数／历史完成次数的低通过率排序；达到[统一失败阈值](#历史通过率与失败阈值)即停止，修复后只重跑受影响项，跳过或未开始不计次数，不自动重试。范围入口、统计与阈值见 [开发环境](development.md#按变更范围选择检查)。

## 保存关闭与安装隔离底座（2026-10-15）

保存关闭底座验证动作排空、保存失败、幂等关闭、stdout确认、强制终止、文件保全与路径拒绝。文件系统形状、真实私有管道和实际installer属于不同层次；阶段1原范围与失败见[安装归档](../archive/windows-installation-update-2026-10-15.md#阶段-1-完成记录2026-10-15)。

动态安装状态未完整绑定时强制执行、不复用缓存；静态输入及原始冻结载荷依然分别按SHA核对。证据分清原完整EXE与覆盖后的原生／服务候选，绑定候选文件哈希、方法源码、工具链与夹具前后状态。普通服务回归使用明确的空游戏目录，私有入口fixture只构建所需游戏；逐文件隔离避免Vitest临时SSR缓存跨worker丢失，工程tmp保留原权限与正式数据边界。

运行命令见[工具操作入口](../../tools/test/README.md#保存关闭屏障与隔离底座)，通过／失败证据见[安装归档](../archive/windows-installation-update-2026-10-15.md#阶段-1-完成记录2026-10-15)。现有静音、隐藏窗口、127.0.0.1、先筛范围、[统一失败阈值](#历史通过率与失败阈值)和修复只重跑受影响项的约束保持。

### 完整安装与程序更新的证据分层

安装验证按下表分层，方法、候选、源码和实际成员SHA分别绑定；组件、解码探针、准备素材及向导取消不能升级为正式系统证明。各轮结果与当前交付统一见[验收](acceptance.md#当前源码与本地交付)和[安装归档](../archive/windows-installation-update-2026-10-15.md)，长期命令只在[完整安装验证工具](../../tools/test/README.md#完整安装与程序更新验证)维护。

| 层次              | 可证明范围                                                                                                                                                                         | 必须保留的限制                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 静态闭包与签名    | actual三PE版本／产品ID、配方与全部payload成员、预算；实际Native／helper读取生产根并Verify envelope及Extract→Verify机器块，EXE／manifest／bootstrap原字节SHA相等                    | 不调用Main、不证明系统安装或Apply；launcher不含更新验签模块，不能将其身份检查写成验签通过                                      |
| 原生更新控制器    | 同一ApplicationUpdate代码，经仅managed注入的HTTP handler测试检查、下载、取消、长度／SHA、回放及资产边界；跨语言公开向量核对严格JSON与RSA                                           | 不开放网页／CLI任意URL钩子；模拟HTTP不等于真实GitHub正例下载，实际线上主动检查单独记录                                         |
| 保存与恢复        | 实际Native／服务、SQLite失败与原状态保全，playing拒绝、prepare后真实Stop及退出码门禁；helper持续租约、10成员指纹、精确quarantine／默认保留D/G/config、同包重装健康                 | 持久日志构造不等于真实断电；fixtureGUID、组合载荷及sourceSHA保留原身份，不能冒称正式Inno系统链                                 |
| 向导浏览／取消    | 同SHA副本的src默认目录、原中文提示、中文路径、桌面任务关／开／关、返回及正常取消、实际截图和取消保全                                                                               | 明确不点击Install，不证明登记、卸载、UAC或SmartScreen；截图缺失部分与原控件值证据分别说明                                      |
| 双PE准备／复验    | 不同四位PE、同临时根、实际配方／公钥／完整installer材料及工具sourceSHA一致                                                                                                         | prepared／reverified只说明材料就绪；60000／60001未实际执行Apply／Inno前不能写更新成功，csproj排除改动不影响直接csc的已冻结输入 |
| 卸载bootstrap探针 | 全0–255字节、真实helper、三种尾组及非法编码拒绝；内存与落盘SHA一致，配方绑定helper和生成include                                                                                    | 不执行helper或安装登记，不证明旧框架卸载可达，也不替代实际unins EXE/dat容量                                                    |
| 框架失败恢复      | 实际A安装，B切换后合法SQLite写入使10成员指纹变化并拒绝健康；A框架EXE/dat原字节保留，live helper缺失时由A框架默认卸载                                                               | 必须执行含准备复验在内的独立8步专项并核对D/G/config与未知资料保全；预期故障成功触发不是产品失败，仍不称真实断电                |
| 正式隔离系统链    | 新标准账户与真实profile先执行默认D、I198／短外D正向及旧框架失败恢复三条8步链，再执行正式GUID首装／同包复装／快捷方式／首次物化分项计量／保存后默认卸载／同根重装读回／再次默认卸载 | 账户及管理员操作须有明确授权；工程checking、隔离标志、helper-only及只看driver exit0均不足，结果按实际报告认定                  |
| 旧便携实际迁移    | 冻结便携程序真实启动、服务API保存及正常关闭；同一完整Inno迁移默认D与外置D两个case，新版恢复原身份／发行，默认卸载保全数据库、配置、G与未知资料                                     | 独立fresh profile逐case实际安装／卸载；保全-only夹具、旧档读取或模块租约专项不能替代，具体版本与SHA白名单不外推到其他候选      |

隔离账户驱动核对默认D正向、I198／短外D正向和旧框架失败恢复三份报告的 `passed`、`failures:0`、所有步骤通过及各自8个唯一必需步骤，不能只看driver退出码。三份实际报告均须绑定同一原prepared报告的规范路径及raw SHA，驱动再记录各报告自身的路径与raw SHA；prepared复验包括旧／新不同高位PE、完整材料、公钥及源码输入。三条fixture链不能替代随后正式GUID的保存／卸载重装、完整容量及账户清理证明。固定步骤ID与操作参数只在[测试工具](../../tools/test/README.md#完整安装与程序更新验证)维护。

当前版本的实际系统结果、完整容量、迁移及推广证明只在[验收](acceptance.md#当前源码与本地交付)维护。容量报告须分开程序／框架／元数据／当前G与存档／缓存／事务；阶段最大观测值不能称绝对峰值。

正式安装验证器在卸载外层首段退出0后，独立有界等待原卸载EXE消失，再观察卸载日志能以 `FileShare.None` 独占打开读取；成功后才归档原日志字节和SHA。`completionObservation`与首段进程结果分别保留，观察失败仍是失败，不执行卸载重试或代删原EXE。日志仍由后续Inno进程持写锁时，不能仅凭首段0或文件存在就立即归档，也不能声称全部清理已完成。

测试更新签名与生产信任分离。双PE夹具用独立测试GUID、进程内RSA私钥及fixture-only公钥资源，对测试描述原始字节签名和验签；测试与生产描述相互拒绝，不为夹具修改生产产品ID、签名器或内置根。夹具WinForms计时器经一次性 `Application.Idle` 在生产入口完成初始化后启动，退出时解除回调并停止，避免提前创建隐藏窗口；修复夹具时点不等于实际交接通过。具体实现和回归入口见[完整安装验证工具](../../tools/test/README.md#完整安装与程序更新验证)。

旧便携迁移与完整Apply／正式安装链分开编排，须先取得标准测试用户与profile范围授权，并使用真实Medium profile能力。验收输入必须是被冻结的旧便携完整EXE、原始指针副本和新完整installer；先由旧程序生成合法闲置数据和完整G，再经真实installer迁移，不制造数据库或模块形状来规避入口。默认D核复制与原B逐文件保全；外置D核原指针及G保全。每case完成精确默认卸载并清除登记后才能进入下一case，报告绑定原输入、执行副本、源码、SID及两个case的实际结果，账户／profile清理报告SHA另行绑定。工具的固定版本白名单、命令及报告字段见[工具README](../../tools/test/README.md#完整安装与程序更新验证)，更换输入须重审，不能把工具准备写成迁移通过。

账户子进程必须加载真实标准用户profile，按Windows实际文件夹和身份归一 `USERPROFILE`、`LOCALAPPDATA`、`APPDATA`、`HOMEDRIVE`、`HOMEPATH`、`USERNAME`、`USERDOMAIN`，并核对应用数据路径属于本次profile；临时根与输出只授予新SID所需权限。PowerShell 5.1通过 `ProcessStartInfo` 调用Node，显式UTF-8并行读取stdout/stderr、有界等待排空后按实际ExitCode判定，避免原生命令stderr被 `ErrorActionPreference=Stop`误判；异常和双流日志保留。

收尾先停止自有runner，再按新SID、固定进程句柄和精确创建时间复核并有界扫至零，不按进程名杀程序。仅删除本轮创建的账户和精确SID／路径且已卸载的非特殊profile；账户或profile清理失败使全链失败，最终原始清理报告SHA绑定正式安装证明。授权、当前执行结果和失败预算见[安装归档](../archive/windows-installation-update-2026-10-15.md)，current推广仍须完整系统证明。

框架恢复的故障注入仅存在于显式编译的fixture alternate Main：严格限定测试GUID、60001、请求、隔离根、默认D、实际安装身份／receipt及包内Node摘要。包内Node对隔离foundation库合法写入并关闭，产生字节变化见证后Native返回42，发生在checking／persistent入口之前；生产Program和桥接不含该注入入口。直接复制已恢复helper再执行 `--uninstall` 只证明组件路径，不能证明框架自己的固定SHA可达；双PE材料已准备或全字节解码通过也不抵扣实际A框架卸载。

`TABLEMAX_INSTALLATION_HEALTH_CHECK=1`仅使helper的健康启动显式静音后台checking后退出；正式默认更新仍启动并保持普通新版主机。持久在线交接fixture分支优先，不以checking代替新主机持续运行证据。该工程标志不替代正式GUID、fresh SID或完整安装验收；不同来源、旧sourceSHA的通过报告按未变化方法复用，不增加新统计或清零原失败。

### 正式执行记录与证明封存

实际执行与最终proof封存分开。正式执行和账户／profile清理均成功后，驱动先按原字节保存 execution-proof.json，再生成绑定delivery、proof、isolation及方法源的 execution-receipt.json；封存核验原件、日志、三链与保留runtime，不再次运行产品。fixture-only或迁移报告不能冒充正式proof。

后续绑定／封存失败时，保留成功清理的原isolation与两份execution原件，另写 acceptance-binding-error.json 并退出1；不能倒写账户执行失败，也不能仅凭receipt宣称正式验收通过。修复封存后可只读复验并CreateNew输出新proof，仍须核对全部原件及方法源SHA。命令见[测试工具](../../tools/test/README.md#正式执行记录与证明封存)，具体通过结果与方法源范围只在[验收](acceptance.md#当前源码与本地交付)维护，既有产品证明保持原范围。

方法源由 execution-method.mjs 复用runner version2指纹收集，显式声明PowerShell父／子与动态C#依赖，不因拆文件遗漏执行方法，也不新增另一套范围注册表或统计。一次性工具盘点只是整理依据。

真实Updater入口的观察PS使用独立stdout／stderr文件，按该PS的实际exit结束，不能等待间接Native持有的管道EOF，也不能据PS或Updater退出0推定间接Native退出。Updater自身仍核对原进程句柄、模块、SID及退出0；冷Native另核真实ready和持句柄正常退出，热唤起核原Native／服务PID及面板请求。输出是有界原字节快照，不声称后代EOF；超时终止观察器后最多再等待5秒，未确认终止仍失败，后代交精确账户清理门禁。

### 正式执行记录与证明封存（接口待验证）

旧标题入口，正文见[正式执行记录与证明封存](#正式执行记录与证明封存)。

## Windows完整性与隔离验收

工程继承Low标签会使生成EXE与Node降为Low，写正常HKCU被拒绝。profile测试模式须先获明确授权，核实际新标准SID／真实目录／两个Medium token，仅物化同SHA副本，不修改原标签、token或DACL；日志及清理证明留工程，具体入口见[完整安装验证](../../tools/test/README.md#完整安装与程序更新验证)。

## 原EXE安全标记与直接启动门禁

同SHA副本通过不能替代原交付文件自身的安全标记和原路径启动。完整交付必须单独核验原EXE的mandatory label、owner／DACL、ADS／MOTW及Authenticode，并从其冻结canonical路径在干净标准profile直接启动；记录真实原进程与向导子进程映像、SID、Medium／非提权令牌、实际截图、正常取消退出和自有Job归零，以及精确账户／profile清理。原EXE的内容及安全元数据、源目录的内容在启动前后须保持一致；复制、改名、解压后运行或只有requested路径不计原EXE通过。

本地生成EXE继承Low是独立交付缺陷；只允许在核原SHA后对该可信最终产物做单文件Low→Medium归一化并记录前后保全，不改源工具标签、DACL、MOTW或系统策略。Windows完整性机制见[Microsoft MIC](https://learn.microsoft.com/en-us/windows/win32/secauthz/mandatory-integrity-control)，单文件标签参数见[icacls](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls)。项目免费RSA应用签名与Authenticode分别记录，NotSigned不冒充已签名或SmartScreen信誉。

原路径浏览／取消证明作为完整安装／保存／卸载证明的补充，不能互相替代。封包采样原文件安全状态，本地current切换与公开发布预检必须读取原始补证并再次查原文件，缺证、Low、MOTW、实际Low／提权进程、源目录变化、非正常取消或清理失败均停止交付。具体命令与输出字段唯一维护在[测试工具](../../tools/test/README.md#原交付exe的安全标记与原路径启动)，实际结果见[验收](acceptance.md#马尼拉本地候选2026-10-16)。

## 先解决集成与高风险场景

- 先定位已验证的可复用职责和稳定契约，游戏规则、数据、策略与表现保持所属模块内聚；不靠跨游戏导入或将版本专属分支塞入平台共享层实现复用，避免复制已有纯函数、容器或资源。
- 新规则、计分、权限、随机、事务恢复、旧存档及多步动作采用测试驱动：先构造可暴露易错边界的失败用例或可重复真实场景，验证其确实覆盖风险，再实现并通过相应检查。纯文档／配置／素材记录选择格式、链接、来源、解码等适用检查，不新增只复述实现的测试。
- 跨模块任务在派工或并行实现前明确共享接口、数据兼容性、文件负责人和交接条件；有其他会话修改目标文件时保留其改动，重新核对当前内容并避免同时重写。同一文件仍只由一名 agent 修改。
- 协议、权限、保存恢复、旧存档或游戏切换变化时，先打通最小真实跨层路径，核验越权、失败保持原状态和迟到旧动作，再扩展其他功能；集成验证不能全部推迟到交付前。
- 布局变化先检查最容易暴露问题的代表场景：六人、720p、125%／150% 显示缩放、暂停／恢复提示及短手机；按影响选择适用组合，并说明未覆盖项。修正后只完成受影响模块所需的尺寸、端侧与便携验证；沿用隐藏窗口和实际更新后的渲染，不将代表场景通过当作完整验收。
- 为已通过的检查保留对应版本／改动、命令、结果与证据路径。仅相关代码、资源、配置或运行环境变化，检查失败或仍有未解决疑点时重跑；先跑受影响项，再完成本次必需的最终检查，不机械重复无关全套构建或矩阵。
- 相同布局或流程失败先固定一个可复现案例，用真实渲染定位原因并验证修正，再跑完整受影响矩阵；不在每次微调后重跑所有场景。交付时冻结一次最终输入，验证唯一完整EXE的实际提取与运行，证据绑定EXE、内部载荷和逐文件清单；后续仅文档变化不重复打包。

2026-10-08 用户补充测试策略：仅更新盒子只运行盒子测试，仅更新游戏只允许对应游戏测试；检查、构建与优化同样按本次实际变更范围收敛。共享协议、平台服务或通用组件变化时，先列出实际受影响依赖，再选必要的共享与对应游戏项；其他工作区已有改动不自动扩大本任务。混合测试涉及的全部范围必须落在本次范围内，不能按文件名或仅有交集就运行；已有脚本不能缩小矩阵时先增加真实筛选或拆分检查，不能为图方便扩大范围。纯文档、配置、素材记录分别只做适用检查；仅规则文件变化不自动跑UI矩阵，仅UI变化不自动跑整局规则模拟。范围入口见 [开发环境](development.md#按变更范围选择检查)。

每项测试保留累计通过次数／历史完成次数；先筛选必需检查，再在集合内按低通过率排序，不能借历史高通过率省略必需验收。默认阈值及启动前显式设置遵守[验证唯一正文](#历史通过率与失败阈值)；保留未执行列表及失败证据，修复后只重跑受影响项。历史次数跨版本保留，不因修复或再次通过清零；未知项排在已失败的0%项之后、已通过项之前。跳过或因范围排除的项不计次数；无变化不自动重试，实质修复后在已有授权内按统一门禁自动新开定向验证轮。统计口径及参数见上述开发环境入口。

## 批量检查与等待

2026-10-11测试流程优化：优先消除重复选择和执行，再考虑单次速度。version 2计划及证据复用见[开发入口](development.md#内容绑定的验收计划2026-10-11)。相关输入、方法、参数和必要环境一致且原证据完整时才复用；复用不增加累计次数。工具输出按执行、启动／解压、传输／校验／安装、扫描／哈希／容量及等待计时，混合旧报告保留未拆分口径，不推算加速倍数。验收子进程只登记产物，统一轮次仅一次收尾；忙碌保护停止后不自动重试，不结束其他任务进程。当时该轮按累计3项失败停止，原记录保留；当前阈值及修复后自动接续以[验证唯一正文](#历史通过率与失败阈值)为准。

并发前列出依赖、接口及完成条件，指定唯一文件负责人和隔离输出；独立检索、检查与稳定契约下的实现适当并行。共享文件、同一 GUI、组装、最终发布与清理目标只由一名负责人操作；后续工作只消费已完成并核验的稳定产物，不读半成品、不覆盖他人的目录，不在仍运行的工作项旁启动清理。并发数量按工具／内存／网络预算选择，不以并行本身作为效率证明。

互不依赖的搜索、读取和检查在同一批调用中执行，逐项核对结果；修改、审批、构建与依赖结果的操作保持顺序。授权并行协作时，交接集中提供改动范围、结果、证据与阻塞，避免连续发送重复进度询问；不因本节创建未授权的协作实例。

等待长任务使用完成通知或有界等待，只有实际状态变化、失败、需决策或完成时才读取相关详情。等待期间继续独立工作并按约定提供用户进度；没有新信息时不反复读取历史、重新分析同一结论或缩短轮询间隔。

## 测试声音与偏好隔离

测试默认关闭声音，包括自动验证以游玩模式运行的窗口；声音解码、调用及播放权检查可在静音输出下继续执行，真人听感或专门试听由验证入口显式开启。日常游玩保留用户声音偏好，测试静音不写入该偏好。
