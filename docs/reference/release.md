# Release流程与发布约定

## 唯一完整 EXE 交付（2026-10-12）

Windows只导出预装全部正式游戏及玩法的完整EXE，文件名不加类型后缀。游戏仍独立组织和增量构建；不可变模块仓库仅用于程序内部预装和原局恢复。取消盒子版、游戏下载、游戏ZIP导入、独立游戏更新／卸载／回退及安装型作者工具包导出；整个程序的安装、默认保留数据卸载与盒子内更新已获授权并实现。新局以本EXE验证后的预装映射为准，旧安装索引和缓存目录不能覆盖。旧存档固定原发行；本机原版本保留，缺失时保留存档并提示使用包含原版本且支持存档格式的旧完整EXE。本轮仅本地导出，不发布、不部署Pages、不生成发布source ZIP。

以下旧安装／分发章节保留其实施与历史边界，涉及独立游戏下载、盒子版及 Pages 的操作已退役，不作为当前使用指南。

当前打包入口为 `pnpm package:win`，新安装器使用 `--candidate` 生成 `TableMax-<四位版本>-win-x64.exe` 与本地清单，冻结候选但保留原current；`pnpm package:release`只重新封装当前完整载荷。`--edition`明确报错。构建会对比冻结游戏单元与已有签名模块的逐文件清单：字节相同则复用，变化则在内部载荷目录重新生成、签名并验证全部模块。私钥由受保护的 `TABLEMAX_GAME_SIGNING_KEY` 或本地 `secrets/game-release-ed25519.pem`提供，不随程序交付。不存在独立游戏包的现行导出入口。

未来明确授权发布时，附件仅为完整 EXE 与该发布源码 ZIP；Pages和安装型作者工具包不再生成或部署。历史作者工具包、安装目录及已发布附件仅保留原验证边界，SDK、模板和源码接入继续维护。

## 完整安装器与免费应用签名（2026-10-15）

用户已授权完整 installer、整个程序卸载与盒子内更新，并明确现在及未来均不购买 Authenticode 证书。实现和验收状态见[安装任务](../tasks/windows-installation-update.md)；旧便携EXE原字节／证明继续保护。新 installer 直接封装完整冻结载荷，固定生产产品ID `{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}`；测试产品ID独立，不能进入正式当前交付或发布证明。

