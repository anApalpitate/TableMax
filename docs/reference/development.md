# 开发环境与验证

2026-10-05 宝可梦人机／复用专项：`node scripts/verify-pokemon-original-compatibility.mjs --reference=1b3930cae9ffa66c480a26b69e4cbf6f6ac59827` 在固定随机源下比较重构前后的真实规则模块，覆盖 2–6 人完整小局／大局、合法动作、状态、计分及全部授权投影。未传 reference 时使用当前 HEAD，提交后复查本轮应显式传上述基线；只读取本地 Git，不联网。`node scripts/verify-pokemon-version.mjs` 用实际 BoxScreen 及样式检查三个端的只读版本面板和资源懒加载。源码策略固定种子统计、真实 Worker、最终 ZIP 与显示证据见当前验收；整局测试总时限与单次 Worker 两秒硬截止分开。原生 fixture 退出后再构建，避免占用 `build/desktop/TableMax.exe`。

当前 Windows x64 桌面为 C# WinForms／.NET Framework 4.8、共享 WebView2 与包内 Node；正式入口选择宝可梦奇遇、现代艺术或经典德国版电力公司，已有对局按存档恢复对应游戏。第一至六阶段已完成，独立原型仍用于合成状态审阅。使用流程见 [项目说明](../../README.md#开始对局)，最近交付包、实际验证范围和设备模拟边界见 [验收记录](acceptance.md)。

本页只维护当前运行、检查和本地维护方法；阶段结果、旧版本命令及 Electron 证据集中在 [开发与验证历史](../archive/development-2026-10-01-to-04.md)。工程依赖见 [工程结构](architecture.md)，文件归属见 [目录职责](project-structure.md)。

## 独立视觉审查截图

`pnpm verify:game-ui '--only=L6,V00,V00-discard,V03,V04,V05,V06,V07,V08' --evidence=independent-review --review-stages` 为每次提交前的公共屏及当前玩家手机保存带步骤编号的截图；手机另记录滚动到操作牌阵的帧，不覆盖同阶段多次接牌。`capturePage` 继续使用隐藏窗口；仅截图滚动，不修改服务状态。每轮使用新的 `--evidence` 名称，保留修正前后证据。

