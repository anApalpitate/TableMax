# 本地资源、卡牌映射与声音

全部运行和原型美术／声音统一在根目录 [assets](../../../assets/README.md)，按 platform 和 games 管理；未采用候选原图归档在 artifacts。正式构建只打包引用资源，运行不请求外站。名称、分值和能力由代码排版，类别图不包含本局顺序、秘密实例或暗格映射。

## 当前卡面与替换

16 类牌各自有独立角色图及彩色牌框，56 张实体牌按类别复用。牌框参考用户 S14 实物图：深棕卡心、角色颜色边框、统一右上分值和左上能力标；名称在下方，位置编号在牌外。

| 资源             | 来源与状态                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14 类宝可梦角色  | characters/*-official.png；[中文官方图鉴](https://pokedex.pokemon.cn/play/pokedex) 原图，630×630 真透明，未编辑，逐张核验并导入                                               |
| 火箭队           | special-team-rocket-official.png；[香港官方角色页](https://hk.portal-pokemon.com/tv-film/1/) 未编辑全身群像，1154×649，含武藏／小次郎／喵喵及果然翁，保留青绿背景，已核验导入 |
| 百变怪           | special-ditto-v1.webp；本轮内置 imagegen 生成，951×1000 真透明，已核验导入                                                                                                    |
| 硬币角色         | 复用皮卡丘图，新增 coin-meowth-official.png，中文官方图鉴未编辑原图；代码金属币框只显示保存结果                                                                               |
| 牌框、牌背、角标 | CardFace／CSS 代码视觉；统一精灵球牌背不区分暗牌类别                                                                                                                          |
| 封面／背景       | cover-v1.webp 与 tabletop/garden-table-v1.webp；既有 imagegen 原创环境图                                                                                                      |
| 头像／骰子       | assets/platform；既有原创共享素材，不代表牌类或人数限制                                                                                                                       |
| 14 类音效        | audio；12 类原创程序合成 PCM 16-bit mono、22050Hz，加本地 MP3 喵喵／皮卡丘游戏叫声；来源及哈希见声音清单                                                                      |
| 帮助／字体       | 本地 GameHelp；Segoe UI／微软雅黑／sans-serif，不请求在线字体                                                                                                                 |

全部游戏资源位于 assets/games/pokemon-encounters。[catalog.ts](../../../assets/games/pokemon-encounters/catalog.ts) 是浏览器资源表；新增版本文件并更新映射／来源清单即可替换，规则、策略、协议和存档不依赖素材文件名。角色图 contain 加内距保留全身；官方图自带白色柔边，在深底有轻微光晕。火箭队横图保留完整群像，后续可用同 ID 的竖图替换。

[官方导入清单](../../../assets/games/pokemon-encounters/characters/manifest-official.json) 保存参考页、图片 URL、哈希、alpha 和逐张核验。[批次 A](../../../assets/games/pokemon-encounters/characters/manifest-a.json)、[批次 B](../../../assets/games/pokemon-encounters/characters/manifest-b.json)、[批次 C](../../../assets/games/pokemon-encounters/characters/manifest-c.json) 记录 16 次独立 imagegen 尝试，只有百变怪成功，其余 15 次明确 moderation_blocked／other，无图片产物。官方原图导入不标为生成原创，不宣称取得出版方桌游原卡。S14 实物仅作风格参考，没有裁剪成运行素材。

原图、失败响应和奶油／深棕素材联系表在 artifacts/maintenance/pokemon-refresh；源码卡面等历史运行截图已按 2026-10-05 授权清理，路径与哈希见 [退役清单](../../../artifacts/maintenance/v1.0.3/historical-screenshot-retirement-20261005/manifest.json)。2026-10-02 清理 19 张已退出引用的自然静物牌／牌背／硬币 WebP，原始 PNG 逐项核对哈希后继续保留在 artifacts/phase-05/imagegen/source；[旧主题清单](../../../assets/games/pokemon-encounters/manifest.json) 的 assets 只列仍使用的封面，retiredAssets 保留旧路径、来源、提示词、哈希及可恢复压缩副本的 Git 版本。[声音清单](../../../assets/games/pokemon-encounters/audio/manifest.json)、[背景清单](../../../assets/games/pokemon-encounters/tabletop/manifest.json) 和 [平台清单](../../../assets/platform/manifest.json) 保留来源。1.0.0–1.0.2 原图和文字证据继续保留，历史运行截图已退役；旧版本 ZIP 已按用户 2026-10-02 要求清除。

## 权限、动画和声音

v1.0.3 本轮将类别映射集中至 `shared/presentation.ts`：精灵资源 ID 独立于原版玩法牌类，角色、叫声、视觉主题与局部图案统一对应。浏览器 `creatureArt` 通过兼容 `cardArt` 装配原路径资源；原图、音频内容、哈希及来源不变。梦幻／闪电鸟／火箭队入场复用现有角色，以 CSS／SVG 添加全屏轨道、雷弧及漫画速度线；未生成新位图，既有火箭群像缺口没有冒充完成。

2026-10-05 声音扩展采用用户本地提供的八个 WAV，来源标签和原始文件／哈希保留于 `artifacts/maintenance/v1.0.2/pokemon-polish-20261005/audio/`，运行映射及处理参数在 audio/manifest.json。用户确认火箭队为登场 BGM、硬币喵喵面为喵喵“喵”叫声，两段运行 WAV 与来源逐字节相同；其他六段保留完整长度、不变调，转 16kHz 单声道 PCM16，去 DC、RMS 目标 −22dBFS、峰值上限 −3dBFS、增益最多 +12dB、首尾 8ms 淡化。来源是用户提供资料，不声明官方出处或真人试听认证。旧 Showdown 叫声及原创火箭登场音的原文件和哈希继续保留，正式引用已由用户版本替代；原创离场音继续使用。合成脚本保留用户提供和其他非合成来源记录。

六类新公开取牌对应皮卡丘、胖丁、伊布、妙蛙种子、杰尼龟、耿鬼；换入、移位和结算不重复叫声。火箭登场 BGM 只在保存取牌能力登场播放，币面叫声在 1200ms 落定播放，减少动态立即播放。一个声音控制器复用两个 Audio 槽，保留公共屏优先／管理员接替、全局保存事件去重和手机无播放器；不使用长片段 FIFO 延迟补播，过期延时和失效权限清理。实际解码／播放调用与人耳听感分开记录。

火箭队经典三人透明竖图本次内置 imagegen 尝试在输出阶段被安全系统拒绝，未产出新图、未导入；运行仍使用表中的旧官方四人横图，不引用缺失 v2。实际提示词、响应及旧图原字节副本见 `artifacts/maintenance/v1.0.2/pokemon-polish-20261005/imagegen/rocket/`，尝试状态追加在 characters/manifest-c.json。接续缺口见 [任务页](../../tasks/README.md#宝可梦火箭队配图缺口)。

只有公开牌／本人获准临时查看加载类别图，所有未知格统一牌背。savedChanges 比较本人授权投影；匹配实例／分支／修订的保存反馈才触发一次，1.6 秒内清理。新修订、暂停、回退、断开／同步立即清理，不补播历史，不由表现层生成随机结果。

翻牌 320ms、发牌 360ms、换入 220ms；能力触发有光环、星点和短标题；硬币有 1200ms 上抛旋转与落定，HUD 翻转 950ms；最终结算有彩色纸片、赢家横幅和完整分数。装饰 pointer-events:none，不遮触控、不阻塞下一次合法操作；减少动态关闭移动及屏幕特效，保留完整状态。

历史 1.6.0 声音默认开启，公共游戏窗口优先，无公共窗口时由管理员播放；手机不创建播放器。手动静音存储并跨同源窗口同步，一个播放器顺序消费有界队列，桌面全局按保存事件去重；同步／回退／恢复不补播，连续相同币面依然按不同保存事件播放。浏览器阻止自动播放时显示明确启用提示，桌面本地窗口允许默认播放。验证边界见 [验收记录](../../reference/acceptance.md)。

历史版本的喵喵和皮卡丘采用 [Pokémon Showdown 游戏叫声目录](https://play.pokemonshowdown.com/audio/cries/) 中 meowth.mp3 与 pikachu-starter.mp3 的本地副本，版本、取得日期、SHA-256、字节数与解码检查见 audio/manifest.json。它们是游戏叫声，不声明为中文动画原声。未核实中文火箭队台词录音，采用原创火箭飞走声配文字；其他主题音由 generate-game-sounds.mjs 合成。当前核验包括来源、哈希、Chromium 解码及实际播放调用，不冒称已完成真人试听或现场听音。

## 牌桌背景与卡面分区（1.0.2）

历史 1.0.2 新增的花园牌桌为 1672×940 RGB WebP、101,962 字节；原图、提示词、裁切与核验保留在 artifacts/maintenance/visual-polish/imagegen。该背景仍使用，迁移后字节不变。旧版卡面分区和 320ms 翻牌／360ms 发牌证据继续保留；1.1.0 更新为上面的角色卡面与关键结果表现，旧静物原图和来源留作历史资料。
