# 阿瓦隆验证与交付

本页记录经典2012原版、平台5–10人的实际检查及版本边界。现行新局采用唯一 `configured` 人数配置，基础／宫廷记录属于旧版本恢复证据。操作命令唯一维护在 [开发环境](../../reference/development.md#阿瓦隆专项构建与验证)，规则来源与数字适配见 [游戏主题](README.md)。版本沿用1.0.6。

## 唯一配置、并发密投与两种EXE（2026-10-11）

六个人数精确角色表、莫德雷德／奥伯伦秘密投影、非法存档拒绝、刺客候选包含未知奥伯伦及误刺结算恢复通过。专项第四任务使用合法流程进入奥伯伦队长局面：三档按本人授权概率选择和密投，一张失败仍成功，两张失败终局可恢复，见[配置4项](../../../artifacts/maintenance/test-history/runs/4c6080d5-86e4-47cb-bcb4-086f4771ad19.json)。旧局按规则版本／包引用恢复，保留密投与checkpoint；旧大厅开局、旧局再玩均切换现行配置。

5–10人×三档共18场真实Worker自然整局通过，保留每Worker32MiB／每决策2秒预算，主要批次实际142.492秒，见[服务与Worker](../../../artifacts/maintenance/test-history/runs/1200ea69-9419-43dc-9222-c41d80342674.json)。该批另有一项UI夹具导入失败，定向[修复5项](../../../artifacts/maintenance/test-history/runs/44aaa607-2a93-4dcc-b645-877bfa7585f7.json)通过，不把原失败抹去。[十席真实并发峰值](../../../artifacts/maintenance/test-history/runs/84cd3585-4385-4ca5-bb96-9e993a45cf0c.json)通过并核验Worker结束清理；不是最坏内存认证。

[调度11项](../../../artifacts/maintenance/test-history/runs/1959fc34-be0b-40f3-9efd-1d027913d491.json)覆盖无需推进时间即启动全部密投、实战三档等待同时开始、真人／首席保存不重置余席、重复提交、源随机状态变化拒绝、保存失败不更新随机状态、余席超时安全暂停、暂停／恢复、模式切换、回退及迟到取消。该报告同时保留空盒子夹具先入座的失败；修正为先选游戏后，[空盒子及房间7项](../../../artifacts/maintenance/test-history/runs/9a9bb612-10fc-4816-bd14-54eed528bbdd.json)通过。目录过滤、精确版本恢复及共享调度回归只检查实际依赖；其他游戏规则未扩大测试。TypeScript、定向ESLint、Prettier及元数据／范围工具检查通过。

最终[full实际程序](../../../artifacts/avalon/validation/configured-full-shipping-fixed-20261011/results.json)及[box实际程序](../../../artifacts/avalon/validation/configured-box-shipping-20261011/results.json)均绑定冻结输入 `4ca00fc292b75244500646f7449a9765cbb7c8469ffa1587a0e33c0be679aa75` 和实际EXE／内部载荷／逐文件哈希。full预装当前7个玩法；box依次导入旧宫廷包、新configured离线包并刷新页面，旧签名目录保留，新局仅现行配置。源码另验证重复旧目录合并与公开目录过滤，不冒充线上网络刷新或Pages部署。

两种程序各核验7种三端视口，320px手机到4K、六行人数表及本局突出、16px最小正文、无横向溢出；查看规则不改变对局，主机／公共端不挂载本人身份。截图来自实际隐藏静音WinForms／WebView2，监听127.0.0.1；没有新增实体手机、现场LAN或真人听感认证。

full EXE **43,690,496字节**，实际验收提取目录 **96,393,141字节**；box EXE **34,908,672字节**，实际验收提取目录 **87,490,646字节**（含启动生成的小文件），均严格小于120,000,000字节。签名阿瓦隆完整依赖下载 **1,707,417字节**、安装 **1,818,554字节**，均严格小于64,000,000字节；[完整包核验](../../../artifacts/game-packages/v1.0.6/avalon-configured-final-20261011/verification.json)通过。内部载荷由[当前指针](../../../artifacts/package-payloads/v1.0.6/current.json)定位；本轮没有发布、部署Pages、生成源码ZIP或运行ZIP。

原失败证据均保留：首次真实包发现缺configured客户端导出，修正后重打包；另有UI头像夹具、旧公共令牌格式、开局前等待游戏页面等夹具错误，定向修复。box提取曾发生stage访问拒绝，使用独立隐藏后台提取、再次逐文件核验后运行，没有更改系统安全设置。

收尾按既有入口一次安全维护，删除9个旧临时副本386,234,731字节；末次实际逻辑体积21,624,752,310字节，安全候选耗尽，当前程序、原资料与验收保持保护。详见[瘦身记录](../../reference/project-slimming.md#阿瓦隆唯一配置收尾2026-10-11)。下列基础／宫廷结论保留各自旧包边界，不作为新配置通过证明。

## 源码与权限

本次42项游戏单测通过：规则7、秘密权限4、恢复3、策略4、UI6、真实Socket／SQLite服务5、隔离Worker13。范围隔离工具11项另外通过；正常工程权限下全项目TypeScript、定向ESLint与Prettier通过。仅执行阿瓦隆产品项，没有因既有其他任务改动扩大游戏测试范围。

规则／策略证据见 [规则检查](README.md#规则与策略验证)。UI证据 [c1d559bd](../../../artifacts/maintenance/test-history/runs/c1d559bd-985c-45f0-9701-7a891209e7b8.json)，服务与Worker证据 [86917a42](../../../artifacts/maintenance/test-history/runs/86917a42-8078-42cc-9fa1-f544c850851d.json)。历史记录含两项beforeAll生命周期，实际产品测试为18项服务／Worker，不能按历史20条冒充20个用例。

服务覆盖五／六人并发秘密表决和匿名任务、保存失败不发布结果、决策点回退、磁盘重启与管理员批准换机后旧凭证撤销；管理与换机授权不随回退恢复。Worker以32MiB隔离预算、2秒计算预算，运行5／6人 × 两种配置 × 三个等级，共12个自然整局，每局包含暂停／回退，另核验取消；策略单测另有18个固定种子六人整局。真人掉线不由策略代操作，未把自动对局胜率写成真人社交推理能力。

## 实际程序、声画与便携包

[来源原生布局](../../../artifacts/avalon/validation/source-layout-resources-fixed/results.json)覆盖320×568、390×844、844×390手机模拟，主机720p／1080p／4K、公共屏与顶层图文规则。信息至少16px、主要操作至少18px、触控至少44px，无横向溢出。手机与主机分别经无上下文单图审查；封面仅确认模块目录引用，不以游戏截图冒充盒子封面实渲。

[来源播放审计](../../../artifacts/avalon/validation/source-playback-audit/results.json)用实际按钮完成本人身份确认、提名、表决、任务与刺杀；每个核验的保存结果等待对应cue，实际HTMLMediaElement.play完成，并由单个授权原生窗口播放。减少动态与指针穿透分别检查，刷新不重播历史演出或声音。12条包内FLAC全部经真实WebView2解码，非静音／无削波；原始PCM无损回环见 [资源](assets.md)。测试默认物理静音，不代表真人已试听。

当时 [运行ZIP退役记录](../../../artifacts/maintenance/v1.0.6/deep-slim-20261012/retirement-plan.json) **43,563,681字节**，实际解压 **97,352,018字节／313成员**，SHA-256 `48d71a06d3e5ca6f48136b0c67d5c665b874a5a2d90dbc29e4c834b94b887550`；ZIP与解压均低于114MB工程预算及严格120,000,000字节门禁。冻结构建 `dc9e82fe170b49f85f1dea8f9c79b5f70faae065dad3f5db5953899dbd6e96d9`，源码提交 `3a621c6`（首个完整实现为 `e354ea3`）。

完整实际ZIP解压验收分别见 [六人宫廷](../../../artifacts/avalon/validation/portable-six-court/results.json)、[五人基础](../../../artifacts/avalon/validation/portable-five-classic/results.json)：四种自然终局全部通过，各20项操作检查、13项布局、41张截图、16组对应事件特效／播放权，两项共40检查、26布局与82截图，耗时102.94／99.27秒。所绑定的 `bd7d496…` 同版包已按 [视觉修正前包退役记录](../../../artifacts/maintenance/v1.0.6/deep-slim-20261012/retirement-plan.json)退役。

后续调整刺杀长剑与后接遗物位置、最窄屏标题及五张远征牌布局；Effects标题改为两个完整词组span，实际JavaScript和CSS均变化，规则／策略／音图与其他游戏保持原字节。最终当前ZIP定向通过 [六人第五任务与梅林遇刺](../../../artifacts/avalon/validation/portable-six-long-quest-final/results.json)、[五人梅林幸存](../../../artifacts/avalon/validation/portable-five-survival-grid-final/results.json)：12项操作、7项布局、27张实际截图、12组对应事件特效／播放权，耗时41.62／32.64秒。六人以成功／失败交替完成全部五次任务，五人包含实际提名与暂停／回退；均含320px刺杀与终局、真实播放、313成员运行前后哈希。手机暗影终局与公共屏黎明终局分别经新实例无上下文单图审查通过。未重复已通过且未受影响的规则与失败／否决流程，继承证据与当前检查各自绑定原包。[交付证明](../../../artifacts/maintenance/v1.0.6/avalon/results.json)、[冻结输入审计](../../../artifacts/maintenance/v1.0.6/avalon/source-audit.json)和 [包差异](../../../artifacts/maintenance/v1.0.6/avalon/package-delta.json)分别维护。

截图来自实际隐藏WinForms／WebView2；手机视口、浏览器触控及DPI属于模拟。没有新增实体手机、现场局域网、真人听感或真实屏幕认证；renderer／service额度是既有分配，不宣称覆盖最坏情形内存测量。

## 原失败与修复

- 沙箱Vite临时SSR文件及全工程类型模块解析异常：保留原日志，使用项目隔离TEMP／TMP和正常工程权限完成受影响项；没有为环境假错改动旧游戏或扩大依赖版本。
- 首次原生布局夹具使用了源码音频路径，实际构建采用哈希资产路径，造成缺文件；[原失败](../../../artifacts/avalon/validation/source-layout-first/results.json)保留。只修验证路径后布局与12条实际解码通过。
- 初始清单把1MiB JSON载荷占位误用于模块资源磁盘指标。按四幅原创WebP、十二声音和代码的初始设计分配更正为4MiB，实际模块约2MiB；服务／renderer／Worker额度没有增加。最终组装无警告，不把预算分配更正写成内存测量结果。
- 来源演出取样一度只断言存在overlay，可能拍到前一事件。夹具改为等待前一演出结束、核对当前保存事件cue；原 [第一条来源胜利](../../../artifacts/avalon/validation/source-success-first/results.json)仍保留，不以其错误标签取样证明对应事件。
- 独立终局审查先发现扫光削弱中央结果文字，提升文字层级后，同版ZIP复核又发现长剑纹理与三行结论混杂；进一步把刺杀剑与后接遗物移至左侧，手机独立定位和尺寸。仅重验受影响的刺杀与当前包哈希，外围效果强度保留。
- 最窄手机独立审查发现成功／失败断词及“黎明”拆行，改为完整统计单元与两行演出标题。把溢出探针从innerWidth改为实际clientWidth后，[六人原失败](../../../artifacts/avalon/validation/portable-six-survival-narrow-final/results.json)和 [五人原失败](../../../artifacts/avalon/validation/portable-five-assassination-narrow-final/results.json)暴露7px横向溢出；[诊断](../../../artifacts/avalon/validation/source-overflow-diagnostic/results.json)定位已结算远征牌文字的自动最小宽度挤出第五格。改为五格minmax(0,1fr)、计数在已有空格处换行，保留16px；最终第五任务和终局严格clientWidth检查通过，未靠裁切隐藏问题。
- 首次便携计划由PowerShell拼接成单个长参数，两项在原生程序启动前失败。修正为显式参数数组，仅重跑这两项；历史累计失败不清零，不自动重试，原批日志保留在测试历史。

关键已测耗时：首轮生产构建52.934秒；最终增量构建18.875秒、29／30缓存命中；打包与实际ZIP提取／哈希检查33.560秒；服务／Worker检查79.78秒；来源布局17.22秒，来源播放审计31.31秒。四幅生成总计150.629秒，生成与实现并行，不相加冒充总开发耗时。最终整包耗时与收尾空间结果见交付证明及 [项目瘦身](../../reference/project-slimming.md)。

## 5–10人扩展（2026-10-11）

沿用2012经典版、v1.0.6及两个原规则兼容版本。统一人数表和派生公开字段，无新增持久结构；第四任务7人以上双失败，其余一失败。角色／权限覆盖六个人数与两配置；24组第四任务0／1／2失败边界及篡改历史拒绝恢复通过。规则／策略13项、服务／权限／恢复／表现／Worker56项通过；追加5／6／10人保存失败与重启服务8项通过。36场隔离Worker自然整局保留32MiB／每决策2秒预算，服务10人并发表决、5人匿名任务通过。

实际同版本包通过[7人](../../../artifacts/avalon/validation/bug-four-7-layout/results.json)、[8人](../../../artifacts/avalon/validation/bug-four-8-layout/results.json)、[9人](../../../artifacts/avalon/validation/bug-four-9-layout/results.json)三端320px至4K布局；[10人五次任务／刺杀](../../../artifacts/avalon/validation/bug-four-10-long-isolated/results.json)验证第四任务双失败，[10人第四任务一失败仍成功](../../../artifacts/avalon/validation/bug-four-10-one-failure/results.json)验证结果与成功演出。实际旧程序生成5人基础／6人宫廷SQLite，保存秘密角色及一票后关机，新程序恢复暂停、本人权限、投票并继续任务，[旧存档报告](../../../artifacts/avalon/validation/bug-four-legacy-restore/results.json)通过。

首轮10人验证在WebView2打开主机页面时报告Unknown，服务已启动但尚未进入游戏，保存[原失败](../../../artifacts/avalon/validation/bug-four-10-long/results.json)及日志；隔离其他原生启动后一次定向检查通过，不把该次启动失败写成规则错误。共享菜单夹具补齐UNO／阿瓦隆声音按钮及游戏专属菜单标题后，三端设置烟测通过。实体手机、现场LAN与真人听感未新增认证。最终包及收尾空间记录见[总验收](../../reference/acceptance.md#106手写bug前四条修复2026-10-11)。

## Bug第6条修复（2026-10-11）

`discussion.test.ts`覆盖5–10人×两配置的逆时针／队长最后、重提名、提前投票拒绝、逐席完成、跳过、严格字段及旧投票不倒退，共13项。实际SQLite／Socket服务覆盖房主及公共端跳过越权、保存失败不推进、重启与checkpoint恢复。规则／秘密／恢复相关25项通过，策略和服务受影响13项通过；37项实际Worker检查包含36场5–10人×两配置×三档自然整局，32MiB／每次2秒预算保留，含新增真实讨论动作，实际约180秒。

[十人宫廷实际包](../../../artifacts/avalon/validation/bug-567-avalon-10-fixed/results.json)四类终局、管理员真实跳过、讨论和身份浮窗、320px至4K、保存反馈与声音通过160检查／40截图，实际137.4秒。第二局曾缺投票通过演出，修复重复投影取消待渲染帧的时序，原失败保留。截图审查另发现终局容器查询导致宽度收缩；显式填满可用宽度后新增按内容宽度判断两／三列的断言，并定向复验，见[终局宽度](../../../artifacts/avalon/validation/bug-567-avalon-final-width/results.json)。未把最初脚本通过当作视觉审查通过。

实体手机、现场LAN及真人听感未新增认证；原证据绑定各自包哈希，最终包只复验受影响项，不能把模拟视口写成实体设备。

[旧版实际存档](../../../artifacts/avalon/validation/bug-567-legacy-restore/results.json)分别由旧程序生成五人基础、六人宫廷SQLite，保留已密封的一票；新程序恢复本人秘密投影，discussion为空，剩余票正常推进任务。实际通过2项；后续最终包阿瓦隆成员字节未变，沿用原包边界。