当前指针仍为便携1.0.6.10；候选1.0.6.14已冻结，含协调器恢复和独立内嵌卸载helper。真实Medium fixture Inno已返回0并写登记，随后中文JSON解码导致校核及保护性卸载拒绝，本轮按阈值停止，临时账户与profile已删除。UTF8工具修复已写入、尚待动态复验；完整系统证明未通过前不推广或发布。账户／UAC／profile范围已明确授权，精确身份及证据见[验收](acceptance.md#10614安装候选与标准账户诊断2026-10-15)。

应用更新使用独立 RSA-3072／SHA-256／PKCS#1 v1.5 签名，Node签原始UTF-8描述，.NET先验原字节再严格解析。公钥和 `tablemax-rsa-2026-01` 随程序内置，与游戏 Ed25519 密钥分离。签名绑定固定仓库／stable tag／installer附件名、公开三位与本地四位版本、长度／SHA、载荷清单及当前游戏映射；同构建换摘要、降级、已接受高位的回放、重复字段或机器块均拒绝。未来正式 Release 正文只含一个隐藏的 Base64 envelope机器块；人类说明照常显示，公开附件仍只有完整installer EXE与发布source ZIP。

私钥已按用户明确授权生成，位于 Git 忽略的 `secrets/application-update/release-rsa3072.pem`，ACL仅当前用户与SYSTEM。签名工具只通过当前进程环境指定文件和keyId，退出后清除该环境；不写命令参数内容、日志、源码或安装器。签名前核对内置公钥，自验生成的最终正文；此操作不发布任何内容。密钥的长期备份应存入用户受控的离线加密介质，恢复时先核对公钥指纹与keyId；本轮没有创建异地备份，不将同盘复制称为灾难恢复。

首版没有网络换根接口。正常换根须先设计由旧信任验证的过渡发行、保留旧版本可验证关系并单独验收；私钥丢失或泄露时暂停在线更新，用户通过另行核验来源和摘要的手动完整安装器恢复信任。不能把网络提供的新公钥直接当作旧根的授权，也不能静默降为未签名digest更新。

项目签名不提供 Windows 发布者证书或 SmartScreen 信誉。保留系统安全提示，不要求安装者导入根证书、关闭安全功能或降低策略；系统拒绝运行时明确提示限制，不能声称免费应用签名等同 Authenticode。第三方 Node／WebView2 文件保留原发行字节和来源。

正式封包、实际安装、current推广和发布分别受门禁约束。先冻结唯一候选installer、安装清单及原current摘要；真实干净标准用户先完成已绑定双PE的实际检查／下载／Apply／父退出／新主机持续健康，再对正式GUID完成首装、同目录重装、快捷方式、完整首次启动计量与默认卸载。账户及profile清理成功后，原始隔离报告SHA才绑定正式证明。提取报告、helper-only、向导取消、工程检查或环境变量均不能替代。推广入口核对候选、正式证明及未变化的原current，再原子切换；发布入口另复验精确摘要与已签正文。命令和参数见[发布工具](../../tools/release/README.md)，普通commit／push不发布。

## 两种Windows交付与空盒子入口（2026-10-11）

本节是2026-10-11双版本的历史记录，已于2026-10-12退役。该阶段沿用v1.0.6，完整游戏版不加类型后缀，仅盒子版加 `-box`；内部edition为full／box，曾支持 `--edition=full|box|both`。两版实际提取、预装／导入及原生安全的原验收保留，不能作为现行完整EXE的证明。

当时内部payload和manifest放在 `artifacts/package-payloads/v1.0.6/<run>/<edition>/`，`current.json`记录双交付；完整玩法离线ZIP用于导入，未来发布曾规划双EXE、source ZIP和作者工具包四附件。空盒子曾显示“请前往游戏库下载”并打开下载浮窗。上述导出选项、导入用途、附件规划和提示均已取消，现行提示为“请在游戏库选择游戏”。历史原包及已发布线上内容保持原记录，旧文件按SHA保全和清理规则处理。

## 最新分发决定与暂缓发布（2026-10-11）

本节只追溯2026-10-11的Pages与v1.0.6重新发布，全部独立游戏分发／Pages准备和部署命令已退役。线上旧内容本轮未修改，以下操作不能作为现行命令执行；新的Release边界见[GitHub发布](#github发布)。

用户此前采用 GitHub Pages 按目录分发游戏包，并暂时撤回 v1.0.6；该 Release 曾改为草稿（ID `409577467`），原标签与25个附件留有历史审计。随后用户明确授权“现在部署Pages并重新发布v1.0.6”，本次已完成[游戏包目录部署](https://anapalpitate.github.io/TableMax/)及[v1.0.6正式重新发布](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.6)。35个公开文件的大小／SHA、正式及latest状态、九条正文和严格三附件核验全部通过，见[最终发布审计](../../artifacts/maintenance/v1.0.6/pages-release-20261011/github-draft-replacement-1791717345309.json)与[验收记录](acceptance.md)。普通提交、推送和构建不自动构成以后发布的授权。

本次[已审更新说明](../../artifacts/maintenance/v1.0.6/pages-release-20261011/release-notes.md)以v1.0.5实际发布source提交 `4943ca5cf89aabc850df3fb566519973913feb3e` 为比较基线，不能以保留的旧标签对象替代。本次source ZIP对应 `a7d13f7388442bbc3083913c0786ca43278214ef`，v1.0.6原标签继续指向 `1f8267a4bdf4d8172719a3e71be1f7445f88c3bc`；两者映射已记录在最终发布审计，未移动或强推历史标签。

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

`.github/workflows/pages.yml`仅手动触发，要求输入 `PUBLISH_TABLEMAX`；没有 push、定时或 Release 自动触发器。本次已核对本地清单及历史目录，将已验证的纯静态目录提交到 `gh-pages`，配置 Pages 使用 GitHub Actions并手动部署；[部署工作流](https://github.com/anApalpitate/TableMax/actions/runs/38133974837)及[公开字节核验](../../artifacts/maintenance/v1.0.6/pages-release-20261011/public-pages.json)通过。该历史工作流不再作为当前交付入口，普通push和本轮维护均不部署。整个站点不超过 [Pages 的1GB限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)，累计历史文件也计入；部署权限与环境按 [官方工作流说明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。私钥、存档和本地审计永不上传。

此前已授权草稿替换使用 `pnpm release:github -- --publish --replace-draft --draft-id=409577467 --notes=<说明> --devkit=<已验工具包> --pages-manifest=<已审站点清单>`完成，三附件及实际源码映射见发布审计。该旧入口曾核对Pages公开字节；双EXE与作者工具包的后续四附件方案已取消，未来发布采用现行完整EXE与source ZIP；`--replace-draft`只适用于明确指定的既有草稿，不能将当前正式Release当作旧草稿再次操作。保留历史标签，不强推或隐瞒实际发布源码映射。

当时新旧目录通过 `node --import tsx tools/release/prepare-pages-history.mjs --current=<当前包目录> --previous=<原发行目录> --previous-release=<原Release审计> --out=<全新准备目录>` 合并，验证原线上附件摘要并重新签名联合目录；相同发行及依赖的离线包优先保留原已发布字节，当前浏览入口只列每种玩法的首个发行。`.nojekyll`只作为部署标记，由Git树核验，不要求它在Pages提供下载。若本轮已有全部公开文件的真实大小／哈希证明，可加 `--pages-proof=<证明>` 复用：入口要求证明不超过一小时、逐文件匹配当前清单、远端 `gh-pages` 提交不变，并再次读取可更新的签名目录；无证明时最多四个并发请求重新核验，不能用本地回环结果代替。

2026-10-10同版本附件替换授权：用户明确要求重新导出并只替换原v1.0.5的附件，因此本轮保持Release标题、正文、版本与已有标签对象，上传完整EXE及从本次已验证源码提交导出的source ZIP。源码提交与保留的旧标签对象映射记录在本地发布审计，不移动标签、不新增Release，也不上传运行ZIP或JSON。本条是此次明确授权的同版本替换边界；后文新版本发布流程仍适用。

本页统一维护本地交付和GitHub Release的流程、前提与事项。工具链、增量构建、运行和安全清理的具体实现见[开发环境](development.md)，当前实际交付与未验证边界见[验收记录](acceptance.md)。本页是操作规范，不表示某版本已完成或已发布。

## 三位公开版本与四位本地构建（2026-10-12）

公开版本保持 `1.x.x`，用于 `package.json`、GitHub标签／Release和公开附件名；本地维护版本为 `1.x.x.y`。根目录 `build-version.json`记录所属公开版本与修订计数，`tools/shared/application-version.mjs`使用独占锁原子分配。新一次 `package:win`分配一个y；失败构建消耗的编号不回收。仅构建单元不增加y，重封已有载荷及恢复同一冻结快照保持原y。明确切换公开版本后，本地计数从1重新分配；Windows各段限定0–65534。

本地唯一程序为 `TableMax-1.0.6.<y>-win-x64.exe`。包装器、内部程序文件版本、运行时身份、冻结快照和本地清单均绑定四位版本；内部payload目录按三位公开版本归类，具体快照隔离。未来获发布授权时，入口校验本地完整EXE的实际证明与哈希，再复制为三位公开附件名；审计保留本地四位版本、实际源码提交和字节映射。标签、公开基础版本和已发布附件不会因本地导出自动变化。

三个受管理PE的FileVersion及AssemblyVersion使用四位；Native的ProductVersion沿用csproj公开三位版本，稳定入口和helper的ProductVersion为四位。验收按各字段契约核对，不能因Native ProductVersion三位而误判版本不一致。

## 盒子与游戏的兼容目录（2026-10-12）

当前程序按游戏声明的SDK、模块协议、页面接口及 `requiredCapabilities`核验内部模块，兼容不依赖版本号大小。能力包使用模块协议8，原协议7包继续按其原能力边界恢复；当前支持SDK1、模块协议7／8、页面接口1，能力表见SDK的 `compatibility.mjs`。阿瓦隆声明并发密投、精确存档恢复和退役玩法能力，能力仅在实际实现后加入。

新局目录只来自本EXE验证后的预装映射，旧安装默认选择、在线签名目录和缓存不能覆盖。当前模块缺失／损坏只从本地签名载荷修复，失败保留数据并明确报错，不能回退旧包。历史签名目录、发行ID、内容寻址依赖和本机原版本仓库保持不可变，仅供按精确引用继续原局。

2026-10-12早期曾采用稳定 `games/catalog.json`及旧版本协议7兼容目录选择最新可安装发行；独立下载、目录刷新、`package:games --history=...`和Pages分发随后随完整EXE统一交付而退役。旧公开文件维持原发布事实，当前程序不访问它们选择新局。历史版本缺失、匹配不唯一或接口不兼容时保留存档并提示所需版本及相应旧完整EXE，不用最新规则或离线ZIP替代。

## 发布范围与版本

- 日常本地只导出预装全部正式游戏与玩法的完整EXE及本地清单；内部payload ZIP用于封装与验收。明确发布到GitHub时才导出源码ZIP并执行Release发布。
- 未获用户明确新版本指示时沿用当前版本号。同版本重新导出保留旧文字结论、实际包哈希和构建边界，新包单独验收。
- 本地打包、提交或推送均不等同GitHub发布授权。用户只要求更新流程或文案时，不执行线上发布、改标签或替换附件。
- 保护其他任务未提交／暂存内容。发布源码与运行输入必须一致，不能把未完成工作混入发布提交；共享工作区的隔离构建办法见[开发环境](development.md)。

## 本地交付

1. 明确本轮范围、版本和适用验收，完成相关专项检查；开发期间仅构建受影响单元，冻结运行源码与资源后再构建正式包。
2. 新安装器执行 `pnpm package:win -- --candidate`，该入口包含生产构建且保留当前交付。若本轮明确要求一次全量生产构建，先执行下列第一条命令，再用它返回的冻结清单执行第二条，避免重复编译：

   ```powershell
   node tools/build/build.mjs --production --full
   node tools/release/package.mjs --candidate --snapshot=<本轮冻结清单绝对路径>
   ```

3. 核对冻结暂存与内部payload完整成员及SHA，再按[实际安装门禁](#完整安装器与免费应用签名2026-10-15)验收同一候选。installer拒绝便携 `--extract-only`；系统安装后保留并核验的runtime副本仅供后续组件检查，不重复证明系统登记／升级。全部正式游戏与玩法、旧发行恢复、离线启动和退出按实际受影响范围验证，旧包证据不可改写为新包通过。
4. 核对完整EXE、内部载荷、实际安装与首次物化内容均严格小于120,000,000字节，工程预警110,000,000字节；完整程序、当前G、helper和框架卸载文件计入。内部模块仍执行自身预算与依赖闭包校验，不能以拆分载荷绕过完整交付门禁。用户存档与浏览器缓存不计入交付大小。
5. 记录候选、证据和未测事项；正式证明完成并获推广授权后才切换current并更新当前验收入口。测试窗口默认静音，包括游玩模式自动验证；专门试听显式开启。

本地运行交付为 `artifacts/releases/TableMax-<四位版本>-win-x64.exe`，对应本地清单及内部载荷位置由 `artifacts/package-payloads/v<三位版本>/current.json`绑定。组装遇进程占用时遵守门禁，占用解除后可用同一有效快照恢复；不得擅自结束用户日常程序。

## GitHub发布

### 游戏包发行（2026-10-11）

2026-10-11曾将代码、公共资源和玩法资源分别导出为内容寻址ZIP，通过签名目录、Pages下载和完整离线包安装；`package:games`、`verify:game-packages`等独立发行别名已撤除。该历史记录保留原签名发行、包哈希和当时验收，不提供现行操作指令。

当前 `package:win`内部仍按 `gameId/variantId`生成精确发行及依赖闭包，校验Ed25519签名、逐文件SHA和预算，收录进完整EXE的本地载荷。`web/details.json`由作者完整清单生成；浏览摘要、运行描述、网页清单与详情的职责见[工程结构](architecture.md#独立发行与公共契约2026-10-11)。签名私钥留在受保护的本地配置，不进程序或源码附件，历史签名发行ID和原包不重写。

以下是未来获得明确GitHub发布授权后的步骤，本轮不执行。

1. 确认 `pnpm package:win`生成的唯一完整EXE和内部载荷通过本地验收；`package:release`只重封当前载荷，不分配新修订号，也不代替同一EXE验收。
2. 复核current所绑定的实际正式安装证明与成功清理的隔离账户报告；`verify-shipping-executable.mjs`对installer要求真实隔离流程，不能使用便携提取或只设置隔离标志。历史便携current仍按原验证协议核验；参数入口见[发布工具](../../tools/release/README.md)。EXE字节改变后重新验收受影响项。
3. 整理源码、文档和更新说明，提交最终发布源码，核对冻结运行输入与已提交字节一致。新版本标签须指向发布提交并推送；已有同名标签或Release先核对现状，不强推或擅自替换历史。历史同版本发布保留实际源码／标签映射。
4. 使用 `pnpm release:github -- --publish --notes=<已审说明文件>`。入口核对当前完整EXE证明、远端标签和已提交运行输入，由最终提交生成source ZIP，并复制完整EXE为三位公开附件名；不传 `--devkit`或 `--pages-manifest`。`--replace-draft --draft-id=<已授权草稿ID>`仅用于明确指定且仍为草稿的Release，不能据旧授权操作当前正式Release。
5. 发布后核对线上标题、正文、标签、正式／预发布状态及两附件名称、数量、大小和SHA，保存本地发布记录并更新验收；保留失败，不把部分上传写成发布成功。

历史便携current的实际EXE证明位于 `artifacts/maintenance/v<公开版本>/windows-editions/<snapshot>/shipping-executable-checks-full.json`，历史名称和内部full标识继续兼容。正式installer证明由隔离账户流程输出并通过推广入口绑定candidate／current，同时关联原始账户清理报告及卸载后保留的精确runtime成员。读取实际记录中的路径，复核EXE、payload、安装清单、当前映射与证明SHA，不用目录名称推定通过。旧box、ZIP及helper报告只证明各自原构建与范围。

### 附件与运行事项

未来授权Release的手动附件仅有：

1. `TableMax-<三位版本>-win-x64.exe`：预装构建时全部正式游戏与玩法的完整程序，无类型后缀。
2. `TableMax-<三位版本>-source.zip`：仅明确发布时从该发布提交通过 `git archive`导出。

不新增盒子版、独立游戏包、Pages目录或作者安装工具包。审计JSON、内部payload ZIP、逐文件manifest、截图与过程报告仅留本地；GitHub自动源码下载不计入手动附件。历史已发布附件保留其原数量、名称、字节与源码映射，不因当前白名单变化而自动修改。

受管理安装使用I/TableMax.exe稳定入口与B=I/TableMax，运行资源B/app、模块G=B/games、数据D由B下配置指定且默认B；旧便携current仍在EXE旁新建TableMax。默认卸载保留D/G/config，不提供删数据选项；事务及未知文件保护、旧便携复制迁移和失败恢复见[构建与运行](build-and-run.md#windows-安装与整个程序更新)。存档、设置、日志和浏览器缓存不写入包内，目录不可写不回退C盘，目录更换重启生效。运行说明维护在项目文档，不重复放进更新正文。

## Release标题与更新正文

2026-10-07用户要求：标题和附件文字沿用 [v1.0.1](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.1)、[v1.0.2](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.2) 的简洁风格，正文只写更新内容，先总结，再用有序列表简述。

- 标题固定为 `TableMax v<版本>`，不追加宣传副标题；历史标题末尾空格不作为新格式要求。
- 首段一至两句概括本版最主要的变化。
- 下方采用 `1.`、`2.`、`3.` 的有序列表，每项用一句话说明一组用户可感知的新增、优化或修复；只写本版已经交付的变化。
- 不重复常驻功能，不列开发流水账、测试数量、构建路径、哈希、体积、安装步骤、附件说明或内部维护记录。不将计划或未完成事项写成已发布更新。
- 发布说明使用真实换行，上传通过 `--notes-file`，避免命令行转义破坏格式。既有v1.0.1／v1.0.2正文保留其历史记录；本次新格式用于后续发布。

格式示意（方括号内容在发布前替换）：

```markdown
TableMax v[版本] 本次更新重点完善[主要变化]，并优化[相关体验]。

1. [新增内容及用途。]
2. [界面或操作体验的变化。]
3. [重要修复及结果。]
```

## 收尾与保留

全部工程进程退出后，按[安全清理入口](development.md#清理本地中间物)先预览、核对再应用，退役过期组装、解压及验证副本，检查项目逻辑体积并记录实际结果。超过10GiB时目标8GiB或安全候选耗尽；本轮用户另有明确目标时按该目标审计，保护范围不扩大。

日常 `artifacts/releases/`仅保留当前已验证完整EXE及本地清单；内部payload ZIP、manifest及当前指针保存在 `artifacts/package-payloads/`，不对外导出运行ZIP。仅明确发布时生成source ZIP。读取器仍识别历史full／box格式；当前交付及验收证据、原素材、规则资料和正式存档继续保护，旧已发布EXE／ZIP／source／manifest按已有SHA保全要求退役，修复引用并保留必要结论。执行结果归[项目瘦身](project-slimming.md)，不在本页复制每轮过程。

## Agent入口迁入的执行约束

以下为原入口的有效约束，2026-10-13按主题迁入；不是新增产品要求。入口仅保留关键规则与阅读路由。

- 按2026-10-12最新版本要求，公开GitHub版本／标签和附件使用三位 `1.x.x`，本地维护交付使用四位 `1.x.x.y`。`package.json`保留三位，`build-version.json`原子维护本地修订；新一次导出完整EXE分配y，失败编号不复用，恢复冻结快照／重封原载荷不递增。公开版本只按用户明确指示调整。本地文件名使用四位，未来授权发布时复制为三位附件名并保留构建、提交和SHA映射；兼容不依赖版本号大小，按协议与能力声明校验，见[Release流程](release.md#三位公开版本与四位本地构建2026-10-12)。

- 按2026-10-12最新指示，现行程序只以完整EXE交付；未来获授权Release采用完整EXE和发布source ZIP，不新增独立游戏包、Pages分发或作者工具包。此前经用户明确授权，Pages已部署、v1.0.6已正式重新发布，公开文件及当时三附件核验通过；本轮不再次发布。普通提交／推送不自动授权或触发其他部署。保留旧标签并审计实际发布源码映射，私钥、审计JSON、内部载荷ZIP、截图和过程报告只留本地；发布核验源码、实际完整EXE、体积及附件白名单，历史内容寻址包保全，具体见Release流程。

- 没有用户明确新版本指示，沿用当前版本号，不递增、重置或改名。同版本包更新保留历史验收并核验实际交付包；长期知识合并到已有主题，重要选择保留理由，完成过程归档，进行中来源、缺口与接续集中在任务页，不为每次任务新建总结。

- 本地日常仅导出完整EXE和本地清单，内部payload ZIP及逐文件manifest留 `artifacts/package-payloads/`，不导出用户运行ZIP或源码包；仅在用户明确声明发布到GitHub时导出source ZIP。新包通过后按[release清理规则](development.md#清理本地中间物)让 `artifacts/releases/`只保留当前完整EXE与本地清单；旧已发布EXE／ZIP／source／manifest先逐文件SHA保全到独立历史证据，禁止直接丢弃。历史游戏离线ZIP保留原资料与验证用途，不再导出或提供程序导入。
