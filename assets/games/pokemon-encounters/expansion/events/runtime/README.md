# 新设计运行派生资源

只导入 `manifest.json` 的4项白名单，合计167,594字节；沙暴／雪天／戏法空间为768×432，每张≤48KiB，R01为512×288且≤24KiB。来源是同目录上级已采用原插画，原件不变。Pillow11.1.0仅缩放、裁切、编码，解码尺寸与SHA已核对；完整EXE实际离线验证进行中。

雨天／晴天及其余9项旧主题适用插图在质量≥52时未满足单张配额，改用代码主题与既有画像。缺新主题R02、R03、R05、R13、R18、R22、R24继续占位，不使用冲突旧图。

复现入口：`python tools/assets/games/pokemon-encounters/prepare-expansion-events.py --workspace E:/Proj/TMP/TableMaxMaterial`。候选、联系表在外部`exports/pokemon-expansion-events/runtime-v3/`，运行端不读取素材工作区。92项既有归档、WAV、Mega及羁绊PNG不批量导入，不扩大本轮4MiB验收门禁。
