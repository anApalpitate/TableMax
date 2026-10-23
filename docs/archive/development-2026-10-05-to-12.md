# 开发与验证历史：2026-10-05至2026-10-12

2026-10-13从高频入口迁入。保留原结论、失败、版本、哈希和证据；不是本轮重新验收。当前方法见[开发入口](../reference/development.md)，当前交付见[验收](../reference/acceptance.md)。

## 两种EXE与内部载荷（2026-10-11）

本节保留双版本与Pages分发的历史边界。2026-10-11曾导出无后缀full完整游戏版和 `-box`盒子版，默认双交付并接受 `--edition=full|box|both`；离线玩法ZIP曾供导入。2026-10-12已取消这些选项和用途，仅导出完整EXE。

现行 `pnpm package:win`支持 `--snapshot=<冻结清单>`；有无关并行游戏改动时，可用 `--platform-from=<已验快照> --games=<完整内部签名模块目录>`只刷新平台单元并保留原游戏输入，仍核验全部冻结字节。旧 `--edition`明确拒绝，部分游戏目录不能交付。线上内容未改，最新下载说明见[README](../../README.md#下载)。

唯一EXE和本地清单在 `artifacts/releases/`，内部 `payload.zip`与 `release-manifest.json`在 `artifacts/package-payloads/v<三位版本>/<run>/full/`。`current.json`只绑定一个完整程序，保留内部 `full`键用于旧格式兼容；每次实际EXE验收独立绑定SHA，不以旧双版本报告替代。当前载荷、指针、EXE、匹配实际证明及正式数据均受保护。

下文旧验证器的 `--portable`／`--zip`若默认读取 `artifacts/releases/*-win-x64.zip`，该默认值仅适用于旧交付。当前验证必须按入口实际参数绑定本EXE的内部payload ZIP、manifest与实际提取的 `TableMax.exe`，不把EXE当ZIP输入；没有这些参数的旧验证器只能按原版本执行。现行完整交付先用 `node tools/release/verify-shipping-executable.mjs`核验提取及原生安全，专项和完整交付证据分别记录。

历史Pages部署、三附件重新发布和旧安装检查见[Release历史](../reference/release.md#最新分发决定与暂缓发布2026-10-11)及[验收](../reference/acceptance.md)。原发布事实、签名历史及旧存档引用保持，不执行已撤除的 `prepare:pages`／`verify:pages`别名或旧独立游戏导出命令。

## 历史开发与验证

下列原标题仅保留转链，当前方法以上文为准；历史正文、版本和证据唯一维护在开发归档。

### 游戏库、并发与内存验证（1.6.0）

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#游戏库并发与内存验证160)；当前操作见本页对应主题。

### 聚会可靠性维护验证（1.2.0）

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#聚会可靠性维护验证120)；当前操作见本页对应主题。

### 手机围桌与等级验证（1.3.0）

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#手机围桌与等级验证130)；当前操作见本页对应主题。

## 第五、六阶段完整游戏与交付

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#第五六阶段完整游戏与交付)；当前操作见本页对应主题。

## 第三、四阶段平台验证

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#第三四阶段平台验证)；当前操作见本页对应主题。

## 人机与封装的后续验证

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#人机与封装的后续验证)；当前操作见本页对应主题。

## 第一阶段验证记录

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#第一阶段验证记录)；当前操作见本页对应主题。

## 第二阶段原型验证记录

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#第二阶段原型验证记录)；当前操作见本页对应主题。

## 首版游戏主题原型与规格验证

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#首版游戏主题原型与规格验证)；当前操作见本页对应主题。

### 1.0.2 视觉维护验证

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#102-视觉维护验证)；当前操作见本页对应主题。

### 1.1.0 后台维护验证

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#110-后台维护验证)；当前操作见本页对应主题。

## 1.4.0 游玩呈现与六人验证

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#140-游玩呈现与六人验证)；当前操作见本页对应主题。

### 1.5.0 多分辨率显示验证

当时的范围与记录见 [开发归档](development-2026-10-01-to-04.md#150-多分辨率显示验证)；当前操作见本页对应主题。

### 电力公司地图与边栏回归

`node tools/test/games/power-grid/verify-power-grid-ui.mjs --maintenance=<维护名> --evidence=<运行名>` 运行生产组件的六人三端108布局、交互、字体／触控与声音调用矩阵，包含844×390手机横屏；`--board-only`检查阶段抽屉、四向最低比例拖动、遮挡避让、跟随暂停／恢复、保存重排及公司权限，并观察边栏双向中间帧、快速反向、减少动态／测试模式、综合详情与现金权限及路线费用的缓增字号。`--seats=2`覆盖两人四厂与新购第五厂；合法自然对局不一定产生有库存的待安置场景，该项由六人样本覆盖。`--map-only`补查手机真实节点／键盘选择、裁切后的城名与路线费用。`--fixtures=<已生成fixtures.json>`复用未改变的规则夹具，减少重复人机生成，不伪造规则状态。页面查看、拖动、抽屉和详情必须零游戏动作。

本次相机／阶段默认的纯函数测试与电力公司数据／规则窄回归采用 `pnpm exec vitest run games/power-grid/ui games/power-grid/rules games/power-grid/data -t '^(?!.*completes a conserved)'`；排除45局未改动人机压力测试，实际自然对局另由夹具和运行验证证明。同版本ZIP导出后执行 `node tools/test/platform/verify-power-grid.mjs --portable --display-only --evidence=<运行名>`，在隐藏原生主机／公共窗口核验720p到4K、125%／150%显示请求及模拟Windows DPI，读取实际WebView2 viewport／ZoomFactor。模拟DPI不替代真人手机或真实Windows显示硬件验收。所有验证监听127.0.0.1。

当次结果见[开发验证历史](development-results-2026-10-06.md)。

2026-10-06扩展策略预算诊断采用临时esbuild `onLoad` 注入即时样本数、前瞻完整批次与计时，只保存阶段／档位／人数及计数，不输出暗牌身份或分值。完整脚本、补丁源及独立基线／注入CJS留在[诊断证据（原件待退役）](history-cleanup-20261024.md)；独立目录先建立，禁止覆盖原报告。先用恒定时钟比较授权动作、记忆及随机状态，再运行串行大局，最终检查观察不变量、冻结源码与实际ZIP。诊断有微小计时开销，固定时钟等价不能外推现实软截止轨迹；补充两个大局不并入预定强度样本，不作Worker／真人性能认证。未改生产源码时不重复打包或运行界面验收。

当次结果见[开发验证历史](development-results-2026-10-06.md)。

叫声文件说明续查可使用来源页实际公布的 `EditURI` 公开MediaWiki API，`imageinfo` 取文件URL／SHA-1，`revisions` 取文件说明；原件按哈希核对后再记录，不读取上传日期为游戏世代，不将百科合理使用标记当作本项目授权。27文件一次批量查询，普通公开请求，不交互403挑战；响应放既定临时目录，正式来源／哈希及失败边界见[核验脚本](../../artifacts/pokemon-expansion/encyclopedia-cries/public-api-file-provenance-20261006/audit-source.mjs)。本次只更新来源文档，未改运行音频或资源清单，不触发打包／媒体回归。

## 扩展收尾与SQLite v2验证（2026-10-06）

完成的 UI 与单EXE核验目录分别使用 pokemon-ui-redesign-<六位字母数字>、shipping-executable-<六位字母数字>；清理器只匹配精确目录名，继续执行30分钟、路径／链接／进程和当前交付保护，未知临时目录不因此获得删除授权。

扩展UI重设计：`node tools/test/games/pokemon-encounters/verify-pokemon-ui-redesign.mjs --evidence=<独立名>`在静音真实Edge中检查四牌源、唯一暂持／牌阵、空弃牌、共同赢家、总分明细、暗投、私看隔离、目标切换和30项插画／精确图示；覆盖320–430px、720p–4K和125%／150%模拟缩放。`--sample`仅样板，不代替完整检查；`--portable`逐文件核验当前ZIP并导入实际包内Screen／共享运行时，不把源码图例页当最终包。服务器显式127.0.0.1，不开放网卡。

深度界面检查另外核验手机投票只有选项、他人行动不展示本人动作、公开三牌源／暂持／研究的层级、弃掉与放入颜色及声音图标。SVG角色以实际可见轮廓和截图审查，先等待图片解码；六人720p共同赢家单独由正式规则生成并断言54格、两赢家及牌桌底边。真实随机对局的能力覆盖采用合法可见行动：触发能力前优先替换明牌，避免过早结束；不窥探牌库或修改规则状态。验证器变化不要求重打未变程序包，使用独立证据名保留失败及修正结果。

`pnpm exec vitest run games/pokemon-encounters/expansion/config`检查30项正反例／图示、34类／112／144及固定种子重构兼容和真实SQLite恢复回退。JSON改动后只构建受影响游戏单元；三配置仍由有类型纯函数消费，不在运行端开放编辑。`node tools/assets/games/pokemon-encounters/soften-pokemon-cries.mjs`从清单指定本地原件处理27项下载叫声，先代表再批量；先用 --representatives 核验五项，再用 --apply 派生全部；参数／验证与原件保护见资源清单，禁止把用户原声纳入批量。冻结后一次`package:win`，原包备份保留，音量与视觉真人判断另行交接。

- `pnpm exec vitest run games/pokemon-encounters/expansion/bot/coverage.test.ts`：2–6人三档150个固定种子，每种子独立60秒（六人绝悟120秒）、700步，哈希覆盖新tactics模块。结果留独立run目录；旧策略结果不复用为当前源码证据。
- `pnpm exec vitest run apps/server/src/expansion-integration.test.ts apps/server/src/bot-executor.test.ts --maxWorkers=1`：真实HTTP／Socket.IO／SQLite和32MiB Worker，暂停／取消／分支／重启旧结果，以及两秒截止。性能检查与其他重CPU工作串行。
- `pnpm exec vitest run apps/server/src/save-storage.test.ts apps/server/src/save-storage-games.test.ts`：v1只读保护、流式迁移、故障／中断、历史分支及确认去重，三款真实规则恢复／合法动作／v2重启。固定512B节点和确认增量检查500／1000／2000保存磁盘增长，不将该结果外推任意游戏日志或CPU线性。
- `node tools/test/games/pokemon-encounters/verify-pokemon-expansion-effects.mjs --evidence=<独立名>`：项目锁定Vite构建真实生产Screen，隐藏Edge观察63姿态关节、14时间轴、十普通主题、秘密／取消／减少动态和六人54格；覆盖720p至4K、125%／150%模拟缩放及320–430px手机演出／可滚动操作。`--portable`实际解压并逐文件核对当前ZIP，夹具直接导入包内游戏客户端、共享React运行时及样式，检查正式编译组件；合法规则夹具只证明组件路径，实际保存与原生流程另走原生验证器。
- `node tools/assets/games/pokemon-encounters/audit-pokemon-expansion-audio.mjs`：只复核既有原件／派生哈希和公开来源记录，将已确认说明与未知项写入资源清单；不下载或制作媒体。

直接读SQLite的审计统一用脚本 `apps/server/src/save-codec.mjs` 的 `readCurrentSave`／`readJournalSave`／`decodeSave`，服务测试通过 `apps/server/src/save-audit.ts`。v2的saves／journal行包含引用，不能直接JSON.parse为完整Save。外层Save仍formatVersion1；旧v1在游戏兼容性通过后的保存时迁移，原库／WAL／SHM及迁移记录保留，未知或损坏库不替换。

所有专项通过后只调用一次 `pnpm package:win`（已包含正式18单元构建，不预先重复全量build）。备份原ZIP／清单，对同一最终ZIP执行 `verify-pokemon-expansion.mjs --portable --evidence=<独立名>` 与普通模式控件验证，再核对冻结输入、离线媒体、退出、实际解压体积及模块预算。共享存储变化扩大三游戏恢复检查；未变规则／原版素材按影响复用既有证据。真人手机／听感／硬件DPI／现场LAN及人类时长单独交接，不重新执行胜率统计门禁。

模块预算警告不能视为交付通过；先优化新增资源或实现，不自动上调。预算失败后的受影响单元修正允许重新冻结组装，保留失败清单、输入与理由，其余缓存单元复用。本节记录 v1.0.3 宝可梦4MiB及当时95MB预算／100MB硬门禁；现行v1.0.6完整EXE、内部payload及实际提取采用110MB预警／120MB硬上限；单玩法下载／安装是旧体系边界，见[当前体积门禁](../reference/development.md#便携包体积与共享运行时)。最终证据须绑定同次冻结输入、实际 EXE 和对应内部载荷哈希。

若18单元构建完成后组装被运行中程序门禁阻止，可在程序退出后用 `pnpm package:win --snapshot=build/snapshots/<ID>.json` 恢复组装：重新核对快照ID、生产模块集合、全部源码输入及组装器指纹，继续执行原有进程、输出哈希和体积门禁，避免重复编译。默认命令仍执行正式构建。本轮首次组装因用户日常程序仍运行而中止，用户确认关闭后使用同一冻结快照恢复，未关闭或修改正式用户数据。

新增审计解码器采用 `.mjs`＋`.d.mts`，预检发现TypeScript模块解析只返回声明文件，旧增量walker漏记运行JS；独立小单元反例先失败，修正后运行JS变化使缓存失效、未变复用通过。`node tools/build/verify-module-runtime-input.mjs <独立名>`只构建隔离小夹具；正式打包检查platform-server冻结输入含 `apps/server/src/save-codec.mjs`。构建工具指纹因此变化，本轮正式18单元需要重新构建一次，不能沿用旧缓存；没有预先重复全量构建。

`node tools/test/platform/verify-save-storage-games.mjs <独立名>`实际解压当前ZIP并逐文件核哈希，用隐藏原生／实际服务在独立数据目录为三游戏生成真实已保存动作，把这些合法保存重建为v1夹具，再由同一包迁移及v2重启。检查全部历史、快照／座位、旧v1备份字节和进程退出，正式用户数据不参与。性能和GUI验收完成后串行运行，监听仅127.0.0.1。

六人绝悟新增能力链可产生合法长小局：本轮seed5完成545动作、最长单次799.522ms，但整局76.6秒触发旧60秒测试限。原失败及150轮原始观测保留；仅该种子在六人绝悟整局120秒上限重跑通过。其他组仍60秒，每次决策两秒、700步和Worker内存限制不改；整局测试上限不作为真人时长或单次CPU预算。

SQLite流式扫描须让 `StatementSync` 强引用保持至迭代完成；包内Node22.14.0的iterator不会保活临时 `prepare()` 返回值，垃圾回收可使下一行抛 `statement has been finalized`。首次实际便携迁移发现此问题，旧库未替换；以同一包内Node和 `--expose-gc` 每行强制GC建立迁移红绿反例，完整历史、头像与原备份逐项比较。失败候选及报告保留，修复后仅重建受影响服务单元并重新执行最终同包检查，不把失败候选通过项迁移为新ZIP证据。

## v1.0.5 互动与资源验证

菜单共性调整使用`--menus-only`，仅验证六游戏（宝可梦两版本）的菜单／设置／声音入口，可加`--game=<id>`收窄；范围登记为shared及实际游戏。`--box-only`包含盒子共享互动，须允许box＋shared；可另加`--preferences-only`只验证射击按钮开关、刷新持久化、接收独立和房间修订不变。菜单、盒子及命中视觉筛选互斥。最终包按钮修复后的共享证据可在逐文件哈希确认全部相关运行依赖未变后复用，并记录前后包边界。

`tools/test/platform/verify-interactions.mjs --run=<唯一名称>`以隐藏原生窗口及静音Edge验证拖动／240ms长按／中心取消、六格选择、单次射击、视频设置内三端屏蔽、三射击叠加／第四淘汰、单发言替换和独立音频桥接，服务仅监听127.0.0.1。盒子修改使用`--box-only`，单游戏修改使用`--game=<id>`，二者互斥；默认矩阵仅用于影响全部入口的共享互动修改，不跑游戏规则或整局。即时派发和真实服务测试在`apps/server/src/interactions.test.ts`、`interaction-service.test.ts`，异步手机解锁／替换与单声源失权测试在`apps/web/src/interactions/audio-player.test.ts`。素材试听通过`artifacts/maintenance/v1.0.5/interaction-refinement/audio-review.html`显式开启；机器解码／ASR不记为人耳试听，旧版试听证据保留在`interaction-assets/`。40游戏WAV原件及FLAC派生和PCM核验保持原样。现行体积门禁统一查`tools/release/package-limits.mjs`，120MB硬上限和110MB工程预警；历史114MB预算报告保持原版本边界。

### 玩家互动音效解锁核验（2026-10-09）

`tools/test/platform/verify-player-interaction-audio.mjs --run=<唯一名称>`专查共享玩家互动声音，范围为box＋shared；默认隐藏静音、监听127.0.0.1及隔离数据。`--profile=touch|desktop|all`选择真实触摸模拟／鼠标输入，`--scenario=refresh`只查刷新与首次可信解锁，默认`full`另覆盖五射击／六发言、非零音频输出、禁用／恢复与盒子／游戏页往返，不运行游戏规则或整局。`--sound`仅显式开启玩家浏览器试听，桌面保持静音；`--executable=<实际解压EXE>`核验指定运行包，运行前后另按逐文件清单核对字节与哈希。

严格自动播放采用`document-user-activation-required`，通过CDP `Runtime.evaluate`的`userGesture:false`读取状态与首次输入坐标，再用真实touchscreen／mouse输入。Playwright普通evaluate与locator内部执行可能授予用户激活，不能用其证明无手势前置条件；初次恢复必须实测未激活且AudioContext suspended。分析器并联在真实destination输入，不替换原音频连接；从头播放、300ms内启动及非零PCM只证明浏览器链路，实体手机与人耳听感仍单列。结果写入当前版本`player-interaction-audio/<run>/results.json`，拒绝覆盖旧run；临时数据沿用可安全清理的`root-entry-<六位随机>`。

`node --test tools/build/build-idle.test.mjs`用模拟Win32_Process库存执行构建保护的真实PowerShell表达式，检查独立下载目录TableMax可继续运行，工作区／来源工作区、未知路径／参数及实际验证进程仍阻止组装。它不启动产品或删除内容。近期修复和实际同包结果见[验收](../reference/acceptance.md#105玩家互动音效触摸解锁2026-10-09)。
