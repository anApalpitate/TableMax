# 资源生成与维护

这些工具仅在明确的素材维护任务中执行，不接入构建后的自动维护。生成、导入、转换和 audit 名称的入口都可能改写正式音频、资源 manifest 或源码引用；运行前核对对应资源清单、输入和覆盖范围。输出以既有 `assets/`、游戏资源清单、`artifacts/` 证据路径为准，原素材保留。

规则画面压缩统一使用 `python tools/assets/rules/compress-rule-captures.py --game=modern-art`，也支持已有其他游戏选择；保留原图与报告。旧现代艺术转发入口已移除。Python 工具须具备已有 Pillow 等依赖，Node 工具使用锁定工作区依赖，不自动安装或升级。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                                                                                                                           | 入口／用途                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [games/avalon/prepare-avalon-audio.mjs](games/avalon/prepare-avalon-audio.mjs)                                                 | `node tools/assets/games/avalon/prepare-avalon-audio.mjs`                                       |
| [games/modern-art/generate-modern-art-audio.mjs](games/modern-art/generate-modern-art-audio.mjs)                               | `node tools/assets/games/modern-art/generate-modern-art-audio.mjs`                              |
| [games/pokemon-encounters/audit-pokemon-expansion-audio.mjs](games/pokemon-encounters/audit-pokemon-expansion-audio.mjs)       | `node tools/assets/games/pokemon-encounters/audit-pokemon-expansion-audio.mjs`                  |
| [games/pokemon-encounters/generate-pokemon-expansion-audio.mjs](games/pokemon-encounters/generate-pokemon-expansion-audio.mjs) | `node tools/assets/games/pokemon-encounters/generate-pokemon-expansion-audio.mjs`               |
| [games/pokemon-encounters/import-pokemon-cries.py](games/pokemon-encounters/import-pokemon-cries.py)                           | `python tools/assets/games/pokemon-encounters/import-pokemon-cries.py`                          |
| [games/pokemon-encounters/soften-pokemon-cries.mjs](games/pokemon-encounters/soften-pokemon-cries.mjs)                         | `node tools/assets/games/pokemon-encounters/soften-pokemon-cries.mjs`                           |
| [games/pokemon-encounters/soften-pokemon-cries.test.mjs](games/pokemon-encounters/soften-pokemon-cries.test.mjs)               | 工具隔离回归：`node --test tools/assets/games/pokemon-encounters/soften-pokemon-cries.test.mjs` |
| [games/power-grid/generate-power-grid-audio.mjs](games/power-grid/generate-power-grid-audio.mjs)                               | `node tools/assets/games/power-grid/generate-power-grid-audio.mjs`                              |
| [games/uno/prepare-uno-audio.mjs](games/uno/prepare-uno-audio.mjs)                                                             | `node tools/assets/games/uno/prepare-uno-audio.mjs`                                             |
| [platform/convert-runtime-audio-flac.mjs](platform/convert-runtime-audio-flac.mjs)                                             | `node tools/assets/platform/convert-runtime-audio-flac.mjs`                                     |
| [platform/generate-game-sounds.mjs](platform/generate-game-sounds.mjs)                                                         | `node tools/assets/platform/generate-game-sounds.mjs`                                           |
| [platform/prepare-platform-interaction-assets.mjs](platform/prepare-platform-interaction-assets.mjs)                           | `node tools/assets/platform/prepare-platform-interaction-assets.mjs`                            |
| [rules/compress-rule-captures.py](rules/compress-rule-captures.py)                                                             | `python tools/assets/rules/compress-rule-captures.py`                                           |
