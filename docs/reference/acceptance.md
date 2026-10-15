# 当前交付与验收

本页仅保留当前完整EXE、仍有效的证据和待验边界。下方旧标题为导航，不能把原版本通过升级为当前包通过。

2026-10-15安装／卸载／盒子更新基础实现与Inno内嵌解码修复已封入候选14；current仍为已验证便携1.0.6.10；新安装候选1.0.6.14已封包，尚未推广或发布。真实标准账户首个fixture安装在HKCU卸载登记被系统拒绝，已清理新账户及profile；完整系统链仍待完成，接续见[安装任务](../tasks/windows-installation-update.md)。

## 1.0.6.14：安装候选与标准账户诊断（2026-10-15）

[冻结交付](../../artifacts/package-payloads/v1.0.6/ff8eb35cb3f0-9mGOFX/full/installer-delivery.json)对应[完整EXE](../../artifacts/releases/TableMax-1.0.6.14-win-x64.exe)，35,663,121字节，SHA `48cb4a6e2bc80ee409e41afd68356b684e0a949e17735b0d05c4f4be27bf4396`；payload43,995,554字节，程序暂存97,360,020字节。暂存不含实际框架与首次启动G，完整安装容量仍待测。源码保留候选13的31个游戏单元，显式复用原签名模块源，公开版本不变；[封包日志](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-candidate-build.log)与[本地已签正文](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/candidate14-body.md)均不表示发布。

内嵌卸载helper采用锁定Pascal Script原始八位Chr，严格Base64和长度／内存SHA／落盘SHA核验后只执行自身固定身份。[探针02](../../artifacts/maintenance/v1.0.6/installation-remaining/embedded-uninstaller-probe-02/results.json)通过全部0–255字节、填充、真实helper及10个拒绝向量；[新双PE准备](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/handoff-prepare/report.json)60000／60001实际编译封包通过，仍不是实际Apply或框架卸载证明。旧框架A在B失败后自行解码A helper的七步系统专项仍待执行。

真实临时标准账户已运行首个fixture Inno：文件、helper健康与快捷方式步骤后，在HKCU卸载登记RegCreateKeyEx code5失败并回滚；[原报告](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/application-handoff/report.json)不改写为安装通过。[账户清理](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/isolated-account.json)已确认账户及profile删除成功；[独立身份](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/production-account/user-identity.json)包含真实SID／profile／AppData。正式GUID、Apply、失败升级恢复及完整首次启动容量尚未执行。

[候选14闭包首轮](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-14/results.json)前4项通过，附加安全上下文读取因WindowsPowerShell5.1模块加载失败停止；后续.NET探针未运行。新轮合计2／3失败，先只读诊断，不自动重复产品测试；[轮次记录](../../artifacts/maintenance/v1.0.6/installation-remaining/resume-02/round.json)保留上轮历史与本轮结果。current原SHA `f9fe7e68f267067856b84cb01680ec0658ff4b5a8e398fb997f4879dacb17bba`及候选13原字节继续保护。

## 协调器修复与三失败停止（2026-10-15）

[底层恢复专项](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-coordinator-fixed-03/report.json)3/3通过，新增失败0、源码输入未变、收尾无错误且遗留进程0。完整候选精确匹配pending目标后只恢复协调器，保全原坏字节、配置、D／G及既有事务记录；同版本其他载荷不符、源安装器不符或无效签名目标均拒绝。新增修复子日志单独记录，不宣称pending整树零变化；数据库不回退。源码与完整输入SHA归[交接](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-coordinator-fixed-03/handoff.json)，测试是1.0.6.10独立产品GUID的组合fixture及直接helper卸载重装，不是候选13或实际Inno证明；已封候选13未包含此补丁。

[上轮记录](../../artifacts/maintenance/v1.0.6/installation-remaining/account-round-20261015.json)累计3失败后停止：账户描述超过48字符、fixture封包覆盖旧tmp sidecar、内嵌卸载探针编译类型不匹配。描述已修正，旧sidecar已精确恢复；当轮未创建账户或生成第三项setup。用户随后明确继续，解码修复和新候选状态见上节，不清零旧失败。

