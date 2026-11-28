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

从仓库根运行 [bots/run.ts](bots/run.ts)。通过生产模块注册表加载当前正式玩法。`--game=<id>` 指定游戏，`--variant=<id>` 可选择已声明玩法，省略时沿用默认玩法，`--seeds` 为不重复的正 32 位整数列表，`--levels` 按座位顺序指定人机等级，`--max-steps` 限制每场推进次数。`--setup` 可传玩法验证的 JSON，省略时使用当前默认配置。`--jobs` 指定并行计算的进程数，默认 1，最多 8 并保留处理器余量。每个进程执行独立种子，批次仍按请求种子顺序报告。

```powershell
node --import tsx tools/analysis/bots/run.ts --game=uno --seeds=781,782,783 --levels=default,doubao,juewu,default --jobs=2
node --import tsx tools/analysis/bots/run.ts --game=pokemon-encounters --seeds=20261126 --levels=default,default
```

UNO 可传 `--uno-calibration=<JSON 路径>` 启用离线 B 组，`--uno-samples=8|16|32` 选择共享假设上限。32 组模式最多执行 2048 个规则步，只计入全套候选都完成的假设。文件声明 `version: 1` 或 `version: 2`、[对应版本的特征顺序](../../games/uno/bot/calibration.ts)和与之对应的有限数值 `coefficients`。文件摘要进入离线策略身份，仅为该次所选绝悟席启用搜索。

长批次可指定 `--checkpoint=<现有目录中的 JSON 文件>`。断点仅保存已结束或按步数上限截断的公开结果，取消及执行失败的开局在续跑时重新执行。续跑沿用玩法、源码、Node、种子顺序、出场等级和配置，并可调整 `--jobs`。如需主动分批，可用 `--seeds-per-run=<本次新增种子数>`。批次尚未跑齐时保留断点并返回非零状态。

标准输出为 JSONL，含玩法和策略版本、批次输入、每局结论与动作链摘要。未终局或失败时返回非零状态。命令使用合成种子和规则投影，不启动服务或读取正式存档。程序化 checkpoint 和逐步动作只给受信任的离线评价调用端，标准报告输出公开投影。该入口的快速反应模拟与真实 Worker、事务、重启和回退验收分别认定。

## 绝悟跨玩法决策评分

[train-decision-learning.ts](bots/train-decision-learning.ts) 通过生产游戏注册表加载指定 `--pilot=<玩法>`，读取已冻结的 `--plan=<JSON>`，在 `--checkpoint=<现有目录下的文件>` 按完整开局保存进度。计划声明 `version: 1`、`roots`、`maxSteps`、`bootstrapSeed` 以及各玩法互不重叠的 `train`、`tune`、`review` 开局种子。按玩家投影和合法动作构造配对样本，用整场胜负差拟合。CUDA 输出由独立数值解复核，留出对照报告写到标准输出。所用规则、策略、源码或运行时有变化时使用新计划和断点。

[confirm-decision-learning.ts](bots/confirm-decision-learning.ts) 用 `--pilot`、`--training-plan=<原计划>`、`--candidate=<候选报告>`、`--plan=<独立确认计划>` 与新的 `--checkpoint` 运行同样的整局对照。确认计划冻结候选报告摘要和新开局。候选通过要求整场胜率提高至少 3 个百分点且 95% 配对区间下界大于 0。

