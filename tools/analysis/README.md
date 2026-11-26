# 分析与测量

[空间分析](storage/README.md)为明确的只读审计入口，默认不覆盖报告，也不删除内容。预算报告使用 `node tools/analysis/budgets/game-budget-report.mjs`；`--initialize` 会改写游戏 `game-module.json`，仅在预算初始化任务使用。

内存测量、策略和匹配／flow 分析可能启动实际服务、Worker 或模拟，并创建 `tmp/`、`artifacts/` 及报告；不属于纯静态扫描。辅助 match／flow runner 供测量入口复用，不进入正式 bot 或规则。已有报告路径和参数保持不变。

[程序运行分段基线](runtime/README.md)提供本机源码服务首次／再次启动、六席保存／同步／页面下一帧、真实Worker生命周期与策略分段。仅显式运行，静音隐藏浏览器、127.0.0.1随机端口、有界非内容诊断；不代替真实手机／LAN或完整EXE验收。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                                                                                                                                           | 入口／用途                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [budgets/game-budget-report.mjs](budgets/game-budget-report.mjs)                                                                               | `node tools/analysis/budgets/game-budget-report.mjs`                                                         |
| [games/pokemon-encounters/analyze-pokemon-expansion-matches.mjs](games/pokemon-encounters/analyze-pokemon-expansion-matches.mjs)               | `node tools/analysis/games/pokemon-encounters/analyze-pokemon-expansion-matches.mjs`                         |
| [games/pokemon-encounters/analyze-pokemon-expansion-strength.mjs](games/pokemon-encounters/analyze-pokemon-expansion-strength.mjs)             | `node tools/analysis/games/pokemon-encounters/analyze-pokemon-expansion-strength.mjs`                        |
| [games/pokemon-encounters/audit-pokemon-expansion-completion.mjs](games/pokemon-encounters/audit-pokemon-expansion-completion.mjs)             | `node tools/analysis/games/pokemon-encounters/audit-pokemon-expansion-completion.mjs`                        |
| [games/pokemon-encounters/measure-pokemon-expansion-continuation.mjs](games/pokemon-encounters/measure-pokemon-expansion-continuation.mjs)     | `node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-continuation.mjs`                    |
| [games/pokemon-encounters/measure-pokemon-expansion-flow.mjs](games/pokemon-encounters/measure-pokemon-expansion-flow.mjs)                     | `node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-flow.mjs`                            |
| [games/pokemon-encounters/measure-pokemon-expansion-matches.mjs](games/pokemon-encounters/measure-pokemon-expansion-matches.mjs)               | `node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-matches.mjs`                         |
| [games/pokemon-encounters/measure-pokemon-expansion-strategy-probe.mjs](games/pokemon-encounters/measure-pokemon-expansion-strategy-probe.mjs) | `node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion-strategy-probe.mjs`                  |
| [games/pokemon-encounters/measure-pokemon-expansion.mjs](games/pokemon-encounters/measure-pokemon-expansion.mjs)                               | `node tools/analysis/games/pokemon-encounters/measure-pokemon-expansion.mjs`                                 |
| [games/pokemon-encounters/pokemon-expansion-flow-observer.mjs](games/pokemon-encounters/pokemon-expansion-flow-observer.mjs)                   | 内部辅助／声明／夹具；由对应入口调用                                                                         |
| [games/pokemon-encounters/pokemon-expansion-flow-observer.test.mjs](games/pokemon-encounters/pokemon-expansion-flow-observer.test.mjs)         | 工具隔离回归：`node --test tools/analysis/games/pokemon-encounters/pokemon-expansion-flow-observer.test.mjs` |
| [games/pokemon-encounters/pokemon-expansion-flow-runner.mjs](games/pokemon-encounters/pokemon-expansion-flow-runner.mjs)                       | 内部辅助／声明／夹具；由对应入口调用                                                                         |
| [games/pokemon-encounters/pokemon-expansion-match-runner.mjs](games/pokemon-encounters/pokemon-expansion-match-runner.mjs)                     | 内部辅助／声明／夹具；由对应入口调用                                                                         |
| [memory/measure-game-heap.mjs](memory/measure-game-heap.mjs)                                                                                   | `node tools/analysis/memory/measure-game-heap.mjs`                                                           |
| [runtime/measure-runtime.mjs](runtime/measure-runtime.mjs)                                                                                     | `node --import tsx tools/analysis/runtime/measure-runtime.mjs --samples=24`                                  |
| [runtime/measure-workers.mjs](runtime/measure-workers.mjs)                                                                                     | `node tools/analysis/runtime/measure-workers.mjs`；独立重测Worker段                                          |
| [runtime/summary.test.mjs](runtime/summary.test.mjs)                                                                                           | 有界样本／百分位回归：`node --test tools/analysis/runtime/summary.test.mjs`                                  |
| [runtime/summary.mjs](runtime/summary.mjs)                                                                                                     | 内部有界数值样本及P50／P95汇总                                                                               |
| [storage/space-analysis.mjs](storage/space-analysis.mjs)                                                                                       | `node tools/analysis/storage/space-analysis.mjs`                                                             |
| [storage/space-analysis.test.mjs](storage/space-analysis.test.mjs)                                                                             | 工具隔离回归：`node --test tools/analysis/storage/space-analysis.test.mjs`                                   |

