# v1.0.7发布后的本地旧交付退役

2026-10-16用户明确授权清除本地 `artifacts/releases` 中的老版本内容。范围仅1.0.6的EXE及sidecar；保留当前1.0.7.2安装器、sidecar、1.0.7源码ZIP，以及内部载荷、游戏历史仓库和原验收记录。GitHub历史Release、附件和标签未改动。

## 执行结果

现有逐文件维护入口先预览并核对清单SHA，再执行唯一一次Apply：删除14文件、187,354,244字节（约187.35MB／178.67MiB），结果passed，无删除错误。原旧目录仅为空时移除，未复制待删内容作备份。当前交付的精确身份与线上证明见[验收](../reference/acceptance.md#当前源码与本地交付)。

[删除前清单（原件待退役）](history-cleanup-20261024.md)记录路径、字节、原修改时间及SHA；[单次执行日志](../../artifacts/maintenance/reviewed-retirements/release-106-retirement-20261016-once.json)记录实际结果；[保护复核（原件待退役）](history-cleanup-20261024.md)绑定保留文件和剩余目录。原文档入链由[迁移表（原件待退役）](history-cleanup-20261024.md)追溯，不改写历史JSON报告中的原路径。

旧1.0.6/current、原发布／验收JSON仍保留其原始身份，但对应本地EXE与sidecar已不存在；不能再把旧指针当作可直接执行的交付。原portable10迁移复验也不再具备原EXE输入，历史通过不代表可立即重跑；需要重新复验时先取得并核验所需原字节，不能静默替换成其他包。

本次实时GitHub只读查询遇TLS握手超时；清理依据为前次已通过且本轮按SHA绑定的正式发布审计，当前本地交付门禁复核通过。准备脚本首次调用被默认执行策略拒绝，改用项目既有的进程级ExecutionPolicy Bypass后成功；未修改系统执行策略。文档索引首次读取Windows PowerShell所写UTF-8 BOM时解析失败，辅助脚本已修正读取方式，冻结清单字节和SHA未改。以上三项只读／准备诊断失败保留，未更改产品或放宽删除门禁；唯一一次删除执行通过。

## 逐文件退役清单

| 原路径                                                                                 |       字节 | SHA-256                                                            |
| -------------------------------------------------------------------------------------- | ---------: | ------------------------------------------------------------------ |
| `artifacts/releases/TableMax-1.0.6.10-win-x64-manifest.json`                           |     25,452 | `054da2fa49daa32d4fa2a9405f886e6d44424e1e50199d26a5944e41c47d5eb2` |
| `artifacts/releases/TableMax-1.0.6.10-win-x64.exe`                                     | 44,096,512 | `93207df18d568e808ea903ce5d538fe1835323f80a523af95a09241eeb6364bc` |
| `artifacts/releases/TableMax-1.0.6.18-win-x64-manifest.json`                           |     33,447 | `715e70109a5eb4426e8b82c707516ebae4d518b614679333f22d147e5c3203b4` |
| `artifacts/releases/TableMax-1.0.6.18-win-x64.exe`                                     | 35,711,499 | `323eb595b2160fdf6c75bf65d8a8c22bc5fb9bf6cc85aa2ce179eb26f1c16a19` |
| `artifacts/releases/retired/v1.0.6/1.0.6.13/TableMax-1.0.6.13-win-x64-manifest.json`   |     32,989 | `8c2ff05cec55e01328203e91ab177537cc6403f90683ac725627482faada5115` |
| `artifacts/releases/retired/v1.0.6/1.0.6.14/TableMax-1.0.6.14-win-x64-manifest.json`   |     33,452 | `2e4843a4fe22601635bc49a76694a0e8435ad3688e4f980cd10e0b2e0e2656c2` |
| `artifacts/releases/retired/v1.0.6/1.0.6.15/TableMax-1.0.6.15-win-x64-manifest.json`   |     33,460 | `f595c6d24da84ddddb5450a5e96945a852ec687e3effd3ffd71b6f9cf3ced173` |
| `artifacts/releases/retired/v1.0.6/1.0.6.16/TableMax-1.0.6.16-win-x64-manifest.json`   |     33,455 | `e717ac567b2353f6ffe83a868b04227678361e7034d989eee12241a179024fe0` |
| `artifacts/releases/v1.0.6/1.0.6.19/TableMax-1.0.6.19-win-x64-manifest.json`           |     35,388 | `3647b54fe1778506021ac8585f77619518a92a12ada2a1a76b3a010bb2fc5ba6` |
| `artifacts/releases/v1.0.6/1.0.6.19/TableMax-1.0.6.19-win-x64.exe`                     | 35,754,061 | `aca93f5fc8f434ed9d9fb02c6a56bcff75214d09a30fb8e6d1a57a80a9641a69` |
| `artifacts/releases/v1.0.6/1.0.6.20/TableMax-1.0.6.20-installer-win-x64-manifest.json` |     35,346 | `174c8362c31a6ab292edbb941a21679cf12922bbc152de1bb7af14112cfc8e68` |
| `artifacts/releases/v1.0.6/1.0.6.20/TableMax-1.0.6.20-installer-win-x64.exe`           | 35,748,037 | `28158b4922209d14177b76a44350a50b3df415bb15c811f512a4bf3d461a82ed` |
| `artifacts/releases/v1.0.6/1.0.6.21/TableMax-1.0.6.21-installer-win-x64-manifest.json` |     35,366 | `ad427ee0f365fbd98ba7cbc9cdc8cf9fbdc7b3b8d1ec7be2a76a89ad4347647f` |
| `artifacts/releases/v1.0.6/1.0.6.21/TableMax-1.0.6.21-installer-win-x64.exe`           | 35,745,780 | `1313f7af6390382968431211a8e86cef1523c850950acc5fe59ef9b34926e122` |