`pnpm verify:effects --evidence=independent-review-final` 将声画 fixture 截图及结果写入独立子目录，默认入口保持原样。自然对局与效果 fixture 的证明范围不可混用。审查者每图新建、`fork_turns: "none"`，只接收单张图片及中性提示；具体提示、审查边界和证据路由见 [游戏验证场景](../games/pokemon-encounters/validation-scenarios.md#当前界面的独立视觉审查)。

短手机返修加 `--compact-check`：真实手机视口固定为 360×640，在本地选择前及确认前等待有限卡牌动画结束后测量，断言六格牌面／号位、合法牌堆、确认／取消入口均在首屏且可点，不滚动到目标。`L6-mew` 补充六人梦幻：完整牌库排牌后执行原规则的六次首翻、取牌、最后对手第六格及己方第六格，核验五个对手入口；未把场景或全状态端点加入正式服务。公共尺寸和二人结果断言保留，截图与几何在断言前落盘。默认入口仍保留原横屏检查；短屏专项通过不能代替默认流程和最终 ZIP 显示矩阵。

能力 UI 补查可用 `--verify-deal` 检查真实下一小局的发牌动效，`--only` 用逗号选择场景，PowerShell 中为完整参数加引号。参数不命中已知场景时直接失败；卡面、能力 fixture、自然整局和最终 ZIP 的证明范围分别保留。

## 环境与依赖

Node.js 开发约束为 `>=22.14.0 <23`，`.node-version` 记录本次验证版本；pnpm 固定为 `10.12.1`。没有修改本机全局运行时或其他项目配置。依赖清单使用精确版本，`pnpm-lock.yaml` 锁定传递依赖；后续安装使用冻结锁文件。版本升级应作为单独改动验证。

当前桌面采用 C# WinForms／.NET Framework 4.8、共享 Evergreen WebView2 和包内 Node `22.14.0` x64；开发 .NET SDK `9.0.102` 固定在 `global.json`，WebView2 SDK `1.0.4258.31` 与编译引用程序集固定在原生项目及 `packages.lock.json`。Windows 11 内置兼容的 .NET Framework；开发和运行电脑需安装 WebView2 共享运行时，缺失时程序提供官方安装入口及取消。

网页／服务主要版本：React／React DOM `19.3.0`、Vite `8.3.1`、TypeScript `5.9.3`、Fastify `5.12.5`、Socket.IO 服务／客户端 `4.8.4`、Zod `4.6.5`、qrcode `1.5.4`、Vitest `5.0.3`、Playwright `1.63.0`。精确工具及类型版本见根目录与各工作区 `package.json`。Electron／electron-builder 已退出活动工程，旧交付与验收按日期保留。

SQLite 使用 `node:sqlite` 的 `DatabaseSync`，只封装打开、准备语句和事务等基础 API。Node 22.14.0 中该绑定标记为实验性，会打印 `ExperimentalWarning`；本工程不隐藏它。绑定收敛在 `apps/server/src/database.ts`，应用不依赖该细节，后续升级需复验。发布的官方 Node 内含 SQLite 3.47.2，无额外 npm 原生绑定；旧 Electron SQLite 存档兼容证据见 [迁移验收](acceptance.md#100原生桌面与小体积交付2026-10-03)。

## 初次配置

在项目根目录使用 PowerShell：

```powershell
node --version
pnpm --version
dotnet --version
pnpm install --frozen-lockfile
pnpm setup:desktop
pnpm check
pnpm build
pnpm verify:desktop
```

开发安装需要联网下载 npm 包、官方 Node x64 ZIP 和锁定 NuGet 包。`setup:desktop` 按官方 SHA-256 验证 Node 下载及缓存，并对 NuGet 包校验 SHA-512 后锁定还原；缓存写入仓库 `.cache/node`、`.cache/nuget` 与 `.cache/dotnet-home`。编译引用程序集只用于开发，不进入发布包。pnpm 仅允许 esbuild 安装脚本。开发电脑使用已有 SDK 9.0.102，命令不修改全局工具或共享运行时；WebView2 缺失时按官方入口安装。

VS Code 工作区启用保存时格式化，使用 `esbenp.prettier-vscode`；本机需已安装该扩展或手动安装。项目命令不依赖扩展，执行时使用项目固定的 Prettier。格式检查覆盖代码与配置，保留需求原件与现有文档排版，不对其批量重排。

`.editorconfig` 与 `.gitattributes` 统一文本 UTF-8／LF 习惯，Git 自动识别二进制资源，不按扩展名笼统改变资源内容。类型检查和规则验证的匹配范围包含未来 `games/` 源码，但不因此创建空游戏工程。

## 真实命令

宝可梦 2026-10-05 声画／手机专项：`node scripts/verify-pokemon-polish.mjs --evidence=名称` 用真实 PokemonScreen 与合法规则状态检查 320–430px、横屏、顶栏及选位栏；`node scripts/verify-pokemon-audio.mjs --evidence=名称` 在隐藏 WebView2 检查八音源解码、固定双槽、保存事件映射和硬币落定同步。后者 fixture 的播放权限桥接只证明表现层，实际公共屏优先与交接由 `pnpm verify:experience --portable` 核验。既有 `pnpm verify:effects --evidence=名称` 已扩展能力短全屏、局部路径、共同赢家、减少动态及私看边界。三种专项都不能代替最终 ZIP、真实网络或人耳试听。

| 命令                                                        | 行为                                                                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                  | 先构建，启动 Vite、原生壳与包内 Node 独立服务；前端热更新，服务与桌面源码修改后重启该命令                                                                 |
| `pnpm start`                                                | 运行已有 `build/desktop`；先执行 `pnpm build`                                                                                                             |
| `pnpm typecheck`                                            | 严格 TypeScript 检查，不生成文件                                                                                                                          |
| `pnpm lint`                                                 | ESLint 与 React Hooks 规则检查                                                                                                                            |
| `pnpm format:check` / `pnpm format`                         | 检查格式／按项目配置格式化                                                                                                                                |
| `pnpm test`                                                 | Vitest 执行核心、真实 Socket.IO、SQLite、强制终止恢复及 Worker 验证                                                                                       |
| `pnpm check`                                                | 顺序执行类型、静态、格式检查与当前测试                                                                                                                    |
| `pnpm build`                                                | 构建网页、独立服务、游戏模块与 net48 原生壳，收集到 `build/desktop`                                                                                       |
| `pnpm verify:desktop`                                       | 隐藏窗口验证开发构建，包括真实大厅、宝可梦六人混合整局、回退、两次启动恢复、独立进程与退出协调                                                            |
| `pnpm verify:modern-art`                                    | 隐藏原生窗口执行现代艺术五席四轮、五类拍卖与真实手机控件，验证保密、回退／重启及两游戏切换；加 `--portable` 验证最终 ZIP                                  |
| `pnpm verify:power-grid --seats=3 --evidence=source-3`      | 隐藏原生桌面与各自手机、真实 Worker 的电力公司混合整局；`--seats=6` 覆盖六席，`--portable` 验最终同一 ZIP                                                 |
| `pnpm verify:power-grid-ui --evidence=fixture`              | 独立实际 React 授权 fixture 的短屏至 4K、320–390 手机、地图操作与保存声音；不替代原生 DPI 或真实整局                                                      |
| `pnpm verify:party`                                         | 隐藏窗口验证加入丢回复、真实重启、网卡 IPv4、弱网恢复、原班续局、回退定位和桌面运行保障；可加 `--portable` 验证当前 ZIP                                   |
| `pnpm verify:room-levels`                                   | 隐藏窗口验证手机各自入座、电脑仅管理／展示、六席围桌尺寸与三档人机配置、实际混合小局／续局／重启；可加 `--portable` 验证当前 ZIP                          |
| `node scripts/verify-box-avatars.mjs`                       | 隐藏窗口核验 26 个本地头像、占用／并发／身份恢复与游戏介绍尺寸；先用 `--compact-only` 检查 360×640 首屏，`--portable` 对应最终 ZIP，`--run=名称` 分开证据 |
| `pnpm verify:presentation`                                  | 隐藏窗口验证六真人、游玩／测试时序、浮窗焦点／结束、公开行动及星标；可加 `--portable` 验证当前 ZIP                                                        |
| `pnpm verify:display`                                       | 隐藏窗口验证电脑 720p／1080p／1440p／4K、独立缩放、显示浮窗、设置恢复与 DPI；可加 `--portable` 验证最终 ZIP，`--box-debug` 独立保存本次盒子证据           |
| `node scripts/verify-box-debug.mjs`                         | 回环服务、隐藏真实 WebView2 检查上传裁剪、房主座位操作、原子切换、三游戏头像、320–390px 手机与电脑设置；`--run=名称` 分开证据，`--portable` 检查最终 ZIP  |
| `pnpm verify:experience`                                    | 隐藏窗口验证游戏库按需加载、管理员指定手机房主、并发初始翻牌和准备、连接／显示控件及声音归属；可加 `--portable` 验证当前 ZIP                              |
| `pnpm verify:effects`                                       | 后台 WebView2 用实际游戏组件和授权投影 fixture 验证主题、同币面、暗牌交换、零分列、共同赢家和减少动态；不冒充自然对局                                     |
| `pnpm verify:memory`                                        | 独立 Node 比较存档复制开销，再用后台 WebView2 执行 20 轮游戏切换的 heap／DOM 回归；可加 `--copy-only` 或 `--desktop-only`                                 |
| `node scripts/verify-native-safety.mjs --evidence=<独立名>` | 检查桥接拒绝、重复启动、缺运行时、生产 CDP 关闭及服务／父进程崩溃清理                                                                                     |
| `pnpm verify:game-ui`                                       | 正式能力／2–6 人保存 fixture 的十五组 UI、多尺寸触控／隐私、已保存动效和声音                                                                              |
| `pnpm verify:cards`                                         | 正式六人保存状态的全部 16 类卡面及公共／手机十三种布局、图像／文字／分区几何                                                                              |
| `pnpm package:win`                                          | 构建 Windows x64 运行 ZIP 和逐文件清单；解压目录只作打包验证，本地不导出源码包                                                                            |
| `pnpm verify:portable`                                      | 将最终 ZIP 解压到新的项目临时目录，对其中的 `TableMax.exe` 运行同一跨层验证，子进程 PATH 不含 Node／开发工具目录                                          |
| `pnpm prototype:dev`                                        | 启动独立原型开发服务，入口 `http://127.0.0.1:5174/prototype.html`，不启动正式桌面或本地服务                                                               |
| `pnpm prototype:build`                                      | 使用独立 Vite 配置构建原型到 `artifacts/phase-02/prototype/`                                                                                              |
| `pnpm prototype:preview`                                    | 预览已有原型构建，入口 `http://127.0.0.1:4174/prototype.html`；先执行原型构建                                                                             |
| `pnpm prototype:verify:game`                                | 对游戏原型执行 Playwright／后台 WebView2 能力、角色、恢复、尺寸和动效走查，证据在 `artifacts/phase-02/verification/game/`                                 |
| `pnpm prototype:verify`                                     | 对已有原型构建运行 Playwright／后台 WebView2 走查，生成 JSON 和截图；先执行原型与桌面构建                                                                 |

服务 CJS 构建使用 esbuild `minify` 进行生产压缩；规则和策略 CJS 使用 `minifyWhitespace`，源码及规则／状态／策略版本保留，`bot-worker.cjs` 保持原构建选项。该构建配置不改变游戏规则，也不以源码或预估字节代替最终 ZIP／实际解压双体积核验；当前包与清理结果见验收记录。

当前便携包和使用流程见 [项目说明](../../README.md#开始对局)。旧工程验证包与阶段结果见开发归档。

现代艺术自然对局深查可加 `--audit --long-names --seats=5 --evidence=audit-run`，全程保留普通 `play` 节奏；`--seats=3`／`4` 覆盖其他人数，`--portable` 改验当前 ZIP。审计在原有五类拍卖、真实手机控件与恢复断言之外，增加窄屏长昵称、非法金额、暗标并发草稿、旧价确认、排序、倒计时和公开资金账本检查。真实结束页覆盖 720p／1080p／4K 主机与公共屏、320／360 手机，逐字核验完整姓名的布局、裁切与实际命中，不能只凭 DOM 或 title 完整判定可读；最终资产／冠军对应公开账本，有管理权限的主机／手机房主再玩按钮须在首屏完整可用，公共屏则核验没有该控制。每次启动保存实际脚本副本与 SHA-256，失败和返修分开证据目录；截图仍使用后台真实渲染，不将测试提速当作普通对局。

`node scripts/verify-modern-art-empty-gallery.mjs --evidence=empty-gallery-run` 定向检查三／四／五位真人入座后的空收藏拍卖布局，使用真实开局、出画、追加同画家第二幅及决策点回退；不直接写游戏状态。单幅／双幅、主机／公共屏分别覆盖 720p／1080p／4K 和 100%／125%／150% 显示请求，记录空间保护后的实际 CSS 尺寸与缩放；加 `--portable` 验证当前 ZIP。先用 `--short-only` 检查最短桌面，`--scale-only` 仅补 4K 125%／150%，两者互斥，默认运行完整矩阵。它只证明这些真实准备场景的排版，不能替代自然四轮整局、资金账本或恢复验证。

`node scripts/verify-modern-art-debug.mjs --seats=5 --run=debug-run` 使用合法隔离示例局检查现代艺术选画无倒计时、行情文字、纵向两列画廊、规则四图及关闭焦点恢复，模拟其他手机两次加价并核验原金额控件、草稿和焦点保留。`--seats=4` 检查四人，`--portable` 检查当前实际解压 ZIP；源运行加 `--capture-rules` 保存四个实际区域 PNG，随后用 `python scripts/compress-modern-art-rule-captures.py` 生成并逐像素核验无损 WebP，保留原 PNG。更新配图后同步游戏资源清单与图文卡片，再构建和验收。

`node scripts/verify-modern-art-audio.mjs --evidence=audio-run` 检查真实桌面归属、盒子重进、手机手势解锁、刷新不补播、独立静音及 WAV 解码／媒体播放。`--entrances-only` 专查五种实际上拍的声音、全屏特效、刷新、测试及减少动态；`--reentry-only` 只验重进，`--portable` 改验当前 ZIP。每次选择新的安全证据名，源与便携结果在 `artifacts/maintenance/v1.0.2/modern-art-debug-20261004/audio/` 分开；播放观测不等于实体手机自动播放政策或真人试听认证。以上本机检查全部显式监听回环并隔离存档。

电力公司原接入验证在 `artifacts/maintenance/v1.0.1/power-grid/` 分别保存 `ui/` 的组件 fixture 与 `runtime/` 的自然混合局、恢复和最终便携证据。整局测试可采用平台测试节奏，但每个动作仍经过身份、合法动作、SQLite 与真实 Worker；普通游玩节奏另取真实保存动作样本，不能将提速局写成全程普通节奏。SQLite 审计在隔离数据上逐 checkpoint／随机源重放，核对电厂分区、燃料和资金，公开报告不导出隐藏现金或牌堆。所有本机启动显式使用 127.0.0.1 与随机端口。新工作区包加入后执行冻结锁文件离线安装以建立本地依赖链接，仅更新 lockfile 不足以保证 React 构建解析。

`node scripts/verify-power-grid-audio.mjs --portable --maintenance=power-grid-debug-20261004 --evidence=<独立名>` 在真实隐藏原生 WebView2 与包内运行时检查六种保存结果。准备器只从本游戏合法规则和两真人对局取得隔离 checkpoint，真实 Socket 动作写入 SQLite 后检查原生 `claimEvent` 单一归属、原 `HTMLMediaElement.play` 返回与 `onplaying`、WAV 解码及有限 FX 帧；不伪造反馈或直接调用音效冒充保存。还核验公共屏优先／主机回退、普通同步、刷新、盒子重进、暂停恢复、静音与测试模式不补播。省略 `--portable` 使用当前构建；`--prepare-only` 只预检合法素材和 checkpoint，不能写成原生播放通过。结果在 `artifacts/maintenance/v1.0.2/<维护名>/native-audio/<名称>/`，真实媒体观察不等于实体手机自动播放政策、人耳或扬声器试听认证。

Vitest 的测试文件并发限制为 4：完整种子局增加后，无界 CPU 并发曾使既有 Socket 和宝可梦整局测试超过原来的 5 秒期限。保留原超时与断言，限制本项目测试并发；不提高测试超时掩盖故障，也不修改全局工具环境。

## 图文规则维护与验证

三款游戏均已采用原创图解：现代艺术九张逻辑场景，电力公司六组代码图解与两项透明插画，宝可梦九张主题场景与八章代码图解。准确规则文字、数字和箭头由代码排版；旧截图捕获命令仅用于历史 UI 证据，不再生产当前规则配图。新素材提示词、原图、导出参数与哈希见各游戏资源清单，[任务索引](../tasks/README.md#原创规则图解重做已完成)保存完成入口；原素材与规则参考资料保留，maintenance 中历史运行截图按下述手动全量退役入口清理。

`node scripts/verify-modern-art-polish-v2.mjs --evidence=<独立名>` 核验三／四／五人的市场拆分、五种拍卖、密集收藏、合法双拍描边、减少动态、三端字号／滚动／规则图和桌面密度；`--representative` 先查三人短屏及短手机，`--diagnostic` 仅取短屏密集收藏几何信息。加 `--portable` 检查实际当前 ZIP、逐文件清单和包内运行时。证据留在 `artifacts/maintenance/v1.0.2/modern-art-polish-20261005/ui-v2/`。

`node scripts/verify-modern-art-audio.mjs --timer-only --evidence=<独立名>` 检查时间到只响一次、暂停冻结、静音消费、刷新不补播及到时后合法报价，沿用真实媒体观察和原生声音归属；加 `--portable` 验最终运行包。`node scripts/verify-fullscreen.mjs --run=<独立名>` 检查真实原生按钮、F11／菜单／Escape、窗口恢复及两窗口独立；`--foreground` 补充普通前台边框／任务栏，仍只在隔离测试模式运行。`--executable=<绝对路径>` 可指定实际解压程序。测试服务仅监听 `127.0.0.1`，媒体观察与密度模拟不等于实体手机、人耳试听或物理多显示器认证。

三款游戏均可按需打开规则顶层卡片，教学不自动触发；设计、截图权限与维护要求见 [通用视觉](visual-design.md#顶层图文规则说明)，具体规则依据和区域说明分别维护在游戏主题。本节列运行方法，命令存在不表示已通过，实际源／便携结论与包哈希从验收记录查询。

宝可梦专项用 `node scripts/verify-rules-guides.mjs --game=pokemon-encounters --maintenance=pokemon-rules-redesign-20261005 --evidence=<独立名>`，加 `--portable` 检查最终同哈希 ZIP。九图实际解码、八章逐项导航、准确六格／百变怪／共同赢家图例、三端 9 组合与 320px 减少动态均被核验，首次短手机及 720p 保存九种场景真实渲染。只改图文 UI 的任务不机械重跑未变的人机整局；规则图例单测使用真实计分模块，不能把原图预览当作运行验收。

`node scripts/verify-rules-guides.mjs --evidence=rules-source-run` 使用真实隐藏原生 WebView2、隔离合法规则示例和独立手机身份，检查三款游戏的 host／public／player 在三种对应尺寸下共 27 个规则浮层：图片实际解码、文字下限、44px 目标、章节导航、关闭／Escape 后焦点恢复，以及查看规则不改变 revision 或身份。`--game=power-grid` 等可限定单个游戏的 9 组合；默认 `--game=all`。加 `--portable` 解压当前最终 ZIP，用包内 Node 与原生程序运行同一检查；每次选择独立的安全证据名。`--maintenance=<安全名称>` 可分开本次证据，默认仍为 `shared-visual-20261004`；证据在 `artifacts/maintenance/v1.0.2/<维护名>/rules/<名称>/`。本机服务显式监听 `127.0.0.1`。这是本机真实运行与手机尺寸／触控模拟，不是实体手机、Safari、电视或现场网络认证。

更新配图先源后包：

```powershell
# 宝可梦三个实际区域；capture-rules 不允许同时使用 --portable
node scripts/verify-rules-guides.mjs --capture-rules --evidence=capture-regions

# 电力公司五个实际区域的独立组件渲染；每轮采用新证据名
node scripts/verify-power-grid-ui.mjs --maintenance=power-grid-debug-20261004 --capture-rules-only --evidence=rule-capture-run

# 三游戏 PNG→WebP，无损并逐像素核验；按需加 --game=power-grid 等限定
python scripts/compress-rule-captures.py --report=artifacts/maintenance/v1.0.2/shared-visual-20261004/rules-compression.json
```

旧规则截图及原 PNG 保留在各游戏 `assets/games/<id>/rules/`，历史无损 WebP 继续保留对应像素核验记录；现代艺术当前入口仅加载 `rules/illustrations-v2/` 的九图，宝可梦仅加载 `rules/illustrations-v1/` 九图。原创场景与真实 UI 验收截图分别记录，不能把生成图标为真实渲染。新图 WebP 为有损导出，记录实际质量和哈希，不标成与原 PNG 像素相同。源图／组件检查不替代最终同 ZIP 规则浮层检查。电力公司视觉专项仍用 `pnpm verify:power-grid-ui --maintenance=<安全名称> --evidence=<独立名>`，`--map-only` 定向核验横向地图的 42 个正向城市、83 边、坐标转换和键盘／指针；完整矩阵另核验阶段顺序、竞拍草稿、价区及容量。`node scripts/verify-power-grid.mjs --seats=6 --display --evidence=<独立名>` 走真实混合局／恢复／三游戏切换，保存五阶段 host／public 游玩图与手机操作前后帧，并在三端投影上核对实际顺序、价区和同步时的报价控件。加 `--portable` 验同一最终 ZIP，不能将组件 fixture 写成完整对局证据。

## 独立原型的运行与检查

初次安装沿用上节冻结依赖和 `pnpm setup:desktop`；仅浏览器开发／预览不需要启动桌面壳，自动走查需要已构建原生壳及共享 WebView2。在项目根目录执行：

```powershell
pnpm prototype:dev
```

按需在浏览器打开开发入口，结束时按 Ctrl+C。对构建产物走查时执行：

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm prototype:build
pnpm prototype:verify
pnpm prototype:verify:game
```

`pnpm prototype:verify` 不自动构建，也不依赖正在运行的 4174 预览；脚本自行启动随机回环端口的 Vite 预览与后台 WebView2，并在结束时关闭。人工审阅已有构建可执行 `pnpm prototype:preview`。5174／4174 均只监听 `127.0.0.1`，端口占用时停止，配置不会静默换端口；这两个地址不是局域网手机接入入口。

原型唯一入口由 `apps/web/vite.prototype.config.ts` 指定，正式构建由 `apps/web/vite.config.ts` 指定。原型不代理 `/api` 或 `/socket.io`，不使用真实身份、网络连接、存档或游戏状态。审阅工具可切换角色／页面、模拟提交与异常，刷新重置示例；页面中的网卡、连接和恢复反馈不是实际系统检测。

原型源码变更按上列命令检查；若影响正式构建边界，再验证 `pnpm build` 的隔离。仅文档变更检查来源引用、相对链接、索引、命令与配置一致性及 diff，不重复无关构建或便携打包。

## 按改动范围选择验证

| 改动范围             | 适用检查与证据                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档、索引或目录说明 | 相对链接与锚点、正文归属、命令／配置一致性、改动文件的 Prettier 格式及 `git diff --check`。`docs/` 默认被格式命令忽略，需要格式化改动页时对明确路径使用 `pnpm exec prettier --check --ignore-path .gitignore <文件路径>`，将 `--check` 改为 `--write` 可格式化。 |
| 独立原型源码         | 类型、静态、格式与独立构建，再执行受影响的通用／游戏走查；`pnpm prototype:verify:game --layout-only` 仅补查布局，不能替代流程走查。                                                                                                                              |
| 正式平台与共享契约   | `pnpm check` 与 `pnpm build`，按行为补真实服务、授权及恢复测试；影响桌面生命周期时执行 `pnpm verify:desktop`。                                                                                                                                                   |
| 正式游戏、计分或策略 | 接入后执行游戏规则、投影、人机和恢复测试，覆盖 [游戏场景](../games/pokemon-encounters/validation-scenarios.md) 的适用项；pnpm check 包含首版规则／策略／D01–D13／真实崩溃测试；pnpm verify:game-ui 运行能力 UI fixture。                                         |
| 正式便携交付         | pnpm package:win 和 pnpm verify:portable；当前用户授权设备模拟范围和证据见验收记录。                                                                                                                                                                             |

新报告只声明本次执行的范围。历史证据保留对应构建、日期与限制，不因更新说明或局部补查而改成完整产品验收。

## 当前维护验证

先执行适用的工程检查，再按改动选专项；命令存在不代表已通过。使用 `verificationOutput` 的入口按根目录 `package.json` 写入 `artifacts/maintenance/v<版本>/`，当前为 `v1.0.3`；电力公司 UI 与三端规则检查也使用此入口，旧证据位置保留。部分游戏专项仍有自己的维护子目录，以脚本参数和实际报告为准。每次选择新的证据名，保留失败、返修和历史记录。最终便携通过必须对应实际执行的 ZIP 哈希，不能由开发构建推定；已通过且未受影响的功能不机械重跑。

短屏布局返修可先运行 `pnpm verify:display --paused-720p-only`，只在真实六手机开局并暂停后检查主机 1280×720 首屏，证据进入当前版本的 `display/paused-720p`。该入口用于固定失败场景，不能替代完整显示矩阵或最终 ZIP 验证。

### 游戏库、并发与内存

游戏元数据与加载器分别维护在服务注册表和 `apps/web/src/game-clients/registry.ts`；`pnpm verify:experience` 覆盖按需加载、手机房主与并发操作。盒子只需要目录信息与缩略图，进入 `/game` 后加载对应客户端、样式和资源。服务按选择或存档 manifest 加载规则，Worker 按任务加载策略；规则／策略 CJS 与前端分块一起本地打包。已加载模块可在进程内复用，回盒子卸载游戏界面不等于清除 JavaScript 模块缓存。内部 `template` 用于切换、容量及策略兼容验证，不作为正式产品游戏。

`pnpm verify:memory` 从当前源码提取 `copySave`，与脚本指定历史 Git 基线的整份 `structuredClone` 在独立 `--expose-gc` Node 进程比较；可用 `--baseline-ref=<Git修订>` 指定另一份确实包含旧复制方式的基线。六席／1,200 checkpoint／1,200 receipt fixture 由合法六席快照扩展并经生产存档校验，不宣称实际游玩了 1,200 步。随后用实际后台 WebView2 连续执行 20 轮开始、结束、回盒子及重新选择同游戏，记录 GC 后 renderer heap、DOM、监听器和本应用进程内存。结果在对应版本的 `memory/results.json`，临时数据在 `tmp/runtime-memory-*`。`--copy-only` 不启动桌面，`--desktop-only` 保留已有复制测量并追加桌面结果，后者需先构建；不同运行时的绝对工作集不能直接比较为游戏优化收益。

内存结果只说明测量配置下的复制分配、耗时和导航回归；并行工程负载可能影响耗时与工作集，不使用整台电脑 RAM 评价本应用。当前按字段复制仍保留全部有效回退历史，完整存档序列化和历史体积仍随对局增长，不能写成长期有界内存。磁盘阈值维护使用清理工具，与运行时 RAM 分开。

### 聚会可靠性

`pnpm verify:party` 使用隔离数据、后台 WebView2 和实际本机网卡 IPv4（监听 `0.0.0.0`），覆盖网卡名称／刷新／选择保持、加入回复丢失与同请求确认重试、刷新／真实程序重启后确认、250ms 延迟和带宽限制、断网／冻结恢复、回退上下文、原班第二大局、重复启动、公共屏保留时恢复管理员窗口及真实端口占用错误；并确认已删除的兑换接口拒绝请求。启动前执行 `pnpm build`，加 `--portable` 新目录解压当前 ZIP、仅系统 PATH 运行，证据独立进入 `party-portable`。它不修改防火墙、路由器或默认玩家存档；本机网卡可达不证明真实手机或实际 Wi-Fi 通过。网络范围按下文 [Node 运行与防火墙规则](#node-运行与防火墙规则) 执行。

普通便携启动保持端口 38473，占用时停止并展示具体原因。手机身份仅在原浏览器源恢复，地址或端口变化后的新源不能自动沿用；换手机／绑定码已删除，确需重新入座时由管理员处理旧座位。服务运行期间防自动休眠，公共屏可见时保持亮屏，退出恢复系统电源行为；手动休眠或关机仍可能中断服务。身份和房主边界见 [通用平台规格](phase-02-platform-spec.md)。

原生 Alt → 程序菜单提供“打开房主管理”“打开日志目录”。`LOCALAPPDATA/TableMax/logs/desktop.log` 保存启动失败原因，`service.log` 保存服务生命周期。损坏／不兼容存档保持原文件，排障前备份 `room.sqlite` 及 WAL／SHM。

### 手机围桌与等级

`pnpm verify:room-levels` 使用真实桌面／独立服务和本地 Worker，手机采用独立 Chromium partition、触控视口和普通二维码加入 URL。实际 UI 添加三档人机、调整等级、由各手机准备和行动，检查 host／public 不占座且无游戏动作或私牌；尺寸矩阵检查席位、名字、按钮与横向溢出并保存实际隐藏帧。真实混合小局后原班续局，再重启确认身份及等级保留；加 `--portable` 对当前 ZIP 新目录解压、仅系统 PATH 运行同一检查。结果仍限于 Windows 和 Chromium 模拟，不证明 Safari、真实手机／Wi-Fi／电视通过。

### 游玩节奏与显示

正常启动采用游玩模式；房主在盒子或游戏页按 `Ctrl+Shift+F12` 打开隐藏运行模式窗口。测试模式沿用权威动作、持久化和恢复链路，只加速人机并省略动效／声音。桌面 `--tablemax-test-mode` 显式选择测试，`--tablemax-play-mode` 显式选择游玩；隐藏验证的 `--foundation-test` 默认测试，验证生产节奏时同时加 `--tablemax-play-mode`，不能把隐藏启动写成可见普通启动实测。

`pnpm verify:presentation` 验证六真人自然小局、浮窗焦点／确认、星标和公开行动、保存动画／音频调用，以及真实 Worker 在两模式的时序和取消。`pnpm verify:game-ui` 使用正式能力／2–6 人保存 fixture；`pnpm verify:cards` 直接用正式六人保存状态渲染全部 16 类卡面并检查图像、文字和分区，组件或 fixture 通过不能替代完整对局。

`pnpm verify:display` 覆盖电脑 720p／1080p／1440p／4K、100%／125%／150% 显示请求、主机与公共屏独立缩放、浮窗及设置恢复，手机无电脑显示设置。当前原生几何与 DPI 口径见 [原生桌面后台验证](#原生桌面后台验证)，行为见 [电脑显示规格](phase-02-platform-spec.md#电脑多分辨率显示150)。显示偏好在数据目录 `display-settings.json`，与 `room.sqlite` 分开；损坏时采用自动适配，写入失败提示且不改变已保存偏好。`--portable` 必须检查最终 ZIP，历史 Electron 显示证据保留原运行时边界。

## 配置、目录与网络

正式程序默认监听 `0.0.0.0:38473`。管理窗口使用 `127.0.0.1`，手机二维码使用用户在地址列表选择的本机 IPv4。多个地址可能包含虚拟网卡，用户需选择手机可访问的地址。端口占用时停止并提示，不静默改用其他端口。

开发 Vite 使用 `127.0.0.1:5173`，把 `/api`、`/socket.io` 转发到默认服务端口。正式运行仅由 Fastify 提供构建后的网页，不使用 Vite。开发模式的服务端口保持默认值；修改服务端口时需同步 Vite 代理。

| 内容                 | 位置／策略                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 默认本地数据         | 系统 `LOCALAPPDATA` 下的 `TableMax/`，不写入程序包或仓库                                                                               |
| 工程验证数据库       | 数据目录 `foundation.sqlite` 与 SQLite WAL／SHM；仅保留工程启动计数，正式平台另用 room.sqlite                                          |
| 正式平台存档         | 数据目录 `room.sqlite` 与 WAL／SHM；最新记录与修订 journal，包含秘密状态，禁止公开                                                     |
| 服务日志             | 数据目录 `logs/service.log`，只记录服务启动／停止事件，不记录验证消息或秘密状态                                                        |
| WebView2 浏览器数据  | 数据目录 `desktop/webview2/`，包含网页会话与缓存；旧 Electron 缓存保留，手机原浏览器身份及 room.sqlite 继续沿用                        |
| pnpm、下载与工具缓存 | 仓库 `.pnpm-store/`、`.cache/`；Git 忽略，工作区隐藏与排除监听                                                                         |
| 可再生构建           | 仓库 `build/`，Git 忽略，工作区隐藏                                                                                                    |
| 便携包与验证图／JSON | artifacts/releases 与 artifacts/maintenance/v<版本> 或专项维护目录；历史归属与哈希见验收记录；Git 忽略，文件树可见，搜索与监听单独排除 |
| 原型构建             | 仓库 `artifacts/phase-02/prototype/`，独立于 `build/desktop/web/`                                                                      |
| 原型截图与走查 JSON  | 仓库 `artifacts/phase-02/verification/`，Git 忽略但文件树可见；每次走查更新对应证据                                                    |
| 美术原图与前后对比   | 仓库 `artifacts/phase-02/art-reset/`；保留 imagegen 原始 PNG、透明通道／尺寸／哈希检查、联系表及同尺寸前后截图和文字测量               |
| 第二阶段检索原始响应 | 仓库 `artifacts/phase-02/research/`，清单记录 URL、HTTP 状态、字节数与 SHA-256；不是已核验规则书                                       |
| 原型走查临时入口     | 仓库 `tmp/prototype-verify-*`，与正式服务、数据库和用户默认存档分离                                                                    |
| 跨层验证临时数据     | 仓库 `tmp/desktop-verify-*`、`tmp/portable-extracted-*` 及命令入口验证目录，使用显式测试数据目录覆盖；不会读写用户默认存档             |
| 单元测试数据库样本   | 系统临时目录 `tablemax-*`，与正式数据分离                                                                                              |

仅支持开发／验证覆盖的环境变量：`TABLEMAX_DATA_DIR` 指定数据位置，`TABLEMAX_HOST` 指定监听地址，`TABLEMAX_PORT` 指定端口（0 仅用于验证临时端口）。`TABLEMAX_WEB_DEV_URL` 只用于仓库中的已标记开发构建，便携包忽略它。原生壳清除继承的 WebView2 调试／缓存覆盖以及 Node 加载覆盖，正式程序不开放 CDP。不要将含秘密的本地配置纳入 Git。

不兼容的旧模板存档保留原文件；需要新开时先备份，再在 PowerShell 用 `$env:TABLEMAX_DATA_DIR` 指定明确的新隔离目录，普通运行仍使用默认 `LOCALAPPDATA/TableMax`。不通过覆盖旧存档来消除错误。

没有自动修改防火墙、路由器或系统服务。手机连接还受私人网络防火墙、访客网络隔离和选错网卡影响。当前完成实际本地服务和禁止外部请求的完整混合局；手机／电视按用户授权模拟，不声称实际系统浏览器或外接硬件已测。

### Node 运行与防火墙规则

用户 2026-10-04 要求减少反复手动允许 Node 访问网络，后续运行、验证及脚本维护按以下规则执行。本节是执行约定，不代表已经配置系统防火墙或改造全部验证脚本。

- **启动前确定网络范围**：区分本机截图／UI／规则／恢复验证与局域网可达性验证，核对实际 Node 路径、监听地址和端口。普通 Node 命令执行不等于需要网络放行；Windows 防火墙提示与工具执行审批、管理员提权分别处理。
- **本机检查默认回环**：启动服务时显式设置 `TABLEMAX_HOST=127.0.0.1`，隔离存档与浏览器数据，验证可用 `TABLEMAX_PORT=0`；其他预览或辅助服务器也只绑定回环。电脑和手机模拟页面均可访问回环服务，不能仅因模拟手机尺寸就监听 `0.0.0.0`。已满足要求的入口不重复改造。
- **仅局域网验收开放网卡**：实际网卡 IPv4、手机连接、二维码地址或网络故障场景确需验证时，才监听 `0.0.0.0`／指定网卡，记录目的、Node 路径、端口与证据。现有 `verify:party` 包含实际网卡验证，不能改为回环后仍声称该场景通过；随机端口验证不得冒用正式端口的放行结论。
- **日常运行保持路径稳定**：开发使用固定构建入口，正式游玩从固定便携目录启动，更新沿用该目录并保留规定的历史包与证据。避免从每次随机解压的位置启动日常局域网服务。便携包隔离解压与验证仍使用该包自己的 Node，不能借用外部运行时替代包内验证，或复用正式存档来减少提示。
- **一次配置必要的入站规则**：用户明确授权修改系统防火墙后，使用 `wf.msc` 的自定义入站规则，指定实际 `node.exe` 完整路径、TCP 和实际监听端口；正式端口为 `38473`，仅适用“专用”配置文件，远程地址限制为“本地子网”。可信家庭／聚会网络可由用户设为专用；不自动把未知网络改为专用。路径或验收端口变化时先核对现有规则，再按授权更新，避免为每个临时副本新增永久规则。
- **提示重复先定位**：比较本次 Node 完整路径、活动网络配置文件、监听端口以及匹配的允许／阻止规则；曾拒绝提示留下的阻止规则也需核对，不以不断点击允许或重复新增规则代替诊断。不要关闭防火墙、全局放行 Node、公用网络或所有端口；仅关闭通知不能解决手机入站连接。网络测试确实受阻时说明未通过范围，不伪报通过。
- **保留系统与产品边界**：规则文档更新不自动授权修改系统设置。普通游戏仍按既有默认监听提供手机联机；本机验证的回环覆盖不改变正式产品行为。临时系统规则如获授权创建，完成后按约定撤销，保留原有规则和用户设置。

Windows 程序规则按完整可执行文件路径匹配；专用网络和本地子网范围依据 [Microsoft：Windows 防火墙规则](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules)。稳定路径可减少重复授权，但不能保证消除网络配置变化或既有阻止规则造成的提示。

## 便携包体积与共享运行时

新增游戏前，Windows x64 ZIP 与实际解压后的全部程序文件均严格小于 100,000,000 字节，工程预算为 95,000,000 字节。`scripts/package.mjs` 只收集原生壳、x64 WebView2 DLL、官方 Node、许可证、服务、游戏模块、网页与完整本地资源；生成服务代码使用生产压缩，保留可读源码及原素材；不分发 Electron、现代 .NET 自包含运行时、WebView2 Fixed Version、其他架构库、引用程序集、PDB 或 SDK 文档。

打包计算 ZIP 和目录字节数，实际解压后比对每个文件的字节数及 SHA-256；任一达到上限立即失败，不发布标准 ZIP。清单在 `artifacts/releases/TableMax-<版本>-win-x64-manifest.json`，记录文件列表、包哈希、运行时与双体积。系统共享运行时、用户存档和缓存不计入交付体积，缓存始终写入用户数据目录。缺少共享 WebView2 时提示安装或取消，安装完成后的完整游戏仅用本地资源与局域网服务。

共享运行时方案见 [决策 008](../decisions/008-small-native-desktop.md)，多游戏下载继续作为 [未来计划](../tasks/README.md#多游戏按需安装未来计划未实现)。

### 原生桌面后台验证

`scripts/desktop-test.mjs` 通过测试专用 `--foundation-test` 与私有 IPC 控制实际原生窗口，连接临时回环 CDP。窗口位于屏幕外，不激活、不进入任务栏，但保持合成器渲染；状态分别记录 `visible: false` 和 `rendered: true`，截图来自实际更新后的 WebView2。该方式不等同于 Electron offscreen，也不代表普通前台启动或实体电视实测。正式启动忽略测试 CDP 设置。

电脑显示使用每窗口 WebView2 `ZoomFactor` 与 PerMonitorV2 DPI，显示设置文件格式保持。验证通过原生窗口尺寸、显式测试几何与 CDP 密度组合覆盖 720p—4K／100、125、150%，不修改系统显示配置；记录实际 viewport、DPI、倍率与 PNG 尺寸。手机模拟使用隔离 profile，只有对应本机服务来源可进入，全部桌面桥接禁用。旧显示矩阵和旧截图继续属于原运行时验收。

## 清理本地中间物

日常本地导出运行 `pnpm package:win`，生成当前运行 ZIP 和逐文件清单。仅在用户明确声明发布到 GitHub 时才准备源码 ZIP；现有本地打包入口不会自动生成源码包，也不执行发布。

项目根目录提供三个可从任意工作目录运行的 PowerShell 入口，共用 [清理实现](../../scripts/cleanup-local.ps1)：

- [Clean-Releases.ps1](../../Clean-Releases.ps1)：清理 `artifacts/releases` 中低于 `package.json` 当前版本的程序／源码 ZIP、配套交付／逐文件清单、解压程序和独立打包目录；当前／未来版本及不认识的名称默认保留。版本重新编号后，可用 `-RetiredVersions 1.6.0` 显式指定已退役标签，仍执行全部安全检查；禁止指定当前版本，自动维护不接受该选项。
- 用户明确要求本地只留最新导出时，手动 `Clean-Releases.ps1 -KeepLatestOnly` 先预览，核对后加 `-Apply`。该模式只处理 `artifacts/releases/` 的直属项，保留当前运行 ZIP 与 `win-x64-manifest.json`，其余旧版本、源码包、同版旧解压目录、打包目录及诊断均作为候选；不清理其他历史证据目录。先验证当前 ZIP 的实际便携通过记录和清单哈希，再沿用进程、路径、链接、近期修改、指纹及互斥保护；不与其他清理选择模式或自动维护混用。已确认本次打包／验证退出后，可明确使用手动近期参数回收本次打包残留。
- [Clean-Intermediates.ps1](../../Clean-Intermediates.ps1)：清理已知验证脚本生成的 `tmp/<用途>-<六位随机后缀>`、便携解压副本、已完成的打包工作目录及 builder 诊断文件；已识别的一次性脚本先归档。未知临时内容保留，不清空整个 `tmp/`。原始素材、资料与历史截图／JSON 证据不在范围内。
- [Maintain-Project.ps1](../../Maintain-Project.ps1)：工程操作前后空闲时检查主工作区磁盘占用；超过 5 GiB 才按最旧候选优先清理上述两类内容，达到 4 GiB 或合格候选耗尽即停止。容量是逻辑文件字节总量，不是运行内存；流式扫描跳过链接和嵌套仓库，不重复统计主工作区与 worktree，也不跨无关项目。

全库计量使用 .NET 流式枚举，包含隐藏和系统文件；待扫描目录出栈后刷新属性，再判断链接和嵌套仓库。每次删除后仍真实重测整个工作区，不用候选字节相减代替水位核验。编译的计量类型只在当前 PowerShell 进程复用，不安装工具或创建后台服务。

三个入口默认只预览，保留最近 30 分钟修改过的候选，不删除也不写清理日志。两个手动清理入口默认处理脚本所在 checkout；维护入口默认从同一 Git 仓库发现主工作区，三个入口均支持 `-ProjectRoot <绝对路径>` 显式选择同仓库 checkout，拒绝无关项目。先退出 TableMax，并完成开发／测试／打包；手动核对后加 `-Apply`，日常维护按已授权规则在空闲边界自动调用维护入口的 `-Apply`，不创建常驻或定时任务，不在仍运行的 package／verify 父进程里绕过空闲检查。

删除前必须找到与目标工作区当前 ZIP 哈希相符的便携 `portable: true`／`result: passed` 验证记录；缺包、未验证、ZIP 变化或容量超标但无候选时安全保留并报告。执行前及逐项删除前检查进程，解析绝对路径并核对仓库边界，拒绝 junction／符号链接和嵌套仓库；同目录清理互斥，候选的逐项路径／字节／修改时间指纹在删除前复核。不能读进程、候选变化或检查失败时停止，不结束用户进程。部分失败保留已执行清单供复查。

```powershell
# 在 TableMax 根目录预览
.\Clean-Releases.ps1
.\Clean-Intermediates.ps1
# 核对后分别执行
.\Clean-Releases.ps1 -Apply
.\Clean-Intermediates.ps1 -Apply
# 日常维护：默认发现本仓库主工作区，超过 5 GiB 才执行
.\Maintain-Project.ps1
.\Maintain-Project.ps1 -Apply
# 或明确指定同仓库 checkout；路径替换为实际主工作区
.\Maintain-Project.ps1 -Apply -ProjectRoot C:\Projects\TableMax
```

`build/` 供 `pnpm start` 使用，默认保留；手动 `Clean-Intermediates.ps1` 明确要删除时可加 `-IncludeBuild`，之后先执行 `pnpm build` 再启动。已确认最近候选停止使用时，手动入口可显式设置 `-MinimumAgeMinutes 0`，它不跳过其他安全检查。自动维护禁止这两种放宽；阈值可用 `-HighWaterGiB`、`-LowWaterGiB` 调整，低水位必须小于高水位。`.pnpm-store/`、`node_modules/`、工具缓存、正式存档、原始素材和历史证据继续保留；保护内容占用过大时只报告，不为达到阈值扩大删除范围。脚本不更改 PowerShell 执行策略、默认 `LOCALAPPDATA/TableMax` 数据或其他项目环境。

只清理已核对的特定临时项时，使用 `Clean-Intermediates.ps1 -TemporaryNames @('game-ui-ABC123', 'review-tools')` 预览，核对后追加 `-Apply`。名称必须是 `tmp/` 直属项的精确名称，不允许路径、重复或不存在的项；此模式不扫描打包目录，不与 `-IncludeBuild` 或自动维护结合，未列出的内容保持原位。显式选择的未知临时内容先整体复制到清理记录的 `reviewed-temporary-content/`，核验文件数量、字节及逐文件 SHA-256 后才删除原目录；路径、进程、近期修改、链接、嵌套仓库和当前已验证 ZIP 保护仍生效。原始资料与历史证据应先核对其归档，不能因为放在 `tmp/` 就视为可丢弃。

电力公司旧音频验证将解压程序与浏览器 profile 混放在历史证据中。手动 `Clean-Intermediates.ps1 -VerificationCopies <相对路径数组>` 只接受 `artifacts/maintenance/v1.0.2/<维护名>/native-audio/<run>/work-<六位后缀>/extracted` 或该 work 内六类 `checkpoint-<cue>/desktop` 的精确目录；拒绝空清单、通配符、文件、整个 work／checkpoint、其他证据路径或重复项。每个 run 的 `results.json` 必须是与当前 ZIP 哈希一致的便携通过结果，其中 `work` 必须与所选目录所属的实际工作目录一致，并保留在原位；SQLite、源码、JSON、截图及当前程序包也保留。先预览再 `-Apply`，仍执行全部近期／路径／进程／链接／指纹保护，此模式只处理列出的副本，不与其他手动模式或自动维护混用。清理记录关联具体目录和父级通过证据，不能将它推广为清空 `artifacts/`。

实际执行记录写入 `artifacts/maintenance/local-cleanup-<UTC时间>-<类别>/cleanup.json`，逐项记录路径、字节、删除状态、跳过原因及保留的当前 ZIP 哈希；维护模式另记目标工作区、水位和前后字节。一次性脚本在同目录 `temporary-scripts` 归档。记录保持文件树可见、Git 忽略。`tmp/modern-art-verify-*` 仅对应已核验的旧现代艺术整局隔离数据（六位随机后缀），不包含 UI 工具、研究或截图证据目录；`tmp/experience-*` 仅用于新版操作验证的隔离数据和便携解压，`tmp/runtime-memory-*` 仅用于内存测量；均按已知前缀清理，正式证据按版本保留在 `artifacts/maintenance/v<版本>/`，不参与临时文件清理。

`tmp/app-icon-verify-*` 与 `tmp/tablemax-sqlite-migration-*` 的六位随机后缀目录分别是图标验证／便携解压及服务迁移验证的隔离副本，归入已知中间物；图标原素材和迁移原始存档仍保留在资源及历史证据目录。

修改工具后运行 `powershell.exe -NoProfile -File scripts/cleanup-local.test.ps1` 与 `powershell.exe -NoProfile -File scripts/project-maintenance.test.ps1`。前者检查手动预览、ZIP／进程／链接／白名单／近期保护、脚本归档及显式构建清理；后者用隔离 Git 主仓库和 worktree 检查目录发现、不重复计量、高低水位、最旧优先、互斥及候选耗尽。测试不清理真实 release，结果分别保存在 `artifacts/maintenance/cleanup-history/tool-checks/current/tool-tests.json` 和 `artifacts/maintenance/project-maintenance-tools/tool-tests.json`。

### 手动历史截图去重

用户明确要求清理历史证据时，可用 `Clean-Intermediates.ps1 -DuplicateScreenshotsManifest <清单路径>` 先预览，核对后加 `-Apply`。清单位于 `artifacts/maintenance/`，版本字段为 `1`，`groups` 列出不重叠的历史目录及其直接 PNG 文件；每项含 `path`、`bytes`、`sha256` 和 `retainedPath`。仅接受 `artifacts/maintenance/v<版本>/` 下低于当前 `package.json` 版本的经人工审计截图；当前与更高版本拒绝退役，不接受整个目录删除，不与其他手动选择或自动维护混用。

预览与删除前都逐文件核验源与保留 PNG 的大小和 SHA-256，保留文件不得在删除集合中；仍执行当前便携证明、路径、链接、嵌套仓库、进程、30 分钟近期、目录指纹和互斥保护。删除只针对显式 PNG 文件，目录里的 JSON、日志、存档、独有图片和其他文件保持原位。执行报告保留每张退役截图的哈希与同字节保留位置；旧验收结果正文不改写，清理后的历史副本从该清单追溯。来源图及正文直接引用图片须在生成清单时排除，不能仅根据名称或 Git 忽略判断。

相关隔离验证为 `powershell -NoProfile -File scripts/duplicate-screenshots-cleanup.test.ps1`；修改共用清理实现还需既有手动／自动保护回归。该模式不减少当前交付 ZIP 的内容，也不导出源码包。

### 手动历史截图全量退役

按 2026-10-05 用户授权，清理历史内容时不再要求保留独有截图：旧版本验收、试玩和界面截图及其联系表可全部删除，失败原因、文字结论、版本／构建边界、逐文件哈希与清理记录继续保留。当前版本验收截图、素材原图、规则参考资料、源代码和存档保持原位。既有同字节去重清单属于当时记录，后续全量退役可以删除其中的保留图片，须用新清单说明这一状态变化。

使用 `Clean-Intermediates.ps1 -HistoricalScreenshotsManifest <清单>` 先预览，核对后加 `-Apply`。清单位于 maintenance，包含 `version: 1`、明确 `authorization: retire-historical-screenshots`、当前版本与通过 ZIP 的 SHA-256；每个历史根目录列出确切图片路径、字节数、SHA-256、理由和当前版本内保留的文字授权证据／哈希。工具只删除所列 PNG／JPEG／WebP，保留目录、其他文件及文字记录；当前版本、未知版本、未知目录、素材／研究目录、非图片、路径逃逸、重复路径、链接、嵌套 Git、变化的内容或文字证据均拒绝。历史 v1.6.0 是已记录的版本重编号前交付；旧未编号目录和归档验证副本仅接受入口中的已核验白名单，不据大小或名字模糊清理。

默认仍有 30 分钟近期保护，且执行当前便携证明、工程进程、互斥、目录指纹和删除前逐文件哈希检查。若同一已结束清理刚改变历史目录时间，可在核对清单且无工程进程时显式用 `-MinimumAgeMinutes 0`，其他保护保持。该模式只支持手动中间物清理，不能与其他手动选择混用，自动维护不采用此范围。删除后将文档截图链接改到退役清单并标注已清理，不将清单作为图片显示，也不改写当时通过／失败结果。

相关隔离检查为 `powershell.exe -NoProfile -File scripts/historical-screenshots.test.ps1`；修改共用入口同时执行既有手动、自动维护、同字节去重和历史可再生副本退役回归。实际执行结果进入 [项目瘦身](project-slimming.md)，运行 ZIP 内容与版本号不因截图清理改变。

### 手动可再生副本与旧包退役

用户 2026-10-05 授权完整检查通过后清理无后续用途内容。方案及实际结果见 [项目瘦身](project-slimming.md)。`Clean-Intermediates.ps1 -RetiredGeneratedManifest <相对清单>` 默认预览，核对后追加 `-Apply`；不与其他清理模式组合，不进入自动维护。

清单位于 `artifacts/maintenance/`，版本为 1，绑定当前 ZIP 的 SHA-256。`entries` 每项含精确 `path`、`kind`、`reason`、完整 `files`（path／bytes／sha256）及保留 `evidence`（path／sha256）。接受维护版本目录中的具体解压程序、带 Chromium 标记且不含平台存档的浏览器 profile、单个历史 TableMax ZIP，以及已退出活动依赖的 `.cache/electron`／`.cache/electron-builder`；另支持下节已完整保留的旧清理目录集中归档。每项及删除前都核验逐文件内容，保留证据不能处于任何删除集合中；沿用当前便携证明、路径／链接／嵌套 Git、进程、近期修改、候选指纹与互斥保护。清理报告保存原清单、全部哈希及保留位置。

新增的六位 `tmp/modern-art-polish-v2-*`、`tmp/desktop-fullscreen-*`、`tmp/modern-art-fullscreen-*` 及八位十六进制 `tmp/fullscreen-portable-*` 均已从实际验证脚本／结果确认用途，属于已知隔离中间物；其他相似名称和未知后缀仍保留。工具回归增加 `powershell.exe -NoProfile -File scripts/retired-generated.test.ps1`，并执行既有手动、自动和截图保护测试。

`node scripts/verify-project.mjs --evidence=<独立名>` 检查整个 Markdown 库的本地文件／章节链接与当前运行包哈希、文件总量、必要模块、体积和排除规则。结果进入当前版本对应的独立维护目录；省略名称时使用时间戳，避免覆盖旧验收。历史退役后先修复指向包的文档链接，再执行此检查；运行时安全、规则、显示和对局验收仍用对应真实验证器。

### 清理记录集中归档

用户明确授权后，可将已结束的 `artifacts/maintenance/local-cleanup-<UTC时间>-<类别>/` 与旧 `local-cleanup-tools/` 集中到 `artifacts/maintenance/cleanup-history/`。清理 JSON 原字节保存在 `records/`，旧工具记录在 `tool-checks/legacy/`；含归档源码、迁移数据库等内容的目录整体保存到无损 ZIP，`index.json` 记录每个原路径、字节、SHA-256、归档成员及可直接阅读的位置。文档改链到新位置；原 JSON／日志中的历史路径保留，由索引追溯，不改写当时结论。

沿用 `-RetiredGeneratedManifest` 手动入口，清单类型为 `consolidated-cleanup-history`，仅接受上述精确目录名。每项增加保留 ZIP 的 `archive`（`path`／`sha256`）；可读记录增加 `retainedPath`。工具核验整个 ZIP 哈希及每个解压成员的路径、字节、SHA-256，逐文件确认原内容全部可恢复，并检查原清理报告有独立可读副本，再允许删除目录。先预览、核对再 `-Apply`，不会自动扫描或清空 maintenance；操作记录进入 `cleanup-history/operations/`，避免此次整理再生成分散目录。相关隔离检查为 `scripts/cleanup-history.test.ps1`，共用入口变化同时回归既有清理保护。

进程检查持续阻止使用目标工作区或工具来源工作区的应用及构建／验证进程。只有可确认可执行文件和命令行均与这两个工作区无关的外部 `TableMax.exe` 才不阻止清理；无法确认路径或命令行的进程仍按保护处理。工具不结束用户运行的应用。

## 工作目录透明压缩

[Compress-Workspace.ps1](../../Compress-Workspace.ps1) 为 Windows NTFS 工作目录提供逐文件透明压缩。默认只审计，确认构建、应用和验证均退出后显式执行：

```powershell
.\Compress-Workspace.ps1
.\Compress-Workspace.ps1 -Apply
.\Compress-Workspace.ps1 -Apply -MinimumBytes 4096
```

工具不删除或重编码素材、存档、源码、历史证据、依赖或程序包。它按文件身份去重计算实际分配，跳过链接目录、嵌套仓库、只读／加密／稀疏文件以及具有审计范围外硬链接的文件；默认候选至少 64 KiB，已经压缩的文件跳过。完全位于本工作区的硬链接仅压缩一次。写入前复查身份与别名，持有排除并发写入和删除的句柄，并通过 [GetFinalPathNameByHandleW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew) 确认主文件及每个硬链接别名的实际路径仍位于工作区内，拒绝父目录移出后用 Junction 回指的情况。压缩前后 SHA-256 必须一致，无收益时撤销压缩。只读属性保持原样，不为压缩临时修改 Git 对象或原始资料的属性。

需要覆盖较小文件时，可先用 `-MinimumBytes 4096` 预览，再按同一参数执行；此参数仅降低普通文件的大小门槛，不取消上述保护。

操作与清理工具共用互斥保护；活动项目进程存在时拒绝执行，不关闭用户程序。`artifacts/maintenance/workspace-compression-*/` 保存开始报告、逐文件 JSONL 审计和最终汇总；异常或中止后的 started 条目不能视为已核验成功。逻辑字节、按路径累计字节和按文件身份去重的实际磁盘分配分别记录；便携 ZIP 及实际解压字节门禁仍按原始字节计算。后续新增文件不自动进入本次压缩，不建立后台轮询。

底层采用 [FSCTL_SET_COMPRESSION](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-fscc/77f650a3-e3a2-4a25-baac-4bf9b36bcc46)、[FILE_STANDARD_INFO](https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_standard_info) 与 [GetCompressedFileSizeW](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getcompressedfilesizew)；隔离回归执行 `powershell.exe -NoProfile -File scripts/compress-workspace.test.ps1 -EvidenceDirectory <项目内 artifacts/maintenance 的绝对路径>`，新回归不得覆盖旧版本证据；覆盖无损内容、普通读写、硬链接边界、嵌套仓库、链接目录、无收益撤销和活动进程拒绝。

## 历史开发与验证

下列原标题仅保留转链，当前方法以上文为准；历史正文、版本和证据唯一维护在开发归档。

### 游戏库、并发与内存验证（1.6.0）

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#游戏库并发与内存验证160)；当前操作见本页对应主题。

### 聚会可靠性维护验证（1.2.0）

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#聚会可靠性维护验证120)；当前操作见本页对应主题。

### 手机围桌与等级验证（1.3.0）

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#手机围桌与等级验证130)；当前操作见本页对应主题。

## 第五、六阶段完整游戏与交付

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#第五六阶段完整游戏与交付)；当前操作见本页对应主题。

## 第三、四阶段平台验证

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#第三四阶段平台验证)；当前操作见本页对应主题。

## 人机与封装的后续验证

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#人机与封装的后续验证)；当前操作见本页对应主题。

## 第一阶段验证记录

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#第一阶段验证记录)；当前操作见本页对应主题。

## 第二阶段原型验证记录

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#第二阶段原型验证记录)；当前操作见本页对应主题。

## 首版游戏主题原型与规格验证

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#首版游戏主题原型与规格验证)；当前操作见本页对应主题。

### 1.0.2 视觉维护验证

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#102-视觉维护验证)；当前操作见本页对应主题。

### 1.1.0 后台维护验证

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#110-后台维护验证)；当前操作见本页对应主题。

## 1.4.0 游玩呈现与六人验证

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#140-游玩呈现与六人验证)；当前操作见本页对应主题。

### 1.5.0 多分辨率显示验证

当时的范围与记录见 [开发归档](../archive/development-2026-10-01-to-04.md#150-多分辨率显示验证)；当前操作见本页对应主题。
