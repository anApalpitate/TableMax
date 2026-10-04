# 电力公司资源

正式资源独立保存在 `assets/games/power-grid/`，浏览器通过 [catalog.ts](../../../assets/games/power-grid/catalog.ts) 选择，来源、提示词、尺寸、哈希和生成／核验／导入状态见 [manifest.json](../../../assets/games/power-grid/manifest.json)。其他游戏不复用这些图像或声音。

| 文件 | 用途 | 实际尺寸／体积 |
| ---- | ---- | ---- |
| `board-v1.webp` | 参考经典实物的六区地形与印刷材质 | 900×1200，199,022 字节 |
| `cover-v1.webp` | 盒子独立小封面 | 600×600，69,950 字节 |
| `plants-atlas-v1.webp` | 16 种工业厂景，4×4 图集 | 1200×1200，188,940 字节 |

内置 imagegen 以经典德国实物图及出版物料为参考生成；原 PNG、提示词、两次地图迭代和独立视觉检查保留在 `artifacts/maintenance/v1.0.1/power-grid/imagegen/`。最终位图只作比例缩小和 WebP 编码，没有程序化涂改。图集按燃料与厂号分配不同厂景；具体编号、燃料、消耗和供电数由代码排版，42 张厂牌不依赖图内文字。

地图风格和构图尽可能贴近真实桌游，地形属于近似重绘，工业图属于参考风格的原创插画。准确城市、区域归属、连接与费用由 [地图数据](map.md) 保证。不得将这些生成素材写成出版原图、逐卡原画或像素级复刻。

六个工业短音效由 [generate-power-grid-audio.mjs](../../../scripts/generate-power-grid-audio.mjs) 可复现合成，总计 126,392 字节。竞价、燃料采购、建城、购厂、供电和终局只表达已保存结果；手机静音，电脑遵循平台声音归属、静音、暂停、断线与退出处理。音频生成参数、峰值、RMS、哈希和时长证据保存在 `artifacts/maintenance/v1.0.1/power-grid/ui/audio/generation.json`；实际运行检查另记录在交付验收。
