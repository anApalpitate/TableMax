# 拉密本地资源

资源统一归 [assets/games/rummikub](../../../assets/games/rummikub/)，仅引用本地文件。采用浅色实体数字牌与四色形状辅助辨识；属于[交互规格](interaction.md)的实现选择，非用户指定固定材质。所有新增资源为项目原创，不复制官方标识或图片。

| 稳定资源   | 文件／入口                                                                                                          | 用途与版本                                                                                                          | 状态                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 盒子封面   | [cover-v1.webp](../../../assets/games/rummikub/cover-v1.webp)／[原创 SVG](../../../assets/games/rummikub/cover.svg) | v1，640×400；浅绿桌面、木边、红 8–11 顺子及四色 7 同数组。准确数字和形状由 SVG 排版；为盒子固定 WebP 契约无损派生。 | SVG 已通过 XML 校验和 Edge 真实渲染；WebP 文件解码与 RGBA 逐像素相等已通过；实际候选 ZIP 的盒子浏览器解码 640×400 已通过。 |
| 数字牌     | [NumberTile.tsx](../../../games/rummikub/ui/NumberTile.tsx)／[style.css](../../../games/rummikub/ui/style.css)      | v1，HTML/CSS 与原生 SVG；颜色、数字、形状、选择顺序、来源标记及百搭绑定。                                           | 已接入三端。                                                                                                               |
| 顶层规则图 | [RulesGuide.tsx](../../../games/rummikub/ui/RulesGuide.tsx)                                                         | v1，原创代码原生逻辑图；106 牌／同数组／顺子／33 点首出／拆顺／百搭替换／计分例。                                   | 已接入六章图文规则，非游戏截图。                                                                                           |
| 摆牌音     | [place-v1.wav](../../../assets/games/rummikub/audio/place-v1.wav)                                                   | 原创 0.24s，22,050Hz／16bit／单声道 PCM，880／1174Hz 短衰减双音。                                                   | RIFF 参数与实际候选 ZIP 的本地浏览器解码已通过；验收静音，未宣称人耳试听。                                                 |
| 摸牌音     | [draw-v1.wav](../../../assets/games/rummikub/audio/draw-v1.wav)                                                     | 原创 0.20s，同格式，240／350Hz 低短音。                                                                             | 同上。                                                                                                                     |
| 结算音     | [win-v1.wav](../../../assets/games/rummikub/audio/win-v1.wav)                                                       | 原创 0.82s，同格式，523.25／659.25／783.99／1046.5Hz 依次进入的短音阶。                                             | 同上。                                                                                                                     |

代码原生图与准确文字直接引用当前已核验规则数据，不需要 AI 位图；未调用 imagegen，因而没有生成提示词或位图转换链。原生 SVG 功能图标与百搭脸谱在上述组件内，资源来源、版本和校验值在 [manifest.json](../../../assets/games/rummikub/manifest.json)。

## 盒子封面派生

保留原创 `cover.svg`，使用隔离临时配置、静音无界面 Microsoft Edge 154.0.4258.62 按 640×400／deviceScaleFactor=1 渲染，字体为 SVG 指定的 Segoe UI／Arial／sans-serif；透明背景 PNG 再用 Pillow 转 WebP lossless RGBA（quality=100、method=6、exact=true）。不修改画面，不使用 imagegen。PNG 与解码后 WebP 的 RGBA 字节完全相同；WebP 69,762 字节、SHA-256 `e2d69c46e147b9594b8566972dc8772dff63a0670b5939dd89fe1559d2c8401a`，源 SVG 与中间 PNG／像素哈希留在资源清单。

实际预览发现构建元数据会把封面原件复制成固定 `cover.webp`，直接使用 SVG 原件导致浏览器解码失败；本次改用正确的 WebP 派生件。失败证据仍保留，实际候选 ZIP 解码与文件／像素校验分开记录。候选 ZIP SHA-256 为 `afa4c170709072017453fc44cfcb36c0b1419d7b857cd4383b5072fc38c08fec`，浏览器解码与声音数据证据在 [candidate-03/results.json](../../../artifacts/rummikub/validation/ui-preview/candidate-03/results.json)，封面实际渲染见 [candidate-01/opening-box-game-cover.png](../../../artifacts/rummikub/validation/ui-preview/candidate-01/opening-box-game-cover.png)。

## 原创声音生成方法

样本率 22,050Hz，单声道有符号 16 位小端 PCM；RIFF／WAVE fmt chunk 为 PCM1。每个音为正弦信号，8ms 入场、指数衰减与末端 30ms 包络；摆牌／摸牌每个频率错开 18ms，结算各频率错开 115ms。摆牌／结算单频幅度 0.12，摸牌 0.11，混合后限制在 −1～1；界面播放音量 0.42。该方法为制作参数，不能写成用户个人音量偏好。

音频只消费新的成功保存反馈；刷新、重连、规则浮层和草稿操作不播放。测试模式默认关闭，按平台共享声音归属请求；手机提示音主动启用后只播放本人动作。音源均在本地包内，不依赖网络。二进制格式、真实浏览器解码／事件消费和人耳试听是不同验证，结果分别维护在[验证场景](validation-scenarios.md)。

替换时保留稳定名称或更新对应引用，核对实际解码、尺寸、透明度与字节数；发生规则／组件变化只更新受影响图解。无 AI 生成原图可退役，本轮旧版本候选不存在。
