# 首版交付与验收

当前本地便携包为 [v1.0.1 宝可梦画面与动效返修](#101宝可梦画面与动效返修2026-10-04)，线上已发布包见 [v1.0.1 GitHub Release](#101github-release2026-10-03)，保留下列历次真实验收记录。

## 1.0.1：宝可梦画面与动效返修（2026-10-04）

按用户对四张主要画面的十三处批注，收紧行动条与六人间距，改用白色斜纹进度、区分两类牌堆及暂持区，压缩手机首屏、居中梦幻目标入口、分开排版行动信息，并放大二人结算。子 agent 分析后增加保存动作的连接轨迹、能力落点、赢家扫光和新星标闪亮；授权投影、明确位置确认和动效失效边界保持，完整行为见 [交互规格](../games/pokemon-encounters/interaction.md)。截图保存至 `tmp/pokemon-screenshots-5a6f7893/`，历史原图和预览在 `ui/screenshots-20261003/` 与本次 `before/` 保留。

短手机累计覆盖 16 个场景：首轮 [前八场景](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-final/results.json)完成后在火箭队币面溢出中停止，返修后的 [八种能力流程](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-abilities-final/results.json)全通过；星标恢复 28px 后再验 [六人梦幻／普通手机／私看三场景](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-phone-final/results.json)通过。全部六格、号位和确认在 360×640 首屏，触控门槛及无遮挡检查保留。[默认六人流程](../../artifacts/maintenance/v1.0.1/ui/pokemon-polish-default-final/results.json)另通过原横屏与手机尺寸检查；[卡面](../../artifacts/maintenance/v1.0.1/cards/results.json)通过 13 布局／16 类牌，[动效](../../artifacts/maintenance/v1.0.1/effects/pokemon-polish-20261004/results.json)通过 8 项。三张独立逐图审查没有必须返修项，提示与裁定见 [审查记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/review-record.json)。

[开发显示](../../artifacts/maintenance/v1.0.1/display/development/results.json)通过 35 组布局／44 张截图：四种原生窗口尺寸、两端六人 36 牌、暂停／恢复、4K 100%／125%／150% 缩放与模拟 DPI；[开发整局](../../artifacts/maintenance/v1.0.1/development/results.json)通过 14 阶段、回退及重启恢复；[自然声画](../../artifacts/maintenance/v1.0.1/presentation/results.json)通过六位实际手机身份、完整小局、浮窗焦点、星标与三档真实 Worker 节奏／取消。设备边界为本机 Windows 隐藏 WebView2／Chromium 的窗口、触控及 DPI 模拟，不代表实体手机、Safari、电视或现场听音。

类型、ESLint、Prettier 通过。全库默认并发测试出现两项人机整局超时；停止界面验证并改用单 worker 后，宝可梦测试全部通过，全库 **25 文件通过／164 项通过／1 项失败**。剩余为未修改的《现代艺术》策略整局测试超过原 20 秒，仍未通过；不放宽时限或将它写成绿色工程检查。原始输出和 107.322 秒命令耗时见 [单进程测试记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/tests-serial.json)及同目录日志，默认 `pnpm check` 89.326 秒失败记录亦保留。仅 CSS／标题选择器返修后重验类型、lint、格式及相关真实流程，没有重复未变化的规则测试。

最终同版本 [本地程序包](../../artifacts/releases/TableMax-1.0.1-win-x64.zip)为 **37,931,361 字节**，实际解压 **75 文件／93,576,952 字节**，双 100 MB 门禁及 95 MB 预算通过；[逐文件清单](../../artifacts/releases/TableMax-1.0.1-win-x64-manifest.json)记录 SHA-256 `d21389dc647679c4d834a8b193e410048600b2faf6986b4dc0abbce06de4a880`。旧图标包与已发布源码／总清单归档在 `pokemon-polish-20261004/before/`；首个返修包及失败证据归档在 `first-package/`。首包实际 ZIP 验收发现测试标记横向溢出、手机星标偏小，随后开发整局发现六人结算需另留计分高度；全部返修后再次冻结打包。旧计分浮窗标题选择器仅对齐去中点后的实际标题，内容、焦点和秘密信息检查保留。本次更新本地程序，线上发布内容与源 ZIP 沿用原发布记录。

最终 ZIP 的 [便携整局](../../artifacts/maintenance/v1.0.1/portable/results.json)、[显示矩阵](../../artifacts/maintenance/v1.0.1/display/portable/results.json)和 [自然声画](../../artifacts/maintenance/v1.0.1/presentation-portable/results.json)首次验收全部通过，均关联上述 `d21389dc…` 哈希：六席三胜、14 阶段、129 次 driver 动作、回退、两次真实启动恢复及原班续局；显示 35 布局／47 浮窗检查／44 张截图；六位实际手机身份自然小局、28px 星标、计分焦点和三档生产节奏／取消。各组页面错误与外部请求为空。最终打包 15.994 秒，整局／显示／声画分别 73.414／114.501／45.796 秒；并行耗时不相加，实际交付与前次失败记录见 [交付记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/delivery-record.json)。本次所有验收子进程已退出。

按用户要求清理临时文件夹：先逐项预览，再通过 `Clean-Intermediates.ps1 -TemporaryNames … -MinimumAgeMinutes 0 -Apply` 删除 **71 项／6,315,587,478 字节（5.88 GiB）**，临时日志先归档并核验哈希，路径、链接目录、进程与修改保护仍执行。`tmp/` 最终只保留四张更新 PNG 和预览页所在的 `pokemon-screenshots-5a6f7893/`；逐项结果见 [清理记录](../../artifacts/maintenance/local-cleanup-20261003-181404-326-intermediates/cleanup.json)，实际命令耗时 1582.645 秒，见 [耗时记录](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/temporary-cleanup-timing.json)。

随后执行 `Maintain-Project.ps1 -Apply`，删除两项安全打包中间物共 **450,194,796 字节**。工作区剩余 **10,104,036,170 字节（9.41 GiB）**，合格候选耗尽；历史证据、原始素材、正式存档、依赖与工具缓存继续保护，未扩大删除范围。当前 ZIP 哈希仍为上述 `d21389dc…`，实际维护耗时 17.437 秒，见 [维护汇总](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/maintenance-summary.json)、[逐项记录](../../artifacts/maintenance/local-cleanup-20261003-183328-416-maintenance/cleanup.json)及同目录任务日志。

## 1.0.1：应用图标更新（2026-10-03）

按用户要求用内置 imagegen 生成高级应用图标，并应用到 EXE、主机／公共窗口标题栏和任务栏、浏览器标签、手机主屏入口及三端盒子品牌。采用青绿陶瓷圆角磁贴与奶油桌台／叠牌 T 形，细暖金夹层；资源、提示词和哈希见[平台清单](../../assets/platform/manifest.json)，完整原图与浅深底 16–256px 审查证据在 `artifacts/maintenance/v1.0.1/app-icon/imagegen/`。当前应用版本继续为 1.0.1。

该次[本地便携包](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/before/TableMax-1.0.1-win-x64.zip)为 **37,924,627 字节**，实际解压 **75 文件／93,539,137 字节**，通过双 100 MB 门禁和 95 MB 工程预算。[逐文件清单](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/before/TableMax-1.0.1-win-x64-manifest.json)记录 ZIP SHA-256 `61445bb9205bb1068377cbaf65f648ac31909e885c3e962f4f1e382b0f02b448`。已发布旧包与清单备份到 `artifacts/maintenance/v1.0.1/app-icon/before/`，其原哈希与下节发布验收保持。

类型、ESLint、Prettier 和 **26 文件／160 项测试**通过；最终 ZIP 的[宝可梦便携整局](../../artifacts/maintenance/v1.0.1/app-icon/portable/results.json)通过六席、14 阶段、回退、两次启动恢复及原班续局。本次复用既有便携验证脚本，仅将副本的相对导入与证据输出改到图标专属目录，原验证脚本和历史证据保持。初次测试被沙箱子进程权限拦截，后以授权范围重跑测试；首次打包遇到短暂 EXE 文件锁，重试后成功，未关闭已有应用。游戏规则、策略和协议未变，设备边界仍为本机 Windows 与隐藏 WebView2／Chromium 尺寸模拟。

[图标实际集成](../../artifacts/maintenance/v1.0.1/app-icon/integration-results.json)通过主机 1280×720、公共屏 1920×1080 和手机 360×640：品牌图片、网页标签及主屏图标均同源且与源文件哈希一致，无横向溢出、页面错误或外部请求；三张 PNG 来自更新后的隐藏真实渲染。[原生审计](../../artifacts/maintenance/v1.0.1/app-icon/native/portable/result.json)核验 EXE 与源 ICO 的 16／32／48／256px 像素一致，实际主机／公共窗口大小图标与当前 DPI 150% 选出的 48px 资源及 PerMonitorV2 关联图标基线逐像素一致。初次审计的固定 32px 假设与 WindowsPS 模块依赖已纠正，不是产品图标故障；已通过的工程检查、最终打包和整局不重复执行。图像生成实测 34.93 秒、Vitest 23.33 秒，其余关键耗时与执行范围见[交付记录](../../artifacts/maintenance/v1.0.1/app-icon/delivery-record.json)。本次没有更新线上 Release。

所有本次构建／验证进程结束后执行 `Maintain-Project.ps1 -Apply`；既有 TableMax 实例及其服务仍运行，维护按进程保护保留全部文件，删除 0 字节，未进行容量统计或扩大清理范围。结果见[维护日志](../../artifacts/maintenance/v1.0.1/app-icon/maintenance.log)，当前包、原图、存档与历史证据均保留。

## 1.0.1：GitHub Release（2026-10-03）

按用户最新指示，将含《现代艺术》的版本定位为 v1.0.1，并发布到 [GitHub Release](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.1)。应用、原生程序集、Windows manifest 和桌面版本响应同步为 1.0.1；规则、协议、存档和策略版本不变。原生安全验证改为读取当前应用版本对应的清单。用户原有 README 改写保留在工作区，发布提交仅纳入本次版本／下载链接调整和现代艺术说明。

`pnpm package:win` 重新构建并逐文件核验实际解压：ZIP **36,966,646 字节**，解压 **72 文件／92,579,416 字节**，满足双 100 MB 门禁及 95 MB 解压预算。SHA-256 为 `8b3d4bc237d75e843a8b842d23ffeb7f651b4e531fbf2b2131b3a4433498dc6c`；[逐文件清单](../../artifacts/maintenance/v1.0.1/app-icon/before/TableMax-1.0.1-win-x64-manifest.json)与[便携包](../../artifacts/maintenance/v1.0.1/app-icon/before/TableMax-1.0.1-win-x64.zip)配套。

- [现代艺术便携整局](../../artifacts/maintenance/v1.0.1/modern-art/portable/results.json)通过：五席四轮、全部拍卖与八类手机动作、秘密隔离、回退、重启和游戏切换；28 张实际截图，页面错误和外部请求为空。
- [宝可梦便携整局](../../artifacts/maintenance/v1.0.1/pokemon-polish-20261004/before/portable/results.json)通过：实际应用版本 1.0.1、六席三胜、14 阶段、回退、重启及原班续局。
- [原生安全专项](../../artifacts/maintenance/v1.0.1/webview2/safety-portable/results.json)10 项通过，包括清单和可执行文件哈希、共享运行时缺失、桥接授权、进程隔离与退出清理。修改脚本的 ESLint、Prettier 及 Git diff 空白检查通过。

本次仅调整应用版本及发布资料，不改游戏实现；设备边界沿用前次验收，仍为 Windows 后台真实渲染和 Chromium 手机尺寸／触控模拟。首次构建被沙箱子进程权限拦截，授权范围内重跑成功；三组实际新包验证分别保留开始／结束时间，不相加为总耗时。发布源码由对应提交导出，排除用户未提交的 README 改写、依赖、存档、原始素材和中间物；历史 1.0.0 验收保持原记录。发布后复核 GitHub 标签指向 `c63b36f9f0129b711ede79df67f419c7627410a2`，四个附件的大小及 SHA-256 与本地一致，Release 为正式最新版；[发布回读](../../artifacts/maintenance/v1.0.1/github-release.json)保存结果。旧 1.0.0 交付先按原哈希归档至 `before-v1.0.1/`，安全维护随后从 releases 移除旧 ZIP；其余近期修改和受保护项保留，工作区超过水位只报告。

随后按用户要求清理历史版本及中间文件：手动入口在完整空闲检查后使用零分钟年龄边界，共删除 **14 项／3,435,627,475 字节（3.20 GiB）**，包括旧解压程序、旧源码与配套清单、打包目录及已结束的隔离验证数据。清理器补齐旧源码／两类清单及六位随机后缀 `modern-art-verify-*` 的识别，当前／未来交付及相似研究目录保持保护；[37 项手动清理检查](../../artifacts/maintenance/local-cleanup-tools/tool-tests.json)与[34 项维护检查](../../artifacts/maintenance/project-maintenance-tools/tool-tests.json)通过。逐项删除记录见 `artifacts/maintenance/local-cleanup-20261003-152207-455-releases/`、`local-cleanup-20261003-152219-114-intermediates/`、`local-cleanup-20261003-152431-213-releases/` 和 `local-cleanup-20261003-152444-298-intermediates/`；当前 ZIP 哈希不变。最终统一维护实测 **8,675,898,844 字节（8.08 GiB）**、0 合格候选；8 项未识别临时内容、历史证据、原始素材、依赖与工具缓存、当前构建和正式存档保留，未扩大清理范围。仅清理工具与文档变化，不重跑游戏构建或修改已发布的 v1.0.1 包。

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

当前便携包为 `artifacts/releases/TableMax-1.0.1-win-x64.zip`，使用步骤见 [项目说明](../../README.md#使用便携版)。命令、数据位置和排障见 [开发环境](development.md)；接入与替换策略见 [扩展指南](../game-development/README.md)。历史第一阶段 0.1.0 ZIP 不代表当前产品。

2026-10-02 按用户要求清除历史版本：移除 0.1.0、1.0.0、1.0.1、1.0.2、1.1.0、1.2.0、1.3.0 共七个 ZIP，以及 phase-01／phase-06／releases 下三个旧 `win-unpacked`，释放 2,161,988,613 字节（约 2.01 GiB）。当次保留 1.4.0 ZIP、解压程序及打包目录，ZIP 哈希与该版最终验证一致；原始素材、截图、JSON、默认玩家数据和 Git 历史保留。以下历次验收中的“旧包保留”描述当时状态，0.1.0–1.3.0 旧包现已清除；[清理记录](../../artifacts/maintenance/release-cleanup-2026-10-02/cleanup.json) 保存删除清单、空间和证据目录检查。

同日用户再次要求清理历史版本和中间产物，并提供可复用工具：移除 1.4.0 ZIP、解压程序、旧打包目录共三项，以及 116 项已结束的测试数据／便携解压副本／打包中间物，释放 16,771,539,807 字节（约 15.62 GiB）。当前 1.5.0 ZIP 保持 `9f87af8ca7079d3136fd457d652184c89e632319561ed77ebf25e63bf9050a75`，原始素材、phase-01 至 phase-06 及维护验收证据、默认玩家存档和当前构建保留；十一份一次性脚本先归档，`tmp/` 已无残留。以下历史验收中的“保留旧包／程序”只指当时状态，1.4.0 程序现已清除。逐项结果见 [清理核验](../../artifacts/maintenance/local-cleanup-tools/cleanup-summary.json)，两份完整删除记录由其 `reports` 字段链接；[20 项工具验证](../../artifacts/maintenance/local-cleanup-tools/tool-tests.json) 使用独立模拟工作区，包含默认预览、当前／未来包、运行进程阻止、junction 防护、近期／未知内容保护、一次性脚本归档、显式构建清理和未验证 ZIP 拒绝。Windows PowerShell 5.1 实际执行通过，工具与保护约定见 [清理说明](development.md#清理本地中间物)。游戏源码／release 未改，无需重新执行游戏整局验证。

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

1.2.0，2026-10-02。范围为持久化加入／换绑确认、实时网卡与启动排障、原班续局及运行保障；不新增游戏内教程或规则帮助。长期行为及窗口／存档边界见 [聚会规格](phase-02-platform-spec.md#聚会连接连续游玩与运行保障)，采用理由见 [可靠确认决策](../decisions/005-platform-authority-and-recovery.md#加入确认与原班续局2026-10-02)。

- `pnpm check`：typecheck、lint、format:check 与 12 文件／58 项测试通过。新增并发／丢回复确认、内容冲突、保存失败、加密存储及对外信息隔离、真实 SQLite 重启、绑定期限／撤销、原班续局及旧实例拒绝；防休眠生命周期、网卡变化及中文错误提示另验。旧有规则、D01–D13、Worker 和实际强制退出测试继续通过。
- [聚会专项](../../artifacts/maintenance/party-reliability/party/results.json)：服务实际监听 0.0.0.0，经本机常规网卡 IPv4 访问；地址标注／刷新／选择保持、提交已保存后故意丢弃 HTTP 回复、刷新确认唯一座位、换绑回复丢失后真实程序重启确认同一座位、原凭证失效及读档暂停通过。250ms 延迟／限带宽、断网与后台冻结恢复通过。实际 UI 筛选回退、具体步骤确认并暂停、原班第二大局、第二桌面进程退出、保留公共屏后重开管理、真实端口占用的中文错误日志通过。原生防休眠 API 活跃，保护释放和显示保护的独立生命周期另由工程测试核验；未让电脑真实休眠。
- [十四组 UI](../../artifacts/maintenance/party-reliability/ui/results.json)：全部既有能力／位置选择／手机布局、秘密查看隔离、保存反馈和同步／回退不补播通过；截图来自更新后的隐藏渲染。已人工查看新增网卡帮助和回退筛选截图。
- [开发整局](../../artifacts/maintenance/party-reliability/development/results.json)：五座位（两位模拟真人、三位实际 Worker bot）完整三胜及十四阶段、回退／冻结／离线与两次启动恢复通过。完成大局后实际点击续局，保留五座位顺序、三电脑和手机凭证，真人重新准备并启动第 1 小局。
- [最终便携整局](../../artifacts/maintenance/party-reliability/portable/results.json) 与 [便携聚会专项](../../artifacts/maintenance/party-reliability/party-portable/results.json)：最终 1.2.0 ZIP 分别解压到新目录、以仅 Windows 系统目录的 PATH 运行，通过同样的完整三胜／五座位原班续局及十组聚会专项，包括过期待确认请求不重发、不多占座。两份记录的 ZIP SHA-256 一致，均为 `54bcc1e7e4a74a647dd1aa74642db5075db7263982fbfddb88b4e440f165c4fa`；页面错误为空。旧包与证据保留。
- [文档链接核验](../../artifacts/maintenance/party-reliability/document-links.json)：本次维护文档的本地文件和锚点通过检查。

协议为 3，游戏采用规则／状态／策略版本与平台格式 1 保持；1.1.0 存档通过可选字段默认值继续读取。全部测试使用隔离数据，未读取默认玩家存档，也未自动更改防火墙或系统电源设置。本机网卡 IPv4 访问仅证明本机服务的局域网监听／地址路径；不声明实际手机扫码、Safari、实际 Wi-Fi 互访、电视或另机便携运行通过。声音未追加现场听音结论。旧 ZIP、原图和历史验证不覆盖。

## 首版维护：手机围桌与三档人机

1.3.0，2026-10-02。所有真人各自用手机操作，电脑只运行服务、管理员和公共展示；房间是有五个环绕席位的桌子，手机本人席位突出，空座、准备／在线状态和人机等级公开。玩法教学仍在线下，正式盒子与游戏菜单不设规则帮助。配置与权限见 [房间规格](phase-02-platform-spec.md#手机聚会与围桌房间2026-10-02)，算法、记忆及局限见 [首版人机](../games/pokemon-encounters/bot.md)。

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

1.4.0，2026-10-02。正常游玩采用三档 1500／1800／2200ms 等待后计算，测试采用 40ms 并省略动效／声音；隐藏入口仅房主 `Ctrl+Shift+F12`。模式更改走权威校验和事务保存，普通重启回到游玩模式，不跳过规则、权限或恢复。连接帮助、游戏信息、座位设置、管理和游戏菜单改为原生模态浮窗，结束游戏是菜单中的直接按钮，确认默认聚焦取消。最新操作持续显示行动者、公开卡图／名称、能力、目标及卡位，最近记录可回看；喷火龙秘密查看不会公开格号、类别或值。胜局用放大的三颗星表示；六人桌面采用三列两排，结算的名字／星标／总分分列，计分明细浮窗展示列贡献和百变怪解析。玩法教学仍线下完成，实际游戏保持独立全屏路由。长期规格见 [模式与窗口](phase-02-platform-spec.md#实际游玩与测试模式140)、[游戏交互](../games/pokemon-encounters/interaction.md#游玩节奏行动播报与六人布局140)，六人是用户授权的 [S21 项目扩展](../games/pokemon-encounters/sources.md#s21六人项目扩展2026-10-02)，不冒充出版规则认证。

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

1.5.0，2026-10-02。电脑盒子与游戏增加“显示设置”浮窗，支持自动适配、720p／1080p／1440p／3840×2160 预设及 100%／125%／150% 界面大小。结合窗口 DIP 和 Windows DPI 计算，保持当前窗口／全屏尺寸，各窗口缩放隔离；房主管理与公共屏分别持久化最近选择，供新开窗口／重启沿用。手机没有入口、尺寸或身份不受调整影响，游戏存档与显示配置分开。短屏电脑压缩围桌、六人场地和暂停提示，保留卡位、最新操作和恢复按钮。长期行为见 [显示规格](phase-02-platform-spec.md#电脑多分辨率显示150)，工程边界见 [显示控制](architecture.md#电脑显示控制)。

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

最终 [1.6.0 ZIP](../../artifacts/releases/TableMax-1.6.0-win-x64.zip) 为 156,161,422 字节，SHA-256：`2acfdda6c4ec1dc062cec9977a63b398e2eaf5ef0ad060450525d294ae9eb6bb`。动态规则和 bot 模块已纳入 ASAR 并实际运行；以下四份记录均对应同一最终 ZIP：

- [完整便携对局](../../artifacts/maintenance/v1.6.0/portable/results.json)：新目录解压、仅系统 PATH、六席含四个实际 Worker bot 完成三胜大局，69 次驱动动作、两次启动恢复、原班续局及重新开始，三种桌面尺寸结算可用。随机完整局到达 13 个阶段，另一币面的指定状态由开发完整局和能力视图补充覆盖。
- [便携聚会保障](../../artifacts/maintenance/v1.6.0/party-portable/results.json)：十组确认重试、弱网、回退暂停、刷新／重启、续局、重复启动、窗口生命周期及端口诊断检查。
- [便携六手机体验](../../artifacts/maintenance/v1.6.0/experience-portable/results.json)：四组按需加载、多人并发、手机房主权限与电脑单声源交接，恢复不补播。
- [便携显示专项](../../artifacts/maintenance/v1.6.0/display/portable/results.json)：同样通过 720p—4K、独立窗口缩放、暂停／恢复及 DPI 模拟，保留 44 张实际隐藏渲染截图。

维护的 [22 项清理测试](../../artifacts/maintenance/local-cleanup-tools/tool-tests.json) 和 [32 项统一维护测试](../../artifacts/maintenance/project-maintenance-tools/tool-tests.json) 全部通过，覆盖阈值、低水位、最旧优先、忙碌跳过、近期修改、链接、ZIP 哈希、证据及正式数据保护。全部验证与打包进程退出后执行 [实际维护检查](../../artifacts/maintenance/v1.6.0/maintenance.json)：自动解析同仓库主工作区 `E:\Proj\TableMax`，逻辑大小 3,049,074,100 字节（约 2.840 GiB），低于 5 GiB 阈值，删除 0 字节；跳过 1,330 个链接且不重复统计其他 checkout。未终止用户进程、放宽保护或扩大删除范围。

本轮实现已提交为 `542ccfd`（`feat: release 1.6.0 game library, mobile owners and reliable play`），未推送。[交付时文档核验](../../artifacts/maintenance/v1.6.0/document-links.json) 检查 40 份 Markdown、541 个本地链接和 138 个锚点，当前问题为零；61 处旧 artifact 路径在本 worktree 缺失，作为历史证据缺口单独记录。四份最终便携记录均与 ZIP 的实际哈希一致。

## v1.0.0：版本归一与开发效率优化

2026-10-03，按用户要求将最新版的应用与包版本由 1.6.0 重新编号为 v1.0.0，包含前节全部产品实现。协议 6、存档格式 1、游戏采用规则和策略版本沿用既有实现；历史验收日期、版本和证据保留原值。

开发效率规则补充工具结果摘要、批量独立检查、完成通知与有界等待、固定失败案例后再扩大验证，以及去重后的 token 统计口径。十个维护验证入口共用按应用版本生成证据目录的工具，避免新运行覆盖原 1.6.0 记录。手动清理支持显式退役版本，默认继续保护高于当前编号的未知版本；当前 ZIP、便携通过哈希、进程、路径、链接、近期修改和删除前复核保护继续执行。

- `pnpm package:win` 一次构建并导出最终 ZIP；[首次便携验证](../../artifacts/maintenance/v1.0.0/before-visual-polish/portable/results.json) 两次运行实际解压程序，确认应用版本 `1.0.0`、协议 6、六席真人／Worker bot 完整三胜大局、全部 14 阶段、回退、重启恢复及原班续局。记录 11 张实际隐藏渲染截图，外部请求和页面错误均为 0；设备模拟边界沿用前节。
- [清理工具隔离测试](../../artifacts/maintenance/v1.0.0/cleanup-tools/tool-tests.json) 29 项、[自动维护隔离测试](../../artifacts/maintenance/v1.0.0/maintenance-tools/tool-tests.json) 32 项通过；新增显式退役高编号标签、预览不删除、拒绝当前版本、拒绝自动退役及保留无关未来版本。脚本 ESLint、语法、证据目录、项目格式与当前交付链接检查通过；本轮未修改游戏源码，沿用前节游戏功能专项，不重复运行无关矩阵。
- 首次重标为 1.0.0 的 [Windows x64 便携 ZIP](../../artifacts/maintenance/v1.0.0/before-visual-polish/TableMax-1.0.0-win-x64.zip) 为 156,161,426 字节，SHA-256 `8356117f71b657f4901ba0a5e081ea98d9bd575587f154e7392b765eb05e7363`。源码、锁文件、文档及开发规则随本轮提交导出为 [当次源码 ZIP](../../artifacts/maintenance/v1.0.0/before-visual-polish/TableMax-1.0.0-source.zip)，不包含依赖、玩家存档、工具缓存或本地中间物。
- 空闲后执行已预览的手动清理：[历史版本记录](../../artifacts/maintenance/local-cleanup-20261002-162404-780-releases/cleanup.json) 删除旧 1.6.0 ZIP 及打包目录 2 项／704,520,503 字节；[中间物记录](../../artifacts/maintenance/local-cleanup-20261002-162435-967-intermediates/cleanup.json) 删除 56 项／4,501,388,803 字节。合计释放 5,205,909,306 字节（约 4.85 GiB）；默认 30 分钟保护保留 4 项近期内容，另保留 5 项未知临时资料。当前 ZIP、存档、素材、依赖、缓存与历史证据继续保留。

[收尾统一维护](../../artifacts/maintenance/v1.0.0/maintenance.json) 发现同仓库主工作区 `E:\Proj\TableMax`，逻辑大小 3,048,787,207 字节（约 2.839 GiB），低于 5 GiB，删除 0 字节；跳过 1,330 个链接，不重复统计 worktree。未终止用户进程或放宽清理保护。

## 1.0.0：同版本视觉优化（2026-10-03）

按用户要求继续优化，package 版本保持 1.0.0，协议／存档／规则版本保持。本次不推出新版本号；只有用户明确要求时才调整版本的约定写入 Agent 入口和维护规则。当前交互正文见 [游戏交互](../games/pokemon-encounters/interaction.md#160行动面板与声画反馈)。

角色名称在投影、操作记录、卡面、待处理牌和可访问文本中去掉“外观”。工具栏标题使用不透明浅底与深色文字。电脑行动面板限制最大宽度，空待处理区去掉斜纹／占位卡框／加号，有牌时才突出暂持。进度改为完成／当前状态线，不再使用按钮式填色或重复步数。合法可取牌使用沿边框移动的虚线，公共牌堆标明展示，弃牌查看按钮紧贴弃牌堆右下侧。喷火龙四边环绕火焰向外燃烧，保留牌名和私密提示可读；减少动态使用静态替代，公共投影不泄露查看位置。

- 工程检查：typecheck、ESLint、项目格式及 22 文件／127 项测试通过；测试阶段实际用时 21.66 秒。后续仅短屏 CSS 和验证脚本调整，ESLint／格式再次核验；未改变规则或保存流程。
- [完整游戏 UI](../../artifacts/maintenance/v1.0.0/ui/results.json) 15 场、[卡面布局](../../artifacts/maintenance/v1.0.0/cards/results.json) 13 种／16 类、[声画与操作区专项](../../artifacts/maintenance/v1.0.0/effects/results.json) 7 项通过。专项使用生产组件和授权投影视觉 fixture，验证四边火焰、连续币面、静态替代及真正运动的虚线边框，区别于自然整局。
- 返修发现 720p 暂停时页面超高；根据实际截图和面板几何修正顶部／底部留白及 CSS 优先级，并提供 [固定失败场景验证](../../artifacts/maintenance/v1.0.0/display/paused-720p/results.json)。最终 [便携显示矩阵](../../artifacts/maintenance/v1.0.0/display/portable/results.json) 通过 44 张实际隐藏截图，包含 720p—4K、两端六人全部 36 牌、暂停／恢复、44px 控件、100／125／150% 窗口缩放、重启及 DPI 模拟；失败的开发记录保留为诊断，不作为最终通过证据。
- [最终便携整局](../../artifacts/maintenance/v1.0.0/portable/results.json) 实际解压新包运行，完整六席三胜、全部 14 阶段、回退、两次启动恢复及原班续局通过。与显示矩阵对应同一最终 ZIP；设备范围仍为本机 Windows／隐藏 Electron／独立手机 Chromium 模拟。

当轮 [Windows x64 ZIP](../../artifacts/maintenance/v1.0.0/before-independent-review/TableMax-1.0.0-win-x64.zip) 为 156,161,961 字节，SHA-256 `caa042fc1af7ccab5dd8fdfdeb3bc91625854b5b1f30de2e98564277682d9729`。程序、源码及对应便携／显示证据现保留在 `artifacts/maintenance/v1.0.0/before-independent-review/`；当轮便携记录见该目录的 `portable/results.json`，显示记录见 `display/portable/results.json`，不将下一轮结果归到此哈希。首次同编号的程序、源码及便携证据仍保留在 `before-visual-polish/`。当轮 [源码 ZIP](../../artifacts/maintenance/v1.0.0/before-independent-review/TableMax-1.0.0-source.zip) 对应原提交，不包含依赖、玩家数据或本地证据。

[同版本收尾维护](../../artifacts/maintenance/v1.0.0/visual-polish-maintenance.json) 检查主工作区 `E:\Proj\TableMax`，逻辑大小 3,049,079,281 字节（约 2.840 GiB），低于 5 GiB，删除 0 字节；跳过 1,330 个链接，未终止用户进程或扩大清理范围。新增文档链接／锚点和 diff 检查通过，版本及锁文件没有改动。

## 1.0.0：独立视觉审查与返修（2026-10-03）

按用户要求逐个关键中间状态截图，以 `fork_turns: none` 新建 32 个单图审查实例，不提供开发上下文、旧缺陷、源码或其他截图。审查覆盖初始翻牌、取牌／弃牌来源、普通换入、梦幻两步、火箭队两面、闪电鸟本人及各接牌者、卡比兽、喷火龙选牌及私密查看、能力反馈、零分列、结果及共同赢家，并对重点修正另建新实例复审。提示词、32 条结论及采用理由见 [逐图审查记录](../../artifacts/maintenance/v1.0.0/visual-review/reviews.md)，复用方法见 [游戏验证场景](../games/pokemon-encounters/validation-scenarios.md#当前界面的独立视觉审查)。

修正手机竖屏确认栏遮挡第二排卡位、模糊选牌文案及喷火龙关闭入口；首翻进度明确座位，待行动与最近动作不再仅靠颜色区分；能力横幅、抛币及结果标题避开卡牌，胜利姓名避免重复叠加；短桌面2至5人收紧高度，火箭队实际落点补充号位标签。保持 1.0.0，规则、协议、存档、权限及保存流程未改变。

- 工程检查：类型、ESLint、项目格式及 22 文件／127 项测试通过，测试阶段实际 30.62 秒；后续标签／CSS及证据目录参数改动重新核验类型、静态检查及格式，未重复无关规则测试。
- [最终 UI 回归](../../artifacts/maintenance/v1.0.0/ui/independent-review-verified/results.json) 15 场通过，保留 335 张实际隐藏渲染截图，含每一步公共屏／当前手机、滚动后牌阵、能力结果及多尺寸；重复进度帧保留，不宣称335张均独立送审。[卡面矩阵](../../artifacts/maintenance/v1.0.0/cards/results.json) 13 种／16 类及 [最终效果专项](../../artifacts/maintenance/v1.0.0/effects/independent-review-verified/results.json) 7 项通过。专项仍为生产组件及授权投影 fixture，区别于真实服务对局。
- [实际 ZIP 整局](../../artifacts/maintenance/v1.0.0/before-language-pruning/portable/results.json) 完整六席三胜、全部14阶段、回退、两次启动恢复及原班续局通过；[实际 ZIP 显示矩阵](../../artifacts/maintenance/v1.0.0/before-language-pruning/display/portable/results.json) 44 张截图通过，覆盖720p—4K、两端36牌、暂停恢复、100／125／150%缩放及原生DPI模拟。两份记录均对应下面的新哈希，不复用旧包通过结论。

当轮 [Windows x64 ZIP](../../artifacts/maintenance/v1.0.0/before-language-pruning/TableMax-1.0.0-win-x64.zip) 为 156,162,408 字节，SHA-256 `d35c20eabf636a024dc0bec11d188690775c7b0d26a2e67853b67b167a3ef789`；[源码 ZIP](../../artifacts/maintenance/v1.0.0/before-language-pruning/TableMax-1.0.0-source.zip) 按最终提交导出。上一轮程序、源码和对应证据保留在 `before-independent-review/`，此前首份同编号包仍在 `before-visual-polish/`。范围仍为本机 Windows／隐藏 Electron／手机 Chromium 与DPI模拟，单帧审查不证明动效、规则正确性或真实手机／电视体验，没有新增现场听音结论。

收尾 [统一维护](../../artifacts/maintenance/v1.0.0/independent-review-maintenance.json) 在构建、验证及打包退出后检查主工作区，保持5 GiB触发、4 GiB低水位及原安全保护。版本文件与锁文件保持不变；相关文档与链接、diff检查后统一提交，默认不推送。

## 1.0.0：便携包语言精简（2026-10-03）

用户授权先精简语言包，沿用 1.0.0。`electron-builder.yml` 只保留 `zh-CN` 和 `en-US`；游戏代码、美术、声音和 Chromium 其他运行组件不变。多个游戏后的按需安装已列入 [未来计划](../tasks/README.md#多游戏按需安装未来计划未实现)，本轮没有实现下载或更换桌面运行时。

- [ZIP 内容与体积核验](../../artifacts/maintenance/v1.0.0/before-webview2/language-pruning/results.json)：删除 53 个语言文件，保留的 21 个文件逐项解压 SHA-256 与旧包一致，包括程序、app.asar 和其他运行组件。ZIP 从 156,162,408 字节降至 144,416,191 字节（148.9 → 137.7 MiB），减少 11.2 MiB／7.52%。
- [实际便携整局](../../artifacts/maintenance/v1.0.0/before-webview2/portable/results.json)：当轮 ZIP 独立解压、仅系统 PATH、隐藏 Electron 与独立服务，通过六席三胜、全部 14 阶段、回退、两次启动恢复及原班续局，页面错误和外部请求为空。设备范围仍为本机 Windows／手机 Chromium 模拟，不新增实机或听音结论。
- 打包配置 Prettier 与 diff 检查通过；Node 22.14.0、pnpm 10.12.1、Electron 44.5.1 沿用锁定环境。首次沙箱构建因子进程 `spawn EPERM` 失败，获准后完成真实打包；本轮仅打包配置与文档变化，未重复规则测试或显示矩阵，游戏与前端文件字节一致的证据见上。

当轮 [Windows x64 ZIP](../../artifacts/maintenance/v1.0.0/before-webview2/TableMax-1.0.0-win-x64.zip) SHA-256 为 `e070212ce21c94b5b1546ca09c954f85feab9afde83c3642b589e18f6cbface1`；源码包和对应证据已一并保留。上一轮 ZIP、源码、交付清单及对应整局／显示证据在 `artifacts/maintenance/v1.0.0/before-language-pruning/`，历史显示通过结论归属旧包，不标为新包重新执行。

## 1.0.0：原生桌面与小体积交付（2026-10-03）

按用户批准的计划，将桌面外壳替换为 net48／x64 WinForms＋共享 Evergreen WebView2＋包内官方 Node 22.14.0。版本保持 1.0.0，React、首版完整游戏、协议 6、存档格式与身份保持；不实施多游戏下载。采用理由见 [决策 008](../decisions/008-small-native-desktop.md)，运行时前提及体积计量见 [开发说明](development.md#便携包体积与共享运行时)。

当前已通过的集成关口：

- 工程 typecheck、ESLint、Prettier 和 23 文件／140 项测试通过；测试阶段实际 38.35 秒。原生最新构建 0 警告／0 错误，锁定 SDK 9.0.102、WebView2 SDK 1.0.4258.31。实际共享浏览器为 154.0.4258.48，服务为 Node 22.14.0／SQLite 3.47.2。
- [真实旧 SQLite 兼容](../../artifacts/maintenance/v1.0.0/webview2/server-migration.json)：隔离复制 Electron Node 24.21.0／SQLite 3.53.4 写出的六席对局，读取相同实例、座位身份与快照，修订 7→8 恢复、9 继续提交、10 再次启动；原文件哈希未变。没有迁移存档格式或删除旧数据。
- [原生安全与退出](../../artifacts/maintenance/v1.0.0/webview2/safety/results.json)：10 项真实关口通过，包含私有凭证、SPA 同文档授权／手机路径拒绝、子 frame／非法参数拒绝、重复启动、正常退出、服务崩溃、父进程崩溃及 Job Object 清理、生产 CDP 关闭和继承环境覆盖清除。缺运行时采用检测故障模拟，确认不启动服务且退出；本机已有运行时，未卸载系统依赖，安装／取消提示分支另经源码复核。
- [开发完整整局](../../artifacts/maintenance/v1.0.0/before-modern-art/development/results.json)：六席三胜、全部 14 阶段、回退、两次启动恢复及原班续局通过。[游戏 UI](../../artifacts/maintenance/v1.0.0/before-modern-art/ui/results.json) 15 场、[卡面](../../artifacts/maintenance/v1.0.0/cards/results.json) 13 布局／16 类、[声画 fixture](../../artifacts/maintenance/v1.0.0/effects/results.json) 7 项通过。fixture 不替代自然对局证明。
- [呈现与声音](../../artifacts/maintenance/v1.0.0/presentation/results.json)、[聚会保障](../../artifacts/maintenance/v1.0.0/party/results.json)、[并发与房主](../../artifacts/maintenance/v1.0.0/before-modern-art/experience/results.json) 通过，包含自然六手机小局、三档实际 Worker 节奏、保存动作声音／动画、手机静音、公共屏优先与关闭归还、事件去重、静音偏好、端口冲突细因、独立窗口与防休眠请求。

本轮验证仍在当前 Windows 11 x64 上完成。原生窗口位于屏幕外、不激活但实际合成渲染，测试 CDP 只监听临时回环端口；手机为隔离 Chromium profile 的触控／UA／网络模拟。外部网页请求被拒绝后的完整游戏证明离线资源链路，不声称实体电视、真实 Safari、另一台无开发环境电脑或现场听音实测。原包与对应证据保存在 `before-webview2/`，新包按实际哈希重新验收。

当轮交付已完成重新验收，程序、源码及将被后续验收更新的证据保留在 `before-modern-art/`：[Windows x64 ZIP](../../artifacts/maintenance/v1.0.0/before-modern-art/TableMax-1.0.0-win-x64.zip) 为 **35,442,208 字节**，实际解压全部 **61 个文件／90,979,966 字节**；两项均严格低于 100,000,000 字节，解压也低于 95,000,000 字节预算，AC-24 通过。ZIP SHA-256 为 `3f7ed86a0b79d3f951b5992dbed614c3d4003f9db9bb756ac2a940cc346eacdf`。[逐文件交付清单](../../artifacts/maintenance/v1.0.0/before-modern-art/TableMax-1.0.0-win-x64-manifest.json) 包含实际字节数、每文件 SHA-256、官方 Node 下载校验及锁定 SDK；实际解压逐项一致，没有 Electron、PDB、其他架构 DLL、引用程序集、SDK 文档或开发 marker。Node.exe 为 83,344,536 字节，与官方 Windows x64 ZIP 原件完全一致。

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

同版本 [Windows x64 ZIP](../../artifacts/maintenance/v1.0.0/before-v1.0.1/TableMax-1.0.0-win-x64.zip)为 **36,966,642 字节**，实际解压 **72 文件／92,579,416 字节**；两项严格低于 100,000,000 字节，解压也满足 95 MB 工程预算。SHA-256 为 `7edd0ec38b5710b27fec6590cb139690524f1a59c263631c25013fb7e2438f6b`；[逐文件清单](../../artifacts/maintenance/v1.0.0/before-v1.0.1/TableMax-1.0.0-win-x64-manifest.json)与真实解压逐项一致，便携运行仅系统 PATH。前一轮程序、源码、清单及被更新的验证目录保存在 `before-modern-art/`，历次记录保持其原哈希。源码及总交付清单按最终提交另行导出，用户已有 README 改动保持原字节且不混入提交。

范围仍为当前 Windows 11／共享 WebView2／原生后台合成和 Chromium 手机触控／尺寸模拟，不声称实体电视、真实手机或 Safari 实测。Windows DPI 与原生自动缩放被纳入实际几何记录；图片为真实更新后的帧。独立单图审查覆盖冻结的[公共屏](../../artifacts/maintenance/v1.0.0/modern-art/review/final-public.png)和[手机](../../artifacts/maintenance/v1.0.0/modern-art/review/final-phone.png)：手机未发现必须修复项；公共收藏末卡的边缘提示经[裁定](../../artifacts/maintenance/v1.0.0/modern-art/review/adjudication.json)保留为有总幅数与显式滚动条的横向收藏布局。静态[解耦及文档审查](../../artifacts/maintenance/v1.0.0/modern-art/review/static-review.json)另记录模块与链接证据。

返修集中在高风险恢复、绝悟估值、Windows 150% DPI 短窗口、游戏 CSS specificity／Portal 范围及盒子续局样式。验收脚本先修正公共窗口路由与自动缩放测量，再按实际“游戏切换返回大厅”行为启动下一游戏；等待动态客户端与公共屏首次渲染，避免导航时抢读上下文。最终源码稳定后仅生成一次最终包，脚本和记录修正沿用该同一 ZIP；没有因仅文档变化重复打包。

收尾发现统一维护在大量依赖目录中反复调用 PowerShell provider 计量过慢；仅中断本任务自行启动的维护进程并保留[首次记录](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-first-attempt.json)及[中断说明](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-interruption.json)。统计函数改为 .NET 流式遍历，每次删除后仍完整重测；[独立复核](../../artifacts/maintenance/v1.0.0/modern-art/review/cleanup-measure-review.json)发现的目录属性缓存边界经出栈刷新修正，删除范围和既有保护代码保持原字节。[29 项手动清理检查](../../artifacts/maintenance/v1.0.0/modern-art/cleanup-tool-tests.json)及[34 项统一维护检查](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-tool-tests.json)通过，新增隐藏／系统文件计量与保留用例。[真实仓库对比](../../artifacts/maintenance/v1.0.0/modern-art/cleanup-measure-comparison.json)的字节、文件、链接和嵌套仓库四字段完全相同：106,546 文件／19,968,400,712 字节／跳过 1,323 链接；Windows PowerShell 的统计耗时由 22.991 秒降至 3.885 秒（后者含首次编译）。这次仅工具和记录变化，未重复游戏构建或无关测试。

[续跑维护](../../artifacts/maintenance/v1.0.0/modern-art/maintenance.json)按重新核验的 30 分钟边界处理全部 55 个合格候选，删除 10,372,585,307 字节（约 9.66 GiB）；合格候选耗尽，工作区仍约 8.94 GiB，超过 5 GiB 的剩余受保护内容仅报告。当前 ZIP 哈希未变，正式存档、原始美术、历史证据、依赖与工具缓存保持，未扩大范围或终止其他进程；[维护摘要](../../artifacts/maintenance/v1.0.0/modern-art/maintenance-summary.json)同时保留首次测量和中断接续说明。
