# 完整安装与程序更新验收

职责：本页维护安装／更新必须证明的条件及方法边界，不能作为“已经执行通过”的记录。当前原件、候选与已完成证明从[当前验收](acceptance.md#当前源码与本地交付)进入；具体命令、参数和输出字段唯一维护在[测试工具](../../tools/test/README.md#完整安装与程序更新验证)。仅用户明确要求本次导出新包时按影响执行，本轮文档整理不启动安装或补造证明。

性质：当前验收方法与证据边界；不代表任何候选已通过。范围包括保存关闭隔离、完整程序安装／更新、原EXE直接启动；通过状态与交付身份查[当前验收](acceptance.md#当前源码与本地交付)，范围选择和失败处理查[验证](validation.md)。操作命令只在[测试工具](../../tools/test/README.md#完整安装与程序更新验证)维护。

## 保存关闭与安装隔离底座（2026-10-15）

保存关闭底座验证动作排空、保存失败、幂等关闭、stdout确认、强制终止、文件保全与路径拒绝。文件系统形状、真实私有管道和实际installer属于不同层次；阶段1原范围与失败见[安装归档](../archive/windows-installation-update-2026-10-15.md#阶段-1-完成记录2026-10-15)。

动态安装状态未完整绑定时强制执行、不复用缓存；静态输入及原始冻结载荷依然分别按SHA核对。证据分清原完整EXE与覆盖后的原生／服务候选，绑定候选文件哈希、方法源码、工具链与夹具前后状态。普通服务回归使用明确的空游戏目录，私有入口fixture只构建所需游戏；逐文件隔离避免Vitest临时SSR缓存跨worker丢失，工程tmp保留原权限与正式数据边界。

运行命令见[工具操作入口](../../tools/test/README.md#保存关闭屏障与隔离底座)，通过／失败证据见[安装归档](../archive/windows-installation-update-2026-10-15.md#阶段-1-完成记录2026-10-15)。现有静音、隐藏窗口、127.0.0.1、先筛范围、[统一失败阈值](validation.md#历史通过率与失败阈值)和修复只重跑受影响项的约束保持。

### 完整安装与程序更新的证据分层

安装验证按下表分层，方法、候选、源码和实际成员SHA分别绑定；组件、解码探针、准备素材及向导取消不能升级为正式系统证明。各轮结果与当前交付统一见[验收](acceptance.md#当前源码与本地交付)和[安装归档](../archive/windows-installation-update-2026-10-15.md)，长期命令只在[完整安装验证工具](../../tools/test/README.md#完整安装与程序更新验证)维护。

| 层次              | 可证明范围                                                                                                                                                                         | 必须保留的限制                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 静态闭包与签名    | actual三PE版本／产品ID、配方与全部payload成员、预算；实际Native／helper读取生产根并Verify envelope及Extract→Verify机器块，EXE／manifest／bootstrap原字节SHA相等                    | 不调用Main、不证明系统安装或Apply；launcher不含更新验签模块，不能将其身份检查写成验签通过                                              |
| 原生更新控制器    | 同一ApplicationUpdate代码，经仅managed注入的HTTP handler测试检查、下载、取消、长度／SHA、回放及资产边界；跨语言公开向量核对严格JSON与RSA                                           | 不开放网页／CLI任意URL钩子；模拟HTTP不等于真实GitHub正例下载，实际线上主动检查单独记录                                                 |
| 保存与恢复        | 实际Native／服务、SQLite失败与原状态保全，playing拒绝、prepare后真实Stop及退出码门禁；helper持续租约、10成员指纹、精确quarantine／默认保留D/G/config、同包重装健康                 | 持久日志构造不等于真实断电；fixtureGUID、组合载荷及sourceSHA保留原身份，不能冒称正式Inno系统链                                         |
| 向导浏览／取消    | 同SHA副本的src默认目录、原中文提示、中文路径、桌面任务关／开／关、返回及正常取消、实际截图和取消保全                                                                               | 明确不点击Install，不证明登记、卸载、UAC或SmartScreen；截图缺失部分与原控件值证据分别说明                                              |
| 双PE准备／复验    | 不同四位PE、同临时根、实际配方／公钥／完整installer材料及工具sourceSHA一致                                                                                                         | prepared／reverified只说明材料就绪；60000／60001未实际执行Apply／Inno前不能写更新成功，csproj排除改动不影响直接csc的已冻结输入         |
| 卸载bootstrap探针 | 全0–255字节、真实helper、三种尾组及非法编码拒绝；内存与落盘SHA一致，配方绑定helper和生成include                                                                                    | 不执行helper或安装登记，不证明旧框架卸载可达，也不替代实际unins EXE/dat容量                                                            |
| 框架失败恢复      | 实际A安装，B切换后合法SQLite写入使10成员指纹变化并拒绝健康；A框架EXE/dat原字节保留，live helper缺失时由A框架默认卸载                                                               | 必须执行含准备复验在内的独立8步专项并核对D/G/config与未知资料保全；预期故障成功触发不是产品失败，仍不称真实断电                        |
| 正式隔离系统链    | 新标准账户与真实profile先执行默认D、I198／短外D正向及旧框架失败恢复三条8步链，再执行正式GUID首装／同包复装／快捷方式／首次物化分项计量／保存后默认卸载／同根重装读回／再次默认卸载 | 临时标准账户及profile操作随验收任务执行，无需单独授权；工程checking、隔离标志、helper-only及只看driver exit0均不足，结果按实际报告认定 |
| 旧便携实际迁移    | 冻结便携程序真实启动、服务API保存及正常关闭；同一完整Inno迁移默认D与外置D两个case，新版恢复原身份／发行，默认卸载保全数据库、配置、G与未知资料                                     | 独立fresh profile逐case实际安装／卸载；保全-only夹具、旧档读取或模块租约专项不能替代，具体版本与SHA白名单不外推到其他候选              |

隔离账户驱动核对默认D正向、I198／短外D正向和旧框架失败恢复三份报告的 `passed`、`failures:0`、所有步骤通过及各自8个唯一必需步骤，不能只看driver退出码。三份实际报告均须绑定同一原prepared报告的规范路径及raw SHA，驱动再记录各报告自身的路径与raw SHA；prepared复验包括旧／新不同高位PE、完整材料、公钥及源码输入。三条fixture链不能替代随后正式GUID的保存／卸载重装、完整容量及账户清理证明。固定步骤ID与操作参数只在[测试工具](../../tools/test/README.md#完整安装与程序更新验证)维护。

当前版本的实际系统结果、完整容量、迁移及推广证明只在[验收](acceptance.md#当前源码与本地交付)维护。容量报告须分开程序／框架／元数据／当前G与存档／缓存／事务；阶段最大观测值不能称绝对峰值。

正式安装验证器在卸载外层首段退出0后，独立有界等待原卸载EXE消失，再观察卸载日志能以 `FileShare.None` 独占打开读取；成功后才归档原日志字节和SHA。`completionObservation`与首段进程结果分别保留，观察失败仍是失败，不执行卸载重试或代删原EXE。日志仍由后续Inno进程持写锁时，不能仅凭首段0或文件存在就立即归档，也不能声称全部清理已完成。

测试更新签名与生产信任分离。双PE夹具用独立测试GUID、进程内RSA私钥及fixture-only公钥资源，对测试描述原始字节签名和验签；测试与生产描述相互拒绝，不为夹具修改生产产品ID、签名器或内置根。夹具WinForms计时器经一次性 `Application.Idle` 在生产入口完成初始化后启动，退出时解除回调并停止，避免提前创建隐藏窗口；修复夹具时点不等于实际交接通过。具体实现和回归入口见[完整安装验证工具](../../tools/test/README.md#完整安装与程序更新验证)。

旧便携迁移与完整Apply／正式安装链分开编排，须先取得标准测试用户与profile范围授权，并使用真实Medium profile能力。验收输入必须是被冻结的旧便携完整EXE、原始指针副本和新完整installer；先由旧程序生成合法闲置数据和完整G，再经真实installer迁移，不制造数据库或模块形状来规避入口。默认D核复制与原B逐文件保全；外置D核原指针及G保全。每case完成精确默认卸载并清除登记后才能进入下一case，报告绑定原输入、执行副本、源码、SID及两个case的实际结果，账户／profile清理报告SHA另行绑定。工具的固定版本白名单、命令及报告字段见[工具README](../../tools/test/README.md#完整安装与程序更新验证)，更换输入须重审，不能把工具准备写成迁移通过。

账户子进程必须加载真实标准用户profile，按Windows实际文件夹和身份归一 `USERPROFILE`、`LOCALAPPDATA`、`APPDATA`、`HOMEDRIVE`、`HOMEPATH`、`USERNAME`、`USERDOMAIN`，并核对应用数据路径属于本次profile；临时根与输出只授予新SID所需权限。PowerShell 5.1通过 `ProcessStartInfo` 调用Node，显式UTF-8并行读取stdout/stderr、有界等待排空后按实际ExitCode判定，避免原生命令stderr被 `ErrorActionPreference=Stop`误判；异常和双流日志保留。

收尾先停止自有runner，再按新SID、固定进程句柄和精确创建时间复核并有界扫至零，不按进程名杀程序。仅删除本轮创建的账户和精确SID／路径且已卸载的非特殊profile；账户或profile清理失败使全链失败，最终原始清理报告SHA绑定正式安装证明。授权、当前执行结果和失败预算见[安装归档](../archive/windows-installation-update-2026-10-15.md)，current推广仍须完整系统证明。

框架恢复的故障注入仅存在于显式编译的fixture alternate Main：严格限定测试GUID、60001、请求、隔离根、默认D、实际安装身份／receipt及包内Node摘要。包内Node对隔离foundation库合法写入并关闭，产生字节变化见证后Native返回42，发生在checking／persistent入口之前；生产Program和桥接不含该注入入口。直接复制已恢复helper再执行 `--uninstall` 只证明组件路径，不能证明框架自己的固定SHA可达；双PE材料已准备或全字节解码通过也不抵扣实际A框架卸载。

`TABLEMAX_INSTALLATION_HEALTH_CHECK=1`仅使helper的健康启动显式静音后台checking后退出；正式默认更新仍启动并保持普通新版主机。持久在线交接fixture分支优先，不以checking代替新主机持续运行证据。该工程标志不替代正式GUID、fresh SID或完整安装验收；不同来源、旧sourceSHA的通过报告按未变化方法复用，不增加新统计或清零原失败。

### 正式执行记录与证明封存

实际执行与最终proof封存分开。正式执行和账户／profile清理均成功后，驱动先按原字节保存 execution-proof.json，再生成绑定delivery、proof、isolation及方法源的 execution-receipt.json；封存核验原件、日志、三链与保留runtime，不再次运行产品。fixture-only或迁移报告不能冒充正式proof。

后续绑定／封存失败时，保留成功清理的原isolation与两份execution原件，另写 acceptance-binding-error.json 并退出1；不能倒写账户执行失败，也不能仅凭receipt宣称正式验收通过。修复封存后可只读复验并CreateNew输出新proof，仍须核对全部原件及方法源SHA。命令见[测试工具](../../tools/test/README.md#正式执行记录与证明封存)，具体通过结果与方法源范围只在[验收](acceptance.md#当前源码与本地交付)维护，既有产品证明保持原范围。

方法源由 execution-method.mjs 复用runner version2指纹收集，显式声明PowerShell父／子与动态C#依赖，不因拆文件遗漏执行方法，也不新增另一套范围注册表或统计。一次性工具盘点只是整理依据。

真实Updater入口的观察PS使用独立stdout／stderr文件，按该PS的实际exit结束，不能等待间接Native持有的管道EOF，也不能据PS或Updater退出0推定间接Native退出。Updater自身仍核对原进程句柄、模块、SID及退出0；冷Native另核真实ready和持句柄正常退出，热唤起核原Native／服务PID及面板请求。输出是有界原字节快照，不声称后代EOF；超时终止观察器后最多再等待5秒，未确认终止仍失败，后代交精确账户清理门禁。

### 正式执行记录与证明封存（接口待验证）

旧标题入口，正文见[正式执行记录与证明封存](#正式执行记录与证明封存)。

## Windows完整性与隔离验收

工程继承Low标签会使生成EXE与Node降为Low，写正常HKCU被拒绝。profile测试模式随安装验收任务执行，无需另行请求账户及profile操作授权；核实际新标准SID／真实目录／两个Medium token，仅物化同SHA副本，不修改原标签、token或DACL；日志及清理证明留工程，具体入口见[完整安装验证](../../tools/test/README.md#完整安装与程序更新验证)。

## 原EXE安全标记与直接启动门禁

同SHA副本通过不能替代原交付文件自身的安全标记和原路径启动。完整交付必须单独核验原EXE的mandatory label、owner／DACL、ADS／MOTW及Authenticode，并从其冻结canonical路径在干净标准profile直接启动；记录真实原进程与向导子进程映像、SID、Medium／非提权令牌、实际截图、正常取消退出和自有Job归零，以及精确账户／profile清理。原EXE的内容及安全元数据、源目录的内容在启动前后须保持一致；复制、改名、解压后运行或只有requested路径不计原EXE通过。

本地生成EXE继承Low是独立交付缺陷；只允许在核原SHA后对该可信最终产物做单文件Low→Medium归一化并记录前后保全，不改源工具标签、DACL、MOTW或系统策略。Windows完整性机制见[Microsoft MIC](https://learn.microsoft.com/en-us/windows/win32/secauthz/mandatory-integrity-control)，单文件标签参数见[icacls](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls)。项目免费RSA应用签名与Authenticode分别记录，NotSigned不冒充已签名或SmartScreen信誉。

原路径浏览／取消证明作为完整安装／保存／卸载证明的补充，不能互相替代。封包采样原文件安全状态，本地current切换与公开发布预检必须读取原始补证并再次查原文件，缺证、Low、MOTW、实际Low／提权进程、源目录变化、非正常取消或清理失败均停止交付。具体命令与输出字段唯一维护在[测试工具](../../tools/test/README.md#原交付exe的安全标记与原路径启动)，实际结果与缺口见[当前验收](acceptance.md#当前源码与本地交付)，旧马尼拉候选仅作[原日期追溯](../archive/acceptance-2026-10-16-to-18.md#马尼拉本地候选2026-10-16)。
