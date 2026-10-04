# 首版交付与验收

各任务已验收的便携包及验证范围见下文固定副本；线上已发布包见 [v1.0.1 GitHub Release](../archive/acceptance-2026-10-01-to-04.md#101github-release2026-10-03)。本页保留当前交付验证与近期本地维护；较早完整对局、AC 对照、哈希和证据集中在 [历史验收](../archive/acceptance-2026-10-01-to-04.md)。

## 1.0.2：现代艺术优化## 1.0.2：宝可梦声画与手机优化（2026-10-05）

完成关键保存事件短全屏、普通动作局部轨迹与精灵主题点缀、手机四列顶栏及右侧固定取消列、八个用户 WAV 的映射和双槽声音调度。取消仅清除本地选牌；喷火龙公共演出不泄漏私看位置。手机静音，测试模式关闭装饰声画，减少动态、暂停／断线／回退／恢复及播放权交接沿用权限和清理边界。协议、规则、存档及版本号不变，行为和来源见 [交互](../games/pokemon-encounters/interaction.md)及 [资源](../games/pokemon-encounters/assets.md)。火箭队透明三人新图未完成：一次内置生成被 `moderation_blocked / other` 拒绝，官方替代检索未找到完整匹配；旧图保留，缺口见 [任务索引](../tasks/README.md#宝可梦火箭队配图缺口)。

本任务保存的 [共享运行 ZIP 固定副本](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-delivery/TableMax-1.0.2-win-x64.zip)为 **40,499,662 字节**，实际解压 **145 文件／95,581,336 字节**，配套 [清单](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-delivery/TableMax-1.0.2-win-x64-manifest.json)；SHA-256：`d8882770c1ab2aa4bcfcc43355cc2b374a487edeec4f29f289208f7e69e48d0d`。超过 95 MB 工程预算 **581,336 字节**，ZIP 与实际解压均严格小于 100,000,000 字节。共享 releases 会被其他任务继续更新，固定副本用于绑定本次结果，不覆盖其他任务新包；其中八个用户音源均匹配本次来源哈希。该包包含当时共享源码的其他改动，本节只认证宝可梦及下述跨窗口检查，不替代其他游戏的独立验收。

同一 `d888…` ZIP 的 [真实整局验收](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-runtime/pokemon-polish-shared-final/results.json)通过：六席混合对局、手机本地选择／取消、全部五种能力阶段、两种币面、结果、回退、两次启动恢复与服务退出，零外站请求、零页面错误。[声音交接验收](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/shared-runtime/experience-portable/results.json)通过 4 组：真实公共屏优先、管理员接替、跨窗口事件去重、六独立手机与房主权限。均为隐藏 WebView2 和 Chromium 视口模拟、回环网络；不声明实体手机、Safari、硬件 DPI、局域网或真人听感通过。

为不混入其他聊天正在开发的源码，本次另外构建一次 HEAD `e20a89a` 加本任务改动的 [独立运行 ZIP](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated-delivery/TableMax-1.0.2-win-x64.zip)：**40,789,996 字节／解压 142 文件、95,808,982 字节**，超过工程预算 **808,982 字节**，双硬门禁通过，SHA-256 `eb983992f2c7084c2a8af4583073b2c5a6dd7d44f86fc5972ab52f3b6771f7df`。[独立整局](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated/portable/pokemon-polish-final-03/results.json)及 [交接](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated/experience-portable/results.json)均通过；独立构建的类型、Lint、格式与 [41 文件／297 项测试](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/isolated-tests.log)通过（130.74 秒）。原共享工作区和现代艺术／桌面／电力公司改动保持原样。

[真实 PokemonScreen 手机专项](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/layout/isolated-layout-final/report.json)通过 **48 个顶栏场景、36 个选位栏布局、38 个合法规则命令**，覆盖 320／360／390／430px、短屏／横屏、长昵称、连接／断线、全屏可用／不可用、普通玩家菜单及测试模式。共享源码的首次横屏失败与修正结果分别保留。[特效专项](../../artifacts/maintenance/v1.0.2/effects/pokemon-polish-fixed-20261005/results.json)通过 **9 组**，包括真实动画启动、共同赢家、连续相同币面、减少动态和喷火龙私看投影；首次轨迹端点受暂持牌动画移动影响的失败记录保留。[音效专项](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/audio/development-01/results.json)通过 **3 组**：八 WAV 解码、六类别取牌映射、双槽并行、1200ms 币面同步及清理／不补播，两段原 WAV 哈希一致。其播放权限由 fixture 提供，真实交接仅以上述便携结果认证。

整局脚本首次被过时的“牌桌管理”按钮名阻断，第二次误用游戏内“菜单”定位大厅；确认实际大厅“管理设置”后仅修订测试驱动，取消定位更新为完整可访问名称，增加独立 `--evidence` 目录。失败与成功输出均保留，不因此重建 ZIP。两段用户要求不处理的音频保留原字节；六段精灵声的处理参数、原件和核验详见资源表，合成再生成会保留用户素材记录。

本任务验证进程已退出，独立工作区已归档并保存源码快照，正式 ZIP／清单及证据已复制回主工作区。[releases 清理预览](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/releases-preview.log)发现三个打包目录候选；收尾只读检查先后发现其他工程运行窗口，因此延期 Apply，不结束其他任务进程。后置 [全库维护预览](../../artifacts/maintenance/v1.0.2/pokemon-polish-20261005/maintenance-preview.log)计量为 **40,346,391,653 逻辑字节／37.576 GiB**，因共享当前 ZIP 再次更新后缺少匹配哈希的便携通过记录而被工具门禁阻止，零删除，不为达到 4 GiB 扩大清理范围。原始素材、原图、历史证据和其他任务当前包保持原位。

（2026-10-05）

沿用 **1.0.2** 更新行情历史／本轮价值拆分、五画家总量徽章、Daniel 梅紫识别、辅助提示轮播、紧凑收藏与手机摘要、图形座号、五类拍卖主题、合法双拍呼吸虚线，以及不显示秒数的提醒进度条。规则帮助使用九张原创逻辑场景和代码排版的准确规则；原图和旧截图保留。原生窗口全屏控制与网页状态同步属于本次共同修改，游戏协议、存档和采用规则版本保持不变。

最终 [运行 ZIP](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/final-release/TableMax-1.0.2-win-x64.zip)为 **39,928,133 字节**，实际解压 **143 文件／94,852,920 字节**，95 MB 工程预算余 **147,080 字节**，双 100 MB 硬门禁通过；SHA-256：`29c09c1de2db60d6cd33d627b56122dd13c5092719a02c6c8e1fa762371886d2`。[包记录](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/package-final.json)及 [逐文件清单](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/final-release/TableMax-1.0.2-win-x64-manifest.json)对应同一包。其他聊天正在修改宝可梦／电力公司，当前交付使用 [隔离构建快照](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/build-snapshot.json)：HEAD 基线加本次现代艺术及原生全屏源码，保留其他聊天工作但不混入本包。[隔离构建](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/build-isolated.log)与 [打包日志](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/package-isolated.log)保留实际执行记录。

同一 `29c09…` ZIP 的 [规则验收](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/rules/portable-final-02/results.json)通过 **9 项／9 张截图／33.66 秒**：九图本地解码、三端及九组尺寸／密度、章节定位、焦点恢复和保存状态不变。[到时声音验收](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio/portable-timer-final-02/results.json)通过 **9 项／41.06 秒**：17 个 WAV 原生解码、一次提醒、暂停、静音消耗、重复零采样／刷新不补播及到时后仍可合法竞价。实际 WebView2 播放事件不等于真人听感或实体手机扬声器验证。九图 **288,028 字节**加提醒音 **16,364 字节**共 **304,392 字节**，满足 370 KB 生产资源预算；提示词、原图与哈希见 [素材证据](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/imagegen/evidence.json)及游戏资源清单。

同一 `29c09…` ZIP 的 [结算／终局 UI 矩阵](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/ui-v2/portable-lifecycle-final-02/results.json)通过 **96 布局／96 截图／2,102 断言／204.23 秒**，覆盖三／四／五人、720p 至 4K、125%／150% 密度和短手机，包含底部冠军及现金可达性；逐一核对全部 143 个解压文件。[全屏包完整性](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/fullscreen-portable-integrity-final-02/results.json)将同哈希 ZIP 与实际运行的解压目录绑定；该目录的 [隐藏原生全屏](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/fullscreen-portable-final-02/results.json)通过 **5 项**，以及 [普通窗口前台全屏](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/fullscreen-portable-foreground-final-02/results.json)通过 **4 项**，核对网页按钮、F11、菜单同步、Escape 浮窗优先、原窗口尺寸与最大化恢复、两窗口独立状态。尺寸与密度模拟不等于实体手机、硬件 DPI 或多显示器验收；本轮网络为回环地址，未修改防火墙。

同一 `29c09…` ZIP 的 [五人完整对局及恢复验收](../../artifacts/maintenance/v1.0.2/modern-art-audit-20261004/runtime/modern-polish-final-04/results.json)通过 **143 个合法动作／四轮／81 张截图／230.97 秒**：冠军首屏及再玩、并发暗标保密、公开旧价拒绝、独立手机身份断网、回退／SQLite 重启、房主授权与两游戏切换后五身份保留、主题 CSS 隔离；测试桌面已关闭，服务不再可达。[最终原生桥接安全检查](../../artifacts/maintenance/v1.0.2/webview2/safety-portable-final-02/results.json)通过 **10 项**，绑定同一最终包哈希。

[隔离类型检查](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/typecheck-isolated.log)、[Lint](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/lint-isolated.log)及 [6 项相关测试](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/tests-isolated-focused.log)通过；此前 [42 文件／285 项测试](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/tests-source.log)通过（87.07 秒），保留当时源码验证范围。[source-06 失败结果](../../artifacts/maintenance/v1.0.2/modern-art-audit-20261004/runtime/modern-polish-source-06/results.json)继续保留：四轮流程完成后两条本地 WAV 的导航／停止取消被测试器记为 `net::ERR_ABORTED`，不将其整体记为通过。随后仅修订测试器对同源已知 WAV 的明确停止／导航取消分类，生产播放实现未因此修改；上述 `final-04` 重新验收通过，该次未发生 WAV 取消。

旧 `04e28ddfc9f047b2e5e44dcc6a16d420ce5bc9bd7ab19744e504c93879a20d02` 包的 [完整 UI 矩阵](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/ui-v2/portable-final/results.json)通过 **411 布局／423 截图／12,353 断言／583.08 秒**；该包的 [规则](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/rules/portable-final/results.json)与 [声音](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/audio/portable-timer-final/results.json)结果保持历史归属，不作为最终 `29c09…` 包全矩阵通过结论。

本次测试进程全部退出后，[releases 清理预览](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/releases-preview-final.log)核对保留当前 ZIP／清单，发现两个旧打包目录候选共 **459,560,533 字节**。其他聊天的宝可梦隔离验证仍运行 `TableMax.exe`（PID 13200），触发工具全局进程保护，故延期 Apply，零删除，不结束其他聊天进程。收尾维护仅执行 [只读预览](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/maintenance-preview-final.log)，不将 releases 记为已经只剩两个文件，也不为达到容量目标扩大清理范围；功能与本次提交不因跨聊天清理延期而改记未验收。

共享 `artifacts/releases/` 随后被其他聊天更新；本节的固定 ZIP／清单副本逐字节匹配已验收 `29c09…` 包，不将后续共享目录中的新包自动视为本节验证产物。

## 1.0.2：盒子 debug（2026-10-04）

按用户批准计划完成座位移除与人机改名、外层生命周期操作、原子结束并切换、上传裁剪头像、状态徽章、图标与两种设置界面、游戏特异人机说明。管理员及手机房主的权限边界、结束后移除生成准备大厅、头像同事务保存和宝可梦无计时分别更新在 [平台规格](phase-02-platform-spec.md)、[工程结构](architecture.md)及 [人机规格](bot-players.md)。版本沿用 **1.0.2**，不推送。

最终 [运行 ZIP](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/previous-release/TableMax-1.0.2-win-x64.zip)为 **40,030,975 字节**，实际解压 **137 文件／94,928,396 字节**，95 MB 工程预算余 **71,604 字节**，双 100 MB 硬门禁通过。SHA-256：`467e841f18717c11176aa23ae940b21ccf44f46a190c7fe1eec44d124b7ab35c`。只生成一次最终 ZIP，实际解压逐文件大小与哈希匹配 [清单](../../artifacts/maintenance/v1.0.2/modern-art-polish-20261005/previous-release/TableMax-1.0.2-win-x64-manifest.json)；上一 `e665…` 包和清单保留在 `artifacts/maintenance/v1.0.2/box-debug-20261004/previous-release/`，原有历史结论仍归属原包。

最终 [40 文件／279 项测试](../../artifacts/maintenance/v1.0.2/box-debug-20261004/tests-final.log)通过（90.95 秒），覆盖权限／撤权／迟到动作、结束移除恢复、加载与保存失败、跨实例丢确认重试、规范 PNG／CRC／尺寸与伪装输入、实际 SQLite 图片／身份／journal 回滚、重复图片、重启和入座重试。类型、Lint、格式及构建通过，日志位于同一证据目录。首轮旧宝可梦计时断言失败已按新要求修订；早期界面驱动错误和 720p 间距失败保留原结果，成功复测不覆盖失败记录。

[盒子开发验收](../../artifacts/maintenance/v1.0.2/box-debug-20261004/development-06/results.json)通过（18.23 秒）：实际隐藏 WebView2 核验上传预览／取消／拖动／缩放、房主改名／移除、结束后新大厅、进行中提示和原子切换、三款实际牌桌头像、320／360／390px 手机、720p 至 4K 和 125%／150% 设置界面。完整 [显示矩阵](../../artifacts/maintenance/v1.0.2/box-debug-20261004/display/development-02/results.json)通过，六真人牌桌、四分辨率、两窗口独立保存及重启、原生桥接与密度模拟共 44 张截图。模拟密度与手机窗口不代表实体手机或物理多显示器验收；本次网络均为回环地址，未修改防火墙。

同一 `467e…` ZIP 的 [盒子便携验收](../../artifacts/maintenance/v1.0.2/box-debug-20261004/portable-final/results.json)通过（24.33 秒），使用系统 PATH、包内 Node 和实际解压资源；[完整便携显示矩阵](../../artifacts/maintenance/v1.0.2/box-debug-20261004/display/portable-final/results.json)通过，含实际桌面重启、六真人牌桌及 44 张截图。两项结果均记录最终包 SHA-256，关闭后各自退出测试桌面与服务。修改文档的 [本地链接](../../artifacts/maintenance/v1.0.2/box-debug-20261004/doc-links.json)存在性检查通过。

releases 清理已预览唯一打包中间目录 **229,911,685 字节**。首次自动审批因发现运行中解压版程序而拒绝；[只读路径审计](../../artifacts/maintenance/v1.0.2/box-debug-20261004/cleanup-process-audit.json)证明该程序在 D 盘、工程与候选目录无进程后允许重试，但 [清理脚本自身保护](../../artifacts/maintenance/v1.0.2/box-debug-20261004/releases-apply.log)仍因用户运行中的 TableMax 拒绝，零删除。等待用户关闭程序或明确暂缓，未绕过保护；当前 ZIP、清单与历史程序继续保留。

[收尾维护](../../artifacts/maintenance/v1.0.2/box-debug-20261004/maintenance.log)同样返回 `blocked`／零删除；只读预览为 **0 安全候选、13,900,833,475 字节（12.946 GiB 逻辑字节）**。不为达到 4 GiB 扩大范围。功能交付完成，程序运行期间的清理单独待处理。

## 1.0.2：本地重新导出与 releases 清理（2026-10-04）

按用户要求沿用 **1.0.2** 重新导出当前本地 Windows 包，本次不改游戏实现。日常本地导出只提供程序 ZIP 和逐文件清单，源码 ZIP 仅在用户明确要求发布 GitHub 时导出；本轮未生成或向 releases 复制源码 ZIP。

当时 [Windows ZIP](../../artifacts/maintenance/v1.0.2/box-debug-20261004/previous-release/TableMax-1.0.2-win-x64.zip)为 **40,023,501 字节**，实际解压 **136 文件／94,899,866 字节**，95 MB 工程预算余 **100,134 字节**，双 100 MB 硬门禁通过。SHA-256：`e6656e8d08b9fc1afa2242400844175e793637081635fe45bd41ce368d6b6fe6`；[逐文件清单](../../artifacts/maintenance/v1.0.2/box-debug-20261004/previous-release/TableMax-1.0.2-win-x64-manifest.json)与该包配套。最终 [打包记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-run.json)为 **16.488 秒／exit 0**。首次外层 PowerShell 日志包装器触发 `NativeCommandError`，未写完成记录，[失败日志](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-wrapper-failed.log)及 [记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-wrapper-failed.json)保留；修正外层记录后成功，不将其归为产品构建错误。

[包对比](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/package-audit.json)核对上一 `7801…` 包：135 文件大小与 SHA-256 相同，无新增或删项；只有重新构建的 `TableMax.exe` 哈希不同，大小仍为 **183,808 字节**。该比较确定变化文件，尚未逐字节定位 EXE 内部差异，不能据此断言只变了 Git 编译标记。旧程序与清单保留在 `reexport-20261004/before/`，完整电力公司验收见 [历史记录](../archive/acceptance-2026-10-01-to-04.md#102电力公司-debug横向地图价区与声画2026-10-04)。

新哈希的 [便携启动检查](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/portable-startup/results.json)通过，**12.217 秒**：全部 136 解压文件匹配清单，仅系统 PATH 下使用包内 Node，隐藏真实 WebView2 渲染与 `127.0.0.1` 回环服务返回 200；关闭后服务不可达，记录 `closed: true`。这是本次包内容与启动验证；旧完整对局、媒体和规则结果仍归属历史 `7801…` 包，没有机械重跑完整游戏矩阵，也不将旧通过结论改记为新包通过。

`KeepLatestOnly` 工具 [最终检查](../../artifacts/maintenance/v1.0.2/reexport-20261004/tools/completion.json)通过 **194 项／45.21 秒**手动测试与 **34 项／15.34 秒**自动维护测试，独立只读审查通过。此模式仅处理 `artifacts/releases` 直属项，核对当前便携通过记录与配套清单后保留当前程序 ZIP／清单，沿用全部路径、链接、嵌套仓库、进程、近期、指纹和互斥保护；其他手动模式及自动维护不混用。

首次清理预览因实际启动证明的原文件名不是 `results.json` 而被门禁拒绝，未发生删除，[拒绝记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/cleanup-preview-first.json)保留。随后将该通过结果逐字节一致地保存为上述规范入口，在打包／验证进程全部退出后，以相同 `-KeepLatestOnly -MinimumAgeMinutes 0` 先预览、再 Apply，路径与内容检查仍全部执行。[实际清理](../../artifacts/maintenance/local-cleanup-20261004-141732-483-releases/cleanup.json)通过，**15.957 秒／554,455,887 字节**，耗时见 [执行记录](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/cleanup-run.json)：删除两个本次打包目录各 **229,846,976 字节**，及旧同版解压目录 **94,761,935 字节**。`releases` 恰保留新 ZIP **40,023,501 字节**与配套清单 **23,743 字节**，两文件在删除前后均核对路径、大小、时间与 SHA-256；其他历史证据、素材与正式存档保持原位。

本轮启动检查自建的隔离副本另按精确名单预览后 [回收](../../artifacts/maintenance/local-cleanup-20261004-141851-055-intermediates/cleanup.json) **107,657,726 字节**，未纳入既有 `tmp/` 内容。后置全项目 `Maintain-Project.ps1 -Apply` 因最新用户限定 releases 而被自动审批拒绝，未执行；改为 [只读收尾检查](../../artifacts/maintenance/v1.0.2/reexport-20261004/root/maintenance-run.json)，结果为 **0 安全候选／零删除**，工作区 **15,109,256,634 字节（14.072 GiB 逻辑字节）**，未为达到 4 GiB 扩大范围。

## 历史截图去重（2026-10-04）

用户进一步授权适当清理 `artifacts/` 历史内容，包括不再需要的验收截图。本次只处理旧 v1.0.0／v1.0.1 中与保留 PNG 大小和 SHA-256 完全一致的副本；独有截图、正文直接引用图、素材来源、JSON／日志、原存档及历史程序包继续保留。旧结果中引用的退役 PNG 不再占第二份空间，其同字节保留位置可从 [逐文件清单](../../artifacts/maintenance/v1.0.2/history-tidy-20261004/duplicate-screenshots.json)查询；原验收结论不因本次清理改写。

新增手动清单模式在实际操作前通过 18 项专用保护检查及既有 **194 项手动／34 项自动维护回归**，不扩大默认或自动清理范围；收尾补充父级嵌套仓库保护并复测，专用检查最终为 [19 项](../../artifacts/maintenance/v1.0.2/history-tidy-20261004/tests/results.json)。相同参数先预览、后 Apply，保持默认 30 分钟近期保护；[实际清理报告](../../artifacts/maintenance/local-cleanup-20261004-144015-137-intermediates/cleanup.json)为 **137 组／3,230 文件／2,480,203,343 字节（2.31 GiB）**，零跳过，执行 **199.07 秒**。操作仅删除显式 PNG，不递归删除父目录，记录每张副本的原路径、哈希与保留位置。

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
