# 资源生成与维护

本机资源搜索、原图与处理候选从 [TableMaxMaterial 工作区](../../../TMP/TableMaxMaterial/AGENTS.md)进入，交接见其 [素材流程](../../../TMP/TableMaxMaterial/docs/reference/material-workflow.md)。该目录不创建 Git；本目录继续维护主项目受控资源工具，运行 cwd、正式输出和覆盖边界沿用各工具要求，不能在外部工作区直接运行依赖项目根目录的入口。

这些工具仅在明确的素材维护任务中执行，不接入构建后的自动维护。生成、导入、转换和 audit 名称的入口都可能改写正式音频、资源 manifest 或源码引用；运行前核对对应资源清单、输入和覆盖范围。输出以既有 `assets/`、游戏资源清单、`artifacts/` 证据路径为准，原素材保留。

FFmpeg版本、下载来源和SHA-256由 [ffmpeg-tool.json](ffmpeg-tool.json) 锁定；实际二进制在项目 `.cache/tools/ffmpeg-7.1/`，不再从 `tmp/` 读取。清理tmp不影响音频工具入口，也不将工具装入产品。缓存缺失时按锁定下载来源人工恢复并核验wheel和二进制哈希，不安装全局工具或自动升级。

规则画面压缩统一使用 `python tools/assets/rules/compress-rule-captures.py --game=modern-art`，也支持已有其他游戏选择；保留原图与报告。旧现代艺术转发入口已移除。Python 工具须具备已有 Pillow 等依赖，Node 工具使用锁定工作区依赖，不自动安装或升级。

普通验证预览通过共享截图 writer 调用 `images/encode-preview.py`：PNG 在内存中按 WebP 品质90／method6编码，维持尺寸和透明度，仅把 WebP 保存为预览。原素材、规则资料、关键验收和失败 PNG 不通过此编码器。命令从仓库根运行，PNG 使用二进制 stdin，WebP 使用 stdout，尺寸、字节和 SHA JSON 使用 stderr；不直接改写文件。依赖锁定在 `images/requirements.txt`，要求 Pillow 11.1.0 和 WebP；可用 `TABLEMAX_PYTHON` 指定已有隔离 Python 的绝对可执行路径，工具不自动安装依赖或改全局环境。运行前可用 `python -c "import PIL; from PIL import features; print(PIL.__version__, features.check('webp'))"` 核验。

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
| [images/encode-preview.py](images/encode-preview.py)                                                                           | 内部二进制管道编码器；由共享 writer 调用，仅用于普通 WebP90 预览                                |
| [images/requirements.txt](images/requirements.txt)                                                                             | 预览编码依赖锁定：Pillow 11.1.0；不自动安装                                                     |