## 人机离线评估

从仓库根运行 [bots/run.ts](bots/run.ts)。通过生产模块注册表加载当前正式玩法。`--game=<id>` 指定游戏，`--variant=<id>` 可选择已声明玩法，省略时沿用默认玩法，`--seeds` 为不重复的正 32 位整数列表，`--levels` 按座位顺序指定人机等级，`--max-steps` 限制每场推进次数。`--setup` 可传玩法验证的 JSON，省略时使用当前默认配置。

```powershell
node --import tsx tools/analysis/bots/run.ts --game=uno --seeds=781 --levels=default,doubao,juewu,default
node --import tsx tools/analysis/bots/run.ts --game=pokemon-encounters --seeds=20261126 --levels=default,default
```

UNO 可传 `--uno-calibration=<JSON 路径>` 启用离线 B 组，`--uno-samples=8|16` 选择共享假设数。文件声明 `version: 1`、[固定特征顺序](../../games/uno/bot/calibration.ts)和与之对应的有限数值 `coefficients`。文件摘要进入离线策略身份，仅为该次所选绝悟席启用搜索。

标准输出为 JSONL，含玩法和策略版本、批次输入、每局结论与动作链摘要。未终局或失败时返回非零状态。命令使用合成种子和规则投影，不启动服务或读取正式存档。程序化 checkpoint 和逐步动作只给受信任的离线评价调用端，标准报告输出公开投影。该入口的快速反应模拟与真实 Worker、事务、重启和回退验收分别认定。

## UNO 校准与配对试点

下面的入口使用合成种子和真实规则，输出 JSON 报告到标准输出，进度写入标准错误。保留报告时由调用者明确选择项目维护路径。正式报告的 `pilot` 记录四人、开启补牌传递、500 毫秒抓漏延迟以及游戏、规则、状态和策略版本。已有报告缺少该字段或配置不一致时，仅可用于开发对照。

