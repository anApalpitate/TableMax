# 分析与测量

[空间分析](storage/README.md)为明确的只读审计入口，默认不覆盖报告，也不删除内容。预算报告使用 `node tools/analysis/budgets/game-budget-report.mjs`；`--initialize` 会改写游戏 `game-module.json`，仅在预算初始化任务使用。

内存测量、策略和匹配／flow 分析可能启动实际服务、Worker 或模拟，并创建 `tmp/`、`artifacts/` 及报告；不属于纯静态扫描。辅助 match／flow runner 供测量入口复用，不进入正式 bot 或规则。已有报告路径和参数保持不变。

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
| [storage/space-analysis.mjs](storage/space-analysis.mjs)                                                                                       | `node tools/analysis/storage/space-analysis.mjs`                                                             |
| [storage/space-analysis.test.mjs](storage/space-analysis.test.mjs)                                                                             | 工具隔离回归：`node --test tools/analysis/storage/space-analysis.test.mjs`                                   |