[audit-decision-learning.ts](bots/audit-decision-learning.ts) 读取 `--evidence=<冻结计划和分玩法报告目录>` 与 `--checkpoints=<断点目录>`，复算标签权重、拟合系数、调参结果及整场胜率和区间。可重复传 `--confirmation=<独立确认计划路径>`，同时核对候选摘要、开局互斥、配对记录和确认判定。[任务计划与结果](../../docs/tasks/bot-rise.md#剩余玩法的决策评分学习)

[train-decision-learning-v2.ts](bots/train-decision-learning-v2.ts) 用 `--pilot`、`--plan`、`--directory` 和 `--jobs` 执行扩展玩法二轮对照。计划冻结 32 个拟合、16 个调参、48 个开发开局及正式开局起点。`--stage=development` 先生成配对标签，再用独立整局比较基线、候选扩展和学习评分。完整开局记录逐项原子保存，核对任务输入后可调整并发续跑。`--stage=formal` 仅接受通过开发筛选的同一权重，按开发块方差冻结样本量，并在预定范围内至多扩样一次。

[audit-decision-learning-v2.ts](bots/audit-decision-learning-v2.ts) 接受 `--evidence=<二轮证据目录>`、`--pilots=<逗号分隔的玩法>` 及可选 `--uno-development=<报告>`。复算独立拟合、调参、开发和正式对照，检查开局完整性、分池和门槛。[二轮结果](../../docs/tasks/bot-rise.md#第二轮未达标玩法复验)

## UNO 校准与配对试点

下面的入口使用合成种子和真实规则，输出 JSON 报告到标准输出，进度写入标准错误。保留报告时由调用者明确选择项目维护路径。正式报告的 `pilot` 记录四人、开启补牌传递、500 毫秒抓漏延迟以及游戏、规则、状态和策略版本。已有报告缺少该字段或配置不一致时，仅可用于开发对照。

采样和校准默认采用 `--feature-version=1`。联合威胁校准在 `collect-uno-pending.ts` 和 `calibrate-uno.ts` 中均指定 `--feature-version=2`，并使用同版本的自然拟合及罚牌语料。独立复算从已冻结的校准评分读取特征版本。

- [collect-uno-pending.ts](bots/collect-uno-pending.ts) 接受分开的 `--fit-seeds` 与 `--review-seeds`、`--continuations`、`--max-steps` 和 `--jobs`。每个合成开局按待处理 +2、普通 +4、末张 +4 三类各保留至多一个由真实规则产生的局面，输出授权特征与独立续推的整场标签。复用冻结拟合分区时用 `--fit-data=<此前的补样报告>` 并省略 `--fit-seeds`，新复核种子须与原拟合和复核种子分开。原对局未找到的子类保留零覆盖记录。
- [calibrate-uno.ts](bots/calibrate-uno.ts) 接受 `--train-seeds`、`--holdout-seeds`、`--roots`、`--hypotheses=8|16|32`、`--continuations` 和 `--max-steps`。可用 `--label-hypotheses=8|16` 单独固定拟合、截断概率标签及独立长续推的每批假设数。计分仍使用完整预算下所有完成的短搜索假设。默认用现行策略选开局采样。正式校准检查用 `--root-policy=search`，在独立留出局中使用拟合后的 B 策略。默认串行，`--jobs=<数量>` 可启用有界并行，最多 8 个进程并预留处理器资源。指定 `--checkpoint=<现有目录内的文件>` 后按完成种子保存，批次绑定源码摘要、Node 版本、试点配置、两组种子和预算。用同样的批次参数重新运行即可续跑，进程数可调。可传 `--steps-per-run=<种子数>` 在种子边界停下并输出 `uno-calibration-progress`。全量拟合后先固定系数，留出样本按原种子顺序合并。可指定 `--natural-fit-data=<冻结的自然拟合语料>` 复用同配置和种子的既有标签。传入 `--pending-data=<独立待罚牌报告>` 时，稀有拟合开局按自然开局的五分之一计权，复核结果按三个子类单列，保持总体和概率分桶采用自然留出。`--fit-policy=anchored` 在拟合种子的四个分组内选择向简单对照收缩的强度。可设 `--ranking-world-batches=4 --ranking-continuations=4`，以更多独立世界作排序复核，B 短搜索和自然概率标签预算照旧。冻结计划可指定 `--ranking-reference=shared-rounds`，在每组独立参考假设内为各候选共用后续小局的发牌、分数增量和规则步数。每个候选独立判断结束和剩余预算，参考模式写入报告及断点。共用参考模式允许至多 48 批，可分配预算给更多独立未知牌假设。复核最优动作一致时差值为零，仅对有差异的两动作生成额外对照标签。报告含输入摘要、Brier 分数、覆盖与排序门槛。用 `--fit-only` 可从指定拟合数据生成待测系数，省略 `--holdout-seeds`。输出为 `uno-calibration-fit`，仍需独立完成正式留出。正式留出可用 `--expected-calibration-digest=<冻结摘要>` 在采样前核对系数。烟测参数只验证流程。
- [audit-uno-calibration.ts](bots/audit-uno-calibration.ts) 接受完整的 `--report`、`--checkpoint`，以及对应的 `--natural-fit-data`、`--pending-data` 和 `--frozen-plan`。从拟合标签复现系数，按冻结的留出分区重算概率、排序和覆盖门槛。复核状态和 B 组验收结论分别输出。
- [diagnose-uno-ranking.ts](bots/diagnose-uno-ranking.ts) 用独立开发种子比较拟合校准和简单评分，各试 8／16 组短搜索假设。四种配置共用同一份候选与独立长续推标签，按正式排序诊断的差值和配对区间判断方向。传 `--plan=<开发计划>`、`--calibration=<B 报告>`、`--checkpoint=<本地路径>`，可用 `--jobs` 和 `--steps-per-run` 分批。开发计划声明 `version: 1`、`seeds`、`roots`、`maxSteps` 和 `ranking` 的 `worldBatches`、`continuations`。输出仅用于开发比较。后续确认仍另开独立正式留出。
- [rescore-uno-ranking.ts](bots/rescore-uno-ranking.ts) 用已有的合成配对标签比较原 B 系数、待测系数和简单评分。传 `--baseline=<原 B 报告>`、`--fit=<拟合候选>`、`--plan=<开发计划>`、`--checkpoint=<开发断点>` 和 `--development=<完整开发报告>`。它复现原开局、短搜索假设和已记录命中数，输出按开局配对的命中率差。用 `--preview` 可读取开发断点副本作中途检查。两种输出都属于开发诊断。
- [merge-uno-fit-corpora.ts](bots/merge-uno-fit-corpora.ts) 用多个 `--fit=<自然拟合语料>` 合并标签，并用 `--report=<来源清单路径>` 保留各分片摘要和开局种子。标准输出的语料可交 `calibrate-uno.ts --natural-fit-data`。各分片须配额一致且种子互不重叠。
- [size-uno-ranking.ts](bots/size-uno-ranking.ts) 接受完整 B `--calibration=<报告>` 和对应 `--checkpoint=<断点>`，按原始开局重抽已确认排序对的数量，估计达到 30 对覆盖所需的开局数。结果仅适用于所观察的候选分布和搜索预算，供估算规模。
- [diagnose-uno-probability.ts](bots/diagnose-uno-probability.ts) 按原开局做嵌套交叉验证，比较按开局、样本数平方根和逐样本加权，以及简单评分、单调再校准。可重复传 `--natural=<拟合语料>` 加入互不重叠的自然拟合分片，并提供 `--pending=<待罚牌补样报告>`。交叉验证统计使用拟合分区。可另传 `--check-natural=<独立开发语料>`，先用原拟合分区生成各方案，再在独立开发开局中比较。报告单列独立开发检查的分桶偏差及按开局配对的 Brier 差区间。
- [train-uno-correction.ts](bots/train-uno-correction.ts) 接受已达到校准门槛的 `--calibration=<报告>`、独立的 `--train-seeds` 与 `--tune-seeds`，另可传 `--roots`、`--continuations` 和 `--max-steps`。`--near-tie` 只标注满足 B 预算与分差条件的候选，并用独立的共享续推为不确定局面补样。校验采样隔离和 B 系数摘要。可用 `--learning-log=<本机 UNO 采集日志>` 加入已完成且匹配主配置的有效轨迹，按回退边界筛选，原始数据留在本机。传 `--checkpoint=<本地 JSON 路径>` 按完成种子或拟合阶段保存训练断点，`--steps-per-run=<数量>` 限制本次继续多少个安全单元。阶段暂停输出 `uno-residual-progress`。`--jobs=<数量>` 可对独立合成种子并行标注与调参，最多 8 个本地子进程并留出处理器资源。按原种子顺序保存，续跑可换并发数。本机日志的根和空闲训练各由单进程处理。新版断点绑定源码、Node 版本和 B 报告的原始字节，早期断点可用创建它的源码续跑。用本机 CUDA PyTorch 拟合残差权重，并由独立数值解复核。对每种权重与限幅组合报告调参增益和改选率。C 候选报告冻结 B 报告原始字节和假设数，可由离线 `run.ts --uno-calibration=<报告> --uno-correction=<候选报告>` 加载，默认沿用训练使用的假设数。
- [train-uno-campaign.ts](bots/train-uno-campaign.ts) 用合格的 `--calibration=<B 报告>`、`--plan=<训练批次 JSON>` 和 `--work-dir=<隔离目录>` 顺序完成各组训练。计划记录 `version: 1`、`roots`、`continuations`、`maxSteps`，以及各组 `id`、`trainSeeds`、`tuneSeeds`。每组使用独立种子，候选保留同一批次其他组的开局排除清单。可用 `--jobs` 或 `--steps-per-run`，用同一计划续跑后输出各组拟合和调参结果。
- [attribute-uno-correction.ts](bots/attribute-uno-correction.ts) 接受 `--calibration`、`--correction`、`--abc-plan=<已冻结的 A/B/C 计划>` 和 `--plan=<归因计划>`。归因计划声明 `version: 1`、`tuneSeeds`、`reviewSeeds`、`roots`、`continuations`（至少 16）、`maxSteps`、`bootstrapSeed`，两组种子均须避开 B／C 和 A/B/C 的开发、正式及备用种子。先用 `--stage=tune` 冻结打乱修正值的启用比例，再用 `--stage=review --tuning-report=<报告>` 在独立种子上复核。两个阶段可分别指定 `--checkpoint`。报告区分一个替代候选与可打乱的局面，并给出实际改选、配对差值和按开局种子分组的区间。该入口提供收益归因诊断。
- [select-uno-development-candidate.ts](bots/select-uno-development-candidate.ts) 用 `--campaign=<完整训练报告>`、`--calibration=<合格 B 报告>`、`--plan=<开发计划>` 和各非零候选的 `--comparison=<完整开发报告>`，逐组复核相同的 A／B 对局。输出所有组的配对结果。按 C−B 开发点估计、较小权重、较小限幅和组名依次选出待正式验证候选，并提供样本量估计。开发筛选报告属于下一阶段输入。
- [freeze-uno-acceptance-plan.ts](bots/freeze-uno-acceptance-plan.ts) 使用 `--selection=<开发筛选报告>`、`--calibration=<合格 B 报告>`、`--correction=<所选 C 报告>`、`--seed=<分配种子>` 和 `--output-dir=<独立现有目录>`，冻结正式首批、备用和归因种子。可通过 `--exclude-seeds` 传入已经使用的其他种子。文件记录 B/C 报告、候选选择和正式计划的摘要；发现同名计划内容变化时保留原文件。
- [size-uno-comparison.ts](bots/size-uno-comparison.ts) 从 `compare-uno.ts --development` 输出的独立完整块估计各对手池的样本方差。用 `--development=<报告>`、`--looks=1|2` 和 `--half-width=0.02` 计算正态近似所需块数，再向上取整以满足各池配额。两次查看按首批的一半预留备用块。将输出中的 `developmentSeeds` 登记到正式计划，所有正式种子另选。耗时预算及最终配额在正式首批前冻结。
- [compare-uno.ts](bots/compare-uno.ts) 接受 `--plan=<JSON>`、`--calibration=<B 报告>` 和 `--correction=<C 候选>`。计划为 `version: 1`，声明 `looks: 1|2`、`bootstrapSeed`、`maxSteps` 和 `seeds`。后者分别登记 `starter`、`mixed`、`strong` 的 `first` 与 `extra` 种子列表。用 `--development` 配合单阶段计划先估计种子块波动，输出单独的开发报告。后续候选可传 `--development-control=<首份完整开发报告>`，复用原 A／B 八场，仅运行同一开局四个座位的 C。须保持 B 报告、源码、运行时和种子方案一致。该选项仅用于开发对照。传 `--checkpoint=<现有目录中的文件>` 在种子块结束时保存。`--jobs=<数量>` 可并行跑同一种子块的各场，默认串行，最多 8 个本地进程并为系统保留处理器资源。失败配额计入执行中的场次，结果按固定座位和 A/B/C 顺序落盘。续跑可调整并发数。可设 `--steps-per-run=<完整块数>` 暂停并输出 `uno-abc-progress`，继续用同一计划和同一阶段的断点。扩样另用断点，附上第一阶段的 `--previous=<报告>`。工具复核源码、Node 版本、B/C 报告摘要、配额和首批扩样判定。累计 10 个异常即停并保留原记录。进度或配额未齐的报告不能登记模型。整场胜率门槛与生产、关键局面和真人体验验收分别认定。
- [watch-uno-training.ts](bots/watch-uno-training.ts) 在已准备的 Windows 本机训练环境中独立启动。用 `--data-dir` 指向当前应用数据，提供 `--job`、通过测量门槛的 `--calibration`、独立的 `--train-seeds` 和 `--tune-seeds`。可选 `--include-recorded` 在首次空闲时封存当时的 UNO 样本。打开主机的空闲训练开关后开始分片。开始游玩、关闭开关或服务退出时撤销许可，未完成的单元可重跑，已保存种子和拟合断点保留。用同一任务参数恢复。产出 `learning/jobs/<job>/candidate.json` 后仍按独立验收流程处理。
- [verify-uno-worker.ts](bots/verify-uno-worker.ts) 接受同一批 `--calibration`、`--correction`、`--comparison`，以及 `--preinstalled-dir`、`--application-manifest=<冻结 full manifest>`、`--worker=<对应的 bot-worker.cjs>`、`--verification-dir=<现有空目录>`。核对冻结文件摘要后，从签名载荷读取同一发行，用真实 Worker 对比六个固定局面的 B／C 耗时与动作，在隔离 SQLite 验证保存失败、取消、回退、正常重开和模型损坏修复。成功时将 `uno-model-worker-acceptance` 报告写到标准输出，包含文件、载荷映射和 B、C、配对报告的 SHA-256，供登记入口复核。固定局面报告与完整对局胜率、真人体验及实际安装体积分别验收。
- [promote-uno-model.ts](bots/promote-uno-model.ts) 将通过各阶段验收的 C 模型登记到本机。传入 `--data-dir`、`--preinstalled-dir=<目标完整程序的 preinstalled-games 目录>`、`--verification-dir=<现有空目录>`、`--calibration`、`--correction`、`--comparison` 和 `--runtime-proof`。空目录须与正式数据及载荷目录分离，签名校验与加载在此进行。登记前复核独立配对门槛，确认真实 Worker、关键局面和回退／重启报告的试点配置、发行标识及 `preinstalledMappingSha256` 一致。`--data-dir=<数据目录> --deactivate=<模型SHA-256>` 仅取消新局可用性；已有对局继续绑定原模型。

## UNO 真人试跑的存档核对

试跑结束后关闭本次房间应用，保留一份 `room.sqlite` 副本。命令使用只读连接，接受排表、参与编号和场次。默认读取副本中的当前房间，给出 `--match-id=<对局编号>` 时也可读取 SQLite 日志中的对应对局。将输出的单场记录放入试跑模板副本的 `matches`，补填实际构建和参与者反馈。[冻结排表](../../docs/tasks/uno-human-pilot-slots.md) · [记录模板](bots/uno-human-pilot/record-template.json)

```powershell
node --import tsx tools/analysis/bots/capture-uno-pilot.ts --roster=docs/tasks/uno-human-pilot-slots.md --save-copy=E:/pilot/room.sqlite --participant=UNO-01 --play=1 --duration-seconds=900
node tools/analysis/bots/uno-human-pilot/summarize-pilot.mjs --input=E:/pilot/record.json
```

采集检查房间、座位、档位、策略、设置与自然终局。管理员提前结束记为中断。输出只保留匿名参与编号、对局号、结果、可选实测时长和来源摘要。主观难度、是否有扳回机会及规则熟悉度由参与者填写，公开局面说明可留在记录表，汇总只统计其填写数量。[试跑排表与证据](../../docs/tasks/bot-rise.md#uno-真人混合试跑)

## UNO 本机样本来源复核

使用冻结的本机采集 JSONL。按确实观察到的执手情况复核玩家指令，仅登记对应的对局、分支、保存修订和从 0 开始的席位编号。每条填写可复核的本地证据引用。复核文件留在本机。

- 根对象包含 `type: "uno-human-source-review"`、`version: 1`、`inputDigest` 和 `decisions`。`inputDigest` 是冻结 JSONL 原始字节的 SHA-256。`decisions` 的每条包含 `instanceId`、`branch`、`revision`、`seat` 和 `evidenceRef`。
- 给训练器传 `--learning-log=<冻结日志> --learning-review=<复核 JSON>`。复核必须匹配原始字节，范围限于试点中能重新标注的合法存活决策。人机策略、回退废弃动作和校验失败的记录都会使对应复核被拒绝。
- 训练器可用 `--learning-source-weight=uniform` 将同样的入选根按统一来源乘数训练，再用独立种子检验分级加权效果。默认 `graded` 按高质量、标准、探索分别取 1.5、1、0.5。包含本机日志的旧训练断点保留，采用新版分级时以新任务重新拟合。
- 空闲训练器可传 `--include-recorded --learning-review=<复核 JSON>`。它将在首次获得空闲许可时封存对应摘要的日志和复核。若活跃日志后来有追加，使用复核所对应的冻结版本启动独立离线训练。