- [collect-uno-pending.ts](bots/collect-uno-pending.ts) 接受分开的 `--fit-seeds` 与 `--review-seeds`、`--continuations`、`--max-steps` 和 `--jobs`。每个合成开局按待处理 +2、普通 +4、末张 +4 三类各保留至多一个由真实规则产生的局面，输出授权特征与独立续推的整场标签。原对局未找到的子类保留零覆盖记录。
- [calibrate-uno.ts](bots/calibrate-uno.ts) 接受 `--train-seeds`、`--holdout-seeds`、`--roots`、`--hypotheses=8|16`、`--continuations` 和 `--max-steps`。默认用现行策略选开局采样。正式校准检查用 `--root-policy=search`，在独立留出局中使用拟合后的 B 策略。默认串行，`--jobs=<数量>` 可启用有界并行，最多 8 个进程并预留处理器资源。指定 `--checkpoint=<现有目录内的文件>` 后按完成种子保存，批次绑定源码摘要、Node 版本、试点配置、两组种子和预算。用同样的批次参数重新运行即可续跑，进程数可调。可传 `--steps-per-run=<种子数>` 在种子边界停下并输出 `uno-calibration-progress`。全量拟合后先固定系数，留出样本按原种子顺序合并。可指定 `--natural-fit-data=<冻结的自然拟合语料>` 复用同配置和种子的既有标签。传入 `--pending-data=<独立待罚牌报告>` 时，稀有拟合开局按自然开局的五分之一计权，复核结果按三个子类单列，保持总体和概率分桶采用自然留出。`--fit-policy=anchored` 在拟合种子的四个分组内选择向简单对照收缩的强度。可设 `--ranking-world-batches=4 --ranking-continuations=4`，以更多独立世界作排序复核，B 短搜索和自然概率标签预算照旧。复核最优动作一致时差值为零，仅对有差异的两动作生成额外对照标签。报告含输入摘要、Brier 分数、覆盖与排序门槛。烟测参数只验证流程。
- [diagnose-uno-ranking.ts](bots/diagnose-uno-ranking.ts) 用独立开发种子比较拟合校准和简单评分，各试 8／16 组短搜索假设。四种配置共用同一份候选与独立长续推标签，按正式排序诊断的差值和配对区间判断方向。传 `--plan=<开发计划>`、`--calibration=<B 报告>`、`--checkpoint=<本地路径>`，可用 `--jobs` 和 `--steps-per-run` 分批。开发计划声明 `version: 1`、`seeds`、`roots`、`maxSteps` 和 `ranking` 的 `worldBatches`、`continuations`。输出仅用于开发比较。后续确认仍另开独立正式留出。
- [diagnose-uno-probability.ts](bots/diagnose-uno-probability.ts) 按原开局做嵌套交叉验证，比较按开局、样本数平方根和逐样本加权，以及简单评分、单调再校准。可重复传 `--natural=<拟合语料>` 加入互不重叠的自然拟合分片，并提供 `--pending=<待罚牌补样报告>`。统计仅使用拟合分区，输出分桶偏差及按开局配对的 Brier 差区间，供后续配置选择。
- [train-uno-correction.ts](bots/train-uno-correction.ts) 接受已达到校准门槛的 `--calibration=<报告>`、独立的 `--train-seeds` 与 `--tune-seeds`，另可传 `--roots`、`--continuations` 和 `--max-steps`。校验采样隔离和 B 系数摘要。可用 `--learning-log=<本机 UNO 采集日志>` 加入已完成且匹配主配置的有效轨迹，按回退边界筛选，原始数据留在本机。传 `--checkpoint=<本地 JSON 路径>` 按完成种子或拟合阶段保存训练断点，`--steps-per-run=<数量>` 限制本次继续多少个安全单元。阶段暂停输出 `uno-residual-progress`。`--jobs=<数量>` 可对独立合成种子并行标注与调参，最多 8 个本地子进程并留出处理器资源。按原种子顺序保存，续跑可换并发数。本机日志的根和空闲训练各由单进程处理。新版断点绑定源码、Node 版本和 B 报告的原始字节，早期断点可用创建它的源码续跑。用本机 CUDA PyTorch 拟合残差权重，并由独立数值解复核。对每种权重与限幅组合报告调参增益和改选率。C 候选报告冻结 B 报告原始字节和假设数，可由离线 `run.ts --uno-calibration=<报告> --uno-correction=<候选报告>` 加载，默认沿用训练使用的假设数。
- [attribute-uno-correction.ts](bots/attribute-uno-correction.ts) 接受 `--calibration`、`--correction`、`--abc-plan=<已冻结的 A/B/C 计划>` 和 `--plan=<归因计划>`。归因计划声明 `version: 1`、`tuneSeeds`、`reviewSeeds`、`roots`、`continuations`（至少 16）、`maxSteps`、`bootstrapSeed`，两组种子均须避开 B／C 和 A/B/C 的开发、正式及备用种子。先用 `--stage=tune` 冻结打乱修正值的启用比例，再用 `--stage=review --tuning-report=<报告>` 在独立种子上复核。两个阶段可分别指定 `--checkpoint`。报告区分一个替代候选与可打乱的局面，并给出实际改选、配对差值和按开局种子分组的区间。该入口提供收益归因诊断。
- [size-uno-comparison.ts](bots/size-uno-comparison.ts) 从 `compare-uno.ts --development` 输出的独立完整块估计各对手池的样本方差。用 `--development=<报告>`、`--looks=1|2` 和 `--half-width=0.02` 计算正态近似所需块数，再向上取整以满足各池配额。两次查看按首批的一半预留备用块。将输出中的 `developmentSeeds` 登记到正式计划，所有正式种子另选。耗时预算及最终配额在正式首批前冻结。
- [compare-uno.ts](bots/compare-uno.ts) 接受 `--plan=<JSON>`、`--calibration=<B 报告>` 和 `--correction=<C 候选>`。计划为 `version: 1`，声明 `looks: 1|2`、`bootstrapSeed`、`maxSteps` 和 `seeds`。后者分别登记 `starter`、`mixed`、`strong` 的 `first` 与 `extra` 种子列表。用 `--development` 配合单阶段计划先估计种子块波动，输出单独的开发报告。传 `--checkpoint=<现有目录中的文件>` 在种子块结束时保存。`--jobs=<数量>` 可并行跑同一种子块的各场，默认串行，最多 8 个本地进程并为系统保留处理器资源。失败配额计入执行中的场次，结果按固定座位和 A/B/C 顺序落盘。续跑可调整并发数。可设 `--steps-per-run=<完整块数>` 暂停并输出 `uno-abc-progress`，继续用同一计划和同一阶段的断点。扩样另用断点，附上第一阶段的 `--previous=<报告>`。工具复核源码、Node 版本、B/C 报告摘要、配额和首批扩样判定。累计 10 个异常即停并保留原记录。进度或配额未齐的报告不能登记模型。整场胜率门槛与生产、关键局面和真人体验验收分别认定。
- [watch-uno-training.ts](bots/watch-uno-training.ts) 在已准备的 Windows 本机训练环境中独立启动。用 `--data-dir` 指向当前应用数据，提供 `--job`、通过测量门槛的 `--calibration`、独立的 `--train-seeds` 和 `--tune-seeds`。可选 `--include-recorded` 在首次空闲时封存当时的 UNO 样本。打开主机的空闲训练开关后开始分片。开始游玩、关闭开关或服务退出时撤销许可，未完成的单元可重跑，已保存种子和拟合断点保留。用同一任务参数恢复。产出 `learning/jobs/<job>/candidate.json` 后仍按独立验收流程处理。
- [verify-uno-worker.ts](bots/verify-uno-worker.ts) 接受同一批 `--calibration`、`--correction`、`--comparison`，以及 `--preinstalled-dir`、`--application-manifest=<冻结 full manifest>`、`--worker=<对应的 bot-worker.cjs>`、`--verification-dir=<现有空目录>`。核对冻结文件摘要后，从签名载荷读取同一发行，用真实 Worker 对比六个固定局面的 B／C 耗时与动作，在隔离 SQLite 验证保存失败、取消、回退、正常重开和模型损坏修复。成功时将 `uno-model-worker-acceptance` 报告写到标准输出，包含文件、载荷映射和 B、C、配对报告的 SHA-256，供登记入口复核。固定局面报告与完整对局胜率、真人体验及实际安装体积分别验收。
- [promote-uno-model.ts](bots/promote-uno-model.ts) 将通过各阶段验收的 C 模型登记到本机。传入 `--data-dir`、`--preinstalled-dir=<目标完整程序的 preinstalled-games 目录>`、`--verification-dir=<现有空目录>`、`--calibration`、`--correction`、`--comparison` 和 `--runtime-proof`。空目录须与正式数据及载荷目录分离，签名校验与加载在此进行。登记前复核独立配对门槛，确认真实 Worker、关键局面和回退／重启报告的试点配置、发行标识及 `preinstalledMappingSha256` 一致。`--data-dir=<数据目录> --deactivate=<模型SHA-256>` 仅取消新局可用性；已有对局继续绑定原模型。

