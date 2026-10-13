# 程序运行分段基线

从项目根目录运行。复用实际源码 `createService`、SQLite、Socket.IO、已构建网页的同步诊断、项目静音浏览器入口与真实 `WorkerBotExecutor`。不优化规则，不改池、公开协议或存档格式，不触发构建／打包／维护。

```powershell
node --import tsx tools/analysis/runtime/measure-runtime.mjs --samples=24
node --test tools/analysis/runtime/summary.test.mjs
node tools/analysis/runtime/measure-workers.mjs
```

需要项目锁定的 Node 22.14.0、依赖、现有 `build/desktop/web` 及本机 Edge；受限进程沙箱下 Edge 可能需要批准后在沙箱外启动。默认 headless、静音、仅监听 `127.0.0.1` 随机端口，设置 `TABLEMAX_AUTO_MAINTENANCE=0`。每席独立浏览器上下文，玩家真实界面在其 iframe 内。额外 Node transport observer 与页面连接使用相同玩家凭证，不增加席位；本基线有六个席位、十三个连接（六页面、六观测、管理员），报告不冒充恰好六条网络连接。

`--samples=6..128` 控制顺序提交数。代表场景为 UNO 六席大厅准备／取消准备，另测同游戏六席种子 fixture 的绝悟策略；不代表游戏公共竞价、全部游戏或整局矩阵。每个提交等待六席收到并且六页面 DOM 修订提交／下一帧诊断后继续，失败不自动重试。

`--renderer=none` 仅测服务／传输／Worker，页面段明确标未测；`--renderer=webview2` 复用隐藏原生测试入口，但必须已有完整可运行 `build/desktop`（含 `preinstalled-games`）。默认 `edge` 无需原生组装，不下载浏览器。源码服务的首次／再次进程启动分别记录启动至就绪、createService 和监听；首次是全新数据目录，再次恢复该目录，不清操作系统磁盘缓存，不称为 EXE 冷启动。页面就绪包含匿名初开、注入测试席位凭证后重载及准备按钮可用，不代表真人扫码入座全过程。

报告在 `artifacts/maintenance/development-efficiency/runtime/`：`runtime.json` 为最新完整运行，`runtime-<后缀>.json` 保留该运行副本，`workers.json` 为独立 Worker 分段。临时编译、隔离SQLite及浏览器输入在 `tmp/efficiency-runtime-<六位后缀>`。独立 Worker 入口只重测该段，不覆盖已测同步结论；它使用编译后的源码和正常 Node 子进程，排除继承 TS loader 的开发开销。

所有时间和字节样本最多256个。报告仅含固定阶段／结果分类、时长、字节、采样内存峰、环境、源码／网页入口SHA及证据路径；不保存凭证、动作、策略输入／记忆、错误原文或投影内容。隔离数据目录仍会产生正常的测试存档，不属于诊断报告。诊断回调仅显式传入时开启；sink抛错不能改变策略成功、错误、取消或退出语义。

分段包含提交→收到、收到→真实保存、保存→广播、客户端收到→frame、提交／保存→frame，以及Worker启动、online→结果、取消时点与取消→退出。`onlineToResult` 包含模块加载／策略，另用同份授权投影直接调用策略测 `directPolicyMs`（它不是Worker内纯策略CPU时间）。JSON投影字节不含Socket.IO封装、压缩或链路开销。内存是定时／分段采样峰，不是分配器绝对峰；Worker RSS含其共享进程与Worker线程。

同进程段用单调时钟。跨服务／页面段使用IPC／CDP往返中点校准，并报告半往返误差；这些是估计。提交→frame负估计排除并单列计数，保存→frame及提交→服务收到负估计归零，不把不同设备原始时间戳直接相减；不能把低于校准误差的数值解释为精确延迟。页面核对DOM修订，但frame仍是浏览器回调，不认证像素已呈现。真实手机、LAN/Wi-Fi、弱网、手机后台恢复、公共竞价与完整EXE启动仍须分别验收。
