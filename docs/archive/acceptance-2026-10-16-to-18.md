# 历史验收与候选记录（2026-10-16至18）

归档原因：当前验收页只保留最近记录、已验收current及公开发行的实际证明。本文按迁移时原文保存较早候选与过程，不将待验收改为通过，不表示原字节仍存在或已经退役。当前身份与未测边界见[当前验收](../reference/acceptance.md#当前源码与本地交付)。

## 马尼拉完整港湾安装候选（2026-10-17，待验收）

完整安装器1.0.7.26（原EXE路径现缺失，仅供身份追溯：`../../artifacts/releases/v1.0.7/1.0.7.26/TableMax-1.0.7.26-installer-win-x64.exe`；不可作为现存安装器使用）及[清单（原件现状）](historical-evidence-audit-2026-10-23.md#h01tablemax-10726-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.26/TableMax-1.0.7.26-installer-win-x64-manifest.json`）包含源码a93e674的完整岸线、行情横带、内嵌行动位、持续挂载与手机滚动稳定化；预装七款游戏／八玩法，公开版本1.0.7。EXE 38101365字节，SHA 973a5849d250ccfb8e9f006006f8e8b2809cab6136e4b05e6b9217c93ac17d75；内部ZIP 46351685字节、实际提取 99277194字节／120成员，三项均严格小于120,000,000字节。

[改动汇总](manila-harbor-rebuild-2026-10-17.md)、[源码验证](../../artifacts/maintenance/manila-harbor-rebuild-20261017/verified-source.json)与[最终独立图审](../../artifacts/maintenance/manila-harbor-rebuild-20261017/visual-review.json)记录实测、失败和替换复验。主机／公共屏234组唯一组合、手机四宽定向检查及受影响静态检查通过；规则、存档、秘密投影和通信协议保持原边界。模拟测试不当作真实设备证明。

[验收清单](../../artifacts/maintenance/manila-harbor-rebuild-20261017/acceptance-plan.md)绑定新候选冻结输入、原路径Medium安全状态、双PE准备与复验，均0失败。正式系统安装、标准账户启动及真实设备验收仍待执行，current保留1.0.7.22，未推广或发布。

## 马尼拉手机调位与主机布局安装候选（2026-10-17，待验收）

此候选已由1.0.7.26替代，原EXE按原SHA退役；原manifest、载荷与证明保留。

[完整安装器1.0.7.25（原件现状）](historical-evidence-audit-2026-10-23.md#h02tablemax-10725-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.25/TableMax-1.0.7.25-installer-win-x64-manifest.json`）及[清单（原件现状）](historical-evidence-audit-2026-10-23.md#h03tablemax-10725-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.25/TableMax-1.0.7.25-installer-win-x64-manifest.json`）包含源码7e0c983的盒子入座状态合组、手机箭头调位、操作／结算对齐、64px出价框与主机视口布局，预装七款游戏／八玩法，公开版本仍1.0.7。EXE 38101577字节，SHA 183ffe626af8776bf938872b3dc1f73b12a9807df70ec8e4349dcd3b721a7999；内部ZIP 46348241字节、实际提取 99273756字节／120成员，均严格小于120,000,000字节。

[改动汇总](manila-touch-layout-2026-10-17.md)及[源码验证](../../artifacts/maintenance/manila-touch-layout-20261017/verified-source.json)记录36组盒子、20项手机交互、12项标签、4项房主下一航次、216组主机／公共布局、终局18项替换复验和38组保存回归；最终手机、结算、终局[独立图审](../../artifacts/maintenance/manila-touch-layout-20261017/visual-review.json)通过。规则、秘密投影与既有动作管道不变；模拟设备不冒充真实手机、LAN或原生DPI。

[验收清单](../../artifacts/maintenance/manila-touch-layout-20261017/acceptance-plan.md)绑定新25的冻结输入、原路径Medium安全规范化、双PE准备与复验，均0失败。本轮正式系统安装／保存／卸载重装及实际设备验证尚未执行，current保留已验收1.0.7.22，未推广或发布。

## 马尼拉竞拍与保存反馈安装候选（2026-10-17，待验收）

此候选已由1.0.7.25替代，原EXE按原SHA退役；以下保留原准备范围与身份。

[完整安装器1.0.7.24（原件现状）](historical-evidence-audit-2026-10-23.md#h04tablemax-10724-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.24/TableMax-1.0.7.24-installer-win-x64-manifest.json`）及[清单（原件现状）](historical-evidence-audit-2026-10-23.md#h05tablemax-10724-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.24/TableMax-1.0.7.24-installer-win-x64-manifest.json`）预装七款游戏／八个玩法，包含源码5b0374c的竞拍三行布局、三按钮同高居中和普通保存回执图层修复；公开版本仍为1.0.7。EXE38,101,198字节，SHA 5eadf29dbd92cd6f4eee1d998ce46b7bacbc96716a7bd05d9cd1f8572689af10；内部ZIP46,345,583字节、实际提取99,270,824字节／120成员，三项均严格小于120,000,000字节。

[源码验证](../../artifacts/maintenance/save-overlay-auction-20261017/verified-source.json)记录171组唯一布局、七组竞拍操作与21项反馈／浮窗检查，以及独立最终截图审查；旧失败与修复轮次保留。模拟视口／DPR不代表真实手机、LAN、原生DPI或安装后验证。[冻结输入](../../artifacts/maintenance/save-overlay-auction-20261017/frozen-inputs.json)与[输入检查](../../artifacts/maintenance/save-overlay-auction-20261017/delivery-input-check.json)核对42单元、812个唯一输入及本任务产品源码；原路径EXE的Low→Medium[规范化回执](../../artifacts/maintenance/save-overlay-auction-20261017/original-executable-security-normalization.json)保全字节／SHA、所有者、DACL和其他流。

[验收清单](../../artifacts/maintenance/save-overlay-auction-20261017/acceptance-plan.md)提供绑定新24载荷的双PE准备材料、复验及正式执行命令；本轮仅准备验收，正式系统安装／保存／卸载重装与实际设备检查未执行，current仍为已验收1.0.7.22，未推广或发布。23原EXE已按原SHA退役，原manifest、载荷与证据保留。

## 偏好改造完整安装候选（2026-10-17，待验收）

此候选已由[1.0.7.24](../reference/acceptance.md#马尼拉竞拍与保存反馈安装候选2026-10-17待验收)替代，原EXE已退役；以下保留当时准备范围与原身份。

已生成[完整安装器1.0.7.23（原件现状）](historical-evidence-audit-2026-10-23.md#h06tablemax-10723-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.23/TableMax-1.0.7.23-installer-win-x64-manifest.json`）及[清单（原件现状）](historical-evidence-audit-2026-10-23.md#h07tablemax-10723-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.23/TableMax-1.0.7.23-installer-win-x64-manifest.json`），预装全部七款游戏／八个玩法，纳入最新座位、玩法简介和[22项偏好改造](ui-preference-changes-2026-10-17.md)。公开版本保持1.0.7。EXE为38,098,219字节，SHA `2ed06867b534bbb26148a670c9e28ab3557e0219122554637d4eca10793205a2`；内部ZIP46,344,944字节、实际提取99,269,709字节／120成员，三项均严格小于120,000,000字节。

[冻结输入](../../artifacts/maintenance/v1.0.7/ui-preference-installer-20261017/frozen-inputs.json)绑定候选、独立pointer与实际载荷；新EXE原路径的继承Low标签经[单文件规范化](../../artifacts/maintenance/v1.0.7/ui-preference-installer-20261017/original-executable-security-normalization.json)调整为Medium，字节／SHA、所有者、DACL及其他流保持。[双PE材料](../../artifacts/maintenance/v1.0.7/ui-preference-installer-20261017/handoff-prepared/report.json)及[精确复验](../../artifacts/maintenance/v1.0.7/ui-preference-installer-20261017/handoff-reverified/report.json)均为准备完成、未执行，failures为0；不代表安装或更新成功。

后续命令、原路径启动、标准账户系统链和最终包体验检查见[验收清单](../../artifacts/maintenance/v1.0.7/ui-preference-installer-20261017/acceptance-plan.md)。本轮仅准备验收，正式安装／保存／卸载重装、账户清理与真实设备验收尚未执行；已验收current仍为1.0.7.22，未推广或发布。

## 手机座位与玩法简介快速改造（2026-10-17，源码）

本轮交付源码，不重封安装器，公开版本仍为1.0.7；现有1.0.7.22完整EXE不包含下述新增改造。手机座位入口移至牌桌标题旁，座位名片缩为头像／姓名状态／操作三列，二级标题固定，长昵称不挤压按钮。后续盒子及七款游戏的22项偏好改造均已完成，最终改动与验证边界见[汇总](ui-preference-changes-2026-10-17.md)；原分游戏报告已合并清理。

简介保留宝可梦原版及现代艺术原内容和图解；重做宝可梦扩展、电力公司、UNO、拉密、阿瓦隆、马尼拉的短内容与18张主题SVG。可选图解字段随对应游戏资源冻结，旧发行按原release读取；真实404回退原图标。详情投影与秘密权限未改。

[座位验证](../../artifacts/maintenance/seat-intro-audit-20261017/seats-round06/report.json)通过22组／10布局／32截图，覆盖320×568、390×844、430×932、844×390、1280×720及主机／房主／普通玩家／公共权限，核验等级、排序、改名、游戏中保护、焦点、字体、触控与祖先裁切。[简介验证](../../artifacts/maintenance/seat-intro-audit-20261017/introduction-round02/summary.json)通过八玩法×三端×九视口共216布局，并完成40图独立视觉审查；[资源边界](../../artifacts/maintenance/seat-intro-audit-20261017/introduction-resource-cases/summary.json)验证开发预览、固定发行和真实404三项。类型、局部ESLint／Prettier、SDK四项、图解收集四项及平台／受影响元数据和资源的增量构建通过，明细见[本轮清单](../../artifacts/maintenance/seat-intro-audit-20261017/delivery-index.json)。

上述为实际源码组件与模拟视口；座位动作只核对发出的既有命令，不替代真实服务保存、实体手机、真实LAN、Windows DPI或安装验收。原环境失败、320px标题孤字及长名挤压的发现与修复记录保留，最终证据按各自实际影响范围复验。

## 设置与马尼拉体验深化（2026-10-16）

当时本地交付为[完整安装器1.0.7.18（原件现状）](historical-evidence-audit-2026-10-23.md#h08tablemax-10718-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.18/TableMax-1.0.7.18-installer-win-x64-manifest.json`）及[清单（原件现状）](historical-evidence-audit-2026-10-23.md#h09tablemax-10718-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.18/TableMax-1.0.7.18-installer-win-x64-manifest.json`），预装全部七款游戏／八个玩法。EXE37,904,603字节，SHA `5446f87b5cdd8c469a194858a19442559e937621b94a354663a2e8d07153c5ee`；内部ZIP46,148,138字节、实际提取99,048,483字节，98成员运行前后逐SHA核验，均严格小于120,000,000字节。公开版本仍为1.0.7，未发布、部署或生成发布source ZIP。

三个设置页完成防溢出及顶栏圆角入口；马尼拉完成独立手机竖港、图形草稿／确认、按需详情、四货物及岗位图像、七类流程图解、原创短音效及保存后演出。候选17通过26布局、三／四／五人自然整局与各一条完整真实UI航次、设置80项；候选18仅修图解CSS后定向复验手机6布局／图框边界。规则、服务、策略、Worker、资源和盒子按[字节等价](../../artifacts/manila/validation/runtime-equivalence-17-18.json)复用，不增加执行统计；具体检查与设备边界见[游戏验证](../games/manila/validation-scenarios.md#当前结果)。

[原EXE安全修正](../../artifacts/manila/deepening-18-security-normalization.json)只将可信原路径installer继承Low纠正为Medium，核字节、SHA、owner、DACL与全部数据流不变。[同次原路径标准账户启动](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01/original-executable/report.json)与[中文向导](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01/installer-wizard/report.json)通过，不以同SHA副本替代原文件。

同一新标准账户／真实Medium profile完成[默认D](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01/application-handoff/report.json)、[长I／外置D](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01/application-handoff-long-root-external-data/report.json)和[旧框架失败恢复](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01/application-framework-recovery/report.json)，各8步通过、0失败；随后完成正式ID首装、同包复装、快捷方式、真实保存后默认卸载、同根重装读回、再次卸载及资源删留。实际已安装Native的[更新设置页](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01/installed-update-layout/report.json)16项正常／长文字布局通过，核支持状态、版本、窗口及身份恢复；不代表真实线上检查、错误或下载进度已发生。

[账户终态](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01/isolated-account.json)与[驱动终态](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/production-account-18-01-completion.json)确认退出0、账户及profile删除、errors为空。[只读封存证明](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/finalized-installation-18.json)1,996,830字节，SHA `fd3a1284df5e28bde7429247a0a0d96cda449492e760aa96ccd2707416eaa724`，重核原receipt、全部方法、16项布局截图／报告和保留runtime；[推广回执](../../artifacts/maintenance/v1.0.7/manila-deepening-20261016/promotion-receipt-18.json)经严格门禁将本地current切至18，未修改线上附件或旧发行映射。

首次完成安装并健康启动的同次采样117,466,494字节＝程序99,656,855＋框架5,273,757＋身份／配置16,374＋当前游戏12,519,508，低于120,000,000硬限，触发110,000,000工程预警。preStartupSampled为false；阶段观测最大183,784,018字节含数据／缓存／暂存，isAbsolutePeak为false。实际播放音效串听完成，未作人耳主观音质认证；实体手机、Safari、真实LAN、物理4K／DPI、真人多人长局及线上正向更新UI下载未在本轮实测。失败、修复与视觉审查见[体验深化归档](manila-experience-deepening-2026-10-16.md)，设备接续见[任务](../tasks/manila-development.md)。

## 马尼拉本地候选（2026-10-16）

以下为深化前的历史验收，当时本地交付为[完整安装器1.0.7.9（原件现状）](historical-evidence-audit-2026-10-23.md#h10tablemax-1079-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.9/TableMax-1.0.7.9-installer-win-x64-manifest.json`）：七款游戏、八个玩法；EXE36,616,557字节，SHA `7b1c6e470552f0b5a16ce591f017ba69b492bac76855a2a96b93a522eb16d8b1`；内部ZIP44,861,683字节、提取97,752,749字节，运行前后98成员逐SHA一致。[封包记录](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/package-09.json)绑定实际交付。

已修复公开最高竞价／领先者缺失、非付款玩家错误融资提示、同分名次差异，并补领航草稿结果／清空。最新3项UI回归通过；候选8通过三端26布局、保存动态及6航次136动作；候选9专门复验融资首屏可见完整抵押按钮，6布局及5航次137动作通过。未受影响的规则／策略／服务／Worker原检查按[执行字节等价](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/runtime-equivalence-07-09.json)复用，不增加统计。

用户明确授权后，在同一新标准账户／真实Medium profile完成[中文向导浏览与取消](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/installer-wizard/report.json)、[默认D](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/application-handoff/report.json)、[I198／短外置D](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/application-handoff-long-root-external-data/report.json)及[旧框架失败恢复](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/application-framework-recovery/report.json)三条完整8步链，均0失败。更新链使用独立夹具GUID；[正式产品原始证明](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/shipping-executable-checks-full.json)则执行精确1.0.7.9正式GUID安装包，12项通过，含首装、同包复装、登记／快捷方式、保存、两次默认卸载、同根重装读回原玩家及发行、精确受管成员与数据保全。

两次游戏资源清理回执均为completed，各删除201文件、保留56文件、deferred为空；实际保存依赖、数据库、配置和未知文件保全。该数据来自正式安装后的实际回执，不以向导取消或fixture链替代。

[账户终态](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02/isolated-account.json)及[外层回执](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/production-account-09-02-completion.json)确认退出0、账户及profile均删除、errors为空。[独立封存证明](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/finalized-installation-09.json)1,801,414字节，SHA `4a05baa446a0e900870723f51959505e7ac23c77393a48fe8f30467836825759`，只读重核同次receipt、完整方法、三链、清理与99文件保留runtime。[本地current回执](../../artifacts/maintenance/v1.0.7/manila-installation-20261016/round-01/promotion-receipt-09.json)通过严格门禁后将本地交付切换为1.0.7.9；公开1.0.7及原附件保持不变，未发布、部署或生成发布source ZIP。

首次安装完成并健康启动的同次程序采样114,824,311字节＝程序98,361,129＋框架5,273,757＋身份／配置16,371＋当前G11,173,054，低于120,000,000硬限，触发110,000,000工程预警。preStartupSampled为false；阶段观测最大178,430,359字节包含数据／缓存／暂存，isAbsolutePeak为false。向导与系统链通过不代表浏览器SmartScreen、真实断电、实体手机LAN或物理DPI通过。原失败、工具修复及单次维护见[归档](manila-2026-10-16.md#安装验收与体验优化接续2026-10-16)；剩余设备范围见[接续任务](../tasks/manila-development.md)。

### 原交付EXE安全标记与直接启动补证（2026-10-16）

用户追加原EXE门禁后，[实际初查](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-security-before.json)发现1.0.7.9原文件继承Low完整性标签；此前系统验收使用同SHA的新profile副本，只证明对应范围，未证明原路径启动。对可信最终产物执行单文件Low→Medium修正，[修正回执](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-security-normalization.json)核字节、SHA、owner、DACL及全部数据流不变；EXE仍为36,616,557字节和本节原SHA，不重封、不新增修订。原文件无ADS／Zone.Identifier，Authenticode为NotSigned，项目RSA应用签名与其分别认定。

[原路径实际报告](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02/original-executable/report.json)从原交付路径直接启动原EXE，实际bootstrap及向导子进程均为同一新标准SID、Medium且未提权；中文向导、实际默认路径、返回及取消通过，原进程正常取消码2，自有Job自然归零，登记／目标目录未创建，原EXE元数据和源目录内容保持不变。实际截图已人工核对。[账户终态](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02/isolated-account.json)及[外层回执](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02-completion.json)确认退出0、账户／profile删除、errors为空。

[原始补证](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/original-account-09-02/original-executable-evidence.json)31,841字节，SHA `9b8d70fd6fa7059c1ea0277eecbad2a5c304995145e345dfbe6b68e1684ea6d8`，已由[原子附加回执](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/attach-current-09-02.json)关联到本地current。[最终门禁重核](../../artifacts/maintenance/v1.0.7/original-executable-20261016/round-01/gate-revalidation-04.json)读取实际原始截图、进程／清理证明及当前安全元数据后通过。后续缺该补证或安全标记／原路径身份不符时，本地current切换与发布预检拒绝。原24步更新／恢复及12项正式系统证明保持原字节，不重复计数；本轮没有发布或追加工程清理。

首轮补测因工具过滤掉profile守卫变量，在原EXE启动前失败，纠正后实际原路径通过；只读附加阶段另遇Low Node无法向系统TEMP写编译临时文件，改用自有profile／工程tmp目录后只读复验通过，未重跑账户或产品操作。对应失败、独立预算和实质原因保留于该证据根。相关32项工具用例通过；最新受影响24项复验通过，另外8项未变用例按先前通过复用，不重复计数。此补证使用CreateProcess直接启动，不冒称浏览器下载、Explorer双击安全提示或SmartScreen信誉验证。

### 首轮开发候选1.0.7.7

[完整安装候选1.0.7.7（原件现状）](historical-evidence-audit-2026-10-23.md#h11tablemax-1077-installer-win-x64-manifestjson)（历史原路径 `../../artifacts/releases/v1.0.7/1.0.7.7/TableMax-1.0.7.7-installer-win-x64-manifest.json`）包含七款游戏、八个玩法，新增2005经典《马尼拉》3–5人、三档本地策略和写实动态沙盘。EXE为36,616,229字节，SHA `f986705422062dcfae0cda86ebaff1842eab31aee8e84f5a12bca4c0010931ec`；内部ZIP44,861,285字节、实际提取97,752,337字节，运行前后98成员逐SHA一致。[封包记录](../../artifacts/manila/validation/package-candidate07.json)绑定候选及安装清单。

本游戏37项规则／策略、2项真实Socket／SQLite、4项实际Worker检查通过；最终三端20项布局与保存动态、手机6项定向布局／真实操作、5人自然整局均有对应证据。主机／公共实际CSS视口达3840×2160，缩放读回平台125%／150%独立偏好并断言对应视口。后续候选的权威执行字节相同，复用范围、失败返修及实际版次见[马尼拉验证](../games/manila/validation-scenarios.md)。

此候选未执行干净Windows账户的系统首装／升级／卸载认证，未做实体手机、真实LAN或物理DPI验收。正式current与公开1.0.7仍保持1.0.7.2原字节；没有发布Release、source ZIP或部署Pages。已完成开发过程见[归档](manila-2026-10-16.md)，后续设备／推广工作见[任务](../tasks/manila-development.md)。
