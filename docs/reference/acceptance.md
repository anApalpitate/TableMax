# 首版交付与验收

## 1.0.6：轻量目录与统一玩法控件（2026-10-11）

未安装游戏的浏览目录仅保留名称、分类、人数、玩法摘要、小封面和必要索引字段；实际目录从17,471降至2,240字节，减少87.18%。作者完整清单、运行描述、浏览摘要与安装器签名数据采用显式投影。新游戏包的图文介绍、人机说明和引导能力进入 `web/details.json`，当前发行按引用加载；旧签名包继续读取内嵌说明。空box不携带重复 `modules.json`、根签名目录或逐游戏完整清单，管理员明确下载时才刷新可信目录。平台 `GameplaySelector`统一宝可梦和阿瓦隆玩法选择，保留资源状态、权限及当前发行固定。

[实际字节审计](../../artifacts/maintenance/v1.0.6/catalog-slim-20261011/metadata-audit.json)证明候选八玩法的规则、人机代码及资源字节与旧发行一致；新详情入包、运行描述不再重复携带介绍。候选包[签名／闭包核验](../../artifacts/game-packages/v1.0.6/catalog-slim-20261011/verification.json)通过。本地full继续预装原Pages八个精确发行，旧ID、旧包和线上发布字节不改；新版格式候选尚未部署或发布。

首轮候选交付如下，后续历史目录及旧包人数校验修正的最终交付另列于本节。

| 首轮本地候选                      |  EXE字节数 | SHA-256                                                            | 实际提取字节数（含标记） |
| --------------------------------- | ---------: | ------------------------------------------------------------------ | -----------------------: |
| `TableMax-1.0.6-win-x64-box.exe`  | 34,907,648 | `e245a86064e3a9e35be1dc6d678320eff6d616100876486ee84a4baec8cda5a3` |               87,489,605 |
| `TableMax-1.0.6-win-x64-full.exe` | 43,686,400 | `e83eb1fc10bc015db179baa309fcf9cd57551364d83042abf586caf917611654` |               96,407,674 |

快照为 `e5740f75c7af517934dcedac06c6774a2e1795bf5dcfdb9c79468c5a8291f9ba`，37单元正式构建35.681秒；双EXE各减少51,200字节、内部解压各减少212,061字节。[box](../../artifacts/maintenance/v1.0.6/windows-editions/e5740f75c7af517934dcedac06c6774a2e1795bf5dcfdb9c79468c5a8291f9ba/shipping-executable-checks-box.json)与[full](../../artifacts/maintenance/v1.0.6/windows-editions/e5740f75c7af517934dcedac06c6774a2e1795bf5dcfdb9c79468c5a8291f9ba/shipping-executable-checks-full.json)实际提取、逐文件哈希、重复提取及原生安全通过，均满足严格120MB门禁。旧本地EXE与清单保全在[本轮备份](../../artifacts/maintenance/v1.0.6/catalog-slim-20261011/before/)。

[实际安装首轮](../../artifacts/maintenance/v1.0.6/windows-editions/e5740f75c7af517934dcedac06c6774a2e1795bf5dcfdb9c79468c5a8291f9ba/actual-install/1791723209925/results.json)中的box空大厅通过；full提取曾因临时stage目录访问拒绝停止，原失败保留。确认目录清空、相关进程退出后，[仅full补验](../../artifacts/maintenance/v1.0.6/windows-editions/e5740f75c7af517934dcedac06c6774a2e1795bf5dcfdb9c79468c5a8291f9ba/actual-install/1791723360303/results.json)通过八包预装、旧包详情实际渲染、重启及full换box时原安装索引／保存实例／发行引用／快照不变。实际app与games分别87,489,605／106,433,111字节。

[游戏库15项](../../artifacts/maintenance/v1.0.6/game-library/run-1791722940530/report.json)覆盖轻量白名单、空盒子零详情请求、管理员显式刷新及并发合并、身份切换、玩法权限与320px至4K布局。[图文说明108布局](../../artifacts/maintenance/v1.0.6/game-introduction/lazy-details-final-20261011/results.json)通过异步加载、字号、触控、焦点和只读行为。首轮报告作用域错误及游戏库夹具遗漏运行计时能力均修正后限定重验，未将失败记为通过。元数据／开发插件5项、独立作者3项、公开API6项及新增详情迁移1项通过；详情字段校验加强后仅重跑受影响3项。类型、适用静态／格式检查通过。测试静音、监听127.0.0.1；模拟视口、隐藏Edge／WebView2不代表实体手机或Safari。

最终复核修正历史发行覆盖当前目录的问题：每个游戏／玩法只公开签名目录首条当前发行，内部安装索引保留历史引用。规则人数按精确发行描述校验，旧6人阿瓦隆与当前10人浏览目录并存；选局／换玩法载入后再按实际规则人数检查，超员拒绝且不改变原保存。公开目录新增1项、实际CJS发行加载2项及版本固定／恢复／超员选局6场景通过。两项测试观测假设（无效 `endCurrent:false`及随时钟变化的倒计时）修正后只重跑受影响场景，原失败保留。

中间快照 `9294313d0e7f132446a81cb8c8b23b0441b5860978d558393c234e0060534ac0`的实际安装及box原生安全通过，full原生检查在临时stage访问拒绝时停止；[原批次记录](../../artifacts/maintenance/test-history/runs/3e967e1d-9bc7-41c7-b59e-309f1496eb7a/results.json)保留，确认目录及进程退出后仅以最终人数补丁包重验受影响交付。中间EXE与清单保全在[候选备份](../../artifacts/maintenance/v1.0.6/catalog-slim-20261011/before-capacity-guard/)。

| 最终本地交付                      |  EXE字节数 | SHA-256                                                            |
| --------------------------------- | ---------: | ------------------------------------------------------------------ |
| `TableMax-1.0.6-win-x64-box.exe`  | 34,907,648 | `00991ab0196fb2df4ae4848063bad315f7534d3abbcdbfb5a31123d843ff6ccb` |
| `TableMax-1.0.6-win-x64-full.exe` | 43,686,400 | `8f7ed15e95fdd7857597910bf5ed0fdbbcaf236eb6a46f52e245992d553f4553` |

最终快照 `dc39fbac05ef3c1449e9a23165fd4478a1d819cdcbeb3be6d1e71b8b4b52d575`只重编平台，游戏冻结单元保留。[最终字节审计](../../artifacts/maintenance/v1.0.6/catalog-slim-20261011/metadata-audit-complete.json)仍证明八玩法规则、人机与资源未改，双EXE各减少51,200字节、实际载荷各减少211,976字节。[最终实际安装](../../artifacts/maintenance/v1.0.6/windows-editions/dc39fbac05ef3c1449e9a23165fd4478a1d819cdcbeb3be6d1e71b8b4b52d575/actual-install/1791724638419/results.json)通过四组断言，box／full的app与games总量87,489,780／106,433,286字节；本轮没有重新发布线上附件、目录或标签。

最终[box提取与原生安全](../../artifacts/maintenance/v1.0.6/windows-editions/dc39fbac05ef3c1449e9a23165fd4478a1d819cdcbeb3be6d1e71b8b4b52d575/shipping-executable-checks-box.json)、[full同项检查](../../artifacts/maintenance/v1.0.6/windows-editions/dc39fbac05ef3c1449e9a23165fd4478a1d819cdcbeb3be6d1e71b8b4b52d575/shipping-executable-checks-full.json)通过实际逐文件哈希、完整成员、重复提取和静音原生安全矩阵；full实际提取含标记96,407,849字节，两个EXE与实际内容均严格小于120,000,000字节。最终类型检查通过，保留本轮各候选与失败的实际证据边界。

