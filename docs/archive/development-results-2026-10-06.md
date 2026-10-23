# 开发验证历史：2026-10-06

2026-10-08 将开发环境中的已完成结果移入本页；当前命令继续维护在[开发环境](../reference/development.md)，旧包大小及当时结论不代表当前交付。

2026-10-06火箭队能力估值和15张角色无损运行格式续验：[同包冻结审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-ability-review-20261006/final-checks.json)对应 `42205330…`，实际解压94,300,018字节。16卡面／硬币实际浏览器逐显示RGBA相等，原PNG保留；首次漏闪电鸟的试包未交付，补齐后重新构建。策略种子覆盖改为每局独立60秒与独立输出目录，失败六人绝悟组十局重跑通过，单次Worker边界未放宽；真实服务17项、同包普通UI与冻结核对通过。闲时安全维护零合格候选，当前空间与保护范围见[瘦身记录](../reference/project-slimming.md)，不以试包或旧源码统计替代本包验收。

2026-10-06三胜目标修复续验：42项模型回归、2–6人各档seed1小局及17项真实服务集成通过。小局窄选用 `vitest run games/pokemon-encounters/expansion/bot/coverage.test.ts -t 'seed 1:|never initializes'`，实际16通过／135未选，不把旧151全量结果用于新策略。同版本运行包从当前冻结源码构建，原生输入的CRLF／LF和原生构建目录变化可改变指纹及EXE，须核对归一源码并验证同一实际解压EXE；本轮未修改原生内容。相关命令与边界沿用上文，证据见[同包审计](../../artifacts/maintenance/v1.0.2/pokemon-expansion-match-outcome-20261006/final-checks.json)。
