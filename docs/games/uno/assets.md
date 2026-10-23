# UNO 本地资源

采用自然暖亮的实体桌面与四色纸牌。精确数字、6／9 区分、功能符号、颜色名称及规则图解由 SVG／HTML／代码绘制，不从生成图反推牌组或规则。

## 图像

[位图清单](../../../assets/games/uno/visual-manifest.json)记录完整提示词、原图、转换、尺寸、字节与 SHA-256。桌面背景 `table-v1.webp` 为 1672×941／153,662 字节，封面 `cover-v1.webp` 为 800×600／93,080 字节；共 246,742 字节。两张均由内置 imagegen 原创生成，非 Mattel 官方美术，正式资源本地打包。

原图、缩小封面及转换核验保留在 `artifacts/uno/imagegen/`。中央桌面留白用于真实卡牌，边缘四色缝线只是装饰；封面无规则数据与文字，游戏介绍由代码排版。生成、解码、实际三端 UI 与2026-10-10便携包已核验，具体旧包哈希和运行边界见 [当时证明（原件已退役）](../../archive/history-cleanup-20261024.md)。

## 声画

本游戏使用独立原创离线音效，由 [生成脚本](../../../tools/assets/games/uno/prepare-uno-audio.mjs) 复现，资源位于 `assets/games/uno/audio/`。当前13条v2运行FLAC共359,031字节，24kHz／16bit／立体声、0.30–1.20秒，峰值0.660；解码PCM与保留WAV逐字节一致。卡牌放置、摸牌、跳过、反转、罚牌、UNO、质疑和胜利使用各自反馈；具体映射、时长与哈希在 [v2生成清单](../../../assets/games/uno/audio/manifest-v2.json) 和 [交互](interaction.md) 维护。

2026-10-20按用户要求扩充声画：纸声、木质瞬态、扫频、低频敲击和短和声分层构成独立跳过／反转／+2／变色／+4／UNO／抓漏／接受+4／质疑成功／失败／获胜等13项；生成参数、原WAV及运行SHA由v2清单逐项记录。公开事件分类与矢量徽章内聚于`ui/saved-feedback.ts`、`ui/SavedEffects.tsx`，只用公开actor／targets判断质疑成败，不解析私密手牌或以实际可摸牌数猜判决。累计罚牌和牌库不足显示实际公开数量。

旧11条v1、manifest.json及保护原WAV的SHA未变，不重写已发布资源。未采用的32kHz v2候选精确移至`artifacts/uno/audio/source-originals/v2-32000-candidate`保留逐文件SHA；正式v2采用24kHz，当前UNO全部assets实测1,016,981字节，未提高原1MiB素材／模块初始分配。该数字不替代实际构建载荷或完整EXE体积门禁，本次未导出安装器。

仅新的已保存结果触发声音和动效，刷新、回退、恢复及重新进桌不补播历史。测试静音、暂停取消、唯一桌面声音消费与浏览器手势解锁沿用宿主契约；减少动态保留清楚的静态结果。机器解码及静音信号验证不等同真人听感验收。

2026-10-11 增加原创 catch-uno-v1.flac（0.58秒），漏喊质疑与UNO、+4质疑各自映射；11项FLAC与合成WAV解码PCM一致，原WAV继续保护。全项目格式审计见 `artifacts/maintenance/v1.0.6/bug-five-seven/audio-audit.json`，同名原素材不作为可删除副本。

全项目[音效审计（原件已退役）](../../archive/history-cleanup-20261024.md)逐文件记录哈希、解码PCM、采样率／声道／时长、源码引用与实际包成员。289份项目音频（181份assets音频及108份清单指向的原素材／历史参考）中65组WAV／FLAC解码一致，WAV为受保护原素材；114份实际运行音频没有相同哈希副本或同名双格式，保留必要运行格式，本次删除0文件，仓库及运行包节省均0字节。新抓漏音效23,065字节，旧10条音频字节未变。WebView2实际事件播放、Edge静音WebAudio解码通过；Windows WebKit缺WebAudio且FLAC加载超时，保留失败记录，不冒称iOS Safari通过。
