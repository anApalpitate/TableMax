# 交付与验收历史：2026-10-01 至 2026-10-04

本页于 2026-10-04 从当前验收页移入，保存电力公司 debug、通用视觉维护、版本导出、电力公司接入、首版 AC 与历次维护的原始结论、证据、耗时及哈希；这些记录只证明对应当时产物。当前交付与边界见 [验收记录](../reference/acceptance.md)。文内原标题与锚点保留，仅同级参考文档链接随目录调整。

首批迁移前历史正文（统一 LF）的 SHA-256：`6e21fd15911ba6fd4a1505cd58d6306237124ea0d863a5e062d8dbc90caa0adf`。

2026-10-05 完成合并应用验收后，用户明确授权退役历史版本。下文包链接已改指同位置的 `.zip.retired.json`，原包字节已删除；独有源码／素材、清单、结果、日志和独有截图继续保留。历史正文的“当前”“保留副本”等表述均指当轮验收时点，不代表旧 ZIP 仍可下载。原大小、哈希与通过／失败结论不变，实际清理及保留核验见 [瘦身记录](project-slimming-2026-10-05-to-08.md#执行结果)。

2026-10-04 用户授权清理不再需要的历史内容后，部分完全重复的验收 PNG 按精确清单去重。原结果与本页历史结论保持原文；已退役截图的路径、哈希和同字节保留位置，从 [当前清理记录](acceptance-2026-10-05-to-08.md#历史截图去重2026-10-04)查询，不能把去重当成重新执行旧验收。

现代艺术 debug 正文另于本轮维护后移入，统一 LF 原文 SHA-256：`dfdf6e33b9cacf627dfcc17f1d3456b0deed2121334c91d176324203aa3da215`；下节同名 ZIP 是当时产物，其原字节另存 [本轮保留副本（已退役）](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/before/TableMax-1.0.2-win-x64.zip.retired.json)，不由当前同名包代替。

电力公司 debug 的原文于本轮重新导出前移入；原 `7801b3c8…` 程序与清单保存在 [旧 ZIP（已退役）](../../artifacts/maintenance/v1.0.2/reexport-20261004/before/TableMax-1.0.2-win-x64.zip.retired.json)及 [旧逐文件清单](../../artifacts/maintenance/v1.0.2/reexport-20261004/before/TableMax-1.0.2-win-x64-manifest.json)，下文同名包指当时产物。

## 1.0.2：电力公司 debug，横向地图、价区与声画（2026-10-04）

按用户追加要求继续沿用 **1.0.2**。展示层顺时针旋转 90°，1200×900 横向地图、城名和房屋正向；规则数据仍为原 900×1200 坐标、42 城／六区／83 边。窄屏地图利用可用宽度，按实际尺度展开名称与费用，所选城名夹在全图边界内；点击／键盘仍选择同一城市，预览、缩放和拖拽不发游戏动作。较高电脑屏六家公司等分列，窄厂牌单列纵滚；短屏将完整公司／顺序放入浮层。手机竞价的金额、确认和退出紧接最高价，320×568 首屏可用，完整顺序／名单按需展开。

经典出版文本复核与 [并发审计](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/concurrency/rules-and-concurrency-audit.md)支持购厂按排名发起、单场按座位顺时针报价，首轮买完额外排序，采购与建城按排名逆序逐人完成。界面明确当前人、排名和资格，不提前许诺下一场发起者。燃料为 36 个价区／84 个位置，逐份价格、实心份额、空位和最低有货箭头都有独立含义；先显示四种燃料现价与存量，再查详细价区。价格规则原已正确，本轮澄清展示，没有改经济、规则、状态、策略、协议或存档版本；35 张非直接官方逐卡认证的既有边界仍保留。

未复现服务端竞拍并发故障。新增两项真实 Socket／RoomCoordinator／SQLite 回归覆盖同时 bid／pass、两连接同动作去重／冲突、失效身份／回合、转存与采购／竞价冲突、失败保存重试、重启和回退旧分支；与既有服务回归合计 3 项通过。源码工程类型与 ESLint 通过，[4 文件／44 项相关测试](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/delivery/source-checks.json)通过，64.81 秒；资源清单格式返修后全工程格式通过，最终地图修改后类型与目标 lint 再查通过，不机械重跑无关整库测试。

规则扩为八章，以五张实际隔离区域图和代码绘制的流程／价格／仓储示意讲解顺序、竞拍、采购、路线、三个步、补给／收入与胜负。原 PNG、旧 v1 和返修前图均保留，最终五张无损 WebP **421,250 字节**，[尺寸与 RGB 像素逐字节核验](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/rules-compression.json)通过。六个原创工业 WAV v2 **180,634 字节**，六类主题视觉只响应新保存反馈；首次同步、回退和刷新不补播，普通重复同步不重启／截断反馈，静音只影响声音，减少动态使用短静态标记。终局新保存可触发声音和效果。

[独立单图审查](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/root/visual-review.json)发现手机主操作在首屏外、电脑末席横向隐藏和边缘城名裁切，均返修并复核。最终手机竞拍／建城、实际便携采购屏、报价与结算 FX 帧没有必修项；详细铀价区仍需在市场内纵滚，不能写成所有 84 位置同时在小屏首屏显示。全图隐藏密集名称／费用的取舍由已通过的选城／放大检查补证，单图意见不扩大成未观察动态、整局或权限结论。

| 验证                                                                                                                           | 结果与实际墙钟                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [最终组件矩阵](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/power-grid/expanded-ui-final/results.json)         | 96 布局／7 交互／5 音频报告通过，24.54 秒；包括短手机竞价首屏 44px 控件、草稿／同节点同步、所有可见公司标题和完整价区。                                                                                                                     |
| [最终地图专项](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/power-grid/rotated-map-labels-passed/results.json) | 42 正向城市、83 边、坐标转换、键盘／指针、局部费用及实际可选城名边界通过，18.11 秒。                                                                                                                                                        |
| [同 ZIP 六席与显示](../../artifacts/maintenance/v1.0.2/power-grid/runtime/portable/pg-debug-portable-final/results.json)       | 12 轮自然结束，三个步、八状态、三档真实 Worker、22 原生显示场景和 21 实时顺序／价区校验通过，381.99 秒；1,129 状态核验、1,094 动作逐 checkpoint 重放。回退、SQLite 重启、同手机身份、房主、再玩及三游戏切换通过，普通 Worker 样本 1,613ms。 |
| [同 ZIP 三端图文规则](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/rules/portable-final/results.json)          | 9 组合通过，19.15 秒；5 图实际解码、字号／44px、页面与浮层宽度、章节焦点、Esc／滚动恢复、对局及身份不变。源码首检亦通过，13.56 秒。                                                                                                         |
| [同 ZIP 原生媒体／声源](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/native-audio/portable-final/results.json) | 41 项通过，99.09 秒；六种合法准备 checkpoint 后的真实 Socket 保存、唯一原生 claim、原媒体 play 成功及 onplaying、6 WAV 解码；公共优先／主机回退、重进／刷新／同步／暂停恢复／测试不补播及静音保留 FX，12 张保存后的实际短帧。               |

源码完整局的两次失败分别为验证器仍用旧采购文案空格和旧地图图例 accessible name；保存／规则及已完成整局不受影响，选择器按真实新控件修正，原失败报告保留。名称边界首检试选了未启用区域的城市，修正为实际可选列表，未扩大游戏选择权限。首个 `ba81fff1…` 中间包已在地图标签返修前归档，最终同名 ZIP 没有在验收后再次构建。

当前 [Windows ZIP（已退役）](../../artifacts/maintenance/v1.0.2/reexport-20261004/before/TableMax-1.0.2-win-x64.zip.retired.json) **40,023,500 字节**，实际解压 **136 文件／94,899,866 字节**，95 MB 工程预算余 **100,134 字节**，双 100 MB 硬门禁通过；打包 **15.12 秒**。SHA-256：`7801b3c8dab873b5a344c441ed5d4a41e9799f98111d39e42a756bfc20fe4292`。三项原生完整局／规则／媒体结果均对应这个哈希。[逐文件审计](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/delivery/package-audit.json)证明 12 张规则 WebP、6 个电力公司 v2 WAV 各打包一次，无原 PNG／旧 v1 声音；19 个非网页运行文件与旧包严格相同，原生 EXE 仅有已记录的 Git 编译版本标记差异。[其他游戏网页审计](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/delivery/non-pg-web-stability.json)证明 3 CSS 严格同 SHA，4 JS 正文仅共享 chunk 引用名哈希变化，不把它们声称为原始字节全相同。

验收采用隔离存档／手机身份、回环监听和隐藏真实 WebView2；所有启动均退出并确认服务不可达。完整局使用测试节奏并另取普通 Worker 样本，媒体准备例用合法两真人路径，不能冒称人类六席全程普通节奏。未认证实体手机、Safari、Wi-Fi、电视、人耳听感或扬声器输出；暂停检查证明不补播及效果清理，不证明物理输出停止时延。旧 `9f02b332…` 正式 ZIP／清单、原素材及失败／中间证据保留；本轮统一 Git commit 不包含用户原有两处 Node／防火墙文档新增，不 push。

构建与验收进程全部退出后执行 `Maintain-Project.ps1 -Apply`，[安全维护（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除 3 个已过保护期的隔离中间目录，**7,988,716,414 字节（7.44 GiB）**，45.58 秒。其余 5 个近期修改目录按 30 分钟保护保留，当前 ZIP 哈希不变；剩余工作区约 **22.784 GiB 逻辑字节**，结果为 `candidates-exhausted`，没有扩大删除素材、历史证据、正式存档、依赖／缓存或绕过近期保护。工程格式、12 个修改文档的 236 个文件／锚点链接及 diff 检查通过。耗时分开记录，不把并行步骤相加为总时长。

## 1.0.2：通用视觉、规则说明与项目瘦身（2026-10-04）

按用户本轮要求沿用 **1.0.2**。共性整理为主体优先、16／18／20 px 信息下限、44 px 操作目标、文字与符号辅助颜色、卡面外独立标记、纵向集合、保存后声画及按需顶层规则说明。宝可梦固定两行三列、现代艺术拍卖与人机、经典德国地图和各游戏秘密权限继续独立，不能把画廊布局或拍卖表现机械推广。用户原话、共性、游戏例外分别归 [美术偏好](../reference/art-preferences.md)、[通用视觉](../reference/visual-design.md)及游戏主题；规则帮助覆盖此前仅现代艺术的例外，不自动增加强制教学。

总索引按任务意图给最小阅读入口，当前主题定向查询，追溯时再查归档；唯一正文、迁移入链、旧锚点和验证范围的维护规则已补齐。长历史验收移入 [历史页](acceptance-2026-10-01-to-04.md)，旧标题保持转链，原结论／失败／哈希保留；现代艺术 debug 的原 ZIP 与中间包也保留在本轮交付证据，当前同名包不替代历史证据。

电力公司七类电厂采用深框与独立能源符号，耗料、供电、仓位、网络及产能各自标明含义；混燃说明煤油“共几份”，本人金额标明“现金”。手机选厂两列局部浏览，采购／发电两列随整页纵向滚动，避免截断对应燃料按钮。地图标签按实际显示尺度展开，窄屏优先选城相邻费用；42 城、六区、83 边、价格和空间数据不变。最终 [组件矩阵](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/power-grid/source-controls-fit/results.json) **96 布局／6 交互／4 声音检查通过，25.22 秒**，包含短桌面至 4K 与 320／360／390 手机；[地图专项](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/power-grid/map-readable-passed/results.json)通过，17.26 秒。组件检查不扩大为原生 DPI 或整局结论。

三款游戏规则卡片都有简要目标、章节导航、区域配图及来源，内容／样式保留在各游戏，平台只共用显示壳。正文 18 px、图注 16 px、标题至少 20 px；导航聚焦章节，关闭或 Esc 回到入口，浮层内纵向阅读、背景滚动恢复，不改变 revision、身份或合法动作。宝可梦与电力公司新增六张真实隔离示例区域图，现代艺术沿用四张实际图；原 PNG 保留，10 张无损 WebP **906,270 字节**，原尺寸与 RGB 像素逐字节相同，来源／哈希见各游戏资源清单。

独立单图审查指出混燃乘号、现金标签、标题断行和燃料按钮裁切，修复后所看规则／发电图无必须修复项；仅证明所见静态状态。[审查记录](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/root/visual-review.json)保留范围。首个中间 `6a9aac67…` 包的宝可梦手机完整验收发现工具栏新增规则入口后仍强制单行，造成真实横向溢出；[失败与原图](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/pokemon-first-failed/results.json)保留。修复为手机正常换行，并增强规则脚本打开浮层前的页面宽度断言，避免背景滚动锁掩盖溢出；不弱化原验收条件。

[整库检查](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/checks/summary.json) **38 文件／272 测试通过，命令 62.33 秒**。返修冻结后类型、ESLint、全工程格式与 diff 检查通过；文档另按项目配置检查格式、相对文件与锚点。仅精简生成的独立 CJS 空白，保留标识符、表达式与 bot-worker 原选项，CJS 总计少 **1,191,553 字节**。规则、状态、策略、协议和存档版本不变。

本次维护当时的最终 [Windows ZIP（已保留历史副本）（已退役）](../../artifacts/maintenance/v1.0.2/power-grid-debug-20261004/delivery/before/TableMax-1.0.2-win-x64.zip.retired.json) **39,857,345 字节**，实际解压 **134 文件／94,702,385 字节**，双 100 MB 硬门禁与 95 MB 工程预算均通过，余 **297,615 字节**。打包 **15.33 秒**，比上一正式 `ff110050…` 包解压体积少 **675,144 字节**。SHA-256：`9f02b3329af41bedbb1fc30de60b9c3d77b996c73f058c8dc4a4ad18d9372c03`。[逐文件审计](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/package-audit.json)证明 10 张 WebP 各本地打包一次，20 个非网页引擎／原生／Node／许可文件与首个中间包完全同 SHA；没有最终验收后再打包。

四项实际验收均对应同一最终 ZIP，[哈希交接](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/portable-proof.json)如下：

| 验证                                                                                                                               | 结果与实际墙钟                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [电力公司六席与原生显示](../../artifacts/maintenance/v1.0.2/power-grid/runtime/portable/shared-visual-controls-final/results.json) | 整局、22 显示场景、三档真实 Worker、回退／SQLite 重启、三游戏切换和普通 Worker 节奏通过，362.30 秒；1,095 状态校验、1,064 保存动作逐 checkpoint 重放。 |
| [现代艺术五席](../../artifacts/maintenance/v1.0.2/modern-art/portable/shared-visual-controls-final/results.json)                   | 四轮／137 步／36 图，62.57 秒；五类拍卖、双拍、秘密权限、回退／重启及切换通过。                                                                        |
| [宝可梦六席](../../artifacts/maintenance/v1.0.2/portable/results.json)                                                             | 三胜完整局、回退、两次启动恢复、原班重玩与手机无横向溢出通过，48.66 秒。旧该目录证据在本轮 before-pokemon 留存。                                       |
| [三游戏三端规则](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/rules/portable-controls-final/results.json)             | 27 组合，55.82 秒；实际图片解码、16 px 下限／44 px 控件、页面与浮层宽度、章节焦点、Esc 恢复、背景滚动及对局／身份不变通过。                            |

最终电力公司自然局按规则直接从 STEP 1 进入 STEP 3，没有冒称本局出现 STEP 2；首个中间包的 STEP 1／2／3 自然局已完整归档，且最终规则引擎逐字节相同。实际包内 Node 22.14.0 的路径／文件哈希及所有本轮原生／服务进程退出见 [进程证明](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/final-actual-processes.json)与[退出证明](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/final-exit-proof.json)。全部本机服务监听 127.0.0.1，独立存档与手机身份，不改变正式数据或防火墙；未认证实体手机、Safari、Wi-Fi、电视或真人听感。

全部构建／验收退出后，先预览再执行根目录清理工具。历史发行候选为零；[中间物清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)删除 **65 个目录／25,128,356,433 字节（23.40 GiB）**，实际两项 Apply 共 **312.02 秒**，预览共 **94.70 秒**。当前已验证 ZIP、同名正式运行目录、存档、原素材、依赖／缓存和历史证据保留。剩余旧构建日志 9,761 字节经显式预览、哈希归档后清理；压缩后启动检查的 6,489,128 字节独立目录也按同一工具清理，不删除其已留存证明。

工作区透明压缩先预览，再空闲执行：[3,514 个文件](../../artifacts/maintenance/workspace-compression-20261004-110947-175/compression.json)逐哈希核验通过，实际 **91.86 秒**，3,512 个存储分配减少、零未确认项，物理分配减少 **99,396,985 字节**。审核范围物理分配由 12,884,095,681 降至 **12,784,698,696 字节**；新报告不计入该范围。此数与清理逻辑字节、便携包计量分开。压缩后的隐藏原生／Node 回环启动与正常退出通过 **3.34 秒**，最终 ZIP 哈希保持不变，不机械重跑字节未变的完整游戏矩阵。

最后 `Maintain-Project.ps1 -Apply` 完成 **9.07 秒**，[结果](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/root/maintenance-result.json)为 `no-candidates`：工作区 **14,776,757,974 逻辑字节（13.762 GiB）**，已无安全清理候选。保护资料仍使其超过 5 GiB，按约定只报告，不扩大删除素材、证据、依赖、缓存或 Git 历史的范围。

效率核对：按任务预检工具与素材，复用现有隐藏桌面／后台浏览器；规则浮层先查短手机、720p 与缩放，静态审查及实际便携失败各自触发对应返修。原通过逻辑不因文档／CSS重复整库测试；最终包因手机操作修复完成同哈希验证。实际关键耗时保存在各自报告，并行阶段不相加为总时长。长期知识归唯一主题页，统一 commit 仅包含本轮范围，保留用户原有两处 Node／防火墙文档改动未暂存，不 push、不改线上 Release。

## 1.0.2：现代艺术 debug 修复（2026-10-04）

按用户九项反馈维护当前 **1.0.2**：左上行情解释本轮已上拍数量与每幅收益，选画和双拍补画不展示计时；修复公开同价并发确认／出价和刷新金额草稿；放大画家边框与拍卖标记，手牌／收藏改为纵向、每行至少两幅；三端增加顶层图文规则卡片；恢复盒子返回游戏的声音连接，现代艺术手机提供独立声音开关；五类拍卖使用不同入场声和全屏特效；三档 bot 使用有界加价、有限公开记忆及不同跨轮规划。规则版本、状态版本和策略注册版本不变；既有存档可恢复。长期行为见 [游戏规格](../games/modern-art/README.md)、[独立策略](../games/modern-art/bot.md)与[通用规格](../reference/phase-02-platform-spec.md)。

规则卡片依据既有采用规格与重新查阅的 GeGe 中文规则；手牌、行情、拍卖台、收藏四个区域来自新版隔离示例局的真实渲染，不使用正式玩家数据。原 PNG 保留，运行引用逐像素相同的无损 WebP（合计 **413,826 字节**）。五类入场与保存结果共 16 个 v2 本地原创 WAV（**528,704 字节**），v1 原资料保留，来源、参数与哈希见 [资源清单](../../assets/games/modern-art/manifest.json)。普通入场为 1.6 秒，减少动态使用短静态徽章；特效不阻断操作，不补播旧事件。

[公开竞价风险链](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/bidding/results.json) **6 文件／43 项通过，2.48 秒**：真实 Socket.IO、SQLite、回环服务，覆盖同价多人确认、确认后同价出价、换价失效、重复 ACK、保存失败不广播、权限、暂停／恢复、回退、重启及旧逐席计时存档严格迁移。损坏或多余旧键仍拒绝。[整库测试](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/checks/test.json) **38 文件／270 项通过**，Vitest 67.48 秒、命令 69.43 秒，含 27 个三档策略种子整局；不提高已有超时。随后独立审查发现手机解锁期间新声音打断的竞争，保留[复现](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/checks/phone-unlock-race.json)，修复后声音单元测试 **31 项通过**（含两项新增异步竞争）。270 项整库结果不冒称包含这两项后增测试。最终类型、ESLint、Prettier 和 diff 检查通过。

先检查最短窗口、手机报价焦点与盒子重进，再扩展最终显示矩阵。源 [五席界面与截图](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/capture-final/results.json) 10 项通过、29.27 秒，包含 320／360／390 手机、720p／1080p／4K、报价两次变化后输入／焦点不丢失及失效草稿拒绝；短桌面 12 个空收藏布局通过、27.89 秒。独立[静态视觉审查](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/review/visual-review.json)要求明确“数量前三名画家”并将角标移至独立标题栏，返修后的五席收藏图无必须修复项；该单图结论不替代其他场景。

首个返修 ZIP `c0e449af…` 的声音、五类声画、五席四轮混合 Worker 及四／五席 UI 已通过；随后完整空收藏矩阵发现五人一口价在实际 CSS 1280×720／DPI 1.5 下，放大角标使拍品压住参与状态条。原失败、首包和已有通过证据保留在 `modern-art-debug-20261004/delivery/before-final-layout/` 与 [原矩阵](../../artifacts/maintenance/v1.0.2/modern-art-audit-20261004/runtime/debug-portable/results.json)。改为按拍品所在网格行的实际宽高限宽，包含顶部标记和卡脚空间；不缩小信息文字或放宽遮挡断言。共享操作验证的旧“暂持／未入场”断言增加当前已有“等待处理”用词，保留原失败，不修改宝可梦产品文案。

返修后的 [源完整空收藏矩阵](../../artifacts/maintenance/v1.0.2/modern-art-audit-20261004/runtime/debug-source-fit/results.json) **108 组通过，98.36 秒**，包含三／四／五人、单／双画、host／public、720p／1080p／4K 与 100／125／150% 请求及实际限制结果；原一口价失败场景通过。独立审查实际单拍图与入场结束后的双拍图，框、角标、拍卖人及参与条无重叠和裁切；静态审查结论仍限定于所查看截图。

最终 [Windows ZIP（已退役）](../../artifacts/maintenance/v1.0.2/shared-visual-20261004/delivery/before/TableMax-1.0.2-win-x64.zip.retired.json) **39,463,310 字节**，实际解压 **127 文件／95,377,529 字节**，双 100 MB 硬门禁通过；解压比 95 MB 工程预算多 **377,529 字节**，如实保留该软预算缺口。实际打包 **16.27 秒**，逐文件哈希与实际解压核对通过，SHA-256 为 `ff110050e1a7d7fe6b7e52a7c0e7188ce54fa17f412fd9a8e27990dddcc26c29`，没有最终验收后再打包。首包与最终包的 [范围审计](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/package-fit-final.json)证明变化为网页 CSS 及其构建引用，原生程序、Node、服务、规则与 bot 文件字节不变；原 1.0.2 导出包也完整保存在本轮 `delivery/before-debug/`，不倒改下节历史哈希。

最终同一 ZIP 的 [音频与重进](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio/portable-layout-final/results.json) **31 项／16 WAV 通过，40.34 秒**，[五类实际声画](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio/portable-layout-entrances/results.json) **15 项通过，36.42 秒**。验证电脑／手机盒子重进后新事件播放、刷新手势解锁与不补播、独立静音、公共声源优先及关窗交接、暂停／测试／减少动态；五类效果实际截图和全屏边界保留。所有本次音频实例与包内 Node 已退出。

其余最终同 ZIP 验收如下，范围审计与交接集中在 [交付记录](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/summary.json)：

| 验证                                                                                                                                                                                                                         | 结果与范围                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [五席混合整局](../../artifacts/maintenance/v1.0.2/modern-art/portable/debug-fit-final/results.json)                                                                                                                          | 四轮／111 步／36 图，59.07 秒；三份独立手机身份与两位真实 Worker，五种拍卖、双拍补画、保密、回退、SQLite 重启及宝可梦切换通过。                              |
| [四人界面](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/portable-4-fit/results.json)／[五人界面](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/portable-5-fit/results.json) | 各 11 项，41.63／34.71 秒；选画无计时、行情／字号、纵向两列收藏、手机报价控件和草稿／焦点保持、过低草稿拒绝、四张规则图实际解码、Escape 关闭和按钮焦点恢复。 |
| [完整空收藏显示](../../artifacts/maintenance/v1.0.2/modern-art-audit-20261004/runtime/debug-portable-fit/results.json)                                                                                                       | 108 组，114.76 秒；三至五人、单／双幅、两电脑角色、720p／1080p／4K 与缩放请求；实际宽高和限制分别记录，原五人一口价遮挡通过，页面错误和外部请求为零。        |
| [共享操作与声音](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/experience-final/results.json)                                                                                                        | 4 项通过；六独立手机准备与并发、手机房主授权、公共屏优先声音／关闭交接、跨窗口去重。既有脚本未记录耗时，不推算时长。                                         |

[退出证明](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/final-process-exit.json)逐个记录六个 UI 场景的实际包内 Node 路径、Node 22.14.0 及原生／服务 PID 退出；混合局、显示和音频各自的关窗、服务不可达记录通过。本轮使用隐藏 Windows WinForms／WebView2、独立手机页面和触控／DPI 模拟，所有本机服务显式监听 `127.0.0.1`；未认证实体手机、Safari、电视、现场 Wi-Fi 或真人听感，不改变防火墙与正式存档。

最后按约定执行 `Maintain-Project.ps1 -Apply`，**0.82 秒**，返回 `blocked`、删除零字节。只读核对为正式 `artifacts/releases/TableMax-1.0.2-win-x64/` 中仍运行的 `TableMax.exe` 与 `node.exe`（PID 32620／5840），不属于上述隔离验收程序；没有结束用户进程、覆盖其运行目录或绕过保护。新 ZIP 哈希保持不变，[维护结果](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/maintenance-result.json)与[计时](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/maintenance-timing.json)保留。用户退出当前程序后可解压新包到既定运行位置。

效率核对：完成工具与素材预检，公开并发／保存恢复、手机输入／音频重进和最短桌面优先；完整矩阵发现的真实高度问题单独修复并复验。仅因实际源码变化、失败修正或最终同 ZIP 必需验收重跑对应检查，规则／策略通过后不机械重复。实际关键命令耗时分别记录，并行阶段不相加为总时长；更早阅读与实现未完整计时，不补造总耗时。长期知识合并到既有规格／美术偏好／开发入口，文档只查格式、链接和 diff；统一提交仅包含本次改动，原有 Node／防火墙文档改动继续未暂存，不 push 或改线上 Release。

## 1.0.2：版本导出与历史清理（2026-10-04）

用户要求“导出最新版为 v1.02，然后清理历史版本和中间文件”，按项目三段格式采用 **1.0.2**。从 `f3d3b75` 的电力公司完整交付基础更新根包版本、原生项目版本、Windows manifest 与运行时版本报告；游戏规则、状态、策略及平台存档／协议不变。逐文件清单对比只有 `TableMax.exe` 与包内 `package.json` 两项变化，其余 **121 文件哈希完全一致**，见 [版本范围审计](../../artifacts/maintenance/v1.0.2/export/version-only-manifest-diff.json)。电力公司／现代艺术专项沿用下列对应 1.0.1 的明确证据，不把它们标成 1.0.2 重跑。

`pnpm package:win` 含真实原生／服务／网页构建，通过，**19.59 秒**、零编译警告／错误。最终 [Windows ZIP（已退役）](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/before-debug/TableMax-1.0.2-win-x64.zip.retired.json) **38,897,568 字节**，实际解压 **123 文件／94,761,935 字节**，双 100 MB 门禁及 95 MB 工程预算通过；[逐文件清单](../../artifacts/maintenance/v1.0.2/modern-art-debug-20261004/delivery/before-debug/TableMax-1.0.2-win-x64-manifest.json)记录 SHA-256 `18791333acaa6668a54ce8065331cefd7fa41ac999e2ab6a6082b15838d23184`。应用的 FileVersion 为 `1.0.2.0`，两次实际启动均报告 `appVersion=1.0.2`，没有仅改 ZIP 文件名。

同一最终 ZIP 的 [便携验收](../../artifacts/maintenance/v1.0.2/portable/results.json)通过，**57.01 秒**：两真人手机模拟＋四 Worker、六席宝可梦完整三胜（89 driver 动作／14 决策阶段）、满座拒绝、管理员无座、秘密隔离、回退、断网身份恢复、同地址 SQLite 两次启动及原班再玩。页面错误／外网请求为零，11 图／3 布局；隐藏原生窗口和 Chromium 手机模拟，不代表实体设备、Wi-Fi 或电视验收。

父验证环境清除所有大小写的 `NODE_PATH`／`NODE_OPTIONS`／网页开发覆盖，实际便携子 PATH 仅系统目录。[补充运行证明](../../artifacts/maintenance/v1.0.2/portable/runtime-proof.json)用同一解压程序短启动 **7.19 秒**，核验每个文件字节／哈希和实际服务 `tmp/portable-game-jqlCwJ/node.exe`，Node 22.14.0，退出后服务不可达；仅补首次 CIM 采样晚于退出的路径缺口，不重复整局。[最终关闭证明](../../artifacts/maintenance/v1.0.2/portable/shutdown-proof.json)显示全部本次自有程序／服务／浏览器进程为零，该验证未操作正式旧版程序。

清理前默认保护发现旧版正式程序仍运行，先完成新包，等待旧程序退出后进入清理，没有自动结束用户进程。核对 `Clean-Releases.ps1 -MinimumAgeMinutes 0`／`Clean-Intermediates.ps1 -MinimumAgeMinutes 0` 的完整预览，确认所有已知验证结束，再追加 `-Apply`。历史交付删除 **6 项／365,171,568 字节**（10.92 秒），已知验证及打包中间物删除 **18 项／21,059,420,040 字节**（51.81 秒），合计 **24 项／21,424,591,608 字节，约 19.95 GiB 逻辑文件字节**；[历史版本报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)与[中间物报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)通过。清理后 releases 只保留当前 ZIP 和逐文件清单，旧 1.0.1 程序／源码 ZIP、清单、解压目录及打包工作目录已移除；旧包清单另作核验资料保留于 `export/previous-1.0.1-manifest.json`，历史验收证据不删除。

剩余三项是历史预览副本，以 `Clean-Intermediates.ps1 -TemporaryNames` 精确选名再次预览，再归档、逐文件哈希核对后移除临时目录（9.98 秒）。**22 文件／12,421,218 字节**全部保留在[归档清理记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)同目录的 `reviewed-temporary-content/`；下文三组预览链接同步改指归档原样内容，未计作实际释放空间。`tmp/` 现为空，正式存档、原素材、依赖／工具缓存、历史截图／JSON 和最终 ZIP 均保留；清理后当前 ZIP 哈希仍为 `18791333…`。

最后执行 `Maintain-Project.ps1 -Apply`（**10.26 秒**），结果 `no-candidates`、再删零字节；工作区余 **13,577,093,892 字节／12.65 GiB 逻辑文件字节**，已超过水位但安全候选耗尽，保留受保护资料、不扩大范围。[维护结果](../../artifacts/maintenance/v1.0.2/export/maintenance-result.json)与[计时](../../artifacts/maintenance/v1.0.2/export/maintenance-timing.json)可复查。效率核对：只改应用版本／当前文档，检查配置／格式／链接、真实构建及同哈希便携；通过的游戏专项不重复。所有清理先预览后执行，实际关键耗时分别记录；同步当前入口后统一提交，原有 Node／防火墙文档改动继续保留，不 push 或修改线上 Release。

## 1.0.1：电力公司经典德国版（2026-10-04）

前置聊天“宝可梦奇遇”完成并提交 `9048068` 后开始实现；先查现代艺术接入、平台恢复、完整游戏交付、维护效率与美术历史。新增独立 `power-grid`，经典德国修正版、2–6 人、42 张厂牌、42 城／六区／83 边、五阶段／三步、三档本地策略和三端界面。共享层只组装注册与加载入口，不改其他游戏规则或策略。来源事实、数字化采用项与尚无出版方逐卡照片认证的 35 张数据分别见 [游戏规格](../games/power-grid/README.md) 和 [来源](../games/power-grid/sources.md)。

| 验证                | 实际结果与证据                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 图结构与规则边界    | 83 边双源比对无差异；4 项地图测试，37 项规则／策略测试含 2–6 人×三档的 15 场完整种子局、完整混燃、满仓交换、三种第三步触发、第二步交叉及最终耗料／平局。行政阶段从第一步直接抽第三步，按经典 p.6 最后使用第二步补给。                                                                                                                                                                                                                            |
| 真实服务风险链      | Socket→规则→SQLite→投影，完整首轮竞拍、采购、建城、发电／收入到第二轮；现金隔离、越权、保存失败原信封重试、重复 ACK、重启、回退与房主授权独立。定向组 2.37 秒。                                                                                                                                                                                                                                                                                  |
| 全库检查            | `pnpm check`：类型、ESLint、Prettier 与 36 文件／253 测试全部通过，85.26 秒。初次无界并发令两项旧 5 秒测试超时；限制文件并发为 4 后保留原超时与所有断言通过，详见 `checks.log`／`checks-final.log`。                                                                                                                                                                                                                                             |
| 实际组件            | `ui/scoped-fixture/results.json`：80 布局／5 操作／4 声音检查，30.87 秒；854×480、720p—4K、320／360／390 手机，实际缩放拖拽、具体建城费用、Portal、六 WAV 解码与保存消费；`ui/amount-fixture/` 另验三项非法报价与整数恢复，21.12 秒。                                                                                                                                                                                                            |
| 三席原生混合局      | `runtime/development/source-3-r3/`：2 个独立手机身份＋默认 Worker，100.61 秒，539 个有效状态／508 个动作逐 checkpoint 与随机重放，控件、保密、回退／重启／再玩、旧游戏切换与普通人机节奏通过。末尾错误要求必须观察第二步，补验 `source-3-r3-step-skip-recheck/` 在同一 DB 复核合法直接一→三，13.79 秒，不重复整局；原失败和修正证据哈希均保留。                                                                                                  |
| 六席原生混合局      | `runtime/development/source-6/`：3 个独立手机身份＋默认／豆包／绝悟 Worker，369.51 秒，第 11 轮终局，1,050 状态／1,023 动作合法重放，三步全部观察，8 类真实手机控件、旧动作拒绝、恢复／再玩与三游戏 CSS 共存通过；普通 Worker 保存样本 1,878 ms。                                                                                                                                                                                                |
| 原生显示            | 六席自然终局前回退至密集建城，22 host／public 布局＋22 显示浮窗，720p／1080p／4K、100／125／150% 显示请求及 125／150% DPI 几何模拟，记录实际原生内容、CSS、PNG、缩放与限制；不宣称所有请求都等于有效缩放。                                                                                                                                                                                                                                       |
| 最终同 ZIP 便携验收 | [final-zip-r2](../../artifacts/maintenance/v1.0.1/power-grid/runtime/portable/final-zip-r2/results.json) 通过，453.29 秒；3 个独立手机身份＋默认／豆包／绝悟 Worker，第 12 轮自然终局，1,218 SQLite 行／1,181 状态／1,146 合法动作精确重放。三步、8 类控件、现金隔离、回退／重启／迟到拒绝／再玩、三游戏同页 CSS 共存、22 原生布局＋22 显示浮窗全部通过；普通 Worker 保存样本 1,611 ms。页面错误与外网请求为零，自有窗口已关闭、服务端口不可达。 |

证据根目录为 `artifacts/maintenance/v1.0.1/power-grid/`。初始只更新 lockfile 导致新游戏 React 链接缺失，冻结离线安装后构建通过；运行期间一次构建遇到 Node `EBUSY`，该局只作诊断，全部自有进程退出后重新完整构建。长 SQLite TEXT 的 `.iterate()` 在验证器中读出异常字符串，数据库 `json_valid` 全部有效，改为 rowid＋`.get()` 逐行审计，生产存档与真实恢复通过；不修改数据库绕过失败。

当轮最终 1.0.1 ZIP 为 **38,897,565 字节**；实际解压 **94,761,935 字节**，123 文件，满足 95,000,000 字节工程预算和严格 100,000,000 字节双门禁。SHA-256：`ccfc5d0f1399b0da858602d40b45fa62d8c0199cca0b4a1522c2b0c0597e18ff`；同一 ZIP 的逐文件哈希和真实便携验收均通过，没有验收后再重包。此前 `9f94765f…` 的 1.0.1 包及清单保留于 `before-power-grid/`，旧验收不倒改；当前下载使用上节 1.0.2。盒子标志改用已有同源 180px 图标，保留大原图和 ICO，正式游戏图像／声音不减配。首个 `final-zip/` 仅因验证器把 compact 的 30 CSS px 误要求为标准 36px 停止，原失败保留；修正验证器后分别核验 1080×800 的 30px、1920×1080 的 36px 与包内原 ICO、180px 图像解码，没有为断言改产品或 ZIP。

范围边界：后台真实 Windows WinForms／WebView2、SQLite、Worker 和手机页面模拟；不是外接电视或真实手机硬件验收。DPI 使用原生测试几何＋CDP 模拟，不更改操作系统 DPI；当前系统捕获的栅格比例与模拟 DPR 可能不同，720p 的 125／150% 请求可被空间保护限制为有效 100%。矩阵的外框检查不单独证明内部字号和触控，实际组件字号／操作检查及截图复核另作补证；公司详情采用局部滚动／浮窗，不声称全部 18 张厂牌在所有短窗口同时展开。地形为参考实物的生成重绘，不是像素级扫描；精确核对城市／区域归属／图结构与价格。六个工业短音效为本地原创合成，浏览器解码与播放消费不等于真人听感评价。运行外网请求为零，规则和策略正式运行仅依赖包内本地资源。

全部本次构建／验证进程结束并按自有路径复核为零后，执行 `Maintain-Project.ps1 -Apply`（0.97 秒）。正式便携目录的程序／服务仍运行，脚本返回 `blocked` 并保留全部文件、删除零字节；没有停止非本次验证的程序或绕过进程保护。[维护结果](../../artifacts/maintenance/v1.0.1/power-grid/maintenance-final-result.json)与[计时](../../artifacts/maintenance/v1.0.1/power-grid/maintenance-final-timing.json)留存。效率核对覆盖环境／素材预检、真实跨层和短屏先验、针对失败的增量补验、唯一稳定包及同哈希终验；后续仅文档链接／diff 检查和统一提交，原有 Node／防火墙改动不混入本次提交。

## 1.0.1：现代艺术真实对局排查（2026-10-04）

从干净的 `dbe39ad` 开始，沿用 1.0.1，以普通 `play` 节奏模拟真实手机操作、Worker 人机和四轮结算。确认并修复：24 字符无空格昵称在选画、最新记录和领拍处横向溢出；暂停或管理员提前结束后仍标示可行动；长昵称参与条缩略后难以区分；小数输入后金额加减不能恢复合法整数；暂停选画和普通等待重复占用空间；等待提示与木纹背景对比偏弱。完整姓名保留在文本、title 或可访问入口；增加稳定座位编号，金额步进按方向取相邻合法整数并限制上下界，非法提交保持拒绝。未修改游戏规则、合法动作、秘密投影或存档格式。

独立实际截图审查发现空收藏拍卖中拍品偏小且下方闲置。电脑在所有公开收藏均为空的普通拍卖状态使用剩余高度放大单幅／双幅拍品，保留玩家身份、报价、参与状态与保存记录；获得收藏、选画、暂停、策略故障及终局保持各自布局。实现和审查均查询 [用户美术偏好](../reference/art-preferences.md)，文字仍至少 16 CSS px，主要操作至少 18px／44px，不以局部缩放换取空间。

[全库单 worker 测试](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/full-tests.json) **211／211 通过**，实际命令 **112.61 秒**。原现代艺术 27 种子策略整局超过既有 20 秒，性能测量定位到重复全状态 Vitest 比较；仅将每步输入不变与 JSON 恢复两处改为 Node `deepStrictEqual` 并补充定位，27 局／6,279 步、全部断言及 20 秒时限保留。最终全库中的该用例 **19.50 秒**，仍对并行 CPU 负载敏感；不声称任意并发负载都能通过。原失败、成本测量、输出一致性和 19 项定向复核见 [规则／策略审计](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/rules-audit/rules-audit-report.md)。

真实跨层审计覆盖五类拍卖与八类手机控件、320／360 长昵称、非法金额无保存及整数恢复、暗标并发独立草稿、旧价确认拒绝、排序不改牌 ID、提醒到零不行动、四轮公开成交／收入账本与最终现金／冠军、已保存动作动效期间下一位立即操作、真实媒体播放、回退、SQLite 重启、原班再玩和双游戏切换。真实断网清除旧动作并显示共享连接等待，同凭证恢复；未使用特权状态端点或修改正式规则准备整局。五人使用三位独立手机与两位真实 Worker，三人使用两位手机与一位 Worker；仅五人及四人适用“两位并发提交、第三位继续保留草稿”检查。

修正前证据保留于本轮 `runtime/source-*`。其中 `source-first`、`source-second-probe`、`source-third-probe` 固定了真实昵称溢出；排序重复选择内层牌、非行动者没有私密倒计时、断网误查游戏内提示及空收藏矩阵误查隐藏牌头，属于验证脚本判断错误，分别更正后使用新证据目录，未改写原失败。`source-four` 已完成 184 步与四轮账本，但最后断网选择器失败，因此该次整体仍标记失败；不能以此前各项通过替代整次通过。

空收藏返修前的 [首包五人整局](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/portable-final-5/results.json)通过 **172 步／四轮／77 图，182.98 秒**，[首包三人整局](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/portable-final-3/results.json)通过 **170 步／四轮／74 图，117.86 秒**；页面／非预期控制台／请求错误及外网请求为零。该 ZIP 的 SHA-256 为 `2faed94bcae83aa1f9f5afbdb9bcc7e7a435be70ea3cf5913db317f942914de8`，实际包和清单已保存于本轮 [first-package](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/first-package/provenance.json)，这些结果只证明当时的包，不代替后续空收藏布局的最终包验证。

空收藏初版源矩阵 [84 布局](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/source-empty-second/results.json)通过（65.79 秒），小窗口 125%／150% 请求如实触发保护、实际 zoom 为 1；[4K 新增 24 布局](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/source-empty-scale/results.json)通过（45.74 秒），125% 的实际 zoom 为 1.6667、CSS 1536×864，150% 为 zoom 2、CSS 1280×720，均未受保护限制，比例对应既有 4K 100% 的 zoom 1.3333。两次启动脚本 SHA 分别保留，不合称同一脚本。几何容纳不等于视觉质量：独立短屏双幅审查仍认定画作 77.52 CSS px 过小，随后将价格放到行情下方、画作使用右侧整列、收紧重复记录，并保证透明外层不挡市场点击。

该重排初验 [source-empty-short-fixed](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/source-empty-short-fixed/results.json)在 **4.78 秒**确认真实网格错误：市场自动排到末行，挤压画作并造成重叠。只修正市场显式网格位置后，[同脚本十二个短屏布局](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/source-empty-short-grid-fixed/results.json)全部通过（**28.28 秒**）：三／四／五人单幅／双幅主机与公共屏，双幅实际画作 **160.43 CSS px**；各手机使用真实合法 24 字符 ASCII 昵称，完成最低正出价后领拍姓名仍完整、没有价格裁切，六次实际历轮估值打开／关闭不改变 revision 或 branch。字号、44px 热区、实际中心命中、画作／标签／价格／身份／记录遮挡检查保持；全部窗口退出、服务不可达，错误为零。

缩略名字进一步采用统一公共座位编号，[十二个短屏复验](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/source-empty-seat-fixed/results.json)通过（28.43 秒），逐个核验博物馆、拍卖人、领拍者、最新行动者与参与条的真实 seat ID 对应；双幅画作约 **159.52 CSS px**。随后中间包 `67544152be5067e45629cf76007e92468245bddea7f8c696ace0b82b1889e917` 的 [108 拍卖布局](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/portable-empty-final/results.json)、[四人四轮](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/portable-audit-final-4/results.json)及 [五人四轮](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/portable-audit-final-5/results.json)分别通过 **107.46／120.73／197.23 秒**，普通整局为 **183／218 步、各 77 图**。该包与清单保留在 [中间包记录](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/final-package/provenance.json)，不把这些结果改写为后续包通过。

独立终局图片审查仍发现该中间包全部玩家姓名省略、桌面下方却有大量空白；手机也有同样截断。旧脚本仅检查名字盒子和完整 title，功能通过不足以证明实际文字完整可读。返修仅改变终局：电脑按单列对应身份与资产并增加冠军文字，手机将金额放在姓名下方，两端完整姓名至少 18px、可换行。脚本改为逐个字符核验实际几何、裁切祖先和命中，另检查金额、冠军与首屏 44px 再玩；覆盖 720p／1080p／4K 主机和公共屏及 320／360 手机。审查的必要问题、可选建议及裁定见 [独立视觉记录](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/visual-review.json)。

新增门禁的两次源预检如实保留失败：[source-ended-5](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/source-ended-5/results.json)完成四轮／199 步后，把字体 Range 的 24px em 框误当作 22.5px、允许溢出的行框裁切，175.72 秒停止；只修正垂直归属到实际视口和裁切祖先，水平、逐字命中和不盖其他席／金额检查仍严格。[source-ended-fixed-5](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/source-ended-fixed-5/results.json)四轮／278 步、243.16 秒，主机全文门禁通过，随后因误要求只读公共屏有再玩按钮停止。修正脚本明确区分权限，公共屏严格无管理控件；没有为误判修改产品、放宽规则或覆盖原记录。

最终同版本 [本地便携包（已退役）](../../artifacts/maintenance/v1.0.1/power-grid/before-power-grid/TableMax-1.0.1-win-x64.zip.retired.json)为 **39,043,322 字节**，实际解压 **111 文件／94,777,948 字节**，严格双 100 MB 门禁及 95 MB 工程预算通过。[逐文件清单](../../artifacts/maintenance/v1.0.1/power-grid/before-power-grid/TableMax-1.0.1-win-x64-manifest.json)记录 SHA-256 `9f94765f03daa5867319270b2bc204a4c72f1cec640b6e4dfc7a1a238363ac28`；对应包、清单和通过入口另保存在 [end-fixed-package](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/end-fixed-package/provenance.json)。最终打包 **15.81 秒**，版本、线上 Release、发布源码 ZIP 与总清单保持原记录。

该最终 ZIP 的 [四人普通四轮](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/portable-ended-final-4/results.json)通过 **188 步／82 图，107.36 秒**，[五人普通四轮](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/runtime/portable-ended-final-5/results.json)通过 **222 步／82 图，219.45 秒**。两次同一冻结脚本 SHA-256 `945afb2dd15bf1bd26fbbdc2d2e9f0bce5e74835721b8d80bbf82b77056629d9`，初始与恢复均为普通 `play`；上述拍卖／金额／并发／账本／身份／恢复检查全部保持。每局另通过 **8 个真实终局布局**，姓名逐字、资金、冠军与权限对应：主机／公共屏各三种桌面大小、两种手机；公共屏没有再玩按钮，管理员／手机房主的按钮至少 44px、可命中、完整在首屏。五人 320×568 的按钮底 **488.13 CSS px**，四人底 **424.17px**，全部 scrollY 为 0。新鲜四人电脑与五人手机单图独立审查均无必要 P1／P2；可选构图／手机冠军文字建议及保留理由记录于上述视觉 JSON。

最终两局页面、非预期控制台、请求与外网请求错误为零；公共屏实际播放分别 **103／200 次**，正音量授权播放 **102／198 次**，主机播放为零、媒体错误为零，未人工听音。各自原生窗口和服务退出、CIM 按本次目录核验残留为零。终局之外的拍卖代码和素材未再改变，保留中间包 108 布局的准确哈希边界，未机械重跑它或规则测试。最终集成类型／ESLint／格式检查通过，实际 **6.15／11.11／7.27 秒**；后续验证脚本的小范围几何／权限纠正分别完成语法、ESLint 与格式复核。设备仍限本机 Windows 隐藏 WebView2 与独立 Chromium 手机、窗口／DPI 模拟，不代表实体手机、Safari、电视或现场网络认证。

所有应用、构建和验证进程结束后，预览核对 28 个本次验证目录、两个倒计时测试目录及三个可再生打包目录，再执行 `Clean-Intermediates.ps1 -MinimumAgeMinutes 0 -Apply`。共删除 **33 项／8,275,309,981 字节（7.71 GiB 逻辑文件字节）**；[逐项报告（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)通过。预览 **48.26 秒**、执行 **147.10 秒**，三个截图预览目录的 HTML 哈希和当前 ZIP 哈希均保持；正式存档、原素材、依赖／工具缓存、全部历史证据及当前解压程序未纳入清理。

收尾按规则执行一次 `Maintain-Project.ps1 -Apply`（**12.59 秒**），结果为 `no-candidates`、再删零字节；主工作区余 **13,351,202,615 字节（12.43 GiB 逻辑字节）**。超过水位后安全候选已耗尽，继续保留受保护资料，未扩大范围；[维护结果](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/maintenance-final-result.json)与 [维护计时](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/maintenance-final-timing.json)可复查。本轮效率核对完成环境／素材预检、窄屏及跨层高风险先验、受影响返修和同 ZIP 终验；实际关键耗时分别留存，未把并行阶段相加成开发总耗时。后续仅同步文档、检查链接／格式与 diff，再统一提交；同期新增的 Node／防火墙规则保持原工作区改动，不混入本次审计提交。

## 1.0.1：现代艺术视听与共用倒计时（2026-10-04）

先按用户指示提交已有电力公司研究文档 `555d780`，本轮继续沿用 1.0.1。依据 [用户美术偏好](../reference/art-preferences.md) 收紧行情上下空间，扩大信息文字，以深色边框、五种画家图形印章及拍卖图标辅助辨识。手机本人手牌／收藏、电脑各家公开收藏默认按画家整理，可切换拍卖方式或原顺序；排序不改牌 ID、规则顺序或秘密投影。信息文字至少 **16 CSS px**，主要操作／关键状态至少 **18px**，电脑分区标题至少 **20px**，标准已写入 AGENTS、通用规格及现代艺术规格。终局集中显示真实 `finalCash`、冠军与完整姓名入口，移除重复空收藏和最后一轮收入，保留完整 44px 重玩按钮。

平台共用决定倒计时在电脑盒子设置，默认 **20 秒**，以滑块选择 **5、8、10、12、15、20、25、30、40、50、60、75、90、105、120 秒**。到零只提示，仍接受原合法动作；暂停冻结、恢复继续。并发初始翻牌／暗标共享计时基线，别人的提交不重置剩余玩家；公共屏不收到私密决策 ID。设置与游戏 checkpoint 分离，游戏切换、续局、新房间与重启保留。重启暂停于最后已保存的计时样本，未保存的崩溃间隔不能精确恢复，边界见 [通用规格](../reference/phase-02-platform-spec.md#共用决定倒计时2026-10-04)。

**16 个原创短音效／355,904 字节**，采用木质敲击、玻璃泛音和短和声，分别表达各类拍卖、竞价、封存、成交和结算；手机静音，公共屏优先、管理员承接。源文件为 24kHz／16bit 单声道 PCM，峰值最大 0.399994、无削波，完整参数和版本在 [资源清单](../../assets/games/modern-art/manifest.json)，[试听页](../../artifacts/maintenance/v1.0.1/modern-art-audio-20261004/audition-v1.html)提供逐项播放。[最终包音频实测](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/audio/portable-final-v4/results.json)通过 22 项、16 文件同源解码、14 次真实保存命令、7 次正音量授权播放；另一次零音量手势解锁，手机播放为零。静音、归属交接、刷新／回退／暂停不补播、测试模式及秘密信息边界均受检，页面、外部请求、音频 HTTP 与播放拒绝为零，耗时 **32.64 秒**；未进行人耳或实体扬声器试听。

当轮 [本地便携包（已退役）](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/before-package/TableMax-1.0.1-win-x64.zip.retired.json)为 **39,042,029 字节**，实际解压 **111 文件／94,770,599 字节**，严格双 100 MB 门禁及 95 MB 工程预算通过；[逐文件清单](../../artifacts/maintenance/v1.0.1/modern-art-audit-20261004/before-package/TableMax-1.0.1-win-x64-manifest.json)记录 SHA-256 `1dc750ee8e7d39f38931e96529d615f65b005836ba6e352ad895d2421f7457bd`，最终打包 **17.19 秒**。前一轮已验证包在本轮 `before/`，本轮三次中间包在 `first-package/`、`second-package/`、`third-package/`，关联失败与通过证据保持；线上 Release、发布源 ZIP 及总清单保留原发布内容。

最终同一 ZIP 的 [代表场景矩阵](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification/portable-final-v4-representative/results.json)通过 **52 布局／60 图**（131.75 秒）：四人／五人出画、公开竞拍、十幅以上收藏与合法三位估值，720p／1080p、320／360／390 手机、历史浮窗／焦点、三类排序及牌 ID 保持；真实 20／5／120 设置、多端同基线、刷新连续、暂停冻结与到零不自动行动。另含宝可梦取牌／结算四场景，六人短桌面 CSS 854×480 的 36 个号位、角色图和 44px 计分按钮完整，360×640 手机六格和计分保持首屏。

[最终终局矩阵](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification/portable-final-v4-ended/results.json)通过 **28 布局／28 图**（45.46 秒）：合法四人／五人四轮结果覆盖 720p／1080p／4K、100%／125%／150% 显示设置与三种手机宽度；另将真实自然五人四轮 Save 只读导出后复制到新 SQLite，核验实际主机／公共窗口、总资产、冠军、完整姓名、44px 重玩首屏、结果容器、行情间距和真实重玩返回大厅。验证 fixture 仍逐条走未修改的 `RoomCoordinator`／规则动作与 `validateState`，准备工具只保留最新 Save，避免重复 SQLite journal 放大；手机明文凭证仅在隔离临时目录，不进入证据或 Git。自然原始 Save 与 SHA 保存在 [只读来源](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification/ended-natural-fixture/provenance.json)。

[最终便携整局](../../artifacts/maintenance/v1.0.1/modern-art/portable/modern-art-polish-final-v4-top/results.json)通过 **五席四轮／234 步／31 图**（59.49 秒），三位独立手机与两位真实 Worker，覆盖五类拍卖、八类实际手机控件、已保存头像、五份真实资产与冠军、首屏重玩、秘密投影、回退、SQLite 重启与双游戏切换。旧整局脚本仍要求已移除的空收藏头像，并主动滚动终局，导致两次验收失败；脚本改查五份最终成绩身份、金额与冠军，从页顶保留首屏门禁，不修改包或放宽断言。原始失败记录在同目录 `modern-art-polish-final-v4` 与 `modern-art-polish-final-v4-updated`，早期真实短屏／三位数字／自然终局问题均在返修后重验。[独立视觉审查](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/visual-review.json)实际查看最终 13 图，两处历史 P2 已解决，无未解决 P1／P2；320 宽手机的长手牌／竞拍页仍可纵向浏览，结果与主要操作维持可读尺寸。页面错误与外部请求均为空。

类型、ESLint、Prettier 和 diff 检查通过。全库单 worker 测试原为 **209／211 通过**（116.93 秒）；新增时间字段使失败保存比较差 1ms，测试对比较区间固定时钟并在 finally 恢复，未减弱状态与广播断言，[20 项定向复核](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/countdown-evolution-recheck.json)通过。累计 **210 项有通过证据**，唯一未通过为未修改的现代艺术 27 种子策略整局超过既有 20 秒；保留 [完整失败记录](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/tests-serial.log)，未放宽时限，不能写成全库全绿。音频专项 23 项、排序 2 项、[压缩隔离 15 项](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/physical-boundary-run/timing.json)、清理 78 项与维护 34 项均通过，后者证据在 [清理回归](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/verification/cleanup-regression/summary.json)。压缩回归命令 **4.72 秒**，包含父目录移出后 Junction 回指同一 inode 的真实拒绝案例，内容、全部属性及未压缩状态保持；原 13／14 项历史证据保留。

按用户要求全方位压缩工作目录，在构建、打包与验证进程结束后先预览，再执行手动中间物清理：**61 个目录／16,405,610,945 字节（15.28 GiB）**，包括隔离验证数据及同版本打包中间目录，耗时 **1,392.14 秒**；[清理汇总](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/cleanup-apply-summary.json)关联逐项报告。三个已请求截图预览、当前便携包、正式存档、历史证据、原始素材及依赖／工具缓存保留，未删除用户附件目录。

随后 [NTFS 主工作区压缩](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/compression-apply-final-summary.json)覆盖 **47,087 条文件路径／31,428 个独立文件**，候选下限 4 KiB，**16,098 项全部确认、16,096 项有收益、零未确认项**。逐候选压缩前后 SHA-256 一致，无收益两项恢复原分配，当前便携 ZIP 哈希不变；只读、范围外硬链接、链接目录等保持。按文件身份去重的实际分配从 **12,455,199,960** 降至 **10,687,838,150 字节**，另省 **1,767,361,810 字节（1.65 GiB）**；逻辑字节仍为 **12,618,338,299**（按路径）／**12,393,306,735**（去重），不与前述删除量混称物理节省。审计 **40.23 秒**，生产命令 **730.86 秒**；该实际分配范围为开始审计时的源文件，排除操作中新建的报告，逐项记录在 `artifacts/maintenance/workspace-compression-20261004-000934-431/`。未删除或重编码素材、存档、源码、程序及历史证据。

[压缩后的实际开发运行](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/audio/compressed-development/runtime-summary.json)通过，含退出 **28.63 秒**：从 `build/desktop/TableMax.exe`、包内 Node 22.14.0 与本地资源启动，22 项检查、14 次 SQLite 保存动作、16 WAV 解码、七次正音量授权播放正常，页面／音频 HTTP／外网请求／播放拒绝为零，手机静音。45 个关键文件中 40 个具有 Compressed 属性，包含包内 Node、`server.cjs` 及正式／源 WAV；五个小模块低于候选下限，源／构建／资源表的 16 份音频哈希一致。桌面与服务 PID 确认退出；受限 WMI 子进程枚举无权限，原记录保持未核验，不将空结果当成退出证明。后续清理器的项目空闲门禁通过。

复核后仅清理本次唯一隔离目录 `modern-art-audio-verify-eEPsi2`，[精确清理](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/compressed-profile-cleanup-summary.json)删除 **128,111,719 字节**，耗时 **31.41 秒**；本轮合计清理 **62 目录／16,533,722,664 字节（15.40 GiB）**。强制 [统一维护](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/maintenance-final-summary.json)执行一次并返回正常 `no-candidates`，0 合格候选、0 追加删除，逻辑文件仍为 **12,645,053,802 字节（11.78 GiB）**。剩余均按保护规则保留，不扩大清理范围；该逻辑计量不能当成压缩后的实际占用。记录包装器未识别正常无候选返回，已从原始输出恢复汇总，实际维护未重跑，未补写丢失的精确计时。[最后只读空间审计](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/compression-storage-final.json)包含新增报告及本轮运行证据，**47,120 路径／31,461 独立文件**的实际分配为 **10,714,708,366 字节（9.98 GiB）**；审计后的报告及 Git 提交产生少量新文件，不再重复压缩或删除保护内容。

八张最终实际 PNG 原样复制到 [现代艺术预览（原文件已归档）](../../artifacts/maintenance/cleanup-history/index.json)，[来源与哈希](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/preview-record.json)与最终包关联。该预览及旧盒子／宝可梦预览于 1.0.2 导出清理时完整归档，内容与哈希保持。本轮设备边界为当前 Windows 隐藏 WinForms／WebView2 与独立 Chromium 手机、触控及显示缩放模拟，不代表实体手机、Safari、电视或现场网络认证；声音观察是解码、归属和实际媒体播放调用。

## 1.0.1：盒子头像与游戏介绍（2026-10-04）

提供 **26 个可选头像**，其中 20 个经过独立内置 imagegen 调用生成，沿用旧六图的木质动物风格；新图均为 512×512 透明 WebP，共 **790,988 字节**，旧六图字节未变。原图、提示词、来源、透明度、32／48px 检查及计时见 [素材交接](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/avatar-art-handoff.json)与 [资源清单](../../assets/platform/manifest.json)。服务端串行确认、先到先得，其他人的头像禁用并标记“已被选择”；离线保留，本人在大厅／结束后可更换，进行中锁定。旧存档稳定补齐，非法／重复数据保护拒绝；排序、续局、回退、重启与切换保持身份。

盒子移除重复角色副标题和页脚，入座／准备区显示本人头像。两款游戏各自的 `ui/introduction.ts` 用图示、三步玩法和胜利目标说明所选游戏；轻量目录不加载完整规则或游戏主界面。从 18 个可访问 TableMax 当前／归档聊天及相关其他项目证据整理 [用户美术偏好](../reference/art-preferences.md)，覆盖边界明确记录；AGENTS、维护规则、派工与独立视觉审查入口均要求设计前查询。独立审查采用手机游戏名在冒号后换行的 P3 建议，其余盒子介绍和头像通过，见 [审查记录](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/review-record.json)。

最小真实 HTTP／Socket.IO／SQLite 与核心头像专项 11 项通过，全部受影响 core／server 回归 **17 文件／91 项通过**（30.88 秒）；类型、ESLint、Prettier 和 diff 检查通过。全库默认并发测试为 **174／176 通过**（52.68 秒），两个既有整局测试超时；单 worker 定向复核 **17／18 通过**（26.62 秒），宝可梦通过，未修改的现代艺术策略整局仍超过原 20 秒（实际 23.858 秒）。复核后累计 175 项有通过证据，完整默认检查不能写成全绿；未放宽时限。见 [工程检查](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/engineering-checks.json)及同目录日志。

先验证 360×640 首屏（9.75 秒），再完成开发跨层矩阵（18.06 秒）。首次离线脚本导航被本源守卫拒绝，改为关闭真实手机 Form、同 partition 重开，保留失败证据。首个便携包的现代艺术短屏结算被新增头像高度挤压；移除已经售罄的空收藏占位、收束现金边距，保留头像与字号，以自然结束存档做 [定向结果复核](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/verification/ma-result-recheck/results.json)通过（11.66 秒），随后重新冻结。历史失败完整当前 Save 已 [只读导出](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/verification/ma-result-recheck/failed-ended-current-save-export.json)，不依赖临时数据库长期留存。

最终 [本地便携包（已退役）](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/before/TableMax-1.0.1-win-x64.zip.retired.json)为 **38,730,831 字节**，实际解压 **95 文件／94,389,421 字节**，双 100 MB 门禁与 95 MB 预算通过；[逐文件清单](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/before/TableMax-1.0.1-win-x64-manifest.json)记录 SHA-256 `2b770ab92112e4ccac7d4211034201541b9afc5de1ddd38c994a67cdabc573fd`。26 个源头像均与实际解压包中的位图哈希匹配，见 [资源审计](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/avatar-package-audit.json)。旧返修包在本轮 `before/`，本轮首包与验证在 `first-package/` 及独立证据目录；线上发布包、源 ZIP、总发布清单沿用原发布记录。

最终同一 ZIP 的 [头像与介绍](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/verification/portable-final-fixed/results.json)通过 8 项跨层／24 布局／24 截图（21.73 秒）：26 本地图、并发一胜一拒、占用／释放、真实离线、丢回复原请求恢复、三端／游戏头像、权限及游戏切换。介绍覆盖 360／390 手机、720p／1080p／4K，以及实际 1.25／1.5 缩放；正文至少 16px、操作至少 44px，无横向溢出。720p 的 125% 请求会正常受空间保护限制，真实 1.25 另在 1080p 核验，原生尺寸及保护状态已记录。[宝可梦便携整局](../../artifacts/maintenance/v1.0.1/modern-art-polish-20261004/before/pokemon-portable/results.json)通过六席三胜、14 阶段、89 次 driver 动作、回退、重启及原班续局（57.291 秒）；[现代艺术便携整局](../../artifacts/maintenance/v1.0.1/modern-art/portable/box-avatars-final-20261004/results.json)通过五席四轮、277 步、五类拍卖／八种手机动作、头像身份、重启及双游戏切换（68.43 秒），720p 与 360×640 结算五行均无遮挡。各组页面错误及外部请求为空。最终打包 16.415 秒；并行阶段不相加冒充总耗时。

最终六张实际 UI 截图和一张头像素材接触表复制到 [盒子预览（原文件已归档）](../../artifacts/maintenance/cleanup-history/index.json)，逐文件哈希与来源见 [预览记录](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/preview-record.json)。1.0.2 导出清理时完整归档，内容与哈希保持。独立现代艺术结果审查确认收益完整、无重叠，另提出既有博物馆次要状态小字的非阻断 P3 建议，本轮保持盒子与头像范围，裁定记录在上述审查 JSON。

全部应用／构建／验证进程退出后，先预览并核对，再用 `Clean-Intermediates.ps1 -TemporaryNames … -MinimumAgeMinutes 0 -Apply` 清理本轮已结束的 **18 个隔离测试目录／5,346,133,680 字节（4.98 GiB）**；保留当前 ZIP、正式存档、原素材、全部验收证据及新旧截图预览。逐项结果见 [临时清理（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)，预览 **67.267 秒**、实际清理 **315.547 秒**，历史失败完整当前 Save 已在清理前只读导出。`tmp/` 最终仅保留上述盒子预览与上一轮宝可梦截图目录。

最后执行 `Maintain-Project.ps1 -Apply`，删除一项可再生打包中间目录 **227,525,735 字节**，当前包哈希未变。主工作区余 **12,133,961,262 字节（11.30 GiB）**，安全候选耗尽后保持原素材、历史证据、依赖／工具缓存、正式存档和当前交付，未扩大清理范围；结果与耗时见 [维护记录](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/maintenance-result.json)、[维护计时](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/maintenance-timing.json)及其逐项报告。

设备边界为本机 Windows 11 隐藏 WebView2／独立 Chromium 手机会话与窗口、触控、缩放模拟，便携仅系统 PATH 启动、使用包内 Node；不代表实体手机、Safari、电视或现场网络认证。长期行为见 [通用规格](../reference/phase-02-platform-spec.md#已确认的美术方向与三端布局)，运行入口见 [开发环境](../reference/development.md)。

## 1.0.1：宝可梦画面与动效返修（2026-10-04）

按用户对四张主要画面的十三处批注，收紧行动条与六人间距，改用白色斜纹进度、区分两类牌堆及暂持区，压缩手机首屏、居中梦幻目标入口、分开排版行动信息，并放大二人结算。子 agent 分析后增加保存动作的连接轨迹、能力落点、赢家扫光和新星标闪亮；授权投影、明确位置确认和动效失效边界保持，完整行为见 [交互规格](../games/pokemon-encounters/interaction.md)。截图当时保存至 `tmp/pokemon-screenshots-5a6f7893/`，1.0.2 导出清理时原样归档为 [宝可梦预览（原文件已归档）](../../artifacts/maintenance/cleanup-history/index.json)；历史原图和预览在 `ui/screenshots-20261003/` 与本次 `before/` 保留。

短手机累计覆盖 16 个场景：首轮 [前八场景](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-final/results.json)完成后在火箭队币面溢出中停止，返修后的 [八种能力流程](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-abilities-final/results.json)全通过；星标恢复 28px 后再验 [六人梦幻／普通手机／私看三场景](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-phone-final/results.json)通过。全部六格、号位和确认在 360×640 首屏，触控门槛及无遮挡检查保留。[默认六人流程](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-default-final/results.json)另通过原横屏与手机尺寸检查；[卡面](../../artifacts/maintenance/v1.0.1/cards/results.json)通过 13 布局／16 类牌，[动效](../../artifacts/maintenance/v1.0.1/effects/pokemon-polish-20261004/results.json)通过 8 项。三张独立逐图审查没有必须返修项，提示与裁定见 [审查记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/review-record.json)。

[开发显示](../../artifacts/maintenance/v1.0.1/display/development/results.json)通过 35 组布局／44 张截图：四种原生窗口尺寸、两端六人 36 牌、暂停／恢复、4K 100%／125%／150% 缩放与模拟 DPI；[开发整局](../../artifacts/maintenance/v1.0.1/development/results.json)通过 14 阶段、回退及重启恢复；[自然声画](../../artifacts/maintenance/v1.0.1/presentation/results.json)通过六位实际手机身份、完整小局、浮窗焦点、星标与三档真实 Worker 节奏／取消。设备边界为本机 Windows 隐藏 WebView2／Chromium 的窗口、触控及 DPI 模拟，不代表实体手机、Safari、电视或现场听音。

类型、ESLint、Prettier 通过。全库默认并发测试出现两项人机整局超时；停止界面验证并改用单 worker 后，宝可梦测试全部通过，全库 **25 文件通过／164 项通过／1 项失败**。剩余为未修改的《现代艺术》策略整局测试超过原 20 秒，仍未通过；不放宽时限或将它写成绿色工程检查。原始输出和 107.322 秒命令耗时见 [单进程测试记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/tests-serial.json)及同目录日志，默认 `pnpm check` 89.326 秒失败记录亦保留。仅 CSS／标题选择器返修后重验类型、lint、格式及相关真实流程，没有重复未变化的规则测试。

最终同版本 [本地程序包（已退役）](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/before/TableMax-1.0.1-win-x64.zip.retired.json)为 **37,931,361 字节**，实际解压 **75 文件／93,576,952 字节**，双 100 MB 门禁及 95 MB 预算通过；[逐文件清单](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/before/TableMax-1.0.1-win-x64-manifest.json)记录 SHA-256 `d21389dc647679c4d834a8b193e410048600b2faf6986b4dc0abbce06de4a880`。旧图标包与已发布源码／总清单归档在 `pokemon-polish-20261004/before/`；首个返修包及失败证据归档在 `first-package/`。首包实际 ZIP 验收发现测试标记横向溢出、手机星标偏小，随后开发整局发现六人结算需另留计分高度；全部返修后再次冻结打包。旧计分浮窗标题选择器仅对齐去中点后的实际标题，内容、焦点和秘密信息检查保留。本次更新本地程序，线上发布内容与源 ZIP 沿用原发布记录。

最终 ZIP 的 [便携整局](../../artifacts/maintenance/v1.0.1/box-avatars-20261004/before/portable/results.json)、[显示矩阵](../../artifacts/maintenance/v1.0.1/display/portable/results.json)和 [自然声画](../../artifacts/maintenance/v1.0.1/presentation-portable/results.json)首次验收全部通过，均关联上述 `d21389dc…` 哈希：六席三胜、14 阶段、129 次 driver 动作、回退、两次真实启动恢复及原班续局；显示 35 布局／47 浮窗检查／44 张截图；六位实际手机身份自然小局、28px 星标、计分焦点和三档生产节奏／取消。各组页面错误与外部请求为空。最终打包 15.994 秒，整局／显示／声画分别 73.414／114.501／45.796 秒；并行耗时不相加，实际交付与前次失败记录见 [交付记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/delivery-record.json)。本次所有验收子进程已退出。

按用户要求清理临时文件夹：先逐项预览，再通过 `Clean-Intermediates.ps1 -TemporaryNames … -MinimumAgeMinutes 0 -Apply` 删除 **71 项／6,315,587,478 字节（5.88 GiB）**，临时日志先归档并核验哈希，路径、链接目录、进程与修改保护仍执行。`tmp/` 最终只保留四张更新 PNG 和预览页所在的 `pokemon-screenshots-5a6f7893/`；逐项结果见 [清理记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)，实际命令耗时 1582.645 秒，见 [耗时记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/temporary-cleanup-timing.json)。

随后执行 `Maintain-Project.ps1 -Apply`，删除两项安全打包中间物共 **450,194,796 字节**。工作区剩余 **10,104,036,170 字节（9.41 GiB）**，合格候选耗尽；历史证据、原始素材、正式存档、依赖与工具缓存继续保护，未扩大删除范围。当前 ZIP 哈希仍为上述 `d21389dc…`，实际维护耗时 17.437 秒，见 [维护汇总](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/maintenance-summary.json)、[逐项记录（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)及同目录任务日志。

## 1.0.1：应用图标更新（2026-10-03）

按用户要求用内置 imagegen 生成高级应用图标，并应用到 EXE、主机／公共窗口标题栏和任务栏、浏览器标签、手机主屏入口及三端盒子品牌。采用青绿陶瓷圆角磁贴与奶油桌台／叠牌 T 形，细暖金夹层；资源、提示词和哈希见[平台清单](../../assets/platform/manifest.json)，完整原图与浅深底 16–256px 审查证据在 `artifacts/maintenance/v1.0.1/app-icon/imagegen/`。当前应用版本继续为 1.0.1。

该次[本地便携包（已退役）](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/before/TableMax-1.0.1-win-x64.zip.retired.json)为 **37,924,627 字节**，实际解压 **75 文件／93,539,137 字节**，通过双 100 MB 门禁和 95 MB 工程预算。[逐文件清单](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/before/TableMax-1.0.1-win-x64-manifest.json)记录 ZIP SHA-256 `61445bb9205bb1068377cbaf65f648ac31909e885c3e962f4f1e382b0f02b448`。已发布旧包与清单备份到 `artifacts/maintenance/v1.0.1/app-icon/before/`，其原哈希与下节发布验收保持。

类型、ESLint、Prettier 和 **26 文件／160 项测试**通过；最终 ZIP 的[宝可梦便携整局](../../artifacts/maintenance/v1.0.1/app-icon/portable/results.json)通过六席、14 阶段、回退、两次启动恢复及原班续局。本次复用既有便携验证脚本，仅将副本的相对导入与证据输出改到图标专属目录，原验证脚本和历史证据保持。初次测试被沙箱子进程权限拦截，后以授权范围重跑测试；首次打包遇到短暂 EXE 文件锁，重试后成功，未关闭已有应用。游戏规则、策略和协议未变，设备边界仍为本机 Windows 与隐藏 WebView2／Chromium 尺寸模拟。

[图标实际集成](../../artifacts/maintenance/v1.0.1/app-icon/integration-results.json)通过主机 1280×720、公共屏 1920×1080 和手机 360×640：品牌图片、网页标签及主屏图标均同源且与源文件哈希一致，无横向溢出、页面错误或外部请求；三张 PNG 来自更新后的隐藏真实渲染。[原生审计](../../artifacts/maintenance/v1.0.1/app-icon/native/portable/result.json)核验 EXE 与源 ICO 的 16／32／48／256px 像素一致，实际主机／公共窗口大小图标与当前 DPI 150% 选出的 48px 资源及 PerMonitorV2 关联图标基线逐像素一致。初次审计的固定 32px 假设与 WindowsPS 模块依赖已纠正，不是产品图标故障；已通过的工程检查、最终打包和整局不重复执行。图像生成实测 34.93 秒、Vitest 23.33 秒，其余关键耗时与执行范围见[交付记录](../../artifacts/maintenance/v1.0.1/app-icon/delivery-record.json)。本次没有更新线上 Release。

所有本次构建／验证进程结束后执行 `Maintain-Project.ps1 -Apply`；既有 TableMax 实例及其服务仍运行，维护按进程保护保留全部文件，删除 0 字节，未进行容量统计或扩大清理范围。结果见[维护日志](../../artifacts/maintenance/v1.0.1/app-icon/maintenance.log)，当前包、原图、存档与历史证据均保留。

## 1.0.1：GitHub Release（2026-10-03）

按用户最新指示，将含《现代艺术》的版本定位为 v1.0.1，并发布到 [GitHub Release](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.1)。应用、原生程序集、Windows manifest 和桌面版本响应同步为 1.0.1；规则、协议、存档和策略版本不变。原生安全验证改为读取当前应用版本对应的清单。用户原有 README 改写保留在工作区，发布提交仅纳入本次版本／下载链接调整和现代艺术说明。

`pnpm package:win` 重新构建并逐文件核验实际解压：ZIP **36,966,646 字节**，解压 **72 文件／92,579,416 字节**，满足双 100 MB 门禁及 95 MB 解压预算。SHA-256 为 `8b3d4bc237d75e843a8b842d23ffeb7f651b4e531fbf2b2131b3a4433498dc6c`；[逐文件清单](../../artifacts/maintenance/v1.0.1/app-icon/before/TableMax-1.0.1-win-x64-manifest.json)与[便携包（已退役）](../../artifacts/maintenance/v1.0.1/app-icon/before/TableMax-1.0.1-win-x64.zip.retired.json)配套。

- [现代艺术便携整局](../../artifacts/maintenance/v1.0.1/modern-art/portable/results.json)通过：五席四轮、全部拍卖与八类手机动作、秘密隔离、回退、重启和游戏切换；28 张实际截图，页面错误和外部请求为空。
- [宝可梦便携整局](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/before/portable/results.json)通过：实际应用版本 1.0.1、六席三胜、14 阶段、回退、重启及原班续局。
- [原生安全专项](../../artifacts/maintenance/v1.0.1/webview2/safety-portable/results.json)10 项通过，包括清单和可执行文件哈希、共享运行时缺失、桥接授权、进程隔离与退出清理。修改脚本的 ESLint、Prettier 及 Git diff 空白检查通过。

本次仅调整应用版本及发布资料，不改游戏实现；设备边界沿用前次验收，仍为 Windows 后台真实渲染和 Chromium 手机尺寸／触控模拟。首次构建被沙箱子进程权限拦截，授权范围内重跑成功；三组实际新包验证分别保留开始／结束时间，不相加为总耗时。发布源码由对应提交导出，排除用户未提交的 README 改写、依赖、存档、原始素材和中间物；历史 1.0.0 验收保持原记录。发布后复核 GitHub 标签指向 `c63b36f9f0129b711ede79df67f419c7627410a2`，四个附件的大小及 SHA-256 与本地一致，Release 为正式最新版；[发布回读](../../artifacts/maintenance/v1.0.1/github-release.json)保存结果。旧 1.0.0 交付先按原哈希归档至 `before-v1.0.1/`，安全维护随后从 releases 移除旧 ZIP；其余近期修改和受保护项保留，工作区超过水位只报告。

随后按用户要求清理历史版本及中间文件：手动入口在完整空闲检查后使用零分钟年龄边界，共删除 **14 项／3,435,627,475 字节（3.20 GiB）**，包括旧解压程序、旧源码与配套清单、打包目录及已结束的隔离验证数据。清理器补齐旧源码／两类清单及六位随机后缀 `modern-art-verify-*` 的识别，当前／未来交付及相似研究目录保持保护；[37 项手动清理检查（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)与[34 项维护检查](../../artifacts/maintenance/project-maintenance-tools/tool-tests.json)通过。逐项删除记录见 `artifacts/maintenance/local-cleanup-20261003-152207-455-releases/`、`local-cleanup-20261003-152219-114-intermediates/`、`local-cleanup-20261003-152431-213-releases/` 和 `local-cleanup-20261003-152444-298-intermediates/`；当前 ZIP 哈希不变。最终统一维护实测 **8,675,898,844 字节（8.08 GiB）**、0 合格候选；8 项未识别临时内容、历史证据、原始素材、依赖与工具缓存、当前构建和正式存档保留，未扩大清理范围。仅清理工具与文档变化，不重跑游戏构建或修改已发布的 v1.0.1 包。

2026-10-01，交付版本 1.0.0；游戏采用 `tablemax-cn-s19-v1`，状态版本 1，基础策略 `pokemon-encounters/basic`／`1`。以下记录真实工程执行结果，规则原文认证状态仍见 [来源页](../games/pokemon-encounters/sources.md)。

用户本日明确：使用当前 Windows 电脑，外接屏目标为电视；开发中无需实际使用电脑之外的设备，以模拟完成校验。因此本轮设备范围是当前 Windows 11 x64（内核 10.0.26200）、真实 Electron／独立服务，以及 1920×1080 电视尺寸、360×800 Android 和 390×844 iPhone 尺寸／触控／UA 模拟。手机使用 Chromium，不是实际 Safari；后台冻结和断网导航模拟不等于手机锁屏或操作系统 App 切换。便携包在当前电脑的新解压目录、仅 Windows 系统目录 PATH 下运行，未另用无开发环境电脑。声音检查解码及播放调用，未声称现场听音。按该授权范围完成验收，不把模拟写成硬件实测。

## 执行与证据

- `pnpm check`：严格类型、ESLint、项目格式与 9 文件／48 项 Vitest；包含真实 Socket.IO、SQLite、Worker、规则及恢复。
- [规则测试](../../games/pokemon-encounters/rules/rules.test.ts)：V00 三小局固定存档追踪、V01–V11、全部能力分支、联合百变怪；20 固定种子覆盖 2–5 座位完整三胜大局及 12 个玩家决策阶段。固定 fixture 不冒充实际随机发牌；下一小局重洗与赢家首位另验。
- [恢复测试](../../games/pokemon-encounters/rules/recovery.test.ts)：D01–D13 所有 before 边界，精确状态／策略／RNG 恢复与重演、旧分支拒绝、保存失败／重复／同步不发成功反馈，真实协调器人机混合局和受限策略输入。
- [崩溃测试](../../apps/server/src/pokemon-crash.test.ts)：实际服务进程在 V08 临时查看、V06 传递暂持、V05 已生成币面三处确认后 SIGKILL，重新打开真实 SQLite；恢复暂停、分支增加、授权和结果保持。
- `pnpm verify:game-ui`：7 组真实能力 UI、触控尺寸、选择／取消／确认、44px、无横向溢出、选中卡位不被确认栏遮挡、临时查看隔离、220ms 保存动效／减少动态、5 类本地 WAV 解码、公共手势播放、同步与回退不补播。JSON 与 PNG 在 [ui 证据](../../artifacts/phase-06/verification/ui/results.json)。
- `pnpm verify:desktop`：真实桌面五座位（2 真人模拟／3 实际 Worker bot）完整大局、公共窗口、同地址重启及回退；[开发构建记录](../../artifacts/phase-06/verification/development/results.json) 为本轮较早 UI 构建，最终界面以便携记录为准。
- `pnpm package:win`、`pnpm verify:portable`：最终 ZIP 在新目录解压、系统 PATH 隔离启动；五座位完整大局、背景冻结／断网导航／刷新身份恢复、回退及两次启动退出。[最终便携记录](../../artifacts/phase-06/verification/portable/results.json) 保存 ZIP 哈希、实际运行时、设备范围、请求与页面错误、截图。
- 模板的两端 UI 用 esbuild 独立打包，包括 `template/assets/die.svg`；模板真实规则／策略／恢复回归继续包含在 `pnpm check`。
- [资源哈希核验](../../artifacts/phase-06/verification/assets.json) 检查 20 张主题图和 5 类音频在正式构建中与源文件字节一致；[文档链接核验](../../artifacts/phase-06/verification/document-links.json) 检查当前文档的本地路径与锚点。

本地证据和 ZIP 保持文件树可见、Git 忽略；必要源文件、资源和当前文档提交 Git。验证使用独立临时数据库，不读写默认玩家存档。设备与软件版本以对应 JSON 为准，截图按 CSS 尺寸运行，实际 PNG 受 Windows 缩放影响。

## AC 对照

“通过”均指上述用户授权的本机与模拟范围；未扩大为出版规则认证、其他 Windows 电脑或真实手机／电视验收。

| 标准                 | 结果与依据                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 便携启动       | 通过：最终 ZIP 解压运行，内置 Electron／Node／SQLite，PATH 排除开发工具；当前电脑模拟无开发环境。                                                               |
| AC-02 离线完整对局   | 通过：五座位实际服务／Worker 完整三胜大局；浏览器禁止外部请求，图像、声音、帮助同源本地。未断开本机物理网卡。                                                   |
| AC-03 手机加入       | 通过：Android／iPhone UA、窄屏和触控模拟取得独立座位、准备，五人满员后额外加入明确拒绝；二维码本地生成，仅含普通入口。未用真实摄像头扫码。                      |
| AC-04 公共屏         | 通过：1920×1080 公共只读窗口展示布局、当前能力行动者、公开牌与共同结果；无查看暗牌、管理或本人控件。                                                            |
| AC-05 规则完整       | 通过：采用版本全部能力、2–5 人、普通来源、整堆重洗、联合百变怪、共同赢家、完整效果后结束和三胜整局。                                                            |
| AC-06 信息权限       | 通过：本人暗格仍为空；仅喷火龙本人临时字段可见；消息／UI／历史／资源 URL 无秘密实例／牌序；跨身份请求被拒。                                                     |
| AC-07 可靠操作       | 通过：真实消息并发、重复编号、确认丢失重发、越权／过期、存储失败不推进；选择取消不提交，确认期间锁定。                                                          |
| AC-08 移动端恢复     | 通过：实际浏览器冻结、断网导航再连接、刷新与同地址服务重启，原凭证／座位及最新已确认状态恢复；锁屏／App 切换用冻结模拟。                                        |
| AC-09 掉线等待       | 通过：真人离线保留身份与待处理选择；协调器测试证明不调度 bot 代真人，房主可暂停／恢复／结束。                                                                   |
| AC-10 房主参与       | 通过：经主机凭证验证取得独立玩家身份，首局从参赛房主起；本人手机正常选择，普通玩家管理动作拒绝。                                                                |
| AC-11 决策点覆盖     | 通过：D01–D13 全部 before checkpoint 与安全标签逐项测试，自动步骤并入玩家决策事务。                                                                             |
| AC-12 普通回退       | 通过：逐能力状态／合法动作／策略恢复，实际多端回退同步；恢复后暂停，可继续完整游戏。                                                                            |
| AC-13 揭示／随机回退 | 通过：牌堆、币面、规则／策略 RNG 精确重演；历史提示已揭示信息，重选不暗中重随机。                                                                               |
| AC-14 回退分支隔离   | 通过：旧信封／迟到策略结果失效，分支递增，选择／动画清理，公开记录不含秘密。                                                                                    |
| AC-15 崩溃恢复       | 通过：正常关闭／两次启动，三个能力节点实际强制终止服务；恢复最新确认状态、原身份及回退分支。                                                                    |
| AC-16 存档兼容       | 通过：损坏／不兼容版本／身份结构拒绝，原数据库字节保持；不静默新开或替换策略。                                                                                  |
| AC-17 视觉动效声音   | 通过：20 张原创自然主题 WebP、本地 5 类短音、数字和规则独立排版；截图检查布局与清晰度，保存后动效／减少动态、公共静音／手机无声与重连不补播。声音未作现场听音。 |
| AC-18 扩展接入       | 通过：独立幸运骰子模板包含规则、计分、投影、两端 UI、原创 SVG、独立策略及真实恢复测试；游戏组装只改注册点，核心不依赖具体游戏。                                 |
| AC-19 电脑座位       | 通过：大厅添加／移除、标识电脑、总人数 2–5 与准备校验；实际 2 真人／3 Worker bot。                                                                              |
| AC-20 全操作人机     | 通过：全部 12 玩家节点有合法策略，默认不发动卡比兽仍有独立 swap 分支规则／UI 检查；20 固定种子及真实混合完整大局。                                              |
| AC-21 人机信息隔离   | 通过：策略输入只有本人授权视图／动作，不含 deck、暗值或秘密实例；不代真人，安全错误日志不打印视图。                                                             |
| AC-22 人机回退恢复   | 通过：暂停／结束取消、回退／重启重调度、memory／RNG 恢复、旧结果与重复提交拒绝，实际 Worker 超时／异常回归。                                                    |
| AC-23 独立决策文件   | 通过：首版与模板各自 bot/index.ts，声明版本和 null 记忆；合法替换／不兼容拒绝及异常流程测试，接入指南可定位入口。                                               |

## 首版维护：独立牌桌与操作简化

2026-10-01 提出、2026-10-02 收尾的 1.0.1 持续完善：盒子与游戏分为独立路由，电脑和手机游戏使用全宽场景；取牌、弃牌、跳过能力与关闭查看一键提交，位置选择使用具体动作确认。菜单承载管理／帮助／公开记录，结果集中展示赢家、胜局和总分，百变怪解析按需展开。会话、页面、通用控件与游戏场景职责拆开，平台资源迁到共享目录。采用理由见 [决策 002](../decisions/002-host-public-screen-and-debug.md#盒子与游戏分开2026-10-01-增补)。

维护记录独立于上述 1.0.0 的历史验收。48 项工程测试、正式与独立原型构建、十组真实 UI 场景已通过；原型仅检查资源迁移后的构建，不冒充重新执行全部原型走查。UI 检查包括 360／390 与 1920 尺寸、44px 触控、秘密查看隔离、一次点击意图、位置选择不提前提交、菜单 Escape、盒子来回不改变修订、刷新游戏路由、游戏宽度超过视口 90%、减少动态与本地声音。证据见 [维护 UI](../../artifacts/maintenance/game-experience/ui/results.json)。

开发构建的真实五人混合整局、暂停／回退、后台冻结、断网导航、同地址两次启动与身份恢复通过，见 [维护开发记录](../../artifacts/maintenance/game-experience/development/results.json)。最终 1.0.1 ZIP 已解压到新目录，以仅 Windows 系统目录的 PATH 运行并通过相同整局／恢复验证；五人结算在 1080×800、1366×768、1920×1080 首屏无纵向滚动。新包及哈希见 [维护便携记录](../../artifacts/maintenance/game-experience/portable/results.json)。文档本地链接／锚点和十六张共享 WebP 迁移字节一致性分别见 [链接核验](../../artifacts/maintenance/game-experience/document-links.json) 与 [资源核验](../../artifacts/maintenance/game-experience/shared-assets.json)。规则、状态、协议和策略版本保持；原始素材、1.0.0 ZIP 和 phase-06 证据保留。

本轮仍按既有用户授权使用当前 Windows 上的 Chromium 触控／尺寸模拟，未增加真实手机、Safari 或电视硬件验收。

## 使用与维护

当前便携包为 `artifacts/releases/TableMax-1.0.2-win-x64.zip`，使用步骤见 [项目说明](../../README.md#快速开始)。命令、数据位置和排障见 [开发环境](../reference/development.md)；接入与替换策略见 [扩展指南](../reference/game-development.md)。历史第一阶段 0.1.0 ZIP 不代表当前产品。

2026-10-02 按用户要求清除历史版本：移除 0.1.0、1.0.0、1.0.1、1.0.2、1.1.0、1.2.0、1.3.0 共七个 ZIP，以及 phase-01／phase-06／releases 下三个旧 `win-unpacked`，释放 2,161,988,613 字节（约 2.01 GiB）。当次保留 1.4.0 ZIP、解压程序及打包目录，ZIP 哈希与该版最终验证一致；原始素材、截图、JSON、默认玩家数据和 Git 历史保留。以下历次验收中的“旧包保留”描述当时状态，0.1.0–1.3.0 旧包现已清除；[清理记录](../../artifacts/maintenance/release-cleanup-2026-10-02/cleanup.json) 保存删除清单、空间和证据目录检查。

同日用户再次要求清理历史版本和中间产物，并提供可复用工具：移除 1.4.0 ZIP、解压程序、旧打包目录共三项，以及 116 项已结束的测试数据／便携解压副本／打包中间物，释放 16,771,539,807 字节（约 15.62 GiB）。当前 1.5.0 ZIP 保持 `9f87af8ca7079d3136fd457d652184c89e632319561ed77ebf25e63bf9050a75`，原始素材、phase-01 至 phase-06 及维护验收证据、默认玩家存档和当前构建保留；十一份一次性脚本先归档，`tmp/` 已无残留。以下历史验收中的“保留旧包／程序”只指当时状态，1.4.0 程序现已清除。逐项结果见 [清理核验（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json)，两份完整删除记录由其 `reports` 字段链接；[20 项工具验证（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json) 使用独立模拟工作区，包含默认预览、当前／未来包、运行进程阻止、junction 防护、近期／未知内容保护、一次性脚本归档、显式构建清理和未验证 ZIP 拒绝。Windows PowerShell 5.1 实际执行通过，工具与保护约定见 [清理说明](../reference/development.md#清理本地中间物)。游戏源码／release 未改，无需重新执行游戏整局验证。

后续新增游戏、跨游戏调试或第三方插件按独立需求安排；新规则／策略版本需要明确存档迁移方案，不能直接覆盖原文件。设备模拟中的限制保留供后续实际使用时复查，本轮不将取得其他设备作为剩余开发关口。

## 首版维护：视觉纠错与场景打磨

1.0.2 完成卡面分区纠错：数值和能力标记不再重叠，名称至少 12px，插画和位置编号各有独立区域。新增无游戏物件的浅木纹花园背景；桌面按人数集中排布，五人默认窗口收紧间距，手机状态和牌堆并列，横屏分左右操作区。梦幻一次显示一个目标场地，切换不提交；公共弃牌在原生浮层查看。翻牌／重新发牌增加区别动效，仍只展示新保存的授权结果，支持减少动态与恢复清理。具体行为与资源见 [游戏交互](../games/pokemon-encounters/interaction.md#视觉排布维护102) 和 [资源记录](../games/pokemon-encounters/assets.md#牌桌背景与卡面分区102)。

本轮工程检查含 9 文件／48 项测试及正式构建。[十四组真实 UI](../../artifacts/maintenance/visual-polish/ui/results.json) 包含既有十组能力／基础操作与 2–5 人、长昵称，截图覆盖 1080×800、1366×768、1920×1080、800×900、360／390×844、360×640 和 844×390；每种关键操作阶段保留截图，检查横向溢出、44px、选位不提前提交、确认栏遮挡、秘密查看隔离、同步／回退不补播与声音。组件矩阵另验 [全部 16 类卡面](../../artifacts/maintenance/visual-polish/cards/results.json) 在五种宽度下的字号、名称裁切、数值／能力碰撞和插画边界；组件画廊只使用公开类别定义，不冒充完整对局。弃牌浮层的 Escape／修订保持和新动效减少动态另有 [补查记录](../../artifacts/maintenance/visual-polish/ui/additional/results.json)，200% 缩放截图保留在同一补查目录。[重新发牌](../../artifacts/maintenance/visual-polish/ui/round-deal/results.json) 由真实房主生命周期动作触发并观察 360ms 动效；[横屏选牌](../../artifacts/maintenance/visual-polish/ui/landscape/results.json) 实际完成 2–5 人初始选牌、确认与二维遮挡检查。

[开发整局](../../artifacts/maintenance/visual-polish/development/results.json) 已通过五座位完整混合游戏、十四阶段、暂停／回退、断网导航／冻结与两次启动恢复。[新便携记录](../../artifacts/maintenance/visual-polish/portable/results.json) 对应 1.0.2 ZIP 新目录解压运行、系统 PATH 隔离、相同整局与恢复检查；五人结算在默认窗口和两种桌面尺寸保持首屏。背景原图／提示词与裁切在 [imagegen 核验](../../artifacts/maintenance/visual-polish/imagegen/file-verification.json)。[资源字节核验](../../artifacts/maintenance/visual-polish/assets.json) 覆盖 21 张主题图及 5 类音频；[文档链接](../../artifacts/maintenance/visual-polish/document-links.json) 核验当前相对路径和锚点。旧版本 ZIP、20 张既有图、历史原图和验收证据全部保留；规则／协议／存档／策略版本保持。范围仍为当前 Windows 与 Chromium 设备模拟，没有新增真实手机／电视或现场听音结论。

## 首版维护：角色卡面与管理员体验

1.1.0 根据 2026-10-02 用户指示完成：电脑房主仅管理、不占座位，程序启动即有唯一牌桌；盒子突出玩家／扫码／开始，说明与管理按需展开；游戏保留独立全宽页面。16 类角色卡面和统一右上分值／左上能力标已导入，翻牌、能力、硬币和结算只表现保存后的授权结果；来源及生成工具限制见 [资源规格](../games/pokemon-encounters/assets.md)。旧 AC-10 房主参赛由最新需求替代，历史验收不倒改。

| 验证       | 结果／证据                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工程       | typecheck、lint、format:check、9 文件／48 项测试与正式构建通过；主机凭证加入参数拒绝，管理员无玩家座位／动作，初局随机与种子重放保持                                                                              |
| 全类别卡面 | [16 类×5 宽度](../../artifacts/maintenance/pokemon-refresh/cards/results.json) 通过 60／68／90／110／140px 名称字号、裁切、数值／能力几何交集和插画边界                                                           |
| 真实 UI    | [十四组](../../artifacts/maintenance/pokemon-refresh/ui/results.json) 覆盖 2–5 人、全部能力、触控和多个电脑／手机尺寸、私密查看隔离、保存反馈及 reduce／刷新／回退不补播                                          |
| 关键节点   | [结算和双币面补查](../../artifacts/maintenance/pokemon-refresh/ui/effects/results.json) 观察实际 animationstart 和结果／硬币覆盖层，保存真实隐藏渲染帧                                                            |
| 开发整局   | [开发记录](../../artifacts/maintenance/pokemon-refresh/development/results.json) 五人真人／bot 混合完整三胜、十四阶段、随机真人首位、暂停／回退、冻结／离线、两次启动身份恢复                                     |
| 最终便携   | [1.1.0 ZIP 记录](../../artifacts/maintenance/pokemon-refresh/portable/results.json) 新目录解压、仅系统 PATH、相同完整整局与恢复；五人结算在 1080×800／1366×768／1920×1080 首屏可见                                |
| 文档与资源 | [链接核验](../../artifacts/maintenance/pokemon-refresh/document-links.json) 无缺失路径／锚点；[44 个旧资源迁移](../../artifacts/maintenance/pokemon-refresh/asset-migration.json) 字节全部不变，原图及旧 ZIP 保留 |

测试使用隐藏 offscreen 窗口，不 showInactive 或 focus，并断言窗口不可见；截图为真实 capturePage，整局使用 CDP 精确视口避开 Windows DPI 原生 1px 舍入。当前验证仍是 Windows Chromium 触控／尺寸模拟，未宣称手机、Safari、电视实机或现场听音。生成尝试中百变怪成功，其余 15 类拒绝；实际卡面为官方原图导入及统一代码排版，火箭队横向群像含果然翁且保留背景，可由资源表替换为后续竖图。

## 首版维护：聚会可靠性与连续游玩

1.2.0，2026-10-02。范围为持久化加入／换绑确认、实时网卡与启动排障、原班续局及运行保障；不新增游戏内教程或规则帮助。长期行为及窗口／存档边界见 [聚会规格](../reference/phase-02-platform-spec.md#聚会连接连续游玩与运行保障)，采用理由见 [可靠确认决策](../decisions/005-platform-authority-and-recovery.md#加入确认与原班续局2026-10-02)。

- `pnpm check`：typecheck、lint、format:check 与 12 文件／58 项测试通过。新增并发／丢回复确认、内容冲突、保存失败、加密存储及对外信息隔离、真实 SQLite 重启、绑定期限／撤销、原班续局及旧实例拒绝；防休眠生命周期、网卡变化及中文错误提示另验。旧有规则、D01–D13、Worker 和实际强制退出测试继续通过。
- [聚会专项](../../artifacts/maintenance/party-reliability/party/results.json)：服务实际监听 0.0.0.0，经本机常规网卡 IPv4 访问；地址标注／刷新／选择保持、提交已保存后故意丢弃 HTTP 回复、刷新确认唯一座位、换绑回复丢失后真实程序重启确认同一座位、原凭证失效及读档暂停通过。250ms 延迟／限带宽、断网与后台冻结恢复通过。实际 UI 筛选回退、具体步骤确认并暂停、原班第二大局、第二桌面进程退出、保留公共屏后重开管理、真实端口占用的中文错误日志通过。原生防休眠 API 活跃，保护释放和显示保护的独立生命周期另由工程测试核验；未让电脑真实休眠。
- [十四组 UI](../../artifacts/maintenance/party-reliability/ui/results.json)：全部既有能力／位置选择／手机布局、秘密查看隔离、保存反馈和同步／回退不补播通过；截图来自更新后的隐藏渲染。已人工查看新增网卡帮助和回退筛选截图。
- [开发整局](../../artifacts/maintenance/party-reliability/development/results.json)：五座位（两位模拟真人、三位实际 Worker bot）完整三胜及十四阶段、回退／冻结／离线与两次启动恢复通过。完成大局后实际点击续局，保留五座位顺序、三电脑和手机凭证，真人重新准备并启动第 1 小局。
- [最终便携整局](../../artifacts/maintenance/party-reliability/portable/results.json) 与 [便携聚会专项](../../artifacts/maintenance/party-reliability/party-portable/results.json)：最终 1.2.0 ZIP 分别解压到新目录、以仅 Windows 系统目录的 PATH 运行，通过同样的完整三胜／五座位原班续局及十组聚会专项，包括过期待确认请求不重发、不多占座。两份记录的 ZIP SHA-256 一致，均为 `54bcc1e7e4a74a647dd1aa74642db5075db7263982fbfddb88b4e440f165c4fa`；页面错误为空。旧包与证据保留。
- [文档链接核验](../../artifacts/maintenance/party-reliability/document-links.json)：本次维护文档的本地文件和锚点通过检查。

协议为 3，游戏采用规则／状态／策略版本与平台格式 1 保持；1.1.0 存档通过可选字段默认值继续读取。全部测试使用隔离数据，未读取默认玩家存档，也未自动更改防火墙或系统电源设置。本机网卡 IPv4 访问仅证明本机服务的局域网监听／地址路径；不声明实际手机扫码、Safari、实际 Wi-Fi 互访、电视或另机便携运行通过。声音未追加现场听音结论。旧 ZIP、原图和历史验证不覆盖。

## 首版维护：手机围桌与三档人机

1.3.0，2026-10-02。所有真人各自用手机操作，电脑只运行服务、管理员和公共展示；房间是有五个环绕席位的桌子，手机本人席位突出，空座、准备／在线状态和人机等级公开。玩法教学仍在线下，正式盒子与游戏菜单不设规则帮助。配置与权限见 [房间规格](../reference/phase-02-platform-spec.md#手机聚会与围桌房间2026-10-02)，算法、记忆及局限见 [首版人机](../games/pokemon-encounters/bot.md)。

- `pnpm check`：typecheck、lint、format 与 14 文件／75 项测试全部通过。新增 [等级权限及恢复](../../packages/platform-core/src/bot-difficulty.test.ts) 五项，包括手机／匿名拒绝、仅大厅人机可改、保存失败不变、调度传级、回退／重启／续局、旧存档默认与不兼容拒绝；[三档策略](../../games/pokemon-encounters/bot/strategy.test.ts) 十二项包括高级局势差异、本人授权记忆、样本覆盖、取消、空库及实际 32 MiB／两秒 Worker。
- 策略专项实际完成三档各 2–5 人完整三胜，共十二个固定种子大局；每档全部十二个玩家选择阶段出现，逐动作校验状态及合法动作。绝悟按授权信息生成三十二组有限假设，用真实计分器、能力后续与终局风险比较；未知牌和对手行为仍是近似，未宣称全局数学最优或固定胜率。五人 draw／mew-other 独立 Worker 在本机约 0.2 秒完成；完成后的 heapUsed 约 10 MiB，未测峰值。
- [围桌与三档开发实测](../../artifacts/maintenance/phone-table-levels/room/results.json)：两部独立 Chromium 手机沿普通邀请 URL 实际加入，各自准备和操作，房主不占座，host/public 无游戏动作、暗牌或 peek 信息。实际选择／添加／调整三档人机、完整混合小局、原班续局和真实程序重启保持座位顺序、三等级及手机 token；七组房间尺寸、长昵称、五席几何和触控检查通过，所有窗口保持隐藏，pageErrors／externalRequests 均空。1080×800、1366×768 的全部五席及房主等级／添加／开始首屏完整可见；360×640 手机的昵称／加入／准备首屏可操作。代表截图已人工查看。
- [开发完整三胜](../../artifacts/maintenance/phone-table-levels/development/results.json)：两部手机模拟真人与三位实际默认 Worker 的完整大局、十四阶段、冻结／断网／回退／两次启动和五席原班续局继续通过。
- [聚会回归](../../artifacts/maintenance/phone-table-levels/party/results.json)：新房间和协议下，十组既有可靠性场景全部通过，包括实际本机网卡 IPv4、入座／换绑已保存后丢回复、弱网、真实重启、过期确认保护、重复启动、公共屏保留后重开管理和端口占用诊断。
- [十四组能力 UI](../../artifacts/maintenance/phone-table-levels/ui/results.json)：更新后的正式渲染通过既有全部能力、位置选择、手机与桌面布局、秘密查看隔离、保存反馈及同步／回退不补播。
- [最终便携完整三胜](../../artifacts/maintenance/phone-table-levels/portable/results.json)、[便携聚会专项](../../artifacts/maintenance/phone-table-levels/party-portable/results.json) 和 [便携围桌／三档](../../artifacts/maintenance/phone-table-levels/room-portable/results.json)：最终 1.3.0 ZIP 各自解压到新目录，以仅 Windows 系统目录的 PATH 运行，通过完整三胜／十四阶段／原班续局及恢复、十组聚会专项、七组房间／三档实际混合小局与重启。三份记录的 ZIP SHA-256 与最终文件一致，均为 `15e1db3131f62dbebf6354e9ec0b14a98c10085b2e2e74662d4632baa7d926d2`；页面错误及外部请求均空。
- [文档链接核验](../../artifacts/maintenance/phone-table-levels/document-links.json)：本轮维护文档的本地文件和锚点检查通过。

协议版本为 4；平台格式／游戏／规则／状态／基础策略版本保持，旧人机缺省等级按默认读取，已有手机身份与进度保留。人机等级和获准记忆纳入保存／回退，不向手机或公共屏下发内部策略数据，不调用外部模型服务。所有测试使用隔离数据，历史 ZIP／证据保留。本轮仍为 Windows／Chromium 手机与电视尺寸模拟；未扩展为真实扫码摄像头、手机 Safari、Wi-Fi 互访或电视硬件验收。

## 首版维护：游玩节奏与六人提示

1.4.0，2026-10-02。正常游玩采用三档 1500／1800／2200ms 等待后计算，测试采用 40ms 并省略动效／声音；隐藏入口仅房主 `Ctrl+Shift+F12`。模式更改走权威校验和事务保存，普通重启回到游玩模式，不跳过规则、权限或恢复。连接帮助、游戏信息、座位设置、管理和游戏菜单改为原生模态浮窗，结束游戏是菜单中的直接按钮，确认默认聚焦取消。最新操作持续显示行动者、公开卡图／名称、能力、目标及卡位，最近记录可回看；喷火龙秘密查看不会公开格号、类别或值。胜局用放大的三颗星表示；六人桌面采用三列两排，结算的名字／星标／总分分列，计分明细浮窗展示列贡献和百变怪解析。玩法教学仍线下完成，实际游戏保持独立全屏路由。长期规格见 [模式与窗口](../reference/phase-02-platform-spec.md#实际游玩与测试模式140)、[游戏交互](../games/pokemon-encounters/interaction.md#游玩节奏行动播报与六人布局140)，六人是用户授权的 [S21 项目扩展](../games/pokemon-encounters/sources.md#s21六人项目扩展2026-10-02)，不冒充出版规则认证。

- 工程：typecheck、lint、format 与 16 文件／88 项测试通过。新增 [模式与调度七项](../../packages/platform-core/src/play-mode.test.ts)、[公开行动四项](../../games/pokemon-encounters/rules/public-actions.test.ts) 及真实 SQLite／Socket 模式启动与六真人入座，覆盖手机／public 拒绝、保存失败、旧字段默认、模式与 checkpoint／RNG／回退隔离、取消和真正超时。在线状态更新不再重置已排队的人机，也不会把主动取消误报为策略失败。既有 D01–D13、三处真实强制退出和 Worker 异常继续通过。
- 规则与人机：默认规则完成 25 个固定种子 2–6 人完整大局；三档各 2–6 人共 15 个固定种子整局，逐动作状态／合法性及每档全部 12 个玩家决策阶段通过。六人 30 个梦幻候选下，绝悟的两处实际 32 MiB／两秒 Worker 本机约 0.1 秒，完成后 heapUsed 约 8–9 MiB，不是峰值或所有电脑的保证。
- [游玩呈现专项](../../artifacts/maintenance/six-player-presentation/presentation/results.json)：六个独立手机身份实际加入并完成自然小局；实际保存动画／音频调用、测试关闭声音／特效、主机专属快捷键、浮窗 Escape／背板／焦点恢复、换手机和结束游戏的嵌套取消及确认通过。计分明细逐席与公共结果相符，开关不修改修订。六席和 36 张牌在 1080×800／1366×768 的游玩／结算首屏完整可见；长昵称和 28–30px 星标检查通过。三档实际等待分别为 1558／1862／2252ms，同一恢复决策测试共 315ms；暂停／切换／结束后无迟到保存。
- [全部卡面](../../artifacts/maintenance/six-player-presentation/cards/results.json)：正式六席存档渲染全部 16 类卡图；四种公共布局和九种手机布局，13 组图像加载、文字字号、分区不重叠、名称及角标边界、无横溢检查通过。截图人工查看，修复了插画被过大的标题／名称区挤成细条的问题；没有替换原图资源。
- [十五组能力 UI](../../artifacts/maintenance/six-player-presentation/ui/results.json)：2–6 人、多尺寸／长昵称、全部能力、手机触控选择／确认、保存反馈、公开行动的卡名／目标、临时查看隔离、减少动态、刷新／回退不补播和本地声音继续回归。fixture 检查使用游玩模式，不以测试省略特效代替动效检查。
- [开发完整三胜](../../artifacts/maintenance/six-player-presentation/development/results.json)、[六席围桌／三档](../../artifacts/maintenance/six-player-presentation/room/results.json) 与 [聚会回归](../../artifacts/maintenance/six-player-presentation/party/results.json)：六座位两手机／四实际 bot 完整三胜、十四阶段、三种桌面结算首屏、回退／冻结／断网／两次启动／原班续局通过；另有三手机／三等级实际 Worker 小局、七种房间尺寸和身份／等级重启保持；十组既有运行保障含本机网卡 IPv4、故意丢确认回复、弱网、换绑真实重启、公共屏保留及端口占用诊断通过。
- 最终 release：[完整整局](../../artifacts/maintenance/six-player-presentation/portable/results.json)、[聚会专项](../../artifacts/maintenance/six-player-presentation/party-portable/results.json)、[游玩呈现](../../artifacts/maintenance/six-player-presentation/presentation-portable/results.json) 和 [六席／三档](../../artifacts/maintenance/six-player-presentation/room-portable/results.json) 四组独立解压、仅系统 PATH 运行全部通过。ZIP 为 `artifacts/releases/TableMax-1.4.0-win-x64.zip`，156,114,564 字节（约 148.9 MiB），SHA-256 为 `b9d44588b03efff80df88f28a2afc5b6dc820501692c8d05855f0bdeff8835f1`；四份记录与最终文件一致。便携模式三档实际等待为 1560／1893／2294ms，同一恢复决策测试共 429ms。原版解压程序在运行造成文件锁时，打包改用每次独立目录，成功后复制标准 ZIP，不关闭原程序或覆盖它的输出。
- [文档链接核验](../../artifacts/maintenance/six-player-presentation/document-links.json)：本轮维护文件、来源及本地证据路径／锚点检查通过。

协议为 5，平台格式及游戏／规则／状态／策略版本保持；新增模式与公开行动为可选存档字段，旧 2–5 人存档和原身份继续读取。隐藏测试与实际游玩均使用同一保存／恢复／校验链路，普通启动不会遗留测试模式。全部验证隔离数据、隐藏窗口，不修改默认存档、系统电源或防火墙；实际音频调用不冒充现场听音，本轮仍为本机 Windows／Chromium 手机和电视尺寸模拟。历史 ZIP、截图和原始素材保留。

## 首版维护：电脑多分辨率显示

1.5.0，2026-10-02。电脑盒子与游戏增加“显示设置”浮窗，支持自动适配、720p／1080p／1440p／3840×2160 预设及 100%／125%／150% 界面大小。结合窗口 DIP 和 Windows DPI 计算，保持当前窗口／全屏尺寸，各窗口缩放隔离；房主管理与公共屏分别持久化最近选择，供新开窗口／重启沿用。手机没有入口、尺寸或身份不受调整影响，游戏存档与显示配置分开。短屏电脑压缩围桌、六人场地和暂停提示，保留卡位、最新操作和恢复按钮。长期行为见 [显示规格](../reference/phase-02-platform-spec.md#电脑多分辨率显示150)，工程边界见 [显示控制](../reference/architecture.md#电脑显示控制)。

- 工程：typecheck、lint、format 与 17 文件／98 项测试通过。[显示控制十项](../../apps/desktop/src/display-controller.test.ts) 覆盖自动／预设／DPI 计算、配置读写与损坏默认、保存失败、参数／主窗口／主 frame 授权、同源窗口独立缩放及销毁后的迟到事件／停止清理；既有规则、三档策略、权限、D01–D13 和真实崩溃恢复继续通过。
- [开发显示专项](../../artifacts/maintenance/display-resolution/development/results.json)：六个独立手机身份实际入座、准备并翻开初始牌，35 组布局和 47 次浮窗操作通过，保存 44 次真实截图。电脑房间四档原生内容尺寸的六席首屏无重叠，电脑对局的六席／36 张牌、最新操作、字号和星标首屏可见。实际房主暂停／恢复覆盖两端四档尺寸和 4K 100%／125%／150%，提示文本与 44px 恢复按钮可见且无遮挡，全部牌位首屏、无纵向滚动；重启恢复暂停及 DPI 模拟继续通过。显示浮窗即时切换、关闭／Escape 焦点恢复、刷新与真实桌面／服务重启、同源 host／public 及多个公共窗口隔离、手机／纯浏览器无原生设置通过；显示操作不改变游戏修订或系统显示器配置。
- [能力 UI 回归](../../artifacts/maintenance/six-player-presentation/ui/display-resolution/results.json)：六人 UI、V05 硬币及 V06 传递三组真实场景通过，继续检查本地图片、能力操作、授权结果动效与手机选择；没有更改规则、秘密投影或素材。
- [最终便携显示专项](../../artifacts/maintenance/display-resolution/portable/results.json)：最终 1.5.0 ZIP 新目录解压，以仅系统目录 PATH 运行，包含正式 preload；35 组布局、47 次浮窗操作、44 次实际截图和两窗口 DPI 模拟通过，覆盖同样显示、实际暂停／恢复、隔离与重启恢复场景。公共窗口单独关闭、两次桌面／独立服务退出正常，无页面错误或外部资源请求。代表 4K 房间、六人对局、暂停及 100%／150% 设置浮窗已人工查看，PNG 为实际更新后的原生隐藏渲染。ZIP 为 156,119,152 字节，SHA-256 `9f87af8ca7079d3136fd457d652184c89e632319561ed77ebf25e63bf9050a75`，与实际运行记录一致。
- [文档链接核验](../../artifacts/maintenance/display-resolution/document-links.json) 检查本轮主题、入口、源码与本地证据路径／锚点；发布 ZIP 的大小与 SHA-256 见 [发布核验](../../artifacts/maintenance/display-resolution/release-verification.json)，与便携运行记录相互核对。

本轮仍按既有授权使用本机 Windows／Chromium、隐藏窗口和隔离数据。3840×2160 PNG 证明该窗口尺寸的实际渲染；DPI 原生参数使用 `--force-device-scale-factor=1.5`，离屏绘制密度与 CDP 像素密度模拟分别记录，未覆盖视口或把模拟截图声明为真实 4K 显示器／电视验收。没有改变系统分辨率、DPI、电源、防火墙或默认玩家存档；原 1.4.0 程序及历史证据保留。本轮不重复声明此前完整三胜／聚会专项为 1.5.0 新包实测，相关历史验收继续保留。

## 1.6.0：盒子、对局体验与可靠性

2026-10-02，按用户确认计划实施，协议 6，存档格式仍为 1、规则与策略版本不变。游戏库提供宝可梦，模板只用于内部切换验证。本轮采用当前 Windows／隐藏 Electron 与独立手机 Chromium 会话，不扩大为实体手机、电视、Wi-Fi 或 Safari 认证。

- 工程：严格类型、ESLint、项目格式与 22 文件／127 项测试通过；覆盖 2／6 人同快照首翻、按座位准备、同人双击不同格、重复确认、保存失败、暂停／恢复／回退／换局失效窗口、手机房主授权／撤销／持久化／越权拒绝。读取一次存档、1.5.0 字段兼容、无游戏保存、切换人数／等级不兼容、加载或保存失败保持状态亦有回归。
- [六手机体验](../../artifacts/maintenance/v1.6.0/experience/results.json)：未选择游戏没有游戏主体模块／角色／背景／音频请求，选择后加载；显示图标居中、帮助对齐、真人房主手机开局、别人首翻不清自己的选牌、管理员独有操作隔离、兑换接口 404。真实桌面公共窗口优先默认发声、关闭后管理员接管且已播事件不补播。
- [完整开发对局](../../artifacts/maintenance/v1.6.0/development/results.json)：六席真人／实际 Worker bot 混合完成三胜大局，全部 14 阶段、回退、重启恢复、原班续局；1080×800／1366×768／1920×1080 结算首屏通过。[聚会保障](../../artifacts/maintenance/v1.6.0/party/results.json) 与 [房间／三等级](../../artifacts/maintenance/v1.6.0/room/results.json) 复验通过。
- 声画来源为本地 14 音频，喵喵／皮卡丘来自 Showdown 游戏叫声目录；记录 URL、版本和 SHA-256，未标为中文动画原声。火箭队用原创飞走声和文字。验证区分来源／解码／实际播放调用与真人试听；没有冒称完成现场听音。

内存证据见 [测量 JSON](../../artifacts/maintenance/v1.6.0/memory/results.json)。同一合法六席快照扩展到 1,200 checkpoint、1,200 receipt（5,222,948 字节）的规模 fixture，在各三个独立 Node 进程各 60 次复制中，深复制中位 52.22 ms／新增堆峰值 12,375,928 B，按字段复制 0.351 ms／259,872 B。采样总堆峰值中位 36.02 MB → 13.49 MB。这是复制算法的规模化比较，不是实际玩过 1,200 步，也不等于整局 RAM 降幅。隐藏 Electron 20 次六席开始／结束／回盒子及重选，后段与前段中位 post-GC heap 增加 75,524 B，DOM／监听器增长 0，页面错误 0；有界压力回归不证明长期完全无泄漏。未裁剪 checkpoint 或 SQLite journal。

[显示专项](../../artifacts/maintenance/v1.6.0/display/development/results.json) 已通过 44 张真实隐藏截图：720p／1080p／1440p／4K、暂停／恢复下两端全部 36 张牌首屏、44px 恢复按钮、100–150% 界面、每窗独立配置、刷新／重启及 150% DPI 模拟。[游玩呈现](../../artifacts/maintenance/v1.6.0/presentation/results.json) 已通过六个真实手机身份的自然小局（44 次驱动动作）、浮窗焦点、明确结束确认和真实保存动效；三档 Worker 实测等待 1564／1858／2232ms，测试三次选择 240ms，暂停／模式切换／结束取消旧任务。验收中修复了重复卡位底部间距、短屏弃牌按钮额外占行，以及打开公共屏时取消导航误清管理员播放资格的问题，保留既有可读／触控／无滚动断言。

[十五场游戏 UI](../../artifacts/maintenance/v1.6.0/ui/results.json) 与 [十三种卡面布局](../../artifacts/maintenance/v1.6.0/cards/results.json) 通过，覆盖全部能力、2–6 人、短手机／横屏及 16 类卡面，外部请求与页面错误均为零。[声画补查](../../artifacts/maintenance/v1.6.0/effects/results.json) 使用真实生产组件和按身份授权的投影构造六组视觉场景，验证公开零分列、暗牌交换、连续同一喵喵币面、只在本人画面出现的喷火龙火焰、特殊流程换入火箭队及共同赢家皇冠／全屏烟花；这些场景用于指定状态的视觉核验，不冒充自然对局。

当时最终的 `TableMax-1.6.0-win-x64.zip` 为 156,161,422 字节，SHA-256：`2acfdda6c4ec1dc062cec9977a63b398e2eaf5ef0ad060450525d294ae9eb6bb`；该历史程序包已在后续版本归一时按用户要求清除。动态规则和 bot 模块当时已纳入 ASAR 并实际运行；以下四份保留记录均对应当时同一最终 ZIP：

- [完整便携对局](../../artifacts/maintenance/v1.6.0/portable/results.json)：新目录解压、仅系统 PATH、六席含四个实际 Worker bot 完成三胜大局，69 次驱动动作、两次启动恢复、原班续局及重新开始，三种桌面尺寸结算可用。随机完整局到达 13 个阶段，另一币面的指定状态由开发完整局和能力视图补充覆盖。
- [便携聚会保障](../../artifacts/maintenance/v1.6.0/party-portable/results.json)：十组确认重试、弱网、回退暂停、刷新／重启、续局、重复启动、窗口生命周期及端口诊断检查。
- [便携六手机体验](../../artifacts/maintenance/v1.6.0/experience-portable/results.json)：四组按需加载、多人并发、手机房主权限与电脑单声源交接，恢复不补播。
- [便携显示专项](../../artifacts/maintenance/v1.6.0/display/portable/results.json)：同样通过 720p—4K、独立窗口缩放、暂停／恢复及 DPI 模拟，保留 44 张实际隐藏渲染截图。

维护的 [22 项清理测试（已退役）](../../artifacts/maintenance/v1.0.5/history-retirement-20261009/result.json) 和 [32 项统一维护测试](../../artifacts/maintenance/project-maintenance-tools/tool-tests.json) 全部通过，覆盖阈值、低水位、最旧优先、忙碌跳过、近期修改、链接、ZIP 哈希、证据及正式数据保护。全部验证与打包进程退出后执行 [实际维护检查](../../artifacts/maintenance/v1.6.0/maintenance.json)：自动解析同仓库主工作区 `E:\Proj\TableMax`，逻辑大小 3,049,074,100 字节（约 2.840 GiB），低于 5 GiB 阈值，删除 0 字节；跳过 1,330 个链接且不重复统计其他 checkout。未终止用户进程、放宽保护或扩大删除范围。

本轮实现已提交为 `542ccfd`（`feat: release 1.6.0 game library, mobile owners and reliable play`），未推送。[交付时文档核验](../../artifacts/maintenance/v1.6.0/document-links.json) 检查 40 份 Markdown、541 个本地链接和 138 个锚点，当前问题为零；61 处旧 artifact 路径在本 worktree 缺失，作为历史证据缺口单独记录。四份最终便携记录均与 ZIP 的实际哈希一致。

## v1.0.0：版本归一与开发效率优化

2026-10-03，按用户要求将最新版的应用与包版本由 1.6.0 重新编号为 v1.0.0，包含前节全部产品实现。协议 6、存档格式 1、游戏采用规则和策略版本沿用既有实现；历史验收日期、版本和证据保留原值。

开发效率规则补充工具结果摘要、批量独立检查、完成通知与有界等待、固定失败案例后再扩大验证，以及去重后的 token 统计口径。十个维护验证入口共用按应用版本生成证据目录的工具，避免新运行覆盖原 1.6.0 记录。手动清理支持显式退役版本，默认继续保护高于当前编号的未知版本；当前 ZIP、便携通过哈希、进程、路径、链接、近期修改和删除前复核保护继续执行。

- `pnpm package:win` 一次构建并导出最终 ZIP；[首次便携验证](../../artifacts/maintenance/v1.0.0/before-visual-polish/portable/results.json) 两次运行实际解压程序，确认应用版本 `1.0.0`、协议 6、六席真人／Worker bot 完整三胜大局、全部 14 阶段、回退、重启恢复及原班续局。记录 11 张实际隐藏渲染截图，外部请求和页面错误均为 0；设备模拟边界沿用前节。
- [清理工具隔离测试](../../artifacts/maintenance/v1.0.0/cleanup-tools/tool-tests.json) 29 项、[自动维护隔离测试](../../artifacts/maintenance/v1.0.0/maintenance-tools/tool-tests.json) 32 项通过；新增显式退役高编号标签、预览不删除、拒绝当前版本、拒绝自动退役及保留无关未来版本。脚本 ESLint、语法、证据目录、项目格式与当前交付链接检查通过；本轮未修改游戏源码，沿用前节游戏功能专项，不重复运行无关矩阵。
- 首次重标为 1.0.0 的 [Windows x64 便携 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-visual-polish/TableMax-1.0.0-win-x64.zip.retired.json) 为 156,161,426 字节，SHA-256 `8356117f71b657f4901ba0a5e081ea98d9bd575587f154e7392b765eb05e7363`。源码、锁文件、文档及开发规则随本轮提交导出为 [当次源码 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-visual-polish/TableMax-1.0.0-source.zip.retired.json)，不包含依赖、玩家存档、工具缓存或本地中间物。
- 空闲后执行已预览的手动清理：当时历史版本记录 `local-cleanup-20261002-162404-780-releases/cleanup.json` 记载删除旧 1.6.0 ZIP 及打包目录 2 项／704,520,503 字节；中间物记录 `local-cleanup-20261002-162435-967-intermediates/cleanup.json` 记载删除 56 项／4,501,388,803 字节。合计释放 5,205,909,306 字节（约 4.85 GiB）；默认 30 分钟保护保留 4 项近期内容，另保留 5 项未知临时资料。两份原记录当前不可读取，以上保留当时文档所记结果，不以本轮记录替代。当前 ZIP、存档、素材、依赖、缓存与历史证据继续保留。

[收尾统一维护](../../artifacts/maintenance/v1.0.0/maintenance.json) 发现同仓库主工作区 `E:\Proj\TableMax`，逻辑大小 3,048,787,207 字节（约 2.839 GiB），低于 5 GiB，删除 0 字节；跳过 1,330 个链接，不重复统计 worktree。未终止用户进程或放宽清理保护。

## 1.0.0：同版本视觉优化（2026-10-03）

按用户要求继续优化，package 版本保持 1.0.0，协议／存档／规则版本保持。本次不推出新版本号；只有用户明确要求时才调整版本的约定写入 Agent 入口和维护规则。当前交互正文见 [游戏交互](../games/pokemon-encounters/interaction.md#160行动面板与声画反馈)。

角色名称在投影、操作记录、卡面、待处理牌和可访问文本中去掉“外观”。工具栏标题使用不透明浅底与深色文字。电脑行动面板限制最大宽度，空待处理区去掉斜纹／占位卡框／加号，有牌时才突出暂持。进度改为完成／当前状态线，不再使用按钮式填色或重复步数。合法可取牌使用沿边框移动的虚线，公共牌堆标明展示，弃牌查看按钮紧贴弃牌堆右下侧。喷火龙四边环绕火焰向外燃烧，保留牌名和私密提示可读；减少动态使用静态替代，公共投影不泄露查看位置。

- 工程检查：typecheck、ESLint、项目格式及 22 文件／127 项测试通过；测试阶段实际用时 21.66 秒。后续仅短屏 CSS 和验证脚本调整，ESLint／格式再次核验；未改变规则或保存流程。
- [完整游戏 UI](../../artifacts/maintenance/v1.0.0/ui/results.json) 15 场、[卡面布局](../../artifacts/maintenance/v1.0.0/cards/results.json) 13 种／16 类、[声画与操作区专项](../../artifacts/maintenance/v1.0.0/effects/results.json) 7 项通过。专项使用生产组件和授权投影视觉 fixture，验证四边火焰、连续币面、静态替代及真正运动的虚线边框，区别于自然整局。
- 返修发现 720p 暂停时页面超高；根据实际截图和面板几何修正顶部／底部留白及 CSS 优先级，并提供 [固定失败场景验证](../../artifacts/maintenance/v1.0.0/display/paused-720p/results.json)。最终 [便携显示矩阵](../../artifacts/maintenance/v1.0.0/display/portable/results.json) 通过 44 张实际隐藏截图，包含 720p—4K、两端六人全部 36 牌、暂停／恢复、44px 控件、100／125／150% 窗口缩放、重启及 DPI 模拟；失败的开发记录保留为诊断，不作为最终通过证据。
- [最终便携整局](../../artifacts/maintenance/v1.0.0/portable/results.json) 实际解压新包运行，完整六席三胜、全部 14 阶段、回退、两次启动恢复及原班续局通过。与显示矩阵对应同一最终 ZIP；设备范围仍为本机 Windows／隐藏 Electron／独立手机 Chromium 模拟。

当轮 [Windows x64 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-independent-review/TableMax-1.0.0-win-x64.zip.retired.json) 为 156,161,961 字节，SHA-256 `caa042fc1af7ccab5dd8fdfdeb3bc91625854b5b1f30de2e98564277682d9729`。程序、源码及对应便携／显示证据现保留在 `artifacts/maintenance/v1.0.0/before-independent-review/`；当轮便携记录见该目录的 `portable/results.json`，显示记录见 `display/portable/results.json`，不将下一轮结果归到此哈希。首次同编号的程序、源码及便携证据仍保留在 `before-visual-polish/`。当轮 [源码 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-independent-review/TableMax-1.0.0-source.zip.retired.json) 对应原提交，不包含依赖、玩家数据或本地证据。

[同版本收尾维护](../../artifacts/maintenance/v1.0.0/visual-polish-maintenance.json) 检查主工作区 `E:\Proj\TableMax`，逻辑大小 3,049,079,281 字节（约 2.840 GiB），低于 5 GiB，删除 0 字节；跳过 1,330 个链接，未终止用户进程或扩大清理范围。新增文档链接／锚点和 diff 检查通过，版本及锁文件没有改动。

## 1.0.0：独立视觉审查与返修（2026-10-03）

按用户要求逐个关键中间状态截图，以 `fork_turns: none` 新建 32 个单图审查实例，不提供开发上下文、旧缺陷、源码或其他截图。审查覆盖初始翻牌、取牌／弃牌来源、普通换入、梦幻两步、火箭队两面、闪电鸟本人及各接牌者、卡比兽、喷火龙选牌及私密查看、能力反馈、零分列、结果及共同赢家，并对重点修正另建新实例复审。提示词、32 条结论及采用理由见 [逐图审查记录](../../artifacts/maintenance/v1.0.0/visual-review/reviews.md)，复用方法见 [游戏验证场景](../games/pokemon-encounters/validation-scenarios.md#当前界面的独立视觉审查)。

修正手机竖屏确认栏遮挡第二排卡位、模糊选牌文案及喷火龙关闭入口；首翻进度明确座位，待行动与最近动作不再仅靠颜色区分；能力横幅、抛币及结果标题避开卡牌，胜利姓名避免重复叠加；短桌面2至5人收紧高度，火箭队实际落点补充号位标签。保持 1.0.0，规则、协议、存档、权限及保存流程未改变。

- 工程检查：类型、ESLint、项目格式及 22 文件／127 项测试通过，测试阶段实际 30.62 秒；后续标签／CSS及证据目录参数改动重新核验类型、静态检查及格式，未重复无关规则测试。
- [最终 UI 回归](../../artifacts/maintenance/v1.0.0/ui/independent-review-verified/results.json) 15 场通过，保留 335 张实际隐藏渲染截图，含每一步公共屏／当前手机、滚动后牌阵、能力结果及多尺寸；重复进度帧保留，不宣称335张均独立送审。[卡面矩阵](../../artifacts/maintenance/v1.0.0/cards/results.json) 13 种／16 类及 [最终效果专项](../../artifacts/maintenance/v1.0.0/effects/independent-review-verified/results.json) 7 项通过。专项仍为生产组件及授权投影 fixture，区别于真实服务对局。
- [实际 ZIP 整局](../../artifacts/maintenance/v1.0.0/before-language-pruning/portable/results.json) 完整六席三胜、全部14阶段、回退、两次启动恢复及原班续局通过；[实际 ZIP 显示矩阵](../../artifacts/maintenance/v1.0.0/before-language-pruning/display/portable/results.json) 44 张截图通过，覆盖720p—4K、两端36牌、暂停恢复、100／125／150%缩放及原生DPI模拟。两份记录均对应下面的新哈希，不复用旧包通过结论。

当轮 [Windows x64 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-language-pruning/TableMax-1.0.0-win-x64.zip.retired.json) 为 156,162,408 字节，SHA-256 `d35c20eabf636a024dc0bec11d188690775c7b0d26a2e67853b67b167a3ef789`；[源码 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-language-pruning/TableMax-1.0.0-source.zip.retired.json) 按最终提交导出。上一轮程序、源码和对应证据保留在 `before-independent-review/`，此前首份同编号包仍在 `before-visual-polish/`。范围仍为本机 Windows／隐藏 Electron／手机 Chromium 与DPI模拟，单帧审查不证明动效、规则正确性或真实手机／电视体验，没有新增现场听音结论。

收尾 [统一维护](../../artifacts/maintenance/v1.0.0/independent-review-maintenance.json) 在构建、验证及打包退出后检查主工作区，保持5 GiB触发、4 GiB低水位及原安全保护。版本文件与锁文件保持不变；相关文档与链接、diff检查后统一提交，默认不推送。

## 1.0.0：便携包语言精简（2026-10-03）

用户授权先精简语言包，沿用 1.0.0。`electron-builder.yml` 只保留 `zh-CN` 和 `en-US`；游戏代码、美术、声音和 Chromium 其他运行组件不变。多个游戏后的按需安装已列入 [未来计划](../tasks/README.md#多游戏按需安装未来计划未实现)，本轮没有实现下载或更换桌面运行时。

- [ZIP 内容与体积核验](../../artifacts/maintenance/v1.0.0/before-webview2/language-pruning/results.json)：删除 53 个语言文件，保留的 21 个文件逐项解压 SHA-256 与旧包一致，包括程序、app.asar 和其他运行组件。ZIP 从 156,162,408 字节降至 144,416,191 字节（148.9 → 137.7 MiB），减少 11.2 MiB／7.52%。
- [实际便携整局](../../artifacts/maintenance/v1.0.0/before-webview2/portable/results.json)：当轮 ZIP 独立解压、仅系统 PATH、隐藏 Electron 与独立服务，通过六席三胜、全部 14 阶段、回退、两次启动恢复及原班续局，页面错误和外部请求为空。设备范围仍为本机 Windows／手机 Chromium 模拟，不新增实机或听音结论。
- 打包配置 Prettier 与 diff 检查通过；Node 22.14.0、pnpm 10.12.1、Electron 44.5.1 沿用锁定环境。首次沙箱构建因子进程 `spawn EPERM` 失败，获准后完成真实打包；本轮仅打包配置与文档变化，未重复规则测试或显示矩阵，游戏与前端文件字节一致的证据见上。

当轮 [Windows x64 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-webview2/TableMax-1.0.0-win-x64.zip.retired.json) SHA-256 为 `e070212ce21c94b5b1546ca09c954f85feab9afde83c3642b589e18f6cbface1`；源码包和对应证据已一并保留。上一轮 ZIP、源码、交付清单及对应整局／显示证据在 `artifacts/maintenance/v1.0.0/before-language-pruning/`，历史显示通过结论归属旧包，不标为新包重新执行。

## 1.0.0：原生桌面与小体积交付（2026-10-03）

按用户批准的计划，将桌面外壳替换为 net48／x64 WinForms＋共享 Evergreen WebView2＋包内官方 Node 22.14.0。版本保持 1.0.0，React、首版完整游戏、协议 6、存档格式与身份保持；不实施多游戏下载。采用理由见 [决策 008](../decisions/008-small-native-desktop.md)，运行时前提及体积计量见 [开发说明](../reference/development.md#便携包体积与共享运行时)。

当前已通过的集成关口：

- 工程 typecheck、ESLint、Prettier 和 23 文件／140 项测试通过；测试阶段实际 38.35 秒。原生最新构建 0 警告／0 错误，锁定 SDK 9.0.102、WebView2 SDK 1.0.4258.31。实际共享浏览器为 154.0.4258.48，服务为 Node 22.14.0／SQLite 3.47.2。
- [真实旧 SQLite 兼容](../../artifacts/maintenance/v1.0.0/webview2/server-migration.json)：隔离复制 Electron Node 24.21.0／SQLite 3.53.4 写出的六席对局，读取相同实例、座位身份与快照，修订 7→8 恢复、9 继续提交、10 再次启动；原文件哈希未变。没有迁移存档格式或删除旧数据。
- [原生安全与退出](../../artifacts/maintenance/v1.0.0/webview2/safety/results.json)：10 项真实关口通过，包含私有凭证、SPA 同文档授权／手机路径拒绝、子 frame／非法参数拒绝、重复启动、正常退出、服务崩溃、父进程崩溃及 Job Object 清理、生产 CDP 关闭和继承环境覆盖清除。缺运行时采用检测故障模拟，确认不启动服务且退出；本机已有运行时，未卸载系统依赖，安装／取消提示分支另经源码复核。
- [开发完整整局](../../artifacts/maintenance/v1.0.0/before-modern-art/development/results.json)：六席三胜、全部 14 阶段、回退、两次启动恢复及原班续局通过。[游戏 UI](../../artifacts/maintenance/v1.0.0/before-modern-art/ui/results.json) 15 场、[卡面](../../artifacts/maintenance/v1.0.0/cards/results.json) 13 布局／16 类、[声画 fixture](../../artifacts/maintenance/v1.0.0/effects/results.json) 7 项通过。fixture 不替代自然对局证明。
- [呈现与声音](../../artifacts/maintenance/v1.0.0/presentation/results.json)、[聚会保障](../../artifacts/maintenance/v1.0.0/party/results.json)、[并发与房主](../../artifacts/maintenance/v1.0.0/before-modern-art/experience/results.json) 通过，包含自然六手机小局、三档实际 Worker 节奏、保存动作声音／动画、手机静音、公共屏优先与关闭归还、事件去重、静音偏好、端口冲突细因、独立窗口与防休眠请求。

本轮验证仍在当前 Windows 11 x64 上完成。原生窗口位于屏幕外、不激活但实际合成渲染，测试 CDP 只监听临时回环端口；手机为隔离 Chromium profile 的触控／UA／网络模拟。外部网页请求被拒绝后的完整游戏证明离线资源链路，不声称实体电视、真实 Safari、另一台无开发环境电脑或现场听音实测。原包与对应证据保存在 `before-webview2/`，新包按实际哈希重新验收。

当轮交付已完成重新验收，程序、源码及将被后续验收更新的证据保留在 `before-modern-art/`：[Windows x64 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-modern-art/TableMax-1.0.0-win-x64.zip.retired.json) 为 **35,442,208 字节**，实际解压全部 **61 个文件／90,979,966 字节**；两项均严格低于 100,000,000 字节，解压也低于 95,000,000 字节预算，AC-24 通过。ZIP SHA-256 为 `3f7ed86a0b79d3f951b5992dbed614c3d4003f9db9bb756ac2a940cc346eacdf`。[逐文件交付清单](../../artifacts/maintenance/v1.0.0/before-modern-art/TableMax-1.0.0-win-x64-manifest.json) 包含实际字节数、每文件 SHA-256、官方 Node 下载校验及锁定 SDK；实际解压逐项一致，没有 Electron、PDB、其他架构 DLL、引用程序集、SDK 文档或开发 marker。Node.exe 为 83,344,536 字节，与官方 Windows x64 ZIP 原件完全一致。

以下记录全部使用该最终 ZIP 的新解压目录、隔离数据及仅系统 PATH，记录哈希与交付文件一致：

- [完整便携整局](../../artifacts/maintenance/v1.0.0/before-modern-art/portable/results.json)：六席三胜、14 阶段、回退、两次启动恢复、冻结／断网导航身份恢复和原班续局通过，网页错误和外部请求为空。
- [便携显示矩阵](../../artifacts/maintenance/v1.0.0/display/portable/results.json)：35 组布局、47 次浮窗检查、44 张真实截图，覆盖两端 36 牌、720p—4K、100／125／150%、暂停恢复、手机隔离、独立缩放、设置持久化与 DPI 模拟；实际原生尺寸等于请求尺寸，不以标签推定 4K。
- [并发／房主／声音](../../artifacts/maintenance/v1.0.0/before-modern-art/experience-portable/results.json)、[聚会保障](../../artifacts/maintenance/v1.0.0/party-portable/results.json)、[六席／三档](../../artifacts/maintenance/v1.0.0/room-portable/results.json) 和 [自然呈现／声音](../../artifacts/maintenance/v1.0.0/presentation-portable/results.json) 全部通过；对应实际命令耗时 21.7、26.7、39.088、49.327 秒，显示为 117.4 秒，并行耗时不相加。
- [正式包原生安全](../../artifacts/maintenance/v1.0.0/webview2/safety-portable/results.json)：10 项通过。正式包忽略开发 URL、测试 CDP 环境和继承 Node／WebView2 覆盖，缺运行时检测、桥接权限及父子进程故障行为与开发验证一致。

共享运行时、用户数据与浏览器缓存位于系统／用户数据目录，未算入上述交付体积；这些前提没有隐藏为包内组件。源码 ZIP 和总交付清单按本次最终提交导出，保留用户已有 README 工作区改动、不混入提交，默认不推送。

[20 次真实游戏导航](../../artifacts/maintenance/v1.0.0/memory/results.json) 的桌面专项通过，DOM／监听器增长为 0；测量只证明此次导航回归，不比较不同运行时的绝对工作集，也不宣称长期无泄漏。收尾清理工具 29 项、统一维护 32 项隔离安全检查通过；实际 [安全维护](../../artifacts/maintenance/v1.0.0/webview2/maintenance.json) 被仍引用工作区的两个 Codex 工具 worker 触发进程保护，保留全部文件、删除 0 字节。没有终止这些进程、放宽清理范围或绕过保护，未取得此次完整工作区水位测量。

返修与耗时：先通过小于 100 MB 的真实启动目录、旧存档与管道，再迁移完整专项。期间修复 WinExe 重定向标准流、构造期窗口上下文、初始化期间服务退出、退出前 stdout 排空、SPA 桥接文档来源和原生 4K 窗口尺寸钳制；CDP 关闭窗口改为处置真实 Form。失败证据在 `webview2/first-regression-failures/`，不作通过结论。首轮 game-ui 234.758 秒、cards 18.959 秒、effects 16.838 秒、presentation 失败 34.978 秒／修复重跑 38.313 秒；命令并行，不能相加为总耗时。证据日志见 `webview2/regression-*.log`。清理隔离测试曾被正在运行的验收进程保护挡住，收尾在全部进程结束后再执行。

## 1.0.0：现代艺术独立接入（2026-10-03）

按用户要求，等待“空间优化”及其追加整理完成于 `26db138` 后开工；版本继续保持 1.0.0。正式盒子现提供宝可梦和现代艺术，两款游戏分别维护规则、状态校验、公开投影、三档本地 bot、UI、样式与本地资源；平台继续负责身份、授权、统一动作／保存／回退及恢复。共享反馈契约不再枚举宝可梦能力，盒子只加载目录和小封面，进入 `/game` 才加载对应客户端。来源与自主采用项见 [现代艺术规格](../games/modern-art/README.md)及[来源](../games/modern-art/sources.md)。

已通过：

- `pnpm check`：类型、ESLint、项目格式及 **26 文件／160 项测试**，最终测试耗时 **23.08 秒**。现代艺术的 15 个规则风险用例、4 个策略用例包含 3／4／5 人 × 三档 × 三种固定种子的 **27 场完整对局**，逐动作核验合法选择、输入不变、秘密投影和 JSON 恢复。
- [真实 Socket.IO／SQLite 测试](../../apps/server/src/modern-art.test.ts)：暗标单人提交后的秘密保护、同一快照独立提交、重复确认、暂停重启、回退和手机房主授权分离通过。非法恢复的拍卖进度、资金发行和第五张归属，以及绝悟整体排名估值问题均经独立复现、修复及回归。
- [实际产品组件 fixture](../../artifacts/maintenance/v1.0.0/modern-art/ui-fixture/results.json)：21 个操作／布局场景、[12 个短屏场景](../../artifacts/maintenance/v1.0.0/modern-art/ui-fixture/short-results.json)、[56 个面板场景](../../artifacts/maintenance/v1.0.0/modern-art/ui-fixture/panel-results.json)通过。包含 854×480／854×600 CSS 短桌面、720p—4K、320×568 手机、五类拍卖、双拍与结算；宝可梦 Portal 浮窗的 8 张公开牌图片及 16 张暗牌权限另验。这些 fixture 与自然对局分开记录。
- [最终 ZIP 的现代艺术整局](../../artifacts/maintenance/v1.0.0/modern-art/portable/results.json)：三个独立真人手机身份与两个实际 Worker bot 完成 **五席四轮、200 次手机动作尝试**；明确断言五种拍卖和八类真实手机控件的具体保存记录。五套本地图集解码、公共手牌／现金／暗标秘密保护、手机房主下一轮、回退、同端口 SQLite 重启、原手机 profile 凭证恢复及同一 SPA 文档中的宝可梦／现代艺术切换通过；两款 CSS 实际共存，身份五席保持。28 张真实截图，页面错误与外部请求为 0；该成功执行 **46.579 秒**。
- [最终 ZIP 的共享交互回归](../../artifacts/maintenance/v1.0.0/experience-portable/results.json)：宝可梦盒子懒加载、手机房主、并发及公共屏声音归属通过。[完整宝可梦便携整局](../../artifacts/maintenance/v1.0.0/portable/results.json)六席三胜、全部 14 阶段、回退／重启／原班续局通过，页面错误与外部请求为 0；同构建的[能力 UI](../../artifacts/maintenance/v1.0.0/ui/results.json)15 组通过。旧包的显示／原生安全记录保持原执行范围。
- [美术导入核验](../../artifacts/maintenance/v1.0.0/modern-art/imagegen/integration-verification.json)：70 卡映射、五套图集、封面及构建哈希均通过；六份 WebP 共 **1,497,918 字节**，原始 PNG、提示词、出版实物参考与原创演绎说明保留。纹理生成约 **259.65 秒**，不含检索、压缩及其他工作。卡面不冒充真实画家原作，拍卖子类型分布仍明确标为项目采用表。

同版本 [Windows x64 ZIP（已退役）](../../artifacts/maintenance/v1.0.0/before-v1.0.1/TableMax-1.0.0-win-x64.zip.retired.json)为 **36,966,642 字节**，实际解压 **72 文件／92,579,416 字节**；两项严格低于 100,000,000 字节，解压也满足 95 MB 工程预算。SHA-256 为 `7edd0ec38b5710b27fec6590cb139690524f1a59c263631c25013fb7e2438f6b`；[逐文件清单](../../artifacts/maintenance/v1.0.0/before-v1.0.1/TableMax-1.0.0-win-x64-manifest.json)与真实解压逐项一致，便携运行仅系统 PATH。前一轮程序、源码、清单及被更新的验证目录保存在 `before-modern-art/`，历次记录保持其原哈希。源码及总交付清单按最终提交另行导出，用户已有 README 改动保持原字节且不混入提交。

范围仍为当前 Windows 11／共享 WebView2／原生后台合成和 Chromium 手机触控／尺寸模拟，不声称实体电视、真实手机或 Safari 实测。Windows DPI 与原生自动缩放被纳入实际几何记录；图片为真实更新后的帧。独立单图审查覆盖冻结的[公共屏（历史截图已清理）](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/manifest.json)和[手机（历史截图已清理）](../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/manifest.json)：手机未发现必须修复项；公共收藏末卡的边缘提示经[裁定](../../artifacts/maintenance/v1.0.0/modern-art/review/adjudication.json)保留为有总幅数与显式滚动条的横向收藏布局。静态[解耦及文档审查](../../artifacts/maintenance/v1.0.0/modern-art/review/static-review.json)另记录模块与链接证据。

返修集中在高风险恢复、绝悟估值、Windows 150% DPI 短窗口、游戏 CSS specificity／Portal 范围及盒子续局样式。验收脚本先修正公共窗口路由与自动缩放测量，再按实际“游戏切换返回大厅”行为启动下一游戏；等待动态客户端与公共屏首次渲染，避免导航时抢读上下文。最终源码稳定后仅生成一次最终包，脚本和记录修正沿用该同一 ZIP；没有因仅文档变化重复打包。

收尾发现统一维护在大量依赖目录中反复调用 PowerShell provider 计量过慢；仅中断本任务自行启动的维护进程并保留[首次记录](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-first-attempt.json)及[中断说明](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-interruption.json)。统计函数改为 .NET 流式遍历，每次删除后仍完整重测；[独立复核](../../artifacts/maintenance/v1.0.0/modern-art/review/cleanup-measure-review.json)发现的目录属性缓存边界经出栈刷新修正，删除范围和既有保护代码保持原字节。[29 项手动清理检查](../../artifacts/maintenance/v1.0.0/modern-art/cleanup-tool-tests.json)及[34 项统一维护检查](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-tool-tests.json)通过，新增隐藏／系统文件计量与保留用例。[真实仓库对比](../../artifacts/maintenance/v1.0.0/modern-art/cleanup-measure-comparison.json)的字节、文件、链接和嵌套仓库四字段完全相同：106,546 文件／19,968,400,712 字节／跳过 1,323 链接；Windows PowerShell 的统计耗时由 22.991 秒降至 3.885 秒（后者含首次编译）。这次仅工具和记录变化，未重复游戏构建或无关测试。

[续跑维护](../../artifacts/maintenance/v1.0.0/modern-art/maintenance.json)按重新核验的 30 分钟边界处理全部 55 个合格候选，删除 10,372,585,307 字节（约 9.66 GiB）；合格候选耗尽，工作区仍约 8.94 GiB，超过 5 GiB 的剩余受保护内容仅报告。当前 ZIP 哈希未变，正式存档、原始美术、历史证据、依赖与工具缓存保持，未扩大范围或终止其他进程；[维护摘要](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-summary.json)同时保留首次测量和中断接续说明。
