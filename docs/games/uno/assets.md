# UNO 本地资源

采用自然暖亮的实体桌面与四色纸牌。精确数字、6／9 区分、功能符号、颜色名称及规则图解由 SVG／HTML／代码绘制，不从生成图反推牌组或规则。

## 图像

[位图清单](../../../assets/games/uno/visual-manifest.json)记录完整提示词、原图、转换、尺寸、字节与 SHA-256。桌面背景 `table-v1.webp` 为 1672×941／153,662 字节，封面 `cover-v1.webp` 为 800×600／93,080 字节；共 246,742 字节。两张均由内置 imagegen 原创生成，非 Mattel 官方美术，正式资源本地打包。

原图、缩小封面及转换核验保留在 `artifacts/uno/imagegen/`。中央桌面留白用于真实卡牌，边缘四色缝线只是装饰；封面无规则数据与文字，游戏介绍由代码排版。生成、解码、实际三端 UI 与当前便携包已核验，具体包哈希和运行边界见 [当前证明](../../../artifacts/maintenance/v1.0.5/uno-20261010/portable-final/results.json)。

## 声画

本游戏使用独立原创离线音效，由 [生成脚本](../../../tools/assets/games/uno/prepare-uno-audio.mjs) 复现，资源位于 `assets/games/uno/audio/`。十条运行 FLAC 共 345,275 字节，解码 PCM 与保留的原始 WAV 逐字节一致。卡牌放置、摸牌、跳过、反转、罚牌、UNO、质疑和胜利使用各自反馈；具体映射、时长与哈希在 [生成清单](../../../assets/games/uno/audio/manifest.json) 和 [交互](interaction.md) 维护。

仅新的已保存结果触发声音和动效，刷新、回退、恢复及重新进桌不补播历史。测试静音、暂停取消、唯一桌面声音消费与浏览器手势解锁沿用宿主契约；减少动态保留清楚的静态结果。机器解码及静音信号验证不等同真人听感验收。