不同PE失败升级后，旧卸载框架固定SHA与新版live helper可能不一致；精确恢复新版helper不能替代旧框架实际卸载证明。[上轮草稿保全](../../artifacts/maintenance/v1.0.6/installation-remaining/unverified-bootstrap-drafts-01/drafts.json)及撤回按当时源码认定；本轮已恢复、修正并封入候选14，真实跨PE框架链仍待完成。原双PE材料仅历史证据，当前准备材料见上节。

## 1.0.6.13：安装候选与专项证据（2026-10-15）

候选13仍存在协调器复合恢复边界；后续源码的底层补丁只按上节组件证据认定，不反写进旧候选。框架bootstrap及真实不同PE失败恢复尚未闭合，接续见[任务缺口](../tasks/windows-installation-update.md#剩余验收与授权边界)，不将组件通过写成完整默认卸载重装保证。

待验安装候选为 [TableMax-1.0.6.13-win-x64.exe](../../artifacts/releases/TableMax-1.0.6.13-win-x64.exe)，对应[冻结交付](../../artifacts/package-payloads/v1.0.6/4e4f4f05f0a9-GUFTiZ/full/installer-delivery.json)与[成功封包日志](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-build-03/build.log)。EXE35,521,681字节，SHA `c45d0055d2f68e469dd432a56ec44cc373cdd7e48ff04c525bfce85c7a42b6df`；payload43,995,554字节、程序暂存97,354,419字节。后者尚未加入实际框架文件与首次启动模块物化计量，不能宣称完整首次启动门禁已通过。正式密钥的本地更新描述已签署并自验；尚待干净标准Windows用户的实际安装、升级、快捷方式及默认卸载证明，不推广current或发布。

[封包闭包9项](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-13-repair-03/results.json)通过全部成员、实际PE文件版本、配方输入、6款正式游戏／7个玩法的当前映射和13个完整依赖blob、生产RSA签名及原交付保全。程序保留已签历史目录元数据，[映射说明](../../artifacts/maintenance/v1.0.6/installation-remaining/production-candidate-seal-13-repair-03/current-game-mapping.json)区分25条历史目录与7条实际预装发行；静态闭包不替代实际安装后物化、系统登记或默认卸载验收。

[实际内置生产根.NET验签](../../artifacts/maintenance/v1.0.6/installation-remaining/production-signature-dotnet-13/report.json)以候选原生壳／helper各22项通过正式envelope及正文机器块，绑定相同EXE／manifest／bootstrap；入口12项只核字节与身份，不宣称入口包含验签模块。探针不运行产品Main，不能抵扣真实安装启动与Apply链。

[实际向导最终轮](../../artifacts/maintenance/v1.0.6/installation-remaining/wizard-production13-r3-03-final/report.json)通过同SHA候选副本的默认src、精确提示「不推荐安装在C盘，因为这是一个有良心的安装包」、中文空格目标、桌面任务关／开／关、准备页、返回保留设置及正常取消。自有Job和未切换私有桌面限制操作范围，同普通SID的四登记视图前后为空，目标／受管文件未生成，未知资料及原EXE SHA保全，所有自有进程自然退出。7张PrintWindow图记录实际DPI144和物理窗口尺寸；初始选中文本未被绘出，默认目录由原生控件值证明。前两轮API、权限、线程、空窗口、后台UIA输入、取消等待及裁切捕获缺陷保留，不把失败清零；该证明未点击Install，也未验收UAC或Windows安全提示。

以下证据继续按各自源码、fixture、组合输入及原SHA认定，不能因候选13静态闭包通过而改写为正式系统安装通过。

| 专项与证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 已证明范围与限制                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [阶段1房间／服务保存关闭](../../artifacts/maintenance/test-history/runs/f3d34d35-5084-40e2-b1be-9f14e907e3cf/results.json)、[私有入口及隔离](../../artifacts/maintenance/test-history/runs/f8e8bf49-1562-4c23-ad61-4e15dfba3aec/results.json)、[原生停止8场景](../../artifacts/maintenance/test-history/runs/ba303024-d2de-4816-9a8a-6c453849c6cd/results.json)、[窗口退出](../../artifacts/maintenance/test-history/runs/97c31b1d-8117-40d8-be55-20223d589e55/results.json) | 队列排空、真实SQLite、保存失败／drained确认、私有协议与Native／Node／WebView2退出；阶段1隔离候选，不包含installer。原[异步关闭失败](../../artifacts/maintenance/test-history/runs/fed592ce-cca5-48d6-96a6-274133f9b7ed/results.json)保留 |
| [JS数值与签名](../../artifacts/maintenance/v1.0.6/application-update-signature/20261015-js-numeric-01/results.json)、[实际.NET更新管理19项](../../artifacts/maintenance/v1.0.6/installation-remaining/native-update-controller-19-longpaths/report.json)                                                                                                                                                                                                                     | 严格原字节签名、规范整数、版本／摘要绑定及真实检查／下载／取消逻辑；网络由管理HTTP夹具输送，不表示GitHub新附件已发布或实际Apply通过                                                                                                      |
| [实际长路径7项](../../artifacts/maintenance/v1.0.6/installation-remaining/native-long-path-20261015-032822/report.json)                                                                                                                                                                                                                                                                                                                                                      | 420字符受管成员及361字符事务日志真实IO；未修改系统长路径策略，不承诺任意深度Native／浏览器启动路径                                                                                                                                       |
| [事务受影响7项](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-affected-05/report.json)                                                                                                                                                                                                                                                                                                                                                               | 同构建实际helper、完整10成员数据库指纹、默认／外置D保全、默认卸载与同包重装健康。迁移输入为合法保全-only形状，不冒称历史版本兼容                                                                                                         |
| [pending受管损坏2项](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-pending-damage-06/report.json)                                                                                                                                                                                                                                                                                                                                                    | DB已变化时commit/recover明确40且保全；默认卸载精确隔离坏字节、缺失不伪造、拒绝未知／超预算受管内容，同完整包重装真实健康；构造日志不代表断电实测                                                                                         |
| [恢复指纹／持续租约交接](../../artifacts/maintenance/v1.0.6/installation-remaining/recovery-fingerprint-20261014-203339/handoff.json)、[跨进程数据独占](../../artifacts/maintenance/test-history/runs/828787df-12cd-4f5a-adf1-eba29d1c8634/results.json)、[服务回归](../../artifacts/maintenance/test-history/runs/91f4022b-6ddd-4e5f-a9b2-4d6c647a0c5d/results.json)                                                                                                        | 6项租约、foundation／journal指纹分支、commit/recover的playing拒绝及foundation库全生命周期独占；不以探测后关闭的句柄代表持续复制保护                                                                                                      |
| [helper启动模式4项](../../artifacts/maintenance/v1.0.6/installation-remaining/native-confirm-final-20261014-211319/handoff.json)                                                                                                                                                                                                                                                                                                                                             | 默认生产路径持续新主机；显式工程flag才用静音后台健康检查，双PEfixture持续分支独立；不抵扣真正Apply后的新主机健康                                                                                                                         |
| [真实旧1.0.6.3档4项](../../artifacts/maintenance/v1.0.6/installation-remaining/real-old-1063-03-clean-env/results.json)                                                                                                                                                                                                                                                                                                                                                      | 原资料SHA、玩家／座位／checkpoint、旧发行恢复及新局映射，真实playing Native拒绝pending恢复20；fixture／新helper组合输入，不包含真实Inno                                                                                                  |
| [更新界面与权限6项](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-host-ui-06-clean-env/results.json)、[实际截图2项](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-host-ui-07-capture/results.json)                                                                                                                                                                                                                                     | 实际主机／公共屏／浏览器／同源child权限和短屏更新面板，清继承注入环境。历史截图套件另有3失败，不称全套通过                                                                                                                               |
| [实际保存失败屏障2项](../../artifacts/maintenance/v1.0.6/installation-remaining/helper-save-barrier-04-clean-env/results.json)                                                                                                                                                                                                                                                                                                                                               | 隔离SQLite专属trigger触发真实保存失败后，Native拒绝更新、失败退出并保全最后成功状态、身份及原档；trigger只回收本轮创建项                                                                                                                 |
| [双PE准备](../../artifacts/maintenance/v1.0.6/installation-remaining/handoff-prepare-final-07/report.json)、[准备素材复验](../../artifacts/maintenance/v1.0.6/installation-remaining/handoff-reverify-final-08/report.json)                                                                                                                                                                                                                                                  | 60000／60001及进程内RSA的双fixture已准备／签名／逐字节复验，尚未执行实际检查下载Apply→父进程退出→Inno→新helper／持续主机                                                                                                                 |

[旧事务报告](../../artifacts/maintenance/v1.0.6/installation-remaining/transaction-positive-04/report.json)保持21通过与无效迁移夹具失败；[旧Inno失败诊断](../../artifacts/maintenance/v1.0.6/installation-remaining/delivery/fixture-qwPCp2-failed/report.json)和[helper-only健康](../../artifacts/maintenance/v1.0.6/installation-remaining/delivery/fixture-EovwuK-helper-health/report.json)均不升级为系统安装证明。失败修订11／12保留，修订13不复用其编号或结果。

仍未执行：真实干净标准用户的正式GUID首装、同根重装、实际快捷方式／卸载登记、默认卸载、完整首次启动容量，以及不同PE实际Apply／helper自身升级。临时账户及所需UAC已获用户授权，本轮因三失败停止；current推广另待精确完整证明，发布仍须明确授权。临时RSA、测试GUID、隔离环境变量、静态提取或向导取消均不能替代系统门禁。运行与发布契约分别归[构建与运行](build-and-run.md#windows-安装与整个程序更新)、[Release流程](release.md#完整安装器与免费应用签名2026-10-15)，实际入口见[验证工具](../../tools/test/README.md#完整安装与程序更新验证)。

工程进程退出后已完成[一次安全维护](../../artifacts/maintenance/v1.0.6/installation-remaining/maintenance-once/result.json)，回收7项缓存4,185,200字节及67项白名单副本86,289,239字节，安全候选耗尽后停止；[全量逻辑体积](../../artifacts/maintenance/v1.0.6/installation-remaining/workspace-capacity-after.json)12,596,402,720字节，未达8GiB。原current、候选13、双PE素材／准备报告SHA仍匹配；维护前后测量时点不同，不按差值推算回收量。只读文档收尾不追加cleanup。

退役成员及原SHA见[维护清单](../../artifacts/maintenance/local-cleanup-20261014-221625-488-maintenance/cleanup.json)。封包闭包9项在维护前完成；维护后关键SHA仅由本轮终端补核，未另写独立保护报告，不把维护前结果充作维护后证明。

## 1.0.6.10：宝可梦新设计应用（2026-10-12）

当前本地完整程序为 [TableMax-1.0.6.10-win-x64.exe](../../artifacts/releases/TableMax-1.0.6.10-win-x64.exe)，公开版本仍为1.0.6。新局使用 `events-research-v3`，统一144张、17项研究、单格超梦及六类随机事件；旧存档、checkpoint及原局下一小局固定原发行。Mega与羁绊仅展示主题占位，7项缺失研究插图采用符合新条件的代码场景。主机／公共隐藏玩家缓冲，本人端保留操作；天气角标、环境层、全屏能力与路卡利欧画像波导已接入。

[实际完整EXE证明](../../artifacts/maintenance/v1.0.6/windows-editions/63b12c9af279f4a374a51d80dfa4e9251ac1f9f1c54b6b467c3cd62d1336c41a/shipping-executable-checks-full.json)通过载荷全部哈希、96成员集合、重复提取及隐藏原生WebView2／包内Node安全。EXE **44,096,512字节**，内部ZIP **43,964,478字节**，实际提取 **97,009,047字节**，均严格小于120,000,000字节。宝可梦扩展模块 **3,717,195字节**（[同包严格预算证明](../../artifacts/maintenance/v1.0.6/pokemon-events-v3-verification/module-budget-10610.json)），本轮仍按4,194,304字节门禁，新增4份运行图片共167,594字节。EXE SHA-256为 `93207df18d568e808ea903ce5d538fe1835323f80a523af95a09241eeb6364bc`，冻结快照与内部载荷由[当前指针](../../artifacts/package-payloads/v1.0.6/current.json)绑定。

源码适用检查已通过：新配置、半分／负分及多暗行计分、144张守恒、单格秘密权限、事件原子保存与恢复、三档2–6人完整三胜矩阵、6席32MiB真实Worker混合大局、原版差分与旧profile回归。人机矩阵及138,392ms混合Worker结果见[人机验证边界](../games/pokemon-encounters/bot.md#当前验证边界)。默认浮钮已修正横竖切换的右缘位置及滚动避让，5项模型检查和类型检查通过。

同一个EXE的适用专项已全部通过：[真实服务与旧发行恢复](../../artifacts/maintenance/v1.0.6/pokemon-expansion-runtime/events-v3-10610-d/results.json)、[显示矩阵](../../artifacts/maintenance/v1.0.6/network-adaptation/game-audit/events-v3-10610-a/results.json)、[演出](../../artifacts/maintenance/v1.0.6/pokemon-expansion-effects/events-v3-10610-b/results.json)、[结算与授胜](../../artifacts/maintenance/v1.0.6/pokemon-expansion-awards/events-v3-10610-a/results.json)和[自然游玩](../../artifacts/maintenance/v1.0.6/pokemon-expansion-normal-play/events-v3-10610-b/results.json)。服务专项6个受控合法事件场景经真实Socket与SQLite保存，对照实际包内规则、单张私看、随机状态及暗牌投影；真实1.0.6.3旧局的恢复、回退、重启和下一小局仍保持原发行。18张肖像、16张无损卡面、8个主题音频、27个叫声及4张新增运行图的离线哈希／解码通过。

显示矩阵含2／4／6人、手机320–430px竖屏及568–932px横屏、电脑720p至4K横竖与短屏／长昵称／浮窗／100／125／150%模拟缩放；1,674次布局审计、422次真实点击、37次草稿保留、425组天气角标几何记录及54格结算通过。记录自然按钮高度、18px主要动作、44px触区及多点点击命中。自然随机对局没有遇到所有能力和事件，未遇阶段单列，固定合法场景补验独立记录；不以随机游玩代替全覆盖。

演出专项106,490ms通过59帧既有姿态、13条序列、路卡利欧画像波导、六类事件三身份、减少动态／取消／恢复不重播，以及原版喷火龙／卡比兽真实规则触发。自然游玩使用实际服务和本人UI，记录15次叫声成功播放；技术播放不表示真人听感已认可。独立查看六人结算、手机雨天角标和能力入场，布局与角色辨识清晰；简化演出仍需真人美术认可。失败达到3项停止后定向复验，原失败与修复过程见[归档](../archive/completed-tasks-2026-10-10.md#宝可梦新设计应用2026-10-12)。实体手机、现场LAN、物理DPI、真人听感、美术认可、7项插图、Mega／羁绊独立效果与时长平衡继续[待验收](../tasks/pokemon-encounters-expansion.md)。本轮仅本地交付，不发布Release／Pages或源码ZIP。

## 当前源码与本地交付

当前本地交付为本页[宝可梦新设计应用](#10610宝可梦新设计应用2026-10-12)的 `TableMax-1.0.6.10-win-x64.exe`与本地清单；内部payload、manifest及 `current.json`位于 `artifacts/package-payloads/v1.0.6/`。预装6款正式游戏／7个玩法，新局固定本EXE的验证映射；旧局按原精确发行继续。当前交付与实际证明保留，同包专项状态以上节为准，历史构建只按各自哈希和原结果认定。

EXE、内部载荷、原图、签名仓库和本地验收不随源码push上传。公开版本仍为1.0.6，线上已发布附件保持2026-10-11的原字节，本地1.0.6.10尚未发布。提交／推送不授权Release或Pages部署，不生成源码ZIP。

此前深度瘦身实测 **5,896,919,854逻辑字节**（含受保护嵌套仓库），达到当次6GB目标；1.0.6.10交付收尾实际退役6,526,191,088字节，维护实测10,340,767,910逻辑字节（9.631GiB，排除链接与嵌套仓库），低于默认10GiB阈值，追加删除0，见[本轮瘦身记录](project-slimming.md#宝可梦新版交付收尾2026-10-12)。历次“原包保留”和容量数字仅表示当时状态；已按审计退役的历史包／截图由当前精确清单说明，不修改原失败、文字结论或逐文件哈希。

本页[手写改动单第1项](#106手写改动单第1项2026-10-11)曾交付运行ZIP，SHA `0048f55745f66c289eed918b78efccb058afbd4e2014bbc67655d36cc3be52c5`；该真实旧包作为明确迁移／验证输入保留在独立历史目录。下方更早的电力公司及宝可梦整合结论仍限定原版本，不表示当前需下载ZIP或重复其完整整局检查。

## 1.0.6.3：关闭与WebView2资源释放（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#1063关闭与webview2资源释放2026-10-12)。

## 1.0.6：唯一完整 EXE（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106唯一完整-exe2026-10-12)。

## 1.0.6：版本适应性与本地四位版本（2026-10-12）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106版本适应性与本地四位版本2026-10-12)。

## 1.0.6：游戏包失败原因细化（2026-10-12，源码）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106游戏包失败原因细化2026-10-12源码)。

## 1.0.6：下载文字与EXE命名微调（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106下载文字与exe命名微调2026-10-11)。

## 1.0.6：阿瓦隆唯一配置与并发密投（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106阿瓦隆唯一配置与并发密投2026-10-11)。

## 1.0.6：安装索引并发与临时journal恢复修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106安装索引并发与临时journal恢复修复2026-10-11)。

## 1.0.6：测试选择与证据复用（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106测试选择与证据复用2026-10-11)。

## 1.0.6：安装故障矩阵与验收范围调整（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106安装故障矩阵与验收范围调整2026-10-11)。

## 1.0.6：轻量目录与统一玩法控件（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106轻量目录与统一玩法控件2026-10-11)。

## 1.0.6：空盒子大厅与两种Windows EXE（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106空盒子大厅与两种windows-exe2026-10-11)。

## 1.0.6：Pages部署与同版本重新发布（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106pages部署与同版本重新发布2026-10-11)。

## 1.0.6：Pages准备、盒子界面与人机发言（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106pages准备盒子界面与人机发言2026-10-11)。

## 1.0.6：独立游戏包与公共作者契约（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106独立游戏包与公共作者契约2026-10-11)。

## 1.0.6：手写改动单第1项（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写改动单第1项2026-10-11)。

## 1.0.6：UNO右侧白边与手牌宽度（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106uno右侧白边与手牌宽度2026-10-11)。

## 1.0.6：拉密交互完善与恢复开放（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106拉密交互完善与恢复开放2026-10-11)。

## 1.0.6：手写bug第5–7条修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写bug第57条修复2026-10-11)。

## 1.0.6：手写bug前四条修复（2026-10-11）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106手写bug前四条修复2026-10-11)。

## 1.0.6：盒子12席显示兼容（2026-10-10，源码专项）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106盒子12席显示兼容2026-10-10源码专项)。

## 1.0.6：经典阿瓦隆（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106经典阿瓦隆2026-10-10)。

## 1.0.6：更新构建（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106更新构建2026-10-10)。

## 1.0.6：UNO 交互优化（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#106uno-交互优化2026-10-10)。

## 1.0.5：经典 UNO 完整本地交付（2026-10-10）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105经典-uno-完整本地交付2026-10-10)。

## 1.0.5：发言面板优化（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105发言面板优化2026-10-09)。

## 1.0.5：盒子初始选择与网址入口（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105盒子初始选择与网址入口2026-10-09)。

## 1.0.5：玩家互动音效触摸解锁（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105玩家互动音效触摸解锁2026-10-09)。

## 1.0.5：拉密经典版本地完整交付（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105拉密经典版本地完整交付2026-10-09)。

## 1.0.5：GitHub发布核验（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105github发布核验2026-10-09)。

## 1.0.5：菜单、互动并发与手机同步（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105菜单互动并发与手机同步2026-10-09)。

## 1.0.5：互动精修与即时覆盖（2026-10-09）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105互动精修与即时覆盖2026-10-09)。

## 1.0.5：盒子调整与跨游戏互动（2026-10-08）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#105盒子调整与跨游戏互动2026-10-08)。

## 1.0.4：网络连接与多设备页面适配（2026-10-08）

见[原验收与版本边界](../archive/acceptance-2026-10-09-to-12.md#104网络连接与多设备页面适配2026-10-08)。

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
