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

下面的入口使用合成种子和真实规则，输出 JSON 报告到标准输出，进度写入标准错误。保留报告时由调用者明确选择项目维护路径。

- [calibrate-uno.ts](bots/calibrate-uno.ts) 接受 `--train-seeds`、`--holdout-seeds`、`--roots`、`--hypotheses=8|16`、`--continuations` 和 `--max-steps`。默认用现行策略选开局采样。正式校准检查用 `--root-policy=search`，在独立留出局中使用拟合后的 B 策略。报告给出胜率分桶、简单对照的 Brier 分数、独立长推演对照和证据门槛。烟测参数只验证流程。
- [train-uno-correction.ts](bots/train-uno-correction.ts) 接受已达到校准门槛的 `--calibration=<报告>`、独立的 `--train-seeds` 与 `--tune-seeds`，另可传 `--roots`、`--continuations` 和 `--max-steps`。校验采样隔离和 B 系数摘要。可用 `--learning-log=<本机 UNO 采集日志>` 加入已完成的有效轨迹，按回退边界筛选，原始数据留在本机。传 `--checkpoint=<本地 JSON 路径>` 按完成种子或拟合阶段保存训练断点，`--steps-per-run=<数量>` 限制本次继续多少个安全单元。断点与拟合输入绑定，阶段暂停输出 `uno-residual-progress`。用本机 CUDA PyTorch 拟合残差权重，并由独立数值解复核。对每种权重与限幅组合报告调参增益和改选率。C 候选报告可由离线 `run.ts --uno-calibration=<报告> --uno-correction=<候选报告>` 加载。
- [compare-uno.ts](bots/compare-uno.ts) 接受 `--plan=<JSON>`、`--calibration=<B 报告>` 和 `--correction=<C 候选>`。计划为 `version: 1`，声明 `looks: 1|2`、`bootstrapSeed`、`maxSteps` 和 `seeds`。后者分别登记 `starter`、`mixed`、`strong` 的 `first` 与 `extra` 种子列表。扩样附上第一阶段的 `--previous=<报告>`，工具复核输入摘要、第一阶段结果和未完成块。整场胜率门槛与另外的生产、关键局面和真人体验验收分开认定。
- [watch-uno-training.ts](bots/watch-uno-training.ts) 在已准备的 Windows 本机训练环境中独立启动。用 `--data-dir` 指向当前应用数据，提供 `--job`、通过测量门槛的 `--calibration`、独立的 `--train-seeds` 和 `--tune-seeds`。可选 `--include-recorded` 在首次空闲时封存当时的 UNO 样本。打开主机的空闲训练开关后开始分片。开始游玩、关闭开关或服务退出时撤销许可，未完成的单元可重跑，已保存种子和拟合断点保留。用同一任务参数恢复。产出 `learning/jobs/<job>/candidate.json` 后仍按独立验收流程处理。
- [promote-uno-model.ts](bots/promote-uno-model.ts) 将通过各阶段验收的 C 模型登记到本机。传入 `--data-dir`、`--games-dir`、`--calibration`、`--correction`、`--comparison` 和 `--runtime-proof`。登记前重新确认当前签名 UNO 发行、独立配对门槛，以及同一绑定下的真实 Worker、关键局面和回退／重启结果。`--data-dir=<数据目录> --deactivate=<模型SHA-256>` 仅取消新局可用性；已有对局继续绑定原模型。