“宏伟大计”核心功能已实现，仍缺实体手机LAN／Safari、默认可见作者启动、真实磁盘满及全下载／解压写入点故障矩阵，因此保留[手写条目](../tasks/手写改动单.md)；详细接续见[任务索引](../tasks/README.md#独立游戏包与按需安装宏伟大计进行中)。安全维护与最终容量归入[瘦身记录](project-slimming.md#轻量目录与玩法控件收尾2026-10-11)。

## 1.0.6：空盒子大厅与两种Windows EXE（2026-10-11）

本轮本地交付已通过实际包检查，继续沿用v1.0.6；未重新发布GitHub Release、部署Pages或导出source ZIP。无游戏时保留正常牌桌大厅、六个空座位和管理入口，以下载图标、标题“请前往游戏库下载”及高亮“游戏库”按钮打开现有浮窗。其他端可以查看游戏库，下载安装仍仅管理员可操作。

| 本地交付                          |  EXE字节数 | SHA-256                                                            | 实际提取字节数（含标记） | 首次安装app与games字节数 |
| --------------------------------- | ---------: | ------------------------------------------------------------------ | -----------------------: | -----------------------: |
| `TableMax-1.0.6-win-x64-box.exe`  | 34,958,848 | `96b470f22b541cc68aaab7f8d7c651cd461d5aa1d9709a6d46911271cafb04c4` |               87,703,107 |               87,813,603 |
| `TableMax-1.0.6-win-x64-full.exe` | 43,737,600 | `2c769c24d858d7abdc83b680369eeddef200e42a2dd859c821afbb4ccc0b043f` |               96,621,177 |              106,646,614 |

该轮快照为 `5b0ecba02867adfe0e5358e70d6e9fb1de71e950db23b57c86f1760b3dc07b4e`；只重新编译受影响平台单元，游戏沿用 `93f640a3594856a93bb78176e81c966c6ba5a8a96b920066d4431a463e439b4d` 冻结单元及已验Pages八玩法／13内容包，不混入其他任务资源改动。[该轮两版哈希指针](../../artifacts/maintenance/v1.0.6/catalog-slim-20261011/before/payload-index.json)绑定独立内部载荷与逐文件清单；内部ZIP仅供封装和审计，用户运行导出仅为full／box EXE。两种EXE、实际提取及首次安装内容均严格小于120,000,000字节。

[实际EXE启动三组检查](../../artifacts/maintenance/v1.0.6/windows-editions/5b0ecba02867adfe0e5358e70d6e9fb1de71e950db23b57c86f1760b3dc07b4e/actual-install/1791720858647/results.json)通过：box正常空大厅和浮窗；full本地安装八个精确发行，首次及无操作退出后重开默认宝可梦原版，显式切换本地UNO无需浏览器外部请求；同一便携目录替换为box后，八个安装引用、已保存实例、发行及快照保持一致。已有保存的空局保持为空，不因升级到full自动选局；已卸载游戏不被旧预装凭证重新安装。

[box实际提取与原生安全](../../artifacts/maintenance/v1.0.6/windows-editions/5b0ecba02867adfe0e5358e70d6e9fb1de71e950db23b57c86f1760b3dc07b4e/shipping-executable-checks-box.json)和[full同项检查](../../artifacts/maintenance/v1.0.6/windows-editions/5b0ecba02867adfe0e5358e70d6e9fb1de71e950db23b57c86f1760b3dc07b4e/shipping-executable-checks-full.json)通过完整载荷哈希、精确成员、重复提取复用及真实WinForms／WebView2／Node安全矩阵。box首次临时stage清理遇短暂访问拒绝，原失败保留；确认目录及进程已退出后仅重验box，未改Launcher或重新封装。

[源码界面12项](../../artifacts/maintenance/v1.0.6/windows-editions-ui-20261011/report.json)覆盖管理员／玩家／公共屏、320px、390px、手机横屏、720p及4K，空盒子操作权限、文字与触控尺寸通过。预装Store原10项及服务3项通过，受影响3项重验覆盖无动作重启与已有空局保护；双交付保护6项、只读哈希边界、旧清理258项及自动维护47项通过。声音默认关闭，真实本机检查监听127.0.0.1；没有新增实体手机LAN、Safari或八玩法自然整局验收，冻结游戏沿用此前已记录结论。

旧无后缀EXE、运行ZIP、清单和已发布source ZIP已逐文件核对后保存在[格式切换备份](../../artifacts/maintenance/v1.0.6/windows-editions/legacy-before-editions-20261011/)，当前 `artifacts/releases/` 仅保留两份EXE与对应本地清单；线上旧三附件及历史标签保持不变。

全部本轮工程退出后的[安全维护](project-slimming.md#两种windows-exe交付收尾2026-10-11)回收131,353,052逻辑字节，最终16,145,727,094字节；安全候选耗尽后仍超10GiB，保护范围未扩大。双EXE、内部载荷、游戏仓库、旧包、存档与验收保全。

## 1.0.6：Pages部署与同版本重新发布（2026-10-11）

经用户明确授权，本次Pages部署与[v1.0.6正式重新发布](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.6)已完成。本轮沿用已验源码与实际程序，保全历史内容包及旧标签；[最终发布审计](../../artifacts/maintenance/v1.0.6/pages-release-20261011/github-draft-replacement-1791717345309.json)确认非草稿、非预发行且为latest，九条正文一致、附件恰为以下三份，线上名称、字节数与SHA-256全部一致。

| 发布附件                            |     字节数 | SHA-256                                                            |
| ----------------------------------- | ---------: | ------------------------------------------------------------------ |
| `TableMax-1.0.6-win-x64.exe`        | 34,957,824 | `eb4aa8cc03e384b5ed7de24bf5f95f56c5be02a2f1915f57444be96e05b0924e` |
| `TableMax-1.0.6-source.zip`         | 25,105,119 | `57270f099e7253195cfe41568e2a1d81257de8e1b29bf126e4a97ef32b1e2ead` |
| `TableMax-author-toolkit-1.0.6.zip` |     41,935 | `8564c4cc312e9034bcfff7dae588f5121f1527f97f21a53e513cb60b85ba9eb4` |

source ZIP对应实际发布提交 `a7d13f7388442bbc3083913c0786ca43278214ef`；保留的v1.0.6标签仍指向历史提交 `1f8267a4bdf4d8172719a3e71be1f7445f88c3bc`，标签对象 `482235f4fe1385fea701225c426b80800d1f1b3f`未移动。映射和此前附件备份见最终审计；不上传基础运行ZIP、JSON或过程截图。

[真实Pages安装与版本固定](../../artifacts/maintenance/v1.0.6/pages-release-20261011/online-install/run-be51e264-f8b5-4d5f-846b-557ed306f280/results.json)通过，耗时137秒：读取10个发行引用，7次真实HTTP 200传输4,884,918字节（含目录），记录190次进度。生产PackageStore校验下载归档摘要及安装后逐文件inventory，目录摘要来自实际响应字节。旧阿瓦隆基础局固定的规则／策略对象、存档及资源路径SHA保留，新基础发行默认优先，拒绝卸载旧局引用；新Store重启后旧局暂停恢复。宝可梦两玩法的重复请求复用共享依赖闭包，三个blob各只下载一次。首次离线包hash／发行引用误配、网络失败及取消后的观察器错误记录保留，修正审计clone观察器后通过。此项不是浏览器、Worker或新增完整整局证据；其余游戏沿用既有整局及旧v1.0.5实际迁移结论，实体手机边界不变。

Pages已通过[手动工作流部署](https://github.com/anApalpitate/TableMax/actions/runs/38133974837)（第二次尝试），静态分支提交 `7b9e651387cf32748b65d8f7e05e62811150e974`。站点36文件、25,533,257字节，含一个部署标记；[35个公开文件的真实HTTPS大小与SHA核验](../../artifacts/maintenance/v1.0.6/pages-release-20261011/public-pages.json)全部通过。[联合清单](../../artifacts/pages/v1.0.6/published-history-20261011-2/site-manifest.json)保留当前八玩法、旧阿瓦隆两发行、14个内容包及旧签名目录原字节，原21个代码／资源／离线包均按旧线上摘要保全。同名离线包仅内嵌全目录不同且发行和依赖相同的，继续使用旧已发布字节；不覆盖原引用。首次部署因旧式Pages环境拒绝master，改为workflow后仅重跑部署；回环、网络超时和`.nojekyll`404均不冒称首次通过。

新[实际EXE验收](../../artifacts/maintenance/v1.0.6/github-release-20261005/shipping-executable-checks.json)通过：34,957,824字节，SHA `eb4aa8cc03e384b5ed7de24bf5f95f56c5be02a2f1915f57444be96e05b0924e`；原ZIP未改变，实际提取含标记87,701,411字节。逐文件载荷哈希、精确成员、重复提取复用和真实原生／WebView2／Node安全检查通过，EXE及实际解压均严格小于120,000,000字节。[作者工具包ZIP](../../artifacts/maintenance/v1.0.6/pages-release-20261011/toolkit-zip.json)38成员及全部源文件哈希核对通过；旧EXE、原审计及原生证据完整备份。公开字节与发布状态核验不代表实体手机验收或本轮新增完整整局。

[已审更新说明](../../artifacts/maintenance/v1.0.6/pages-release-20261011/release-notes.md)比较v1.0.5实际发布source提交 `4943ca5cf89aabc850df3fb566519973913feb3e` 与本次已验实现提交 `1cf25774a0b1ca4d1443f68107e721b4fb183856`，不采用v1.0.5保留旧标签对象作为基线。下方Pages准备与历史发布结论继续保留各自的包和证据边界。

## 1.0.6：Pages准备、盒子界面与人机发言（2026-10-11）

此前v1.0.6 Release 已撤回为草稿，25个历史附件和标签保留；[撤回审计](../../artifacts/maintenance/v1.0.6/pages-box-20261011/withdrawal.json)。本节记录当时仅做准备、未部署Pages或恢复Release的边界；随后获授权的本次发布状态见上节。旧线上下载结论属于历史记录，分发路径、白名单及手动发布门禁见[Release流程](release.md#最新分发决定与暂缓发布2026-10-11)。

当时[本地运行ZIP](../../artifacts/maintenance/v1.0.6/windows-editions/legacy-before-editions-20261011/TableMax-1.0.6-win-x64.zip) **34,828,408字节**，SHA-256 `3bc7c2c0853c2fe50f24b6b055d192f4856f3130194743e021081b4de7746850`；[清单](../../artifacts/maintenance/v1.0.6/windows-editions/legacy-before-editions-20261011/TableMax-1.0.6-win-x64-manifest.json)实际解压 **87,679,056字节**，快照 `f54efa228907bca87e0ea60074f8dc7c2294c7269f2f9ba958a0ad39d5464e1a`。新签名游戏包独立保存在 `artifacts/game-packages/v1.0.6/pages-ready-20261011/`，不覆盖旧目录；八玩法闭包、逐文件哈希、签名及资源分离验证通过，阿瓦隆传输／安装量为1,704,826／1,811,974字节，其余组合不变，全部门禁通过。

盒子版本选择、美化、内层滚动及唯一TableMax仓库链接由[实际源码渲染](../../artifacts/maintenance/v1.0.6/game-library/report.json)11项检查覆盖320px、390px、横屏、720p和4K，零页面错误；[同一ZIP解压原生界面](../../artifacts/package-library-FT7dVg/report.json)检查资源状态和权限。F11三模式、真实WebView可信按键、WinForms键处理、菜单及公共窗口独立共11项通过，[同包证据](../../artifacts/results/native-f11/1791714112030/results.json)。显式全屏和Escape保留原返回模式。

阿瓦隆声明仅finish-discussion免前置等待，仍经Worker、授权动作及保存。普通实时时钟测试5项和通用调度兼容7项通过，两配置／三档、真人等待、暂停及保存失败受保护；SDK可选字段保持兼容，类型检查及外部作者契约通过。作者工具包已同步冻结到 `artifacts/author-toolkit/v1.0.6/pages-ready-20261011/`。

[同ZIP普通模式实际Worker](../../artifacts/maintenance/v1.0.6/game-packages/pages-avalon-immediate-retry-20261011/results.json)两配置各4次发言确认，基础32.58–44.62ms、宫廷31.97–44.59ms；身份确认保持1.83–1.85秒，真人150ms等待期间revision不变。均自然到首次投票检查点，无管理员跳过、页面错误或退出错误；不是本轮新增完整整局验收。首次计时观察器未拆消息封装以及中断记录保留，不记为成功。

[Pages回环校验](../../artifacts/pages/verification-1DLvlW/results.json)通过32个文件（21,870,152字节）、目录路径、签名篡改拒绝及旧输出保护；这是本地静态站点验证，不代表实际Pages CDN、部署或线上下载通过。实体手机、Safari、真实键盘与硬件显示器未新增验收。

最终候选在[静态站点](../../artifacts/pages/v1.0.6/ready-20261011/site/index.html)与[逐文件清单](../../artifacts/pages/v1.0.6/ready-20261011/site-manifest.json)，仅本地准备。维护保护增加Pages目录；两次隔离清理检查被仍运行的验证／静态检查PID拦截，保护生效；全部退出、独占重跑后[262项检查通过](../../artifacts/maintenance/v1.0.6/pages-box-20261011/cleanup-tests/tool-tests.json)。

手写单中“盒子界面”四项已完成并移除，其余手写原内容及任务量标记保留。

## 1.0.6：独立游戏包与公共作者契约（2026-10-11）

基础程序已拆为盒子、服务、共享运行时、目录与小封面，正式游戏按需安装到便携根 `games/`。八个玩法的不可变发行绑定代码、公共资源与玩法资源；安装和版本选择分开，当前对局及下一小局继续使用原发行。网络协议8、模块契约7和各游戏规则／状态／策略版本保持原边界。

此前[基础运行ZIP备份](../../artifacts/maintenance/v1.0.6/pages-box-20261011/previous-runtime.zip) **34,827,783字节**，SHA-256 `ccd8f613a0d4a682a38089cc2aac664a3ba4cbf08761f13677fb6f47f454116d`；[89成员清单](../../artifacts/maintenance/v1.0.6/pages-box-20261011/previous-runtime-manifest.json)解压 **87,676,016字节**，快照 `d109af44c745cce902516c59d2e85280dbdb321461eaab37115e80ab7cc1d73c`。历史发行EXE **34,957,312字节**，SHA-256 `4f923f099c3f198adf8e8a7656f63d8366916ed78996e6932dac05bb73a8e157`；[实际提取与原生安全](../../artifacts/maintenance/v1.0.6/pages-release-20261011/previous/github-release-20261005/shipping-executable-checks.json)通过，提取后含所有权标记 **87,698,375字节**。这是撤回前构建，不能替代上方新包验收。

[签名目录](../../artifacts/game-packages/v1.0.6/TableMax-game-catalog-v1.0.6.json)包含8发行、13内容包，去重安装9,801,855字节。单玩法完整依赖（同组合共享资源仅计一次）的传输／安装字节如下，全部低于48MB工程预警及严格64,000,000字节门禁：

| 玩法       |  传输字节 |  安装字节 |
| ---------- | --------: | --------: |
| 宝可梦原版 | 2,300,177 | 2,795,853 |
| 宝可梦扩展 | 2,977,035 | 3,458,802 |
| 现代艺术   | 1,959,139 | 2,059,869 |
| 电力公司   | 1,494,796 | 1,688,220 |
| 拉密       |    85,377 |   168,416 |
| UNO        |   537,428 |   614,613 |
| 阿瓦隆基础 | 1,704,811 | 1,811,935 |
| 阿瓦隆宫廷 | 1,704,811 | 1,811,935 |

独立作者工具包[ZIP](../../artifacts/author-toolkit/v1.0.6/macro-20261011-final2/TableMax-author-toolkit-1.0.6.zip)为41,563字节／38成员，SHA-256 `f422c558f421c72c37a408b2be8f6f07905f428f33c8d5ae5f5c6fea921ce9e2`。[两外部工程真实接入](../../artifacts/author-toolkit/v1.0.6/macro-20261011-final2/report.json)各自拥有回环端口、运行目录、SQLite、浏览器profile与证据目录，完成6个授权动作及本地媒体加载，无页面错误；项目脱离主仓私有源码构建，通过冻结公共依赖和显式平台环境接入。不同游戏10构建单元并发输出互不覆盖，媒体字节修改不改变代码指纹，私有导入门禁通过。可见浏览器默认启动尚未实机核验，已验证隐藏Chromium接入。

安装器10项、真实服务3项覆盖签名／逐文件哈希、ZIP边界、完整依赖、双下载限制、共享去重、取消、旧版保留、事务恢复、缺包修复、权限及独立玩法安装；版本固定、CSS切换和授权宿主契约定向检查通过。[实际解压包八玩法](../../artifacts/maintenance/v1.0.6/game-packages/installed-final-20261011/results.json)及[UNO／阿瓦隆受影响重验](../../artifacts/maintenance/v1.0.6/game-packages/installed-final-retry-20261011/results.json)完成离线整局。UNO首次5分钟上限未到终局，延长的普通规则500分重验在915,686ms自然结束，未改目标或强制结算；阿瓦隆两配置重验按正常发言完成，无管理员跳过。真实平台人机和真人驱动Worker均保持本人投影与32MiB／2秒预算；原生主机及浏览器端无页面错误，134份本地音频静音解码通过。浏览器外部请求被阻断；不宣称操作系统级断网验证。

整局证据绑定保全的候选基础包，后续仅修正旧档版本元组匹配及盒子安装状态／新版选择；规则、人机、游戏网页和资源内容哈希未变，复用已通过整局而不扩大重验。最终包[真实旧原生存档迁移](../../artifacts/maintenance/v1.0.6/game-packages/legacy-migration/attempt-1791711647721/results.json)通过：旧完整ZIP实际开局、保存与checkpoint，新Launcher逐字节保全旧包，新服务按实际版本元组绑定，原实例、两个凭证、秘密投影、状态及历史保持，恢复暂停，回退和重启继续使用原包。首次迁移因游戏ID误入版本比较失败，原数据库完整保留；修复后只重验受影响路径。

最终[安装界面检查](../../artifacts/package-library-BNnHrn/report.json)区分真实权限／原生边界与模拟任务快照：基础包真实启动、管理员入口、其他端API拒绝与原生文件选择能力拒绝真实验证；下载／校验／安装／失败／不兼容等状态、37.5%填色及38%文字、完成通知一次、旧当前包与新可选包比较使用只读响应fixture，不改变安装索引或当前局。320／390／844×390移动UA、720p与4K均无水平溢出，非空信息16px及触控44px通过；早一轮横屏实际仍为电脑玩家竖屏，修正验证UA后重验，没有将旧截图冒称手机横屏。实体手机LAN、Safari解码、磁盘满与各安装阶段进程崩溃的完整矩阵仍需补充，不把模拟视口、事务单元检查或播放事件写成这些设备／故障通过。

[v1.0.6 Release](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.6)已发布，标签与源码为 `1f8267a4bdf4d8172719a3e71be1f7445f88c3bc`，[发布审计](../../artifacts/maintenance/v1.0.6/github-release-20261005/github-publication.json)核对25附件的名称、大小和SHA-256：EXE、对应源码ZIP、签名目录、13内容包、8玩法离线包及作者工具包；没有上传运行ZIP、过程JSON或截图。[真实在线安装](../../artifacts/maintenance/v1.0.6/game-packages/installed-online-release-20261011/results.json)从最终空基础包主动刷新签名目录，下载宝可梦两玩法，记录106次实际字节进度；重复请求合并，完整共享闭包只登记一份，再次安装新增传输0字节，下载不自动选局。两玩法显式开局与实际网页／媒体入口通过，无页面错误；这里只验证安装及入口，不重复声称整局。快速校验／安装阶段未被轮询采样，上游HTTP请求数量由定向单元检查证明，本次线上运行没有另行计数。各端仍只访问主机，主机才请求Release。

补充[真实进程崩溃恢复](../../artifacts/results/package-crash/1791712430894/results.json)3项通过：在写journal前、提交index前及提交index后终止独立安装子进程，再新建store恢复。前两者保留旧选局版本，后者可见新版本，旧包字节完整、journal清空、重试新版可用。最初沙箱拒绝fork，三个子进程均未启动，按失败阈值停止并保留记录；取得本机执行权限后只重跑这三项。覆盖的是三个事务边界的进程终止，仍不代表断电、fsync故障、全部下载／解压写入点或真实磁盘满。

统一收尾按现有保护规则回收1,594,104,151逻辑字节，最终12,714,166,749字节（11.841GiB）；安全候选耗尽后仍高于10GiB，未扩大删除范围。当前交付、签名密钥、安装仓库、原包／存档与验收证据保留，实际范围与容量仅维护在[瘦身记录](project-slimming.md#独立游戏包交付收尾2026-10-11)。源码推送与Release发布已完成，原手写单因剩余设备／故障矩阵未删除“宏伟大计”。

## 1.0.6：手写改动单第1项（2026-10-11）

手写文件更名为 `手写改动单.md`，第1项完成并删除，剩余原文与任务量标记保留。盒子普通提交／保存采用固定页头状态，删除人机不再因临时反馈插入而跳动；未确认及失败继续明确提示。盒子与六款游戏（宝可梦两版）全屏入口归入视频设置，原生提供全屏／无边框窗口／窗口，固定F11且不展示快捷键提示。真人“射击按钮”可独立关闭／恢复并保留本地选择，不影响接收特效或服务权限；普通电脑浏览器只提供实际支持的全屏／窗口，手机不提供电脑显示模式。

当次[运行ZIP](../../artifacts/maintenance/v1.0.6/game-packages/previous-delivery/TableMax-1.0.6-win-x64.zip) **43,594,443字节**，[314成员清单](../../artifacts/maintenance/v1.0.6/game-packages/previous-delivery/TableMax-1.0.6-win-x64-manifest.json)实际解压 **97,408,673字节**，满足114MB预算及严格小于120,000,000字节门禁。SHA-256 `0048f55745f66c289eed918b78efccb058afbd4e2014bbc67655d36cc3be52c5`，冻结快照 `98e2fffb0655749faf354b34f28b789a26ba69643b76f3cc62691cf57386466c`。[同包证明](../../artifacts/maintenance/v1.0.6/box-task1/results.json)核验673源码输入、全部ZIP与实际运行后成员哈希；302运行成员不变，服务、规则、人机、Worker、Node及全部音效／图像逐字节一致，复用原玩法证据。

[真实盒子操作](../../artifacts/maintenance/v1.0.6/debug-20261008/box/box-task1-actions-20261011/results.json)8检查／6截图通过：390px管理员添加和房主删除、720p添加提交／保存位移0px，真实滚轮位置及删除后邻座DOM保留；私有SQLite写锁导致真实保存拒绝，修订／座位不变；结果未确认时重试入口超通知时长仍可用，同动作ID只保存一次。源码生产组件夹具另覆盖320px、390px、横屏、720p／1080p／4K，普通提交／保存均0px位移，见[源码证据](../../artifacts/maintenance/v1.0.6/box-task1/scroll-source/fixed-final/report.json)，不当作真实设备验证。

实际包[后台窗口](../../artifacts/maintenance/v1.0.6/window-modes/box-task1-window-modes-20261011/results.json)与[正常前台窗口](../../artifacts/maintenance/v1.0.6/window-modes/box-task1-window-modes-foreground-20261011/results.json)均通过三模式、幂等、F11／菜单／Escape、无边框返回与最大化恢复、主机／公共独立和现代艺术菜单；[射击按钮](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/ui/box-task1-preferences-fixed-20261011/results.json)证明刷新保留、关闭仍接收真实合法广播、管理员／公共无发送开关及修订不变。六游戏菜单专项均通过，逐项路径见同包证明；仅测共享菜单，没有重跑未变规则或整局。

按历史低通过率排序运行10项实际检查：首批115.57秒，射击测试因误用旧消息形状失败，修正为现有point对象，仅重跑该项并执行新盒子项32.37秒，产品字节未变，原失败保留。构建21.93秒、完整打包35.01秒，原生0警告／0错误；TypeScript、ESLint、格式、范围机制及改动文档链接检查通过。自动检查静音、服务仅127.0.0.1；实体手机、Safari、实际LAN、多显示器与DPI组合未验。本轮沿用1.0.6，未发布Release或导出源码包。

空闲后按预览与保护规则退役过期缓存及8份隔离副本，共回收885,631,422逻辑字节；08:09 UTC实测9,926,552,563字节（9.245GiB），安全候选耗尽，未放宽保护追求8GiB。打包临时目录完整迁入tmp，release仅留当前ZIP／清单；原包、素材、存档与必要证据保留，首次报告目录缺失导致的收尾停止另有记录，见[瘦身结果](project-slimming.md#手写改动单第1项收尾2026-10-11)。

## 1.0.6：UNO右侧白边与手牌宽度（2026-10-11）

去掉玩家页重复根滚动条槽和手牌区旧60px右侧预留；竖屏手牌保持满内容宽度，互动浮球默认移至独立64px底部区域，用户已保存位置继续恢复。规则、保存、手牌本地整理和音效未改。当次[运行ZIP](../../artifacts/maintenance/v1.0.6/box-task1/delivery-before-change/TableMax-1.0.6-win-x64.zip) **43,593,078字节**，[314成员清单](../../artifacts/maintenance/v1.0.6/box-task1/delivery-before-change/TableMax-1.0.6-win-x64-manifest.json)实际解压 **97,403,995字节**，满足114MB预算与严格小于120,000,000字节门禁。SHA-256 `1d2347f837b447bbad148523fdad0a3814239da307df147a62ad29994aad5883`，冻结快照 `592b1686453a317380a800561fecc3e5cf8c490f54059ec8a257d3a3d882e1b6`。

[实际同包证明](../../artifacts/maintenance/v1.0.6/uno-edge-debug/results.json)核对全部ZIP／实际解压成员哈希：309成员不变，变化限于UNO样式、共享互动入口及其目录引用。服务、全部规则、人机与其他游戏资源逐字节保持。两人初始与六人密集手牌各27布局、49.49／49.90秒，覆盖320px、390px、横屏、电脑竖屏指针及720p至4K多比例；内容右边界误差≤1px，根额外空槽0px，首末牌命中、排序及长按整理通过。定向TypeScript、ESLint、Prettier及变更文档链接检查通过，原失败和修正边界见[验证记录](../games/uno/validation-scenarios.md#手牌右侧白边回归2026-10-11)。旧交付与验收保留，沿用v1.0.6，不发布Release或导出源码包；自动检查静音、隐藏、回环地址，实体手机和Safari未验。

## 1.0.6：拉密交互完善与恢复开放（2026-10-11）

经典2–4人／106牌拉密恢复游戏库选择。本轮按现有桌游与手机偏好完善本地牌架：颜色／点数／发牌次序、独立整理模式下拖拽及Alt方向键；等待与暂停时可整理，按实例与本人稳定席位缓存授权牌ID，摸牌追加、刷新与横竖屏切换保留次序。撤销／重置和组操作使用可访问SVG按钮，牌组更多操作进入浮层，落牌行预留空间；选择、建组、撤销与打开菜单保持浏览锚点，仅明确桌面／牌架按钮切换工作区。短横屏并排工具栏与回合条，完整牌面与44px可见点击区保持；已保存／连接及未确认反馈共用固定64px区域，手机明确显示“已保存”。详见[交互规格](../games/rummikub/interaction.md)。本轮未改官方规则、持久状态、variant、人机策略或资源音频。

最终[运行ZIP](../../artifacts/maintenance/v1.0.6/uno-edge-debug/delivery-before-change/TableMax-1.0.6-win-x64.zip) **43,592,908字节**、[314成员清单](../../artifacts/maintenance/v1.0.6/uno-edge-debug/delivery-before-change/TableMax-1.0.6-win-x64-manifest.json)实际解压 **97,403,455字节**，均严格低于120,000,000字节及114MB工程预算。SHA-256 `feb31ddb2bac2af37dd2d71e5f0e7902ccf015572597b743ab3cf918fb67aff2`，冻结构建 `5fe6b8b59963cb640c982287ae57bd4086f3b42309c709767d660cfedb9546b0`。最终组装29.053秒，构建14.903秒、29／30缓存命中，仅拉密网页重建400ms；[交付证明](../../artifacts/maintenance/v1.0.6/rummikub-continuation/results.json)核验672项冻结输入及实际运行前后314程序成员。沿用版本，仅本地运行ZIP／清单；源码按已授权master推送，没有源码包或Release发布。

本地次序与草稿11项精确测试、入口检查范围保护、定向TypeScript、UI／验证器ESLint与Prettier通过。实际解压WebView2静音隐藏验证合计70布局、88张按共享策略筛选的证据图，覆盖320×568、390×640、650×390、667×375、720×390、844×390，以及720p至4K、主机／公共／玩家、14／30张牌架、首次出牌／重组／小局与终局。最终包[稳定操作](../../artifacts/rummikub/validation/ui-preview/accepted-stability-2-30-20261011/results.json)25.52秒、[完整重组](../../artifacts/rummikub/validation/ui-preview/accepted-reorganization-4-20261011/results.json)26.23秒通过；包含暂停的无动作与本地整理、暂藏第二张牌时首／末Alt边界、完整缓存不变与撤销原位退回、刷新草稿和真实回合转换。入口2／3／4人、五席限制、首次出牌和结算使用前一同版包原通过报告，后续唯一变化为本地键盘边界保护，详见[逐成员等价与原包边界](../../artifacts/maintenance/v1.0.6/rummikub-continuation/final-member-equivalence.json)，没有把旧报告改标新SHA。

[自然整局报告](../../artifacts/rummikub/validation/runtime-continuation-complete-20261011/results.json)在前一同版实际包中完成2／3／4人共九小局，每场一次真实保存／停服／重启／原身份恢复。实际包服务、规则、策略、Worker与Node在最终包逐字节一致，全部313个未改程序成员核验后复用；最终包仅重跑受影响UI，不重复规则与纯策略27场历史矩阵。三场实测16.88／34.60／30.05秒，379次服务Worker启动，真人身份驱动最长受测决定489.81ms，32MiB旧生代／2秒预算不变；600个保存状态、588个checkpoint及1,844次秘密投影核验通过。服务50ms采样heap峰34,264,992／36,406,136／40,604,000字节，相对空盒增量18,426,792／20,604,600／24,790,120字节；采样不代表分配峰值，既有最坏搜索及重载／连续4K压力警告继续保留。

八项原验证器失败原位保留：首批定位未显式滚动且默认游戏已选，第二批等待文案不匹配及开局自动导航，第三批暂停aria-disabled被自动点击阻止和旧内嵌拆分查询。前两批各累计三项失败停止，第三批两项失败后其余适用项通过；明确修正后仅重跑受影响项。实际截图另暴露短横屏牌架被压缩和手机保存标记隐藏，分别修复布局及标记；只读复核发现Alt边界暂藏牌错位，增加有区分度的实际回归后通过。原报告、失败截图与当次验证器源码仍保存，详情见[游戏验证](../games/rummikub/validation-scenarios.md#交互完善与入口恢复2026-10-11)。独立650px单图建议收紧短屏保存条，本轮保留固定高度以容纳持续连接／重试和完整昵称，触控与牌面实际几何通过；部分滚动行正常裁切，不把单图建议写成额外验收。

本轮为回环地址实际程序、模拟触控视窗和静音音频调用检查。实体手机、现场LAN、iOS Safari和真人听感未验，不用模拟或播放事件冒称通过。规则最高来源仍为2025官方经典原件，历史v1.0.5与其他游戏原结论及哈希保留。

收尾[安全维护](../../artifacts/maintenance/v1.0.6/rummikub-continuation/maintenance-final/result.json)退役四个已结束且登记通过的验证临时目录187,008,417字节及四项过期构建缓存439,621字节，共187,448,038字节。第一次引用审计期间文档变化触发保护、保留原中止记录；基于稳定文档重新预览后执行，未放宽保护。四个近期打包目录完整移至tmp，共2,524文件953,861,157字节，逐路径／大小／SHA相同，继续受近期保护，见[迁移清单](../../artifacts/maintenance/v1.0.6/rummikub-continuation/staging-relocation.json)。07:23 UTC实测逻辑空间10,146,001,528字节（9.449GiB），低于10GiB门槛，自动追加删除0；release仅保留当前ZIP／清单，当前验收图、原素材、规则、存档与缓存依赖保留。

## 1.0.6：手写bug第5–7条修复（2026-10-11）

UNO 改为出牌保存后独立抢按；默认人机随机选择合法实体牌和Wild颜色，三档喊牌／抓漏分别独立计时，暂停冻结、旧窗口取消。手机玩家摘要超过三人固定两行，末牌留白与本地整理保留；保存条和结算内容均进入正常布局，不再互相遮盖。阿瓦隆每次提名后逆时针逐席讨论、队长最后，仅管理员可跳过；5–10人两配置及秘密权限不变，旧投票不倒退补讨论。顶层图文规则、用户原话偏好与资源清单同步更新。第8条下载与公共契约重构未实施。

最终[运行ZIP](../../artifacts/maintenance/v1.0.6/rummikub-continuation/delivery-before-change/TableMax-1.0.6-win-x64.zip) **43,590,592字节**、[314成员清单](../../artifacts/maintenance/v1.0.6/rummikub-continuation/delivery-before-change/TableMax-1.0.6-win-x64-manifest.json)实际解压 **97,396,106字节**，两者严格低于120,000,000字节及114MB工程预算。SHA-256 `a8cafdf3f06e18c755bbb2f4cc90942f3673f70d6ca617dc2dcf945d7994b3dc`；冻结构建 `8e0f3d0d8ac424e280c4500d1b30fff31acb1c0d37f3472eb46d68691df05309`。最终组装34.144秒、30／30缓存命中；[交付证明](../../artifacts/maintenance/v1.0.6/bug-five-seven/results.json)绑定实际运行、全部成员哈希与版本。没有导出源码包或发布Release。

[UNO验证](../games/uno/validation-scenarios.md#bug第5条修复2026-10-11)包含真人抢按／抓漏／+4权限、保存失败、三档普通模式真实等待、策略固定局面和自然500分比赛、共享调度／取消及Worker预算；最终包六人尺寸矩阵、长按整理、小局／整场结算通过，实际84.25秒／21截图。[阿瓦隆验证](../games/avalon/validation-scenarios.md#bug第6条修复2026-10-11)包含5–10人两配置、跳过越权、保存／重启／回退、36场32MiB Worker自然整局、十人四类实际终局、终局内容宽度与旧5／6人实际SQLite恢复。未改四款游戏运行成员逐字节一致，复用原证据，见[成员比较](../../artifacts/maintenance/v1.0.6/bug-five-seven/member-equivalence.json)。

[全项目音效审计](../../artifacts/maintenance/v1.0.6/bug-five-seven/audio-audit.json)记录289份项目音频（181份assets音频及108份清单指向的原素材／历史参考）、65组无损等价WAV／FLAC、生成脚本／清单引用与114份实际运行成员；实际包无重复哈希或同名多格式。原素材保留，本次删除0文件，仓库／运行包节省均0字节，新抓漏音效23,065字节。WebView2实际新保存结果播放和Edge静音解码通过；[Windows WebKit报告](../../artifacts/maintenance/v1.0.6/bug-five-seven/audio-decoders.json)缺WebAudio且FLAC加载超时，未改标通过。实体手机、现场LAN、iOS Safari和真人听感继续待现场验收。

原失败保留：讨论历史校验键误改已修正；人机整局动作上限因新增真实讨论从240／400放宽至650，单决策预算不变；重复投影取消演出待渲染帧已修复。截图审查发现终局容器收缩与UNO结果内容被压缩，分别修复宽度和结果容器，增加明确断言并复验。UNO音效脚本原等待出牌音效即检查喊牌已修正为等待指定cue。没有用模拟设备、播放事件或自动检查替代真人验收。

收尾[安全维护](../../artifacts/maintenance/local-cleanup-20261011-061041-931-maintenance/cleanup.json)实际逻辑字节11,113,462,994 → 9,226,080,332，删除1,887,485,204字节／53个合格可再生目录；候选耗尽，受保护内容不扩大清理。近期三个打包目录完整移至tmp，逐文件哈希不变，继续受30分钟保护，见[迁移清单](../../artifacts/maintenance/v1.0.6/bug-five-seven/staging-relocation.json)。release目录仅保留当前ZIP与清单，当前验收截图、原素材和正式存档保留。

## 1.0.6：手写bug前四条修复（2026-10-11）

沿用v1.0.6，前四条已落实连接会话代次防护、局部明亮设置卡片、人机／离线真人角叉与共用删除流程、1500ms＋320ms通知、同义按钮对齐、游戏库全目录人数提醒／简称／德式分类／电脑瀑布流，以及基础与版本资源状态接口。当前资源仍全部本地打包；无下载服务、自动选择或新存档字段。阿瓦隆采用2012经典5–10人，两配置及第四任务双失败，原5／6人兼容版本沿用。第5–8条未实施。

当时运行ZIP与成员清单由[交付证明](../../artifacts/maintenance/v1.0.6/bug-first-four/results.json)绑定SHA、冻结输入、实际成员与本次源码提交，ZIP及实际解压均低于114MB工程预算和120,000,000字节门禁。首次生产包77.764秒，最终增量构建18.130秒、28／30缓存命中；未导出源码包或发布GitHub Release。

[最终包连接报告](../../artifacts/maintenance/v1.0.6/root-entry/bug-first-four-delivery-20261011/results.json)核验干净浏览器、首次传输失败后恢复、HTTP／HTTPS代理拒绝WebSocket升级但polling正常、断网恢复及真实凭证撤销；[旧包基线](../../artifacts/maintenance/v1.0.6/root-entry/bug-first-four-baseline-20261011/results.json)未复现原手机首扫码误报。真实手机LAN首扫码仍待现场验收，模拟视窗／loopback不作为该结论。

[盒子座位](../../artifacts/maintenance/v1.0.6/box-seats/bug-first-four-20261011/report.json)核验角色、阶段、快捷删除／确认／取消／重复点击及93组布局；[游戏库与设置](../../artifacts/maintenance/v1.0.6/game-library/report.json)核验320px至4K、全目录人数提醒、筛选、资源全状态、版本资源键值／管理员权限及不自动选择。通知单测与实际组件检查通过，同步15项单测通过。五款开放游戏及宝可梦两个版本完成三端共享设置菜单烟测，未扩展到无关游戏规则。[阿瓦隆扩展验证](../games/avalon/validation-scenarios.md#510人扩展2026-10-11)包含36场隔离Worker、实际7–10人布局、双失败0／1／2张边界、单失败成功演出和真正旧5／6人SQLite恢复。

失败边界保留：游戏库夹具原断言遗漏阿瓦隆封面，产品封面glob已修正；设置滤镜导致固定通知8px溢出，将模糊移至遮罩并修复窄屏按钮网格后通过。两条旧同步测试与“首次恢复等待最新确认”约束矛盾，改为健康连接周期检查场景而未放宽恢复权限。新增菜单烟测适配各游戏专属声音按钮／浮窗标题，首次10人WebView2启动Unknown及隔离复核均留在原报告。当前证据、原素材和存档受保护，维护结果见[项目瘦身](project-slimming.md)。

## 1.0.6：盒子12席显示兼容（2026-10-10，源码专项）

按最新要求，盒子六席以内保留原布局，7–12席采用按容器宽度排列的座位网格；空位最多12席，已有座位不截断，完整保留昵称、编号、本人、真人连接／准备与三档人机信息。结束后的左上角名称为“恢复加入”，沿用保留身份座位、开放加入并重新准备的 `replay` 动作；各游戏实际人数仍受原规则限制。人数筛选随游戏目录上限生成，最多12人，当前真实目录仍最高6人。

[源码渲染报告](../../artifacts/maintenance/v1.0.6/box-seats/final-20261010/report.json)通过4组检查：三端×1／6／7／9／12容量×320px至4K的90组布局、三端12空座，共93组；另核验结束权限／动作和真实／合成目录人数筛选，保留8张截图。扩展座位无重叠／横向溢出，长昵称完整换行，每席均可滚到完整可见；信息至少16px，新增网格关键状态至少18px。320px玩家与1920×1080主机两张独立单图审查通过。ESLint、项目格式、文案JSON及新增链接检查通过；类型对HEAD基线28项诊断，新增0。首次夹具协议导入失败及旧信息标签被误作关键状态的检查失败分别保留报告，修正夹具后通过，未改游戏规则或扩大原字号改动。

验证为隐藏静音Edge、127.0.0.1夹具的实际源码渲染；合成12人仅证明盒子显示兼容。本轮未重新打包或更新GitHub Release，当前便携包仍以下节已验阿瓦隆ZIP为准。

## 1.0.6：经典阿瓦隆（2026-10-10）

按用户自主制作要求完成经典2012阿瓦隆，平台5–6人；基础与派西维尔／莫甘娜两种同版配置、秘密身份与知识、并发秘密表决、匿名任务、五否决、三失败及梅林刺杀均走统一授权／事务／回退。三档独立策略、三端复古圆桌／角色画卷／封蜡牌件、局部反馈与圣杯／暗影／终末剑全屏演出、12条原创离线声音已接入，顶层图文规则按需查看。版本沿用1.0.6，未创建GitHub Release。

2026-10-10验收 [运行ZIP](../../artifacts/maintenance/v1.0.6/bug-first-four/delivery-before-change/TableMax-1.0.6-win-x64.zip) **43,563,681字节**，[逐文件清单](../../artifacts/maintenance/v1.0.6/bug-first-four/delivery-before-change/TableMax-1.0.6-win-x64-manifest.json) **313成员／实际解压97,352,018字节**，SHA-256 `48d71a06d3e5ca6f48136b0c67d5c665b874a5a2d90dbc29e4c834b94b887550`。114MB工程预算和ZIP／实际解压严格小于120,000,000字节通过。[同包证明](../../artifacts/maintenance/v1.0.6/avalon/results.json)绑定实际ZIP、冻结输入与运行前后成员哈希；来源提交 `3a621c6`，其他任务的既有未提交改动另行保留。

42项阿瓦隆规则／策略／UI／服务／Worker单测与11项范围工具检查通过；5／6人、两配置、三档策略另有12个实际隔离Worker自然整局。首个完整同版包通过五人基础与六人宫廷四种自然终局、320px至4K三端布局、实际操作、秘密／回退、正确事件演出、减少动态、12音频解码与原生单窗口播放权，刷新不重播，共40项操作检查／26布局／82截图。最终声画排版补丁涉及CSS及标题span的JavaScript，当前实际ZIP通过六人五次任务后梅林遇刺、五人梅林幸存，含320px严格clientWidth、刺杀／终局、12项操作／7布局／27截图及313成员前后哈希。新实例手机暗影终局／公共屏黎明终局单图审查通过。旧完整流程原包和证据另存，不混写包边界，详见 [阿瓦隆验证](../games/avalon/validation-scenarios.md)。此结论不新增实体手机、现场LAN、物理屏幕或真人听感认证。

664冻结输入均核对提交，7项仅既有原生文本换行差异；五款已有游戏217文件逐字节未变。相较构建前包增加21项阿瓦隆成员、更新两个目录JSON；首个完整阿瓦隆验收包至当前的呈现差异分别列入 [包差异](../../artifacts/maintenance/v1.0.6/avalon/package-delta.json)。其他游戏沿用原字节证据，不机械重跑。

前包及清单保存在 [阿瓦隆构建前交付](../../artifacts/maintenance/v1.0.6/avalon/delivery-before-change/TableMax-1.0.6-win-x64.zip)，以下更新构建、UNO与更早验收仍绑定各自原哈希。原环境／音频路径／计划参数失败、预算分配理由、窄屏真实溢出与关键耗时在游戏验证维护；本轮安全收尾见 [项目瘦身](project-slimming.md)。

## 1.0.6：更新构建（2026-10-10）

按“更新构建”从已推送提交`414a1bf`重新打包，纳入`7a7824d`的游戏库搜索／筛选、集中通知和仓库图标链接，版本保持1.0.6。[当时运行ZIP](../../artifacts/maintenance/v1.0.6/avalon/delivery-before-change/TableMax-1.0.6-win-x64.zip)41,638,660字节，[逐文件清单](../../artifacts/maintenance/v1.0.6/avalon/delivery-before-change/TableMax-1.0.6-win-x64-manifest.json)292成员／实际解压95,319,481字节，SHA-256 `6bb7a718c4d9ed1488653955460bd6ca2626ba346908f97a8085e92ad4d2b38b`；114MB工程预算及严格120MB门禁通过。

[本轮证明](../../artifacts/maintenance/v1.0.6/build-update-20261010/results.json)绑定实际ZIP：隐藏静音原生程序运行版本1.0.6、Node22.14.0、全部成员运行前后哈希、六人密集UNO三端4张截图、游戏库390px／720p／1080p三项浮窗、原生仓库与网址链接权限通过。[输入审计](../../artifacts/maintenance/v1.0.6/build-update-20261010/source-audit.json)核对629个冻结输入，其中7项仅换行差异；其他任务未提交内容未进入运行输入。与前包相比279成员未变，UNO页面、规则、策略与声画资源逐字节一致，沿用下节完整UNO验收。未新增实体手机、现场LAN或听感认证；仅更新本地ZIP和清单，未创建GitHub Release。

安全测试夹具原先错误等待CSP禁止的嵌套主机及手机外层页面，分别按实际保护和iframe结构修正，失败报告保留。静态浮窗探针改为先真实关闭临时通知；额外头像面板检查仍发现互动浮球覆盖部分头像，保留原问题，不将其标为通过。本轮游戏库检查范围通过`--library-only`明确限定。前一1.0.6包和清单保存在[构建前交付](../../artifacts/maintenance/v1.0.6/build-update-20261010/delivery-before-change/TableMax-1.0.6-win-x64.zip)，下节旧证据仍绑定原哈希。

release目录仅保留当前ZIP和清单；近期打包过程目录移入tmp继续受默认到龄保护。收尾维护两次均被其他清理任务持有的互斥锁阻止，未删除文件、未绕过保护。维护预览逻辑体积约14.185GiB，清理尚未完成，见[实际状态](../../artifacts/maintenance/v1.0.6/build-update-20261010/cleanup-status.json)。

## 1.0.6：UNO 交互优化（2026-10-10）

完成手机长按调位、横滑／出牌隔离、颜色／数字排序、默认可打牌前置、手动顺序与同标签刷新恢复。手牌不按决策ID重建，倾角稳定；去掉重复小字，排行榜改为图标并显示并列名次；玩家最新保存条仅一份且位于手牌上方；桌边座位避让实体牌堆、牌堆标签和中央状态标记，竖屏手牌避让互动浮球。两条用户偏好已写入[偏好页](art-preferences.md#uno-最新要求2026-10-10)，实现参数见[UNO交互](../games/uno/interaction.md#本地手牌整理v106)。产品版本更新1.0.6，UNO规则、策略及存档版本保持不变。

当前[运行ZIP](../../artifacts/maintenance/v1.0.6/build-update-20261010/delivery-before-change/TableMax-1.0.6-win-x64.zip) **41,630,209字节**，[逐文件清单](../../artifacts/maintenance/v1.0.6/build-update-20261010/delivery-before-change/TableMax-1.0.6-win-x64-manifest.json) **292成员／实际解压95,293,378字节**，SHA-256 `11c4e849f9e04df5320a7d0333c78d973cbe84b36196e124e8ce5ce7e1012990`。114MB工程预算及ZIP／解压严格小于120,000,000字节通过；原生实际运行版本1.0.6，每次运行前后292成员哈希一致。

[同包验收](../../artifacts/maintenance/v1.0.6/uno-ui/portable-final/results.json)覆盖2／3／4／6人，320×568、390×844、844×390及主机／公共屏720p—4K和独立缩放，共96项实际布局、110张截图。可信模拟触摸核验非法牌整理、排序、横滑、边缘滚动与取消、暂停取消、摸牌末尾追加、刷新／回退与DOM保留；整理不发送游戏命令、不产生保存声画。+2、万能、+4、UNO、质疑、小局／整场结算七项实际合法动作及保存后声画、历史不补播、减少动态通过，榜单累计积分降序和同分并列通过。保留v1.0.5真实程序先保存对局与显示设置，再用新包恢复，身份与游戏投影保持。

3项本地排序测试、适用类型／静态／格式检查通过。[源码审计](../../artifacts/maintenance/v1.0.6/uno-ui/source-audit.json)将623个冻结输入与已推送实现提交`bb33799`逐一核对，其中1个原生项目文件仅CRLF／LF差异；独立打包排除其他任务未提交改动。[成员差异](../../artifacts/maintenance/v1.0.6/uno-ui/package-delta.json)只有6成员变化，其他286成员含规则、策略、音频及位图逐字节不变，沿用原规则验收，不机械重跑自然500分比赛。旧版[运行ZIP及清单](../../artifacts/maintenance/v1.0.6/uno-ui/delivery-v1.0.5/TableMax-1.0.5-win-x64.zip)与原证据保留。本轮仅本地ZIP／清单及源码推送，不创建GitHub Release。

验证使用隐藏静音WinForms／WebView2及回环监听。手机尺寸、触控、DPI和音频信号是机器模拟，未新增实体手机、现场LAN或人耳听感认证。首次测试的非法牌未滚入视口、夹具没有回退检查点、三人夹具白名单缺口分别修正后只返验对应项；四人跟色标记和390px浮球避让由实际截图复核后补严检查。旧候选报告保留原哈希，不改标为最终包。

收尾退役72,837,033字节到龄生成／冗余副本，当前交付、旧版验收、原资料和素材保留。release仅当前ZIP／清单；近期副本仍受保护。实际维护后14,237,283,404逻辑字节（约13.260GiB），安全候选耗尽，详情见[瘦身记录](project-slimming.md#uno-v106-交互优化收尾2026-10-10)。

## 1.0.5：经典 UNO 完整本地交付（2026-10-10）

新增 Mattel G7942 同版经典 108 牌、2–6 人 UNO：普通回合、两人特别规则、+4 质疑、UNO 抓漏、末张罚牌与 500 分累计，默认／豆包／绝悟独立本地策略，服务端秘密投影与保存恢复。三端采用自然织垫、木边和实体纸牌，包含原创图文规则、保存后的飞牌／功能牌／四色纸屑反馈与十条原创离线音效。规则、出版依据与数字适配从 [游戏主题](../games/uno/README.md) 进入。

当前 [运行 ZIP](../../artifacts/maintenance/v1.0.6/uno-ui/delivery-v1.0.5/TableMax-1.0.5-win-x64.zip) **41,625,580 字节**，[逐文件清单](../../artifacts/maintenance/v1.0.6/uno-ui/delivery-v1.0.5/TableMax-1.0.5-win-x64-manifest.json) **292 成员／实际解压 95,278,471 字节**，SHA-256 `08828727f5c6ce09d1d8283be4d1eec1f262c3f293c7264133e52a9d7923bdad`。114MB 工程预算及 ZIP／实际解压严格小于 120,000,000 字节通过。[独立审计](../../artifacts/maintenance/v1.0.5/uno-20261010/source-audit.json)核验 616 个冻结输入与实际 ZIP，四款旧游戏 200 成员逐字节未变。

规则／策略 39 项、真实服务／32MiB Worker 13 项、范围工具 10 项通过；类型、适用静态及格式检查通过。实际隐藏 WinForms／WebView2 完成 2／4／6 人自然 500 分比赛，共 32 小局，693 个本人权限 Worker 决定最长 304ms；每场真实暂停、回退、退出／重启和原身份恢复。开局、六人 30 牌、9 类特殊／结束状态、320px—4K、独立显示设置、秘密权限、十音轨解码与唯一公共声道、历史不补播和减少动态通过。

上述完整比赛与主要矩阵绑定保留的 `41881a…` 原包。最后仅修正短横屏互动浮球遮跟色标记，规则／策略／运行 JavaScript／音频／位图逐字节未变；当前包实际六人横屏和 320px 密集手牌返验通过，292 成员运行前后哈希一致。[当前便携证明](../../artifacts/maintenance/v1.0.5/uno-20261010/portable-final/results.json)明确当前实测、旧证据与 [增量等价](../../artifacts/maintenance/v1.0.5/uno-20261010/landscape-delta.json)边界，不把旧图改标为新图。全部验证仅监听 127.0.0.1、物理静音；实体手机、LAN、物理 DPI 和人耳听感不记为已认证。沿用 v1.0.5，源码分阶段提交／推送，本轮只交付本地 ZIP，不替换 GitHub Release。

收尾安全退役1,560,336,113字节到龄生成副本；当前交付、原资料、素材、正式存档和验收保留。实际维护结束11,065,160,003逻辑字节（10.305GiB），安全候选耗尽，近期与未知内容继续保护；不扩大删除或把NTFS物理节省计入逻辑目标，见 [清理范围与结果](project-slimming.md#uno-完整制作收尾2026-10-10)。

2026-10-10同版本发布附件替换完成：拉密游戏库按钮显示“开发中”且禁用，[同包盒子](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/release-rummikub-final-20261010/results.json)9项通过，[实际单EXE检查](../../artifacts/maintenance/v1.0.5/release-replace-20261010/shipping-executable-checks.json)通过逐文件哈希、重复提取复用、实际运行和原生安全。[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) 41015483字节／实际解压94595648字节，SHA-256 `89e6412a799d7a076b0cde8e450a9593e027dd24df376ffc0c9809a99092e041`；单EXE 41177088字节，SHA-256 `3d7f5ff112ef5bb4035c463a38b7587a9181e12dbe48a42fe86da2f8907e747f`，带所有权标记的提取目录94653080字节，均满足114MB预算与严格小于120MB门禁。类型、格式及静态检查通过；卡片相对定位的探针失败保留。[原v1.0.5 Release](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.5)的EXE与source ZIP已替换，线上大小与SHA-256一致，标题、正文及原标签对象保持不变，见[发布审计](../../artifacts/maintenance/v1.0.5/release-replace-20261010/github-replacement.json)。源码ZIP对应已验证提交 `4943ca5cf89aabc850df3fb566519973913feb3e`，18550573字节，SHA-256 `57b6e9df5b28f98171b113fc2b4d795235b873e3f86bd73ea3886d03a986ba32`；后续审计文档提交不重导源码ZIP；前包保存在`release-replace-20261010/delivery-before-change/`，线上旧EXE／source ZIP在`online-before/`按原SHA256备份。

2026-10-10入口文案与协议回调：按钮改为“打开网址”，外部入口恢复必须显式HTTP／HTTPS前缀，示例保留脱敏。43项地址及保存权限回归、格式与静态检查通过。[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) 41015416字节／实际解压94595477字节，SHA-256 `3af6de317c3b5b9184d9eee6f575802feb27eb98c7ae52b4a4525c8abbc9bfdd`；[同包盒子检查](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/prefix-restored-20261010/results.json)8项通过。前包保留于`join-prefix-20261010/delivery-before-change/`，历史结论保持。

2026-10-09连接帮助示例脱敏：占位文案改为`example.com:12345`；运行网页已检索确认不再含原域名，真实地址保存逻辑保持。[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) 41015461字节／解压94595489字节，SHA-256 `dd2019e403385220773bcb4644dbe2856dd660d55c8153a7a7798a26fe7dfc72`；[同包盒子核验](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/example-redacted-20261009/results.json)8项通过。前一发言面板包保存在`join-example-20261009/delivery-before-change/`，保留原验收。

## 1.0.5：发言面板优化（2026-10-09）

按用户截图反馈，将六个大卡片改为紧凑单列，保留毛玻璃、独立短语图标和完整原文；修正标题不透明底色的样式覆盖。只改互动面板CSS。[同包结果](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/results.json)核验320×568、390×844、480×640、1280×720电脑玩家竖屏，六条完整可见、无横向溢出、按钮至少48px／正文至少18px；六条真实点击经服务端确认广播，关闭、Escape与焦点未困在浮窗内通过，房间修订不变。测试静音，不代替人耳或实体手机验收；缩放过渡、浮层尺寸与焦点断言的探针失败均保留；320px短屏底部裁切已修复。9项范围工具与格式、静态检查通过。

[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) 41015459字节，[清单](../../artifacts/maintenance/v1.0.5/join-example-20261009/delivery-before-change/TableMax-1.0.5-win-x64-manifest.json) 275成员／实际解压94595489字节，SHA-256 `281f1bff587fc821dddb7af7a1f1dcaa293dddd115b14cf309a88deac1d74c75`。只重建平台网页560ms，21单元复用；包内文件运行前后哈希一致，均满足114MB预算和严格小于120MB门禁。前一盒子优化包保存在`speech-panel-20261009/delivery-before-change/`并保持历史结论。

收尾经预览核对删除本轮六个便携解压／浏览器副本与三个发布过程目录，共1,361,631,219字节；保留当前与前一交付、全部截图、失败结论及原始资料。[逻辑空间维护](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/maintenance-final.log)实际统计8,569,192,538字节（7.981GiB），低于10GiB阈值。

## 1.0.5：盒子初始选择与网址入口（2026-10-09）

首次无存档启动直接选中宝可梦奇遇，存档恢复保持原选择；二维码按钮显示当前完整网址，长网址换行。连接帮助支持无协议的域名／IP与端口，默认HTTP，明确HTTPS保持。48项地址、外部入口及初始选择回归、9项范围工具检查、类型与静态检查通过；首轮沙箱SSR临时目录失败已修复，标题断言改用实际完整游戏名。

[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) 41015354字节，[清单](../../artifacts/maintenance/v1.0.5/speech-panel-20261009/delivery-before-change/TableMax-1.0.5-win-x64-manifest.json) 275成员／实际解压94594995字节，SHA-256 `f1603f0fe175d4f0ede034ad447d1285c7f0b6967f76a64055eac1d8896e462a`。仅重建平台网页与服务（2.336／11.183秒），20单元复用；严格小于120,000,000字节并在114MB预算内。

[同包盒子验证](../../artifacts/maintenance/v1.0.5/network-adaptation/connection/box-final-20261009/results.json)检查实际ZIP成员大小与哈希、静音隐藏主机／公共窗口、真实浏览器加入、裸地址表单保存、QR及按钮同步与320／390／1280px长网址。外部地址只捕获授权目标，不代表现场FRP或实体设备验收。前一声音修复包保存在`box-entry-20261009/delivery-before-change/`，其原验收结论保持。

本轮验证结束后，经预览核对清理两个便携解压／浏览器副本及发布过程目录，共454,317,974字节；当前交付、前包、截图与原始资料保留。[收尾维护](../../artifacts/maintenance/v1.0.5/box-entry-20261009/maintenance-final.log)实际统计8,523,745,211逻辑字节（7.938GiB），低于10GiB阈值。

## 1.0.5：玩家互动音效触摸解锁（2026-10-09）

严格浏览器播放策略下，首次触摸的 `pointerdown` 尚未获得用户激活，提前调用的 `resume()` 会挂起；原实现复用该 Promise，导致已激活的 `pointerup` 无法再次恢复音频。已通过[真实触摸红例](../../artifacts/maintenance/v1.0.5/player-interaction-audio/touch-cdp-input-clean-20261009/results.json)复现，修复为上下文尚未运行时允许后续手势同步重试。300ms过期丢弃、静音视觉及历史事件不补播保持原行为。

[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) **41,015,324字节**，[逐文件清单](../../artifacts/maintenance/v1.0.5/box-entry-20261009/delivery-before-change/TableMax-1.0.5-win-x64-manifest.json) **275成员／实际解压94,594,904字节**，SHA-256 `b23f340cab62674ed8a611d2fc526a50003d7e28868669717879cf934fa8aa35`。114,000,000字节预算及ZIP／实际解压严格小于120,000,000字节门禁通过，快照 `2e21656ca15fcf951c1a3e0161332ba1db6fa8c5a155296ca218048bd680c2f5`；仅平台网页重建2.044秒，其他模块复用缓存。构建中发现旧占用保护误拦下载目录中的独立TableMax，按已知绝对路径与参数缩窄，17项真实PowerShell库存检查通过，工作区／来源工作区及未知实例继续保护。原包与清单保存在 `player-interaction-audio/delivery-before-fix/`，下方拉密验收引用该历史副本。

[同包声音核验](../../artifacts/maintenance/v1.0.5/player-interaction-audio/portable-final-20261009/results.json)和[便携证明](../../artifacts/maintenance/v1.0.5/player-interaction-audio/portable-proof.json)通过。真实Edge采用严格自动播放策略、非激活CDP读取与可信触摸／鼠标输入；五射击和六发言逐项本地解码、从头启动并产生非零destination输入，两个玩家环境各16次播放，最长启动延迟分别5.5／1.8ms。刷新不补播、全新未激活接收页静音、可信手势后新音效、禁用／恢复、盒子与游戏页往返通过，275程序成员运行后哈希不变，无外部请求。玩家浏览器显式开启声音，桌面验证窗口保持静音；这是机器音频信号及设备模拟结果，不代表实体手机、扬声器或人耳听感验收。

18项相关音频／播放／恢复单测、类型检查及所改文件静态检查通过。首轮沙箱SSR临时路径与依赖类型读取失败已通过项目内临时目录及正常权限检查排除；旧探针的Playwright伪用户激活结果不计产品通过，保留各失败边界。当前声音与新验证入口见[开发环境](development.md#玩家互动音效解锁核验2026-10-09)。本次不发布GitHub，也不导出源码包。

## 1.0.5：拉密经典版本地完整交付（2026-10-09）

新增经典版拉密2–4人／106牌：私有牌架、公开桌面、整回合重组草稿及统一合法提交，保存／回退／重启／管理员批准换机，主机／公共／玩家三端图文规则、本地素材及默认／豆包／绝悟人机。按用户最新要求以2025官方经典原件为最高依据，不额外加入百搭先后释放限制；原文明文与数字解释分记，见[来源](../games/rummikub/sources.md)。本次仅本地交付，没有push、源码导出或GitHub发布。

[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) **41,015,328字节**，[逐文件清单](../../artifacts/maintenance/v1.0.5/player-interaction-audio/delivery-before-fix/TableMax-1.0.5-win-x64-manifest.json) **275成员／实际解压94,594,942字节**，SHA-256 `2c5474f86a1b2282d1fd21bde1fd26868e1c055649e9c11ebd4d3ccfecdecf5f`。114,000,000字节预算及ZIP／实际解压严格小于120,000,000字节门禁通过。最终快照`1f8750626a45d378f0f59f311b5ab498c62400fed3724d3af5f1879c4233bc31`，22单元复用20项，组装24.393秒；完整包及275文件哈希、实际运行后的原字节与当前冻结源输入复核见[便携证明](../../artifacts/maintenance/v1.0.5/rummikub-20261009/portable-final.json)。前一同版交付保留在[原包清单](../../artifacts/maintenance/v1.0.5/rummikub-20261009/delivery-before-rummikub/TableMax-1.0.5-win-x64-manifest.json)，历史通过不自动成为新包证据。

同包[三端UI](../../artifacts/rummikub/validation/ui-preview/final-authoritative-20261009/results.json)四组通过：首出与私有草稿、百搭重组提交及回退、小局／整场结束和原班再玩，覆盖320–430px手机、短横屏、电脑720p–4K、六章规则与本地三WAV静音解码。[实际服务](../../artifacts/rummikub/validation/runtime-final-authoritative-fresh-20261009/results.json)2／3／4人完整大局共九小局通过，每场一次真实停服／重启／本人身份恢复，439次服务Worker启动维持32MiB老生代及两秒边界，最长受测真人身份Worker决定1162.18ms。Socket／SQLite保存失败、去重、私有权限、回退和换机，以及未变代码的81源码自然小局等证据入口见[游戏验证](../games/rummikub/validation-scenarios.md)。新增双百搭五项风险与原七项规则共12项通过，当前源码类型检查通过。

最终服务绝对heap峰值68,737,968字节；相对空盒基线最高采样增量51,240,264字节。前者超过初始64MiB标量，包含共享平台成本，后者是本次服务增量检查，不能混同两种指标；额度未提高。此前整页重载及连续4K截图的手机／进程私有内存压力警告保留，普通入桌／游戏三次采样通过不证明全生命周期或完整未GC往返。手机、LAN、物理屏幕与真人听感仍属人工设备边界，自动验收默认静音。

首次最终服务预检使用已启动Native的目录，因程序正常生成`TableMax.config.json`而不再是纯275程序成员，尚未开始任何对局即停止；改为同ZIP全新解压后只重跑服务项，原失败保留，新引用的Native报告路径同步纠正，没有改产品或重复通过的UI。

## 1.0.5：GitHub发布核验（2026-10-09）

本轮用户明确授权commit、push并发布v1.0.5，主题“互动效果与网络优化”。[当时完整EXE审计](../../artifacts/maintenance/v1.0.5/github-release-20261005/shipping-executable-checks.json)41,018,880字节，SHA-256 `359d2cd5bb184c61a737cf44598e939c66be450f7a59a9a702b13769d6c8216d`，内嵌本页已验证运行ZIP。实际提取267文件／94,410,471字节（含所有权标记），重复提取复用、逐文件哈希及原生安全验证通过，见[发布EXE检查](../../artifacts/maintenance/v1.0.5/github-release-20261005/shipping-executable-checks.json)。558项冻结运行输入均已提交且无工作区差异，用户未提交文档重构另行保留。

发布附件仅完整EXE与由标签提交导出的source ZIP；不上传运行ZIP、JSON清单或截图。正文以互动效果、声音播放、网络同步及菜单体验为主，不宣称实体手机LAN目标已达标。线上状态、标签提交与附件大小／SHA-256以[发布记录](../../artifacts/maintenance/v1.0.5/github-release-20261005/github-publication.json)和[GitHub v1.0.5](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.5)为准。

## 1.0.5：菜单、互动并发与手机同步（2026-10-09）

四游戏版本的游戏／视频设置归入菜单，声音入口为图标并保持原权限；互动采用三射击槽及独立最新发言，发言时音效压至30%，300ms启动窗口内从头播放，超时不补播。同步使用运行期stamp、轻量probe、15秒完整校验与800ms只读动作查询；真正恢复清空播放并退休互动水位，健康校验保持连续。

[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) **40,859,424字节**，[逐文件清单](../../artifacts/maintenance/v1.0.5/rummikub-20261009/delivery-before-rummikub/TableMax-1.0.5-win-x64-manifest.json) **266文件／实际解压94,355,356字节**，SHA-256 `8a8c9c8ffe391eeefef19b496235bb535692bcd5b0e2d95fd19b7069b6b754f0`。114,000,000预算和ZIP／实际解压严格小于120,000,000字节门禁均通过，实际解压大小／哈希与清单一致；最终快照`85129453…`。保留[前一交付](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/delivery-before-optimization/TableMax-1.0.5-win-x64-manifest.json)，没有源码ZIP、push或Release。

[定向检查](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/checks/summary.json)覆盖66项产品单测、8项范围工具检查，类型和ESLint通过。共享互动[9项真实渲染检查／8截图](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/ui/portable-box-20261009-repair/results.json)通过；最终包[四版本菜单／12截图](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/ui/portable-menus-touch-repair-20261009/results.json)通过，涵盖三角色权限、嵌套设置、独立屏蔽记忆及三玩家视窗。首次路径错误、验收脚本误用旧HTTP视图接口和42px声音按钮失败均保留；修复仅更新受影响项。最后按钮修复只改变现代艺术UI，[逐文件依赖复核](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/checks/menu-repair-dependency-proof.json)确认共享互动等文件字节未变，复用其通过证据，没有重跑无关游戏规则。

[本机六Socket模拟](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/socket-performance/2026-10-08T18-12-06-412Z-ef1c02bc/results.json)在127.0.0.1对polling／WebSocket各执行30次合法保存及180个接收样本，保存至接收P95分别12.88／4.44ms，漏一推送后514.66／505.48ms恢复。[准备就绪后的音频启动](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/checks/audio-start-latency.json)本机玩家／公共P95为0.70／1.90ms；测试静音，只验证实际声源启动，不认证听感。这些数值不含真实手机、LAN、跨设备时钟误差或手机关键画面更新，真实设备目标仍待[手机同步任务](../tasks/mobile-room-sync.md)验收。

## 1.0.5：互动精修与即时覆盖（2026-10-09）

按本轮最新要求取消互动FIFO及间隔，新事件立即覆盖旧动画和声音；身份、实例／分支复核和有界去重保持独立于游戏状态。浮球可拖拽并记忆相对位置，240ms长按显示以球为中心的六格环盘，中间取消、发言图标；视频设置提供三端独立屏蔽按钮。异步手机解锁、预加载与迟到音轨守卫避免旧音抢播，射击只接收从射击层开始的同一pointer，弹窗迁移清理捕获手势。

[当时运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) **40,851,905字节**，[当时逐文件清单](../../artifacts/maintenance/v1.0.5/mobile-sync-optimization/delivery-before-optimization/TableMax-1.0.5-win-x64-manifest.json) **266文件／实际解压94,333,009字节**，SHA-256 `a7574e9b6402b8bb42dd88c00e80f1a86a0f2fe8957d600ded3b4a989553c4bb`。硬上限120,000,000字节和工程预算114,000,000字节通过，预算余19,666,991字节；完整打包46,894ms，冻结快照`71eb694d…`，实际解压逐文件大小／哈希一致。[前一同版包（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json)及原清单原样保留，以下初次交付结论仅对应旧包。没有源码ZIP、push或GitHub Release。

[同包实际UI](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/final/results.json) **10检查／12截图**通过：拖动持久化、六格与中心取消、取消滑出不误发、dialog迁移恢复、五射击及六语音即时覆盖、真实11音源decode／start／stop、三端独立视频设置、电脑公共屏优先／管理员接管、短屏横屏和四个游戏／版本共享入口；暂停不推进游戏，新房间清场且重连不补播。运行的是本轮ZIP实际解压EXE，非源目录或原型；只做受影响共享控件，不跑游戏规则或整局。服务派发／权限／去重及真实轮询／WebSocket集成13项、几何3项、音频引擎6项、范围门禁7项通过；针对本次文件的TypeScript和ESLint通过。

[命中阶段补拍](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/shot-visual-final/results.json)实际确认鸡蛋、杯子倾倒、番茄飞溅和送花绽放／花瓣；首次粑粑检查因64px Canvas采样要求Alpha恰为255而失败。原图有514个Alpha255像素，浏览器64px采样最大254，属缩放舍入；改用原尺寸采样并先保存诊断后，[仅粑粑精准复核](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/poop-visual-repair/results.json)通过飞行和命中后飞溅，未改产品或重新构建，原失败与历史次数保留。根已目视复核实际花朵、emoji及飞溅截图。

全部11MP3去掉首尾静音并保留自然尾声，时长750–4990ms；鸡蛋六蛋加两拖鞋按1.2x原音和配置发射／命中点同步，送花补原版发射与赠花声音，番茄／粑粑改为实录音效，粑粑替换透明emoji图。厚颜无耻来自央视1994版唐国强诸葛亮；carry实际执行已核验模型的背景音乐分离，邻接非语音区能量减少约28–31dB，此测量不代表听感或完全无残余。当前互动媒体195,117字节，低于500KB目标。来源、原件、处理、署名和哈希见[资源清单](../../assets/platform/interaction/manifest.json)与[处理记录](../../artifacts/maintenance/v1.0.5/interaction-refinement/audio-processing.json)。[11条显式试听页](../../artifacts/maintenance/v1.0.5/interaction-refinement/audio-review.html)默认静音、无自动播放；机器ASR／完整解码不能替代人耳试听，分离伪影与音效听感仍待确认。

首轮静态检查两次因React refs规则拒绝构造器闭包、一次因窄范围tsconfig漏Vite声明和首时间点缺少可选保护而失败；达到3项后停止并修复，仅复核受影响项，记录见[静态批次](../../artifacts/maintenance/v1.0.5/interaction-refinement/checks/static-initial-failures.json)。服务批次的C盘临时目录ENOENT以本项目TMP／TEMP隔离修复，原失败和历史次数保留。全部运行隐藏、静音且监听127.0.0.1，零外联／页面错误，[工程进程退出](../../artifacts/maintenance/v1.0.5/interaction-refinement/ui/final/process-exit.json)已核对。实体手机、LAN、物理DPI及人耳听感未作为已通过。

## 1.0.5：盒子调整与跨游戏互动（2026-10-08）

产品、原生程序集及manifest为1.0.5。真人玩家透明互动球在盒子和游戏共用六等分环盘，五种单次射击与六条固定语音通过独立临时通道发送。全桌1播放＋3等待FIFO、完整时长＋200ms、身份／实例／分支复核和有界去重不改变游戏修订、随机状态、存档或checkpoint。各端可独立屏蔽，电脑互动独立音频桥接优先公共屏；浏览器玩家沿用本地手势解锁。头像裁剪删除方向键，“取消／确定”紧接缩放条并适配短屏；网址入口统一“使用网址”。

[首次运行ZIP（生成副本已退役）](../../artifacts/maintenance/v1.0.6/space-retirement/result.json) **40,857,197字节**，逐文件清单 **265文件／94,363,202字节**，SHA-256 `ab27e4d31ea03d7dec2565d7d8bee11384f950c7375399e93dc07c66ce8f0815`。ZIP及实际解压均严格小于120,000,000字节，114,000,000工程预算余19,636,798字节；[同包根入口](../../artifacts/maintenance/v1.0.5/root-entry/v105-final/results.json)逐文件大小／哈希、实际解压和HTTP／HTTPS入口5检查通过。未导出完整安装EXE或源码ZIP，未推送／发布GitHub。

[互动实际界面](../../artifacts/maintenance/v1.0.5/interaction-ui/final/results.json)12检查：六格选择、五射击三端显示与防误触、六发言槽、本端即时屏蔽、不补播、公共屏优先／主机接管、player无桥接、真实dialog顶层、320×568／844×390／1280×720头像首屏按钮、三游戏及宝可梦两版入口；42个打包FLAC和11MP3离线WebView2解码。[同包游戏显示](../../artifacts/maintenance/v1.0.5/player-display/v105-final/results.json)quick范围 **22检查／34布局／34截图**，包含实际合法动作与四变体；不是完整整局或历史460布局重跑。5文件29项相关会话／服务／队列／几何测试通过，另新增长语音4352ms＋200ms和新实例清空边界通过；最终类型检查通过。

[素材清单](../../assets/platform/interaction/manifest.json)记录原件、来源、派生参数和哈希；互动运行媒体232,441字节，低于500KB目标。26头像从保留原图按quality80／method6派生，尺寸／alpha一致且全部更小，1,138,110→986,872字节，节省151,238字节；40运行WAV无损FLAC转换PCM逐项相等，净省711,478字节，原件保留。机器ASR、完整解码及真实浏览器时长核验通过，**尚未进行人耳试听**，不将模型音频输入失败或ASR同音字当作试听认证；显式试听页保留在素材证据目录。

首轮服务测试因验收读取不存在seatId失败，修正验证器后通过；两次互动页面脚本分别误用了管理员`/game`和select-game携带variantId，修正为`/player/game`与select-variant后通过。素材完成后首次冻结包输入变化被正确拒绝，重新冻结受影响单元后交付；所有失败记录保留。Windows依赖链接沙箱权限问题以本项目沙箱外检查解决，不更改全局工具。测试默认静音、隐藏窗口、仅127.0.0.1；实体手机、现场LAN、物理DPI及人耳听感仍是未测边界。

## 1.0.4：网络连接与多设备页面适配（2026-10-08）

连接区采用“扫码或打开网站”，二维码下方增加48px绿色图标按钮，连接帮助说明手机扫码与手机／电脑直接打开两种方式。二维码、按钮及帮助地址使用同一当前局域网／外部根入口，旧`/player`路由兼容。原生host／public仅将当前顶层邀请链接的可信用户点击交给系统浏览器；普通新页实际按真人玩家权限入座，无管理员凭证或原生桥接。盒子窄屏座位设置重新对齐，对局返回标题按进行中／暂停／结束显示。逐页审查收紧电力公司空厂位、修正现代艺术320px行情拆行，并将宝可梦原版归零提示移至牌下编号行，避免遮住牌值；原版宽屏结算将结果与授权继续入口置于左上，最新保存动作紧邻其下，牌阵位于右侧。游戏规则、投影权限和连接实例未改变。

当前[同包汇总](../../artifacts/maintenance/v1.0.4/network-adaptation/results.json)绑定ZIP SHA-256 `d08c299bce3cef019a8960af9bde1be4cd28cd0654552758ca002f6ce19f804b`：**41,365,985字节**，248文件实际解压**94,964,067字节**，95MB工程预算余35,933字节，双100MB门禁通过。冻结快照`4ae871de…`，完整打包20,571ms，17／18单元缓存命中。前一已验`bdb08d10…`与本轮各候选保留原包／清单及成功失败记录，不改标为最终包。

[最终入口](../../artifacts/maintenance/v1.0.4/network-adaptation/connection/release-delivery/results.json)7检查核验真实原生鼠标／键盘点击、禁止任意弹窗、普通浏览器新页入座／准备、外部地址保存／清空及开始游戏后刷新返回。[最终盒子](../../artifacts/maintenance/v1.0.4/debug-20261008/box/network-adaptation-release/results.json)96布局／21浮窗／118图；[完整玩家显示](../../artifacts/maintenance/v1.0.4/player-display/network-adaptation-release-display/results.json)460布局／126检查／288图覆盖四变体最少／最多人数、设备识别、偏好、720p／1080p／4K、800／960／1200边界、125%／150%模拟密度与320–430手机，检查同一iframe、连接和输入节点，切换不改变revision。[根入口](../../artifacts/maintenance/v1.0.4/root-entry/network-adaptation-release/results.json)5检查及[远程等价故障](../../artifacts/maintenance/v1.0.4/network-adaptation-release/remote/all-2026-10-08T07-10-49-141Z/results.json)11检查核验HTTP／HTTPS非标准端口、禁止WebSocket、推送／确认丢失、重发去重、断线及执行冻结恢复、WSS、换机三阶段和重启，最新revision实际渲染且能提交动作。

[游戏逐页评判](../../artifacts/maintenance/v1.0.4/network-adaptation/game-audit/page-review.json)区分全流程候选审查与最终受影响阶段：电力公司四页及收益、现代艺术五类拍卖／双拍／结算、宝可梦两版关键阶段和30研究说明。最终原版2／6人结算、归零及横屏结果单独补验；行情、收益与新入口独立审查通过[模块等价核验](../../artifacts/maintenance/v1.0.4/network-adaptation/checks/final-module-equivalence.json)明确原包边界，不将早候选截图当成最终ZIP证据。[新入口独立逐图复核](../../artifacts/maintenance/v1.0.4/network-adaptation/visual-review/final-entry-review.json)四图SHA匹配、无可见P1／P2，首屏外座位与帮助需正常滚动，观察范围明确保留。

原生点击首次候选的回调等待死锁已修复；首次完整显示320px瞬时3px溢出保留，验证器等待实际mobile标记、字体与渲染后复验通过，阈值未放宽。原版宽屏结算返修中，旧选择器命中了内部记录按钮而非动作根容器，实际间距检查失败，后续使用根容器实测修正。候选CSS诊断受CSP阻止的失败及后续CSSOM诊断单独保留，诊断状态不可作为便携通过，最终聚合显式拒绝注入和源码模式。受限沙盒依赖realpath／Edge管道失败和懒图片等待等验证器失败继续保留，未计作产品通过。

[完整EXE核验](../../artifacts/maintenance/v1.0.4/github-release-20261005/shipping-executable-checks.json)对应EXE SHA-256 `e14a822ff50453e883de35267f8ec38c843d06251e95eaa4319b01f0c13ad533`、**41,522,176字节**；实际提取含归属标记 **95,016,135字节**／249文件，逐文件哈希、重复提取复用及原生安全通过。95MB工程预算按冻结运行载荷计，100MB提取门禁包含标记。本轮用户明确授权提交／推送、`v1.0.4`标签及GitHub Release，主题为网络连接与多设备页面适配；仅上传该完整EXE与精确发布提交的source ZIP，发布记录由现有入口落盘，公开下载以[Release](https://github.com/anApalpitate/TableMax/releases/tag/v1.0.4)为准。

全部测试隐藏、静音且仅监听127.0.0.1。类型、相关lint／项目Prettier及清理前缀57项检查通过；实体手机、Safari、现场樱花穿透、物理Windows DPI、真实公网证书与默认系统浏览器关联未认证，125%／150%属于CSS视口和密度模拟。工程实际空间与安全退役见[瘦身记录](project-slimming.md)。

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

## 当前源码与本地交付

本节当时本地交付为本页[手写改动单第1项](#106手写改动单第1项2026-10-11)的运行ZIP及逐文件清单，SHA-256 `0048f55745f66c289eed918b78efccb058afbd4e2014bbc67655d36cc3be52c5`；包含本页此前UNO与拉密修复，历史包与发布附件保留实际哈希、证据及结论，不当作当前包验收。

运行ZIP、逐文件清单、原图和实际验收证据均为本地文件，不随源码push上传。源码提交／推送不等于发布新程序；公开下载与附件以GitHub Releases为准。项目逻辑空间以[最新瘦身记录](project-slimming.md)为准，历次数字保留其统计时间与保护范围。

下文旧轮次的“原包保留”描述其当时状态；本轮已按授权退役23份更早运行ZIP，链接改指原清单或退役哈希记录，历史大小、版本及通过／失败结论不改写。当前包、前一份整合包和宝可梦独立旧验收包继续保留。

前一轮电力公司包 `201de235…` 未包含当时正在修改的宝可梦界面。当前包已整合这些修订，并分别核验实际包内画面、完整对局与恢复；未变化游戏采用下述逐文件等价证明复用既有检查。

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
