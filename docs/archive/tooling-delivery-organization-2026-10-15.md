# 工具与交付文档整理归档（2026-10-15）

本页记录当时的原字节与结论；旧本地交付于2026-10-16经用户授权退役，原下载链接改指[逐文件退役清单](local-release-retirement-2026-10-16.md#逐文件退役清单)。原SHA、验收报告和失败结论保留。

本页保全从长期正文迁出的历史原文、失败、旧操作与原SHA，不作为当前命令或交付状态。当前交付统一见[验收](../reference/acceptance.md#当前源码与本地交付)，现行方法从[文档索引](../README.md)进入。摘录中的“当前”“本轮”只指原时点。

## 总索引原产品与交付摘要

来源：[docs/README.md](../README.md)；整理前原文件SHA-256 `8f5f8076dd1e10848b0111cb1201b1b0b98ec6d0df0ac00d445254193daa0f2f`。

当前公开版本为 **v1.0.6**，本地已验证并推广的完整安装器为 **1.0.6.18**。Windows 仅交付预装全部正式游戏及玩法的完整 EXE；取消盒子版、独立游戏下载、离线导入与独立游戏更新。当前游戏库来自本 EXE 验证后的预装映射，旧安装索引或缓存目录不能改变新局使用的发行。旧存档按原发行精确恢复，非当前发行只用于继续原局。实现与设备验证边界见[当前验收](../reference/acceptance.md#当前源码与本地交付)。

公开版本使用三位 `1.x.x`，本地构建使用四位 `1.x.x.y`；兼容校验依据协议与能力声明。内部模块载荷、冻结快照、签名和逐文件清单继续保留。本轮尚未发布，线上 v1.0.6 与 Pages 内容保持原发布状态；新交付流程见[Release流程](../reference/release.md#唯一完整-exe-交付2026-10-12)，版本规则见[版本与构建](../reference/release.md#三位公开版本与四位本地构建2026-10-12)。

经典 [阿瓦隆](../games/avalon/README.md)采用2012原版、平台5–10人，新局使用用户指定的唯一人数角色表，支持莫德雷德／奥伯伦知识边界、三档本地策略及并发密投；旧配置仅恢复原局。规则来源、秘密投影和实际交付边界分别进入游戏主题及 [验收](../reference/acceptance.md)；本次直接视觉要求见 [用户偏好](../reference/art-preferences.md#阿瓦隆最新要求2026-10-10)。

完整程序预装宝可梦奇遇、现代艺术、经典德国版电力公司、UNO、阿瓦隆与经典2–4人拉密；宝可梦包含原版与九宫格扩展。真人通过手机或电脑浏览器操作，电脑主机负责服务、管理与公共展示。电脑浏览器玩家首次保持居中竖屏，可切换并记住横屏选择，见[玩家显示与滚动条](../reference/visual-design.md#电脑浏览器玩家的手机区域2026-10-08)。加入支持扫码和二维码下“打开网址”，使用根网址并兼容旧玩家路由；实现概况与游玩流程见[项目说明](../../README.md)。

## 2026-10-11历史发布：

来源：[docs/tasks/README.md](../tasks/README.md)；整理前原文件SHA-256 `e58d4099173f09716fe0a28d8fb5c8567f28bc639a27357251cb73d3223da61f`。

2026-10-11历史发布：经用户明确授权，GitHub Pages已部署、v1.0.6已正式重新发布；35个公开文件及Release三附件的线上大小／哈希核验通过，见[历史分发记录](../reference/release.md#最新分发决定与暂缓发布2026-10-11)。该记录保留当时源码、安装体系与附件边界，不能代替现行完整EXE或真实设备验收。

## 经典2012 [阿瓦隆]

来源：[docs/tasks/README.md](../tasks/README.md)；整理前原文件SHA-256 `e58d4099173f09716fe0a28d8fb5c8567f28bc639a27357251cb73d3223da61f`。

经典2012 [阿瓦隆](../games/avalon/README.md)已接入平台5–10人，提供秘密表决／任务、刺杀、三档策略及复古桌游声画。现行源码已调整为唯一人数配置、测试密投立即计算和实战并发密投；旧配置只恢复原局。最新交付与未完成验收以[当前验收](../reference/acceptance.md)为准，实际服务、原生操作、历史包及原失败见[验证记录](../games/avalon/validation-scenarios.md)，版本沿用1.0.6。

## [经典 UNO 完整制作]

来源：[docs/tasks/README.md](../tasks/README.md)；整理前原文件SHA-256 `e58d4099173f09716fe0a28d8fb5c8567f28bc639a27357251cb73d3223da61f`。

[经典 UNO 完整制作](uno-2026-10-10.md)已完成：规则／人机、三端桌游美术、离线声画和适用本地交付验证已闭合；当前规格见[游戏主题](../games/uno/README.md)，当前 EXE、内部载荷及设备边界见[验收](../reference/acceptance.md)，历史运行 ZIP 保持原验收范围。

## 拉密经典2–4人接入

来源：[docs/tasks/README.md](../tasks/README.md)；整理前原文件SHA-256 `e58d4099173f09716fe0a28d8fb5c8567f28bc639a27357251cb73d3223da61f`。

拉密经典2–4人接入及本地牌架整理、稳定操作与入口恢复已完成；v1.0.6同包证据和未测设备边界见[当前验收](../reference/acceptance.md#106拉密交互完善与恢复开放2026-10-11)，历史实施见[构建归档](rummikub-2026-10-09.md)，规则与来源见[游戏主题](../games/rummikub/README.md)。

## 2026-10-12新设计已接入

来源：[docs/tasks/README.md](../tasks/README.md)；整理前原文件SHA-256 `e58d4099173f09716fe0a28d8fb5c8567f28bc639a27357251cb73d3223da61f`。

2026-10-12新设计已接入 `events-research-v3` 源码：统一144张、17研究、单格超梦、六类随机事件、天气有效值与戏法空间，并调整横屏按钮、路卡利欧演出及公共缓冲展示。原版差分、事件服务8项、最小人机16项、三档2–6人完整三胜矩阵及六席真实Worker混合大局已通过；1.0.6.10完整EXE、适用端侧矩阵与独立视觉检查通过，剩余事项见[素材、玩法与真人验收任务](../tasks/pokemon-encounters-expansion.md)。未来仅接续7项研究插图、Mega／羁绊独立效果设计，以及实体设备、现场网络、听感、物理DPI与真人时长／平衡；资源接入与占位见[运行素材](../games/pokemon-encounters/assets.md#新设计运行素材与占位2026-10-12)，历史完成记录保持原验收边界。

## 任务索引中的火箭队生成拒绝

来源：[docs/tasks/README.md](../tasks/README.md)；整理前原文件SHA-256 `e58d4099173f09716fe0a28d8fb5c8567f28bc639a27357251cb73d3223da61f`。

2026-10-05 用户要求把火箭队换成经典武藏／小次郎／喵喵三人组、透明竖构图并用于卡面和短能力入场。内置 imagegen 一次参考生成在输出阶段返回 `moderation_blocked / other`，未生成或导入，当前保留旧官方四人横图。实际提示词、拒绝响应和原图哈希见 `artifacts/maintenance/v1.0.2/pokemon-polish-20261005/imagegen/rocket/`，状态在 [资源记录](../games/pokemon-encounters/assets.md#权限动画和声音)。不改写提示绕过拒绝、不把未产出的 v2 接入 UI；后续可使用用户提供或明确授权且可核验的替代素材。其他本轮声画与手机改动的实际验证见 [验收](../reference/acceptance.md)。

## 目录职责中的旧分发目录

来源：[docs/reference/project-structure.md](../reference/project-structure.md)；整理前原文件SHA-256 `3e7d2b42714199c1eb252065a3fab3f5b0a14a875a0e74d1d2342c3edce5ed57`。

2026-10-11曾以 `artifacts/game-packages/`和 `artifacts/author-toolkit/`导出安装包／作者工具，并双EXE交付。上述公开导出已退役；历史原包、目录和证据按原版本保留或审计退役。`tools/author/`的SDK／模板／源码验证能力保留，导出入口明确拒绝执行；私钥只留受保护本地 `secrets/`，不进Git或程序。

## 第一至六阶段已完成；

来源：[docs/reference/architecture.md](../reference/architecture.md)；整理前原文件SHA-256 `add32eb919d01134a6859c45a07f7dead51367aa33e90aece44ce5a6beb9b4d4`。

第一至六阶段已完成；正式游戏包括宝可梦奇遇、现代艺术、电力公司、拉密、UNO与阿瓦隆，验证模板继续用于契约、策略替换和恢复回归。采用依据：[工程基础](../decisions/001-engineering-foundation.md)、[平台授权与恢复](../decisions/005-platform-authority-and-recovery.md)、[游戏目录与房主分权](../decisions/007-library-owner-and-concurrency.md)、[小体积原生桌面](../decisions/008-small-native-desktop.md)。2026-10-03 桌面外壳改为共享 WebView2，最终交付验证状态仍以[验收记录](../reference/acceptance.md)为准。

## 深路径WebView2启动调查

来源：[docs/reference/build-and-run.md](../reference/build-and-run.md)；整理前原文件SHA-256 `30c9d0f56dc7e0fa0f873a65cb6190e5d598cf444a170a7ec85284dbfd4c0d25`。

已测两次I198／默认D在服务与WebView2环境ready后发生controller COM超时，而同I／同PE、短外D的启动专项通过。这只缩小了排查范围，尚不能据此认定UDF长度是唯一原因，也不构成任意深I／D均可用的承诺。完整三链及正式交付证明统一见[安装归档](windows-installation-update-2026-10-15.md)与[验收](../reference/acceptance.md#当前源码与本地交付)，历史局部结果保持其原范围。

## v1.0.3 便携存储与启动迁移（2026-10-06）

来源：[docs/reference/build-and-run.md](../reference/build-and-run.md)；整理前原文件SHA-256 `30c9d0f56dc7e0fa0f873a65cb6190e5d598cf444a170a7ec85284dbfd4c0d25`。

用户明确指定v1.0.3。按同日最新微调，单EXE首次启动在旁边新建 `TableMax/` 专属目录，并在其中创建 `TableMax.config.json`；ZIP解压版直接在解压目录创建配置，内容为 `{"dataDirectory":"."}`；相对路径以配置所在目录解析，绝对路径原样使用。主机 Alt → 程序 → 存储设置提供目录选择，原子写入配置并于重启后生效；不自动搬移或覆盖旧数据。存档、日志、显示设置、WebView2缓存均跟随所选数据目录。单文件EXE在 `TableMax/app` 解压运行资源，并向内部桌面传递 `TableMax/` 专属目录；直接运行ZIP内EXE以该EXE目录为默认。不可写／无效配置报错，不能回退C盘。显式 `TABLEMAX_DATA_DIR` 继续服务于已有隔离验证。

旧存档启动迁移通过私有stdout同步发送固定 `startup-progress/save-migration`，导入、逐修订深比较和文件哈希计算推进时报告，最多每秒一次；不包含存档内容、身份或凭证。普通启动仍20秒；收到迁移进度后允许120秒无进展，总计最多30分钟，不以定时器假进度延长等待。完整v1备份、校验与恢复事务保持。新验证 `node tools/test/desktop/verify-portable-storage.mjs` 对同一最终EXE检查默认目录、配置变更重启、旧存档字节保留、缓存及单文件解压；可加 `--source=<空WAL的闲置旧数据目录>`，只复制至隔离目录并核验真实大存档迁移和重启。报告默认在当前版本 `portable-storage/results.json`；`--evidence=<独立名称>` 可保留同版本不同初始化验收，不导出秘密状态。真实用户原数据不参与写入。验证输出 `tmp/portable-storage-<六位随机后缀>` 纳入已知隔离副本清理入口；通过证据和原用户存档仍保留。

## 早期预算超限与定向压缩

来源：[docs/reference/validation.md](../reference/validation.md)；整理前原文件SHA-256 `f951378a931e42c8895c1f72efc45d0aba584754cc474757b866890f38fce113`。

2026-10-08研究重设计的第一包实际解压95,035,481字节，超过当时95MB工程预算35,481字节，未作交付验收。只压缩宝可梦人机144,410字节为715字节入口＋28,397字节载荷，净省115,298字节；该轮压缩包248文件实际解压94,920,183字节，余79,817字节；后续客户端返修后的当前体积以验收记录为准。相关[载荷检查（原件已退役）](history-cleanup-20261024.md)及[首包预算失败（原件已退役）](history-cleanup-20261024.md)保留；当前实际包验收见[验收记录](../reference/acceptance.md)。

## 两种Windows交付与空盒子入口（2026-10-11）

来源：[docs/reference/release.md](../reference/release.md)；整理前原文件SHA-256 `942b5797336a62fdfcc75cfe2299c9538223fb9818ab00cf192e5cea46150b20`。

本节是2026-10-11双版本的历史记录，已于2026-10-12退役。该阶段沿用v1.0.6，完整游戏版不加类型后缀，仅盒子版加 `-box`；内部edition为full／box，曾支持 `--edition=full|box|both`。两版实际提取、预装／导入及原生安全的原验收保留，不能作为现行完整EXE的证明。

当时内部payload和manifest放在 `artifacts/package-payloads/v1.0.6/<run>/<edition>/`，`current.json`记录双交付；完整玩法离线ZIP用于导入，未来发布曾规划双EXE、source ZIP和作者工具包四附件。空盒子曾显示“请前往游戏库下载”并打开下载浮窗。上述导出选项、导入用途、附件规划和提示均已取消，现行提示为“请在游戏库选择游戏”。历史原包及已发布线上内容保持原记录，旧文件按SHA保全和清理规则处理。

## 最新分发决定与暂缓发布（2026-10-11）

来源：[docs/reference/release.md](../reference/release.md)；整理前原文件SHA-256 `942b5797336a62fdfcc75cfe2299c9538223fb9818ab00cf192e5cea46150b20`。

本节只追溯2026-10-11的Pages与v1.0.6重新发布，全部独立游戏分发／Pages准备和部署命令已退役。线上旧内容本轮未修改，以下操作不能作为现行命令执行；新的Release边界见[GitHub发布](../reference/release.md#github发布)。

用户此前采用 GitHub Pages 按目录分发游戏包，并暂时撤回 v1.0.6；该 Release 曾改为草稿（ID `409577467`），原标签与25个附件留有历史审计。随后用户明确授权“现在部署Pages并重新发布v1.0.6”，本次已完成[游戏包目录部署](https://anapalpitate.github.io/TableMax/)及[v1.0.6正式重新发布](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.6)。35个公开文件的大小／SHA、正式及latest状态、九条正文和严格三附件核验全部通过，见[最终发布审计（原件已退役）](history-cleanup-20261024.md)与[验收记录](../reference/acceptance.md)。普通提交、推送和构建不自动构成以后发布的授权。

本次[已审更新说明（原件已退役）](history-cleanup-20261024.md)以v1.0.5实际发布source提交 `4943ca5cf89aabc850df3fb566519973913feb3e` 为比较基线，不能以保留的旧标签对象替代。本次source ZIP对应 `a7d13f7388442bbc3083913c0786ca43278214ef`，v1.0.6原标签继续指向 `1f8267a4bdf4d8172719a3e71be1f7445f88c3bc`；两者映射已记录在最终发布审计，未移动或强推历史标签。

当时后续方案为full／box两种Windows EXE、发布提交的source ZIP和已验证作者工具包放GitHub Release；签名目录、代码／资源包及完整玩法离线包放 `https://anapalpitate.github.io/TableMax/`。当时线上旧三附件保留原发布事实，四附件方案后来取消；普通推送不触发重新发布。

目录固定为：

```text
index.html
.nojekyll
games/v1.0.6/catalog.json
games/v1.0.6/packages/<目录中的精确附件名>
games/v1.0.6/<gameId>/<variantId或default>/index.html
```

原Pages体系的 `releaseTag`定位版本目录，`assetName` 定位其中的包；内容哈希、发行引用、Ed25519 签名和本机安装事务不变。管理员主动刷新签名目录，所有玩家仍只访问主机。没有在线目录时保留已验证缓存，离线导入和已安装游戏继续可用。

首次Pages部署还须保全已撤回Release签名目录引用的旧内容包与离线包（本地原 `artifacts/game-packages/v1.0.6/` 未覆盖），按原精确包名合并进同一版本的packages目录；旧签名目录另存到历史子目录。不能因为此前没有Pages历史站点而遗漏旧发行，同名已发布旧包必须保留原字节，不以新目录重新生成的副本覆盖；新发行另行保全。旧安装版当时可导入对应原发行离线包；当前程序已撤除导入，缺失原版本按所需旧完整EXE处理，仍禁止用最新发行替代。

当时执行 `pnpm prepare:pages -- --packages=<已验独立游戏包目录> --out=<全新输出目录>` 生成静态站点及站点外逐文件清单；当时执行 `pnpm verify:pages -- --packages=<同一目录>` 在127.0.0.1检查目录路径、哈希、离线依赖、篡改拒绝和不覆盖旧输出。工具不调用 GitHub。每次准备使用新目录，部署时合并既有历史目录：内容寻址包不可覆盖或删除，旧对局引用必须仍可下载；当前签名目录和浏览目录可以更新。跨版本依赖须一并保全，不能只上传最新文件。本地 `artifacts/pages/` 当前候选与清单受维护保护，不自动清空。

`.github/workflows/pages.yml`仅手动触发，要求输入 `PUBLISH_TABLEMAX`；没有 push、定时或 Release 自动触发器。本次已核对本地清单及历史目录，将已验证的纯静态目录提交到 `gh-pages`，配置 Pages 使用 GitHub Actions并手动部署；[部署工作流](https://github.com/anApalpitate/TableMax/actions/runs/38133974837)及[公开字节核验（原件已退役）](history-cleanup-20261024.md)通过。该历史工作流不再作为当前交付入口，普通push和本轮维护均不部署。整个站点不超过 [Pages 的1GB限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)，累计历史文件也计入；部署权限与环境按 [官方工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。私钥、存档和本地审计永不上传。

此前已授权草稿替换使用 `pnpm release:github -- --publish --replace-draft --draft-id=409577467 --notes=<说明> --devkit=<已验工具包> --pages-manifest=<已审站点清单>`完成，三附件及实际源码映射见发布审计。该旧入口曾核对Pages公开字节；双EXE与作者工具包的后续四附件方案已取消，未来发布采用现行完整EXE与source ZIP；`--replace-draft`只适用于明确指定的既有草稿，不能将当前正式Release当作旧草稿再次操作。保留历史标签，不强推或隐瞒实际发布源码映射。

当时新旧目录通过 `node --import tsx tools/release/prepare-pages-history.mjs --current=<当前包目录> --previous=<原发行目录> --previous-release=<原Release审计> --out=<全新准备目录>` 合并，验证原线上附件摘要并重新签名联合目录；相同发行及依赖的离线包优先保留原已发布字节，当前浏览入口只列每种玩法的首个发行。`.nojekyll`只作为部署标记，由Git树核验，不要求它在Pages提供下载。若本轮已有全部公开文件的真实大小／哈希证明，可加 `--pages-proof=<证明>` 复用：入口要求证明不超过一小时、逐文件匹配当前清单、远端 `gh-pages` 提交不变，并再次读取可更新的签名目录；无证明时最多四个并发请求重新核验，不能用本地回环结果代替。

2026-10-10同版本附件替换授权：用户明确要求重新导出并只替换原v1.0.5的附件，因此本轮保持Release标题、正文、版本与已有标签对象，上传完整EXE及从本次已验证源码提交导出的source ZIP。源码提交与保留的旧标签对象映射记录在本地发布审计，不移动标签、不新增Release，也不上传运行ZIP或JSON。本条是此次明确授权的同版本替换边界；后文新版本发布流程仍适用。

本页统一维护本地交付和GitHub Release的流程、前提与事项。工具链、增量构建、运行和安全清理的具体实现见[开发环境](../reference/development.md)，当前实际交付与未验证边界见[验收记录](../reference/acceptance.md)。本页是操作规范，不表示某版本已完成或已发布。

## 旧在线兼容目录

来源：[docs/reference/release.md](../reference/release.md)；整理前原文件SHA-256 `942b5797336a62fdfcc75cfe2299c9538223fb9818ab00cf192e5cea46150b20`。

2026-10-12早期曾采用稳定 `games/catalog.json`及旧版本协议7兼容目录选择最新可安装发行；独立下载、目录刷新、`package:games --history=...`和Pages分发随后随完整EXE统一交付而退役。旧公开文件维持原发布事实，当前程序不访问它们选择新局。历史版本缺失、匹配不唯一或接口不兼容时保留存档并提示所需版本及相应旧完整EXE，不用最新规则或离线ZIP替代。

## 1.0.6.10：宝可梦新设计应用（2026-10-12）

来源：[docs/reference/acceptance.md](../reference/acceptance.md)；整理前原文件SHA-256 `37e55da4f82c9c697718f95a521daf0382b57597217493e515cbd7551981c6ca`。

当前本地完整程序为 [TableMax-1.0.6.10-win-x64.exe](local-release-retirement-2026-10-16.md#逐文件退役清单)，公开版本仍为1.0.6。新局使用 `events-research-v3`，统一144张、17项研究、单格超梦及六类随机事件；旧存档、checkpoint及原局下一小局固定原发行。Mega与羁绊仅展示主题占位，7项缺失研究插图采用符合新条件的代码场景。主机／公共隐藏玩家缓冲，本人端保留操作；天气角标、环境层、全屏能力与路卡利欧画像波导已接入。

[实际完整EXE证明（原件已退役）](history-cleanup-20261024.md)通过载荷全部哈希、96成员集合、重复提取及隐藏原生WebView2／包内Node安全。EXE **44,096,512字节**，内部ZIP **43,964,478字节**，实际提取 **97,009,047字节**，均严格小于120,000,000字节。宝可梦扩展模块 **3,717,195字节**（[同包严格预算证明（原件已退役）](history-cleanup-20261024.md)），本轮仍按4,194,304字节门禁，新增4份运行图片共167,594字节。EXE SHA-256为 `93207df18d568e808ea903ce5d538fe1835323f80a523af95a09241eeb6364bc`，冻结快照与内部载荷按该原始证明绑定；current已于2026-10-15推广18，见[当前源码与本地交付](../reference/acceptance.md#当前源码与本地交付)。

源码适用检查已通过：新配置、半分／负分及多暗行计分、144张守恒、单格秘密权限、事件原子保存与恢复、三档2–6人完整三胜矩阵、6席32MiB真实Worker混合大局、原版差分与旧profile回归。人机矩阵及138,392ms混合Worker结果见[人机验证边界](../games/pokemon-encounters/bot.md#当前验证边界)。默认浮钮已修正横竖切换的右缘位置及滚动避让，5项模型检查和类型检查通过。

同一个EXE的适用专项已全部通过：[真实服务与旧发行恢复（原件已退役）](history-cleanup-20261024.md)、[显示矩阵（原件已退役）](history-cleanup-20261024.md)、[演出（原件已退役）](history-cleanup-20261024.md)、[结算与授胜（原件已退役）](history-cleanup-20261024.md)和[自然游玩（原件已退役）](history-cleanup-20261024.md)。服务专项6个受控合法事件场景经真实Socket与SQLite保存，对照实际包内规则、单张私看、随机状态及暗牌投影；真实1.0.6.3旧局的恢复、回退、重启和下一小局仍保持原发行。18张肖像、16张无损卡面、8个主题音频、27个叫声及4张新增运行图的离线哈希／解码通过。

显示矩阵含2／4／6人、手机320–430px竖屏及568–932px横屏、电脑720p至4K横竖与短屏／长昵称／浮窗／100／125／150%模拟缩放；1,674次布局审计、422次真实点击、37次草稿保留、425组天气角标几何记录及54格结算通过。记录自然按钮高度、18px主要动作、44px触区及多点点击命中。自然随机对局没有遇到所有能力和事件，未遇阶段单列，固定合法场景补验独立记录；不以随机游玩代替全覆盖。

演出专项106,490ms通过59帧既有姿态、13条序列、路卡利欧画像波导、六类事件三身份、减少动态／取消／恢复不重播，以及原版喷火龙／卡比兽真实规则触发。自然游玩使用实际服务和本人UI，记录15次叫声成功播放；技术播放不表示真人听感已认可。独立查看六人结算、手机雨天角标和能力入场，布局与角色辨识清晰；简化演出仍需真人美术认可。失败达到3项停止后定向复验，原失败与修复过程见[归档](completed-tasks-2026-10-10.md#宝可梦新设计应用2026-10-12)。实体手机、现场LAN、物理DPI、真人听感、美术认可、7项插图、Mega／羁绊独立效果与时长平衡继续[待验收](../tasks/pokemon-encounters-expansion.md)。本轮仅本地交付，不发布Release／Pages或源码ZIP。

## 验收页中的历史维护体积

来源：[docs/reference/acceptance.md](../reference/acceptance.md)；整理前原文件SHA-256 `37e55da4f82c9c697718f95a521daf0382b57597217493e515cbd7551981c6ca`。

此前深度瘦身实测 **5,896,919,854逻辑字节**（含受保护嵌套仓库），达到当次6GB目标；1.0.6.10交付收尾实际退役6,526,191,088字节，维护实测10,340,767,910逻辑字节（9.631GiB，排除链接与嵌套仓库），低于默认10GiB阈值，追加删除0，见[本轮瘦身记录](../reference/project-slimming.md#宝可梦新版交付收尾2026-10-12)。历次“原包保留”和容量数字仅表示当时状态；已按审计退役的历史包／截图由当前精确清单说明，不修改原失败、文字结论或逐文件哈希。

## 旧运行ZIP的迁移输入

来源：[docs/reference/acceptance.md](../reference/acceptance.md)；整理前原文件SHA-256 `37e55da4f82c9c697718f95a521daf0382b57597217493e515cbd7551981c6ca`。

本页[手写改动单第1项](../reference/acceptance.md#106手写改动单第1项2026-10-11)曾交付运行ZIP，SHA `0048f55745f66c289eed918b78efccb058afbd4e2014bbc67655d36cc3be52c5`；该真实旧包作为明确迁移／验证输入保留在独立历史目录。下方更早的电力公司及宝可梦整合结论仍限定原版本，不表示当前需下载ZIP或重复其完整整局检查。

## 候选18原构建配方

来源：[tools/release/README.md](../../tools/release/README.md)；整理前原文件SHA-256 `0c8bca2565d62b70d1f6ad9be842a7d05fe76744efb06ea999a7055a169ed07e`。

现行18按下列方式从候选13保留同一31个游戏单元，显式使用原内部签名游戏源，避免误用另一份game-packages/current。后续新代码封包仍先candidate，以下保留该轮输入说明，不自动重复构建。任务期间关闭逐项维护，已有一次安全维护不追加第二轮。

```powershell
$env:TABLEMAX_AUTO_MAINTENANCE = '0'
$env:TABLEMAX_TEST_MAINTENANCE = '0'
pnpm package:win -- --candidate --platform-from=build/snapshots/4e4f4f05f0a938f831d5f5da406b76c88e6f0f8d7db25d29077d743aa7cb1ade.json --games=artifacts/package-payloads/v1.0.6/internal-games-MdGykg
```

## fixture sidecar覆盖与恢复

来源：[tools/release/README.md](../../tools/release/README.md)；整理前原文件SHA-256 `0c8bca2565d62b70d1f6ad9be842a7d05fe76744efb06ea999a7055a169ed07e`。

重封内部fixture时先把release manifest按原字节复制到本轮独立工作目录，再传给 `createInstallationExecutable`；该工厂会在输入manifest旁写出固定名称的installation manifest，不能复用旧冻结目录作为可写输出。2026-10-15一次旧tmp sidecar覆盖已按原SHA恢复，原ZIP／release manifest／EXE未变，原失败保留于[轮次记录（原件已退役）](history-cleanup-20261024.md)。

## 阿瓦隆旧双版本验证

来源：[docs/reference/validation.md](../reference/validation.md)；整理前原文件SHA-256 `62d3fa9fc7d731e41fe1ff7e24216544d3eb783c9e2944203cfcf499b9d99399`。

历史双版本安装程序验证曾使用 `node tools/test/games/avalon/verify-configured-delivery.mjs --edition=full|box --packages=<本地已验签名包目录> --out=<新证据目录>`，每次选择一个 edition，从当前载荷指针绑定实际EXE提取、逐成员验哈希、隐藏静音启动并检查三端规则。full检查预装新包；box先导入原宫廷包再导入新包，注册与公开目录始终只选现行配置，新包通过离线导入后可重新加载，不依赖线上已发布新包。`--work=tmp/delivery-session-<六位后缀>`仅允许复用没有data目录的提取专用会话，仍重验实际EXE与全部成员，不复用已有对局或浏览器profile。该入口仅供对应历史程序和原包验证；现行完整EXE不提供离线导入，不以此旧安装流程作为新交付要求。旧版候选、失败与通过分别保留其版本边界。

## 浏览器玩家验证的旧版本口径

来源：[docs/reference/validation.md](../reference/validation.md)；整理前原文件SHA-256 `62d3fa9fc7d731e41fe1ff7e24216544d3eb783c9e2944203cfcf499b9d99399`。

当前按 2026-10-08 用户纠正交付 v1.0.4；本标题保留旧锚点。电脑浏览器真人保持中央手机区域，三游戏原手机布局不做宽屏重排。验证器从根 `package.json` 读取版本并核验对应 ZIP／清单的全部解压成员；当前证据位于 `artifacts/maintenance/v1.0.4/debug-20261008/`。玩家 DOM 断言在稳定同源子文档中进行，外层仅用于窗口尺寸与实际截图。

## 旧Corepack环境处理

来源：[docs/reference/validation.md](../reference/validation.md)；整理前原文件SHA-256 `62d3fa9fc7d731e41fe1ff7e24216544d3eb783c9e2944203cfcf499b9d99399`。

Node 与 pnpm 沿用锁定版本。沙箱默认 Corepack 缓存落在不可用的用户临时位置时，仅对本进程设置 `COREPACK_HOME=E:\Proj\TableMax\.cache\corepack` 和 `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`；使用仓库内缓存及 `pnpm install --offline --ignore-scripts` 链接新增工作区，不升级包、不修改全局环境。运行必须遵守下文回环监听与测试静音规则。

## Release页中的原全量构建示例

来源：[docs/reference/release.md](../reference/release.md)；整理前原文件SHA-256 `1a32f377c27e43485f2ab7b632276f7da74c8d7947de6a6f48fe61c9f2e4e107`。

2. 新安装器执行 `pnpm package:win -- --candidate`，该入口包含生产构建且保留当前交付。若本轮明确要求一次全量生产构建，先执行下列第一条命令，再用它返回的冻结清单执行第二条，避免重复编译：

   ```powershell
   node tools/build/build.mjs --production --full
   node tools/release/package.mjs --candidate --snapshot=<本轮冻结清单绝对路径>
   ```

## 历史候选manifest归组

本次仅迁移四份原manifest，合计133,356字节；[逐文件原新路径与SHA（原件已退役）](history-cleanup-20261024.md)及[应用记录（原件已退役）](history-cleanup-20261024.md)记录moved4、deleted0。10／18与指针由[保护基线（原件已退役）](history-cleanup-20261024.md)绑定，payload和proof未迁移。该元数据归组不表示新输出路径兼容已经通过，失败和接续见[整理任务](tooling-delivery-organization-2026-10-15.md)。

- artifacts/releases/TableMax-1.0.6.13-win-x64-manifest.json → artifacts/releases/retired/v1.0.6/1.0.6.13/TableMax-1.0.6.13-win-x64-manifest.json；32989字节，SHA 8c2ff05cec55e01328203e91ab177537cc6403f90683ac725627482faada5115。
- artifacts/releases/TableMax-1.0.6.14-win-x64-manifest.json → artifacts/releases/retired/v1.0.6/1.0.6.14/TableMax-1.0.6.14-win-x64-manifest.json；33452字节，SHA 2e4843a4fe22601635bc49a76694a0e8435ad3688e4f980cd10e0b2e0e2656c2。
- artifacts/releases/TableMax-1.0.6.15-win-x64-manifest.json → artifacts/releases/retired/v1.0.6/1.0.6.15/TableMax-1.0.6.15-win-x64-manifest.json；33460字节，SHA f595c6d24da84ddddb5450a5e96945a852ec687e3effd3ffd71b6f9cf3ced173。
- artifacts/releases/TableMax-1.0.6.16-win-x64-manifest.json → artifacts/releases/retired/v1.0.6/1.0.6.16/TableMax-1.0.6.16-win-x64-manifest.json；33455字节，SHA e717ac567b2353f6ffe83a868b04227678361e7034d989eee12241a179024fe0。

[一次性工具盘点（原件已退役）](history-cleanup-20261024.md)保存原337文件职责、直接消费者和文字引用，只作来源审计，不作为新registry。

## 工具整理任务停线原记录（2026-10-16迁入）

来源：[进行中工具整理任务](tooling-delivery-organization-2026-10-15.md)；迁入前原任务SHA-256 `94e325047fc22f7fc4ccd58637980ac49ed4b95e950b403650d63c584222a19f`。以下保存原三失败、后续五失败停线与当时接续判断，不改写旧结果。

2026-10-16用户明确允许在已有授权内，经实质修复或定向环境纠正并记录证据后自动新建独立预算轮；以下“达到5项后不自动继续”是旧时点记录，现行规则见[统一失败门禁](../reference/validation.md#历史通过率与失败阈值)。安装优化round01／02／03的后续定向通过与当前剩余见[工具任务](tooling-delivery-organization-2026-10-15.md)及[安装优化任务](windows-installer-flow-2026-10-16.md)，不清零原失败，也不把原18证明升级为新工具方法或新19系统验收。

## 范围与保护

按用户2026-10-15确认的增量整理方案实施；保留10／18原交付路径、字节、指针及原始验收证明。公开版本仍为1.0.6，不新建正式候选、不重建游戏、不发布或部署。保留既有工作区配置改动。

## 进度

- [x] 完成原337文件职责／直接消费者盘点；结果为一次性记录，不充当新注册表。
- [x] 13–16四份历史清单归组，合计133,356字节；逐文件SHA一致，未删除。
- [x] 交付路径兼容、四热点拆分、独立封存与完整方法源绑定的源码已写入；尚未通过本轮动态验收。
- [ ] 补验路径链接拒绝及新布局SHA检查，核对旧重封路径。
- [ ] 执行新增隔离回归、现有受影响回归，验证封存失败可单独恢复。
- [ ] 长根外置数据fixture与冻结18正式安装生命周期真实验证。
- [x] 收敛文档唯一正文；统一保存并通过适用格式、语法、ESLint、文档链接与锚点检查，详见静态报告。
- [x] 默认失败阈值改为5，规则正文、runner／安装JS、父PS范围及两个C#底座的预算源码联动；旧失败保留。
- [ ] 验证新预算默认／显式／环境优先级，编译并核验受影响C#底座；静态通过不能替代这些检查。
- [ ] 阶段提交、最终推送并确认同步。

## 本轮停测与接续

### 最新规则与当前停线

用户随后明确将默认累计失败上限改为5，并授权修复后定向再测；原失败不清零。当前累计5项，已再次停止动态测试。默认阈值及参数由[验证规范](../reference/validation.md#历史通过率与失败阈值)统一维护，工具读取同一默认策略；历史3次停线记录保持原事实。

恢复后第4次失败仍为junction未拒绝。只读诊断发现本机lstat／readlink把junction呈现为普通目录，而父目录Dirent仍标记链接；已采用双视图检查，链接定向复验及新旧布局／越界／SHA共4项随后通过。

第5次失败发生在既有current-delivery回归的临时目录清理，表面错误ENOTEMPTY。其目录junction原用unlinkSync，外层finally又可能覆盖主断言异常；已改为精确rmdirSync及聚合保留主错误／清理错误，并让payload祖先复用双视图守卫。这些后续修复尚未复验，不能推定原主断言已通过。未追加工作区清理，保留失败夹具。

### 初次三项失败原记录

本轮累计3次路径验证失败，已停止新增动态测试：首次沙箱拒绝创建junction；第二次显式沙箱外执行仍使用系统临时目录，mkdtemp被拒；第三次改为工程tmp后，Windows junction拒绝断言未触发。代码现补充对“lstat报ENOENT但父目录仍存在同名项”的拒绝处理，修复尚未动态复验。前两项为测试环境问题，第三项为路径保护待验证缺陷；不清零原失败。

后续只做了源码提取、静态审阅、格式／语法／链接检查及原文件哈希核对。未创建账户、未启动安装器、未重新封包或推广，原18的已完成验收不等于新工具方法已通过。

初轮静态检查曾发现提取后两处未用import，后续修正；测试错误保全实现也按静态规则调整。最新39份MJS语法与ESLint通过，三份PS的AST无错误，保护基线内交付、指针、清单、原证明及既有工作区配置均保持原SHA。证据：[初轮记录（原件已退役）](history-cleanup-20261024.md)、[累计5失败记录（原件已退役）](history-cleanup-20261024.md)、[最新静态语法（原件已退役）](history-cleanup-20261024.md)、[最新ESLint（原件已退役）](history-cleanup-20261024.md)。静态检查不替代隔离或系统验收。

达到现行5项上限后不自动继续。后续先复验current-delivery受影响项并保留完整主错误，再跑隔离回归；静态与隔离均通过后才进入真实Windows验证。现有formal驱动默认要求三条fixture链，不能为缩小矩阵省略原门禁；安排实际系统验收时必须据真实入口预算并复用相同方法且仍可核验的材料。

证据入口：[迁移计划（原件已退役）](history-cleanup-20261024.md)、[迁移结果（原件已退役）](history-cleanup-20261024.md)、[337文件盘点（原件已退役）](history-cleanup-20261024.md)、[保护基线（原件已退役）](history-cleanup-20261024.md)。本任务仍未完成，不将实现与静态通过写成业务验收通过；阶段代码提交与push待适用验证完成。

## 验证边界

复用runner v2、原case ID和报告，不新建第二套注册表。环境／业务／封存／清理分别诊断，清理失败阻止整体通过；累计失败停止与修复后定向复验按上述唯一验证规范执行。只检查本任务实际依赖，不追加工作区清理。

## 方法拆分后的正式执行与独立封存（2026-10-16）

原停线快照之后，父／子PS方法源数组与环境入口列表经实质修复并定向复验；[入口列表隔离3项（原件已退役）](history-cleanup-20261024.md)通过，首次[账户创建前的失败（原件已退役）](history-cleanup-20261024.md)不改写。round03累计4失败仍保留，未因随后通过清零。

`production-account-19-02` 使用拆分后的完整冻结方法源执行三条fixture及正式19系统链，[驱动终态（原件已退役）](history-cleanup-20261024.md)退出0，账户／profile实际清理成功。驱动保留原始[execution-proof.json（原件已退役）](history-cleanup-20261024.md)、不可覆盖的[execution-receipt.json（原件已退役）](history-cleanup-20261024.md)与[隔离清理报告（原件已退役）](history-cleanup-20261024.md)。

随后独立finalizer按回执复核原输入、完整方法源、清理报告及保留runtime，CreateNew写出[finalized-installation-19.json（原件已退役）](history-cleanup-20261024.md)，[封存日志（原件已退役）](history-cleanup-20261024.md)为passed；没有重跑产品或将fixture／迁移报告冒充正式proof。实际系统范围见[安装阶段记录](windows-installer-flow-2026-10-16.md#轮次03正式系统链与清理完成2026-10-16)，正式SHA与容量只在[验收](../reference/acceptance.md#当前源码与本地交付)维护。旧18原证明和字节保持原范围，新19方法实际结果另存；真实便携迁移仍在途，整体任务、文档及commit／push尚未收尾。

## 迁移修复后的方法源边界与完成记录（2026-10-16）

原正式19系统链和独立封存已经通过。随后round03第5项为portable验证器identity缺productId导致严格回执比较失败：真实default迁移／卸载已执行，整体仍failed，该测试账户清理成功。原报告、旧轮5失败和方法输入均保留，详见[迁移失败与定向完成](windows-installer-flow-2026-10-16.md#轮次03迁移失败与轮次04定向完成2026-10-16)。

只修verifyIdentity四字段投影后，round04独立账户双迁移各8项通过，驱动exit0、账户／profile均删除且errors为空，没有重建或重跑formal。[历史方法源回执（原件已退役）](history-cleanup-20261024.md)保留正式旧方法hash和对应原portable源恢复副本的exact SHA对照；旧proof没有重新绑定为修复后源码，也不把两个账户合成一份证明。

本阶段已完成路径／current保护、新预算与隔离、方法拆分、实际执行回执与独立封存，以及新布局正式系统链和真实迁移所需验证。实际证据入口见[安装完成记录](windows-installer-flow-2026-10-16.md#轮次03迁移失败与轮次04定向完成2026-10-16)；现行规则转[验证](../reference/validation.md#历史通过率与失败阈值)，当前身份与交付数字转[验收](../reference/acceptance.md#当前源码与本地交付)。旧原文和失败全部保留，已完成任务撤出进行中索引；现行方法与历史过程分别维护。