## UNO 本机样本来源复核

使用冻结的本机采集 JSONL。按确实观察到的执手情况复核玩家指令，仅登记对应的对局、分支、保存修订和从 0 开始的席位编号。每条填写可复核的本地证据引用。复核文件留在本机。

- 根对象包含 `type: "uno-human-source-review"`、`version: 1`、`inputDigest` 和 `decisions`。`inputDigest` 是冻结 JSONL 原始字节的 SHA-256。`decisions` 的每条包含 `instanceId`、`branch`、`revision`、`seat` 和 `evidenceRef`。
- 给训练器传 `--learning-log=<冻结日志> --learning-review=<复核 JSON>`。复核必须匹配原始字节，范围限于试点中能重新标注的合法存活决策。人机策略、回退废弃动作和校验失败的记录都会使对应复核被拒绝。
- 训练器可用 `--learning-source-weight=uniform` 将同样的入选根按统一来源乘数训练，再用独立种子检验分级加权效果。默认 `graded` 按高质量、标准、探索分别取 1.5、1、0.5。包含本机日志的旧训练断点保留，采用新版分级时以新任务重新拟合。
- 空闲训练器可传 `--include-recorded --learning-review=<复核 JSON>`。它将在首次获得空闲许可时封存对应摘要的日志和复核。若活跃日志后来有追加，使用复核所对应的冻结版本启动独立离线训练。
