# 首版交付与验收

## 1.0.2：扩展版续建、预算与同包复核（2026-10-06）

本地扩展技术包继续补齐公开棋盘轨迹、八段原创能力／研究主题音和人机估值修复。产品版本仍为1.0.2，既有GitHub发布、标签及附件保持原状。完整多姿态演出和真人验证尚未完成，接续见[阶段任务](../tasks/pokemon-encounters-expansion.md)。

[续建同包汇总](../../artifacts/maintenance/v1.0.2/pokemon-expansion-continuation-delivery/final-checks.json)对应[当前运行ZIP](../../artifacts/releases/TableMax-1.0.2-win-x64.zip)与[逐文件清单](../../artifacts/releases/TableMax-1.0.2-win-x64-manifest.json)：ZIP **41,119,920字节**，189文件实际解压 **94,532,267字节**，严格小于100,000,000字节；95MB工程预算剩 **467,733字节**。SHA-256为 `99514d30221a05dfe249a7fd6d16223b755f3937d72979c22127c393166bb7be`。18单元、385个唯一输入路径逐一核验冻结，16单元命中缓存，打包含实际解压实耗21.475秒，无游戏体积预算告警。全部旧媒体及其他游戏核心文件共143项保持字节／哈希不变；未重复宣称执行未受影响的其他游戏完整对局。

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

该轮 [运行ZIP](../../artifacts/maintenance/v1.0.4/incremental-build-20261005/previous-delivery/TableMax-1.0.4-win-x64.zip) **40,630,608字节**，实际解压 **153文件／95,145,272字节**，均严格小于100,000,000；95MB工程预算超 **145,272字节**。SHA-256：`2b082190a56c058c2f4a9ec2ad6625a98ec8345762543bc85818dfc78227acd8`；[冻结清单](../../artifacts/maintenance/v1.0.4/guidance-setting-20261005/final-delivery-manifest.json)及 [审计与收尾](../../artifacts/maintenance/v1.0.4/guidance-setting-20261005/delivery-checks.json)。上一份已验证同版本ZIP及清单保留在本轮证据目录，下节仍记录其原有验收边界。验收后仅更新文档，不再次构建；仅提交本次明确改动，不推送，用户扩展草案及其他已有改动保留。

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

该轮 [运行 ZIP](../../artifacts/maintenance/v1.0.3/combined-repackage-20261005/previous-delivery.zip)为 **40,626,986 字节**，实际解压 **151 文件／95,141,448 字节**，严格低于 100,000,000；95 MB 工程预算仍超 **141,448 字节**。SHA-256：`d5227cc8bee2827e6fa5ab1c5ce7a3846e91cbdd55b9de4a87b54bac7431d190`。游戏／策略 CJS 与 Worker 采用锁定 esbuild 压缩，118 个媒体文件与上一包大小及哈希完全相同；[冻结清单和同包审计](../../artifacts/maintenance/v1.0.3/power-grid-debug-20261005/final-delivery-checks.json)记录各检查哈希，没有验收后重新打包。本机回环、隐藏 WebView2 及手机尺寸模拟不等于实体手机、局域网或人耳听感认证。历史包／临时目录清理见 [瘦身记录](project-slimming.md#电力公司-debug-收尾2026-10-05)，保留当前交付、原素材、规则、失败文字及逐文件哈希。

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
