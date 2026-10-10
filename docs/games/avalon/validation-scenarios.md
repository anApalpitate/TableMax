# 阿瓦隆验证与交付

本页记录经典2012原版、平台5–6人、基础／宫廷两种角色配置的实际检查及边界。操作命令唯一维护在 [开发环境](../../reference/development.md#阿瓦隆专项构建与验证)，规则来源与数字适配见 [游戏主题](README.md)。版本沿用1.0.6，没有发布GitHub Release。

## 源码与权限

本次42项游戏单测通过：规则7、秘密权限4、恢复3、策略4、UI6、真实Socket／SQLite服务5、隔离Worker13。范围隔离工具11项另外通过；正常工程权限下全项目TypeScript、定向ESLint与Prettier通过。仅执行阿瓦隆产品项，没有因既有其他任务改动扩大游戏测试范围。

规则／策略证据见 [规则检查](README.md#规则与策略验证)。UI证据 [c1d559bd](../../../artifacts/maintenance/test-history/runs/c1d559bd-985c-45f0-9701-7a891209e7b8.json)，服务与Worker证据 [86917a42](../../../artifacts/maintenance/test-history/runs/86917a42-8078-42cc-9fa1-f544c850851d.json)。历史记录含两项beforeAll生命周期，实际产品测试为18项服务／Worker，不能按历史20条冒充20个用例。

服务覆盖五／六人并发秘密表决和匿名任务、保存失败不发布结果、决策点回退、磁盘重启与管理员批准换机后旧凭证撤销；管理与换机授权不随回退恢复。Worker以32MiB隔离预算、2秒计算预算，运行5／6人 × 两种配置 × 三个等级，共12个自然整局，每局包含暂停／回退，另核验取消；策略单测另有18个固定种子六人整局。真人掉线不由策略代操作，未把自动对局胜率写成真人社交推理能力。

## 实际程序、声画与便携包

[来源原生布局](../../../artifacts/avalon/validation/source-layout-resources-fixed/results.json)覆盖320×568、390×844、844×390手机模拟，主机720p／1080p／4K、公共屏与顶层图文规则。信息至少16px、主要操作至少18px、触控至少44px，无横向溢出。手机与主机分别经无上下文单图审查；封面仅确认模块目录引用，不以游戏截图冒充盒子封面实渲。

[来源播放审计](../../../artifacts/avalon/validation/source-playback-audit/results.json)用实际按钮完成本人身份确认、提名、表决、任务与刺杀；每个核验的保存结果等待对应cue，实际HTMLMediaElement.play完成，并由单个授权原生窗口播放。减少动态与指针穿透分别检查，刷新不重播历史演出或声音。12条包内FLAC全部经真实WebView2解码，非静音／无削波；原始PCM无损回环见 [资源](assets.md)。测试默认物理静音，不代表真人已试听。

当前 [运行ZIP](../../../artifacts/releases/TableMax-1.0.6-win-x64.zip) **43,563,681字节**，实际解压 **97,352,018字节／313成员**，SHA-256 `48d71a06d3e5ca6f48136b0c67d5c665b874a5a2d90dbc29e4c834b94b887550`；ZIP与解压均低于114MB工程预算及严格120,000,000字节门禁。冻结构建 `dc9e82fe170b49f85f1dea8f9c79b5f70faae065dad3f5db5953899dbd6e96d9`，源码提交 `3a621c6`（首个完整实现为 `e354ea3`）。

完整实际ZIP解压验收分别见 [六人宫廷](../../../artifacts/avalon/validation/portable-six-court/results.json)、[五人基础](../../../artifacts/avalon/validation/portable-five-classic/results.json)：四种自然终局全部通过，各20项操作检查、13项布局、41张截图、16组对应事件特效／播放权，两项共40检查、26布局与82截图，耗时102.94／99.27秒。所绑定的 `bd7d496…` 同版包保存在 [视觉修正前包](../../../artifacts/maintenance/v1.0.6/avalon/delivery-before-visual-fix/TableMax-1.0.6-win-x64.zip)。

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
