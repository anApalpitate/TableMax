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
| 5 类音效         | audio；原创程序合成 PCM 16-bit mono、22050Hz，draw／replace／effect-complete／round-result／error                                                                             |
| 帮助／字体       | 本地 GameHelp；Segoe UI／微软雅黑／sans-serif，不请求在线字体                                                                                                                 |

全部游戏资源位于 assets/games/pokemon-encounters。[catalog.ts](../../../assets/games/pokemon-encounters/catalog.ts) 是浏览器资源表；新增版本文件并更新映射／来源清单即可替换，规则、策略、协议和存档不依赖素材文件名。角色图 contain 加内距保留全身；官方图自带白色柔边，在深底有轻微光晕。火箭队横图保留完整群像，后续可用同 ID 的竖图替换。

[官方导入清单](../../../assets/games/pokemon-encounters/characters/manifest-official.json) 保存参考页、图片 URL、哈希、alpha 和逐张核验。[批次 A](../../../assets/games/pokemon-encounters/characters/manifest-a.json)、[批次 B](../../../assets/games/pokemon-encounters/characters/manifest-b.json)、[批次 C](../../../assets/games/pokemon-encounters/characters/manifest-c.json) 记录 16 次独立 imagegen 尝试，只有百变怪成功，其余 15 次明确 moderation_blocked／other，无图片产物。官方原图导入不标为生成原创，不宣称取得出版方桌游原卡。S14 实物仅作风格参考，没有裁剪成运行素材。

原图、失败响应、奶油／深棕联系表及源码卡面截图在 artifacts/maintenance/pokemon-refresh。2026-10-02 清理 19 张已退出引用的自然静物牌／牌背／硬币 WebP，原始 PNG 逐项核对哈希后继续保留在 artifacts/phase-05/imagegen/source；[旧主题清单](../../../assets/games/pokemon-encounters/manifest.json) 的 assets 只列仍使用的封面，retiredAssets 保留旧路径、来源、提示词、哈希及可恢复压缩副本的 Git 版本。[声音清单](../../../assets/games/pokemon-encounters/audio/manifest.json)、[背景清单](../../../assets/games/pokemon-encounters/tabletop/manifest.json) 和 [平台清单](../../../assets/platform/manifest.json) 保留来源。1.0.0–1.0.2 原图、ZIP 和证据继续保留。

## 权限、动画和声音

只有公开牌／本人获准临时查看加载类别图，所有未知格统一牌背。savedChanges 比较本人授权投影；匹配实例／分支／修订的保存反馈才触发一次，1.6 秒内清理。新修订、暂停、回退、断开／同步立即清理，不补播历史，不由表现层生成随机结果。

翻牌 320ms、发牌 360ms、换入 220ms；能力触发有光环、星点和短标题；硬币有 1200ms 上抛旋转与落定，HUD 翻转 950ms；最终结算有彩色纸片、赢家横幅和完整分数。装饰 pointer-events:none，不遮触控、不阻塞下一次合法操作；减少动态关闭移动及屏幕特效，保留完整状态。

主机／公共屏经本屏手势开启声音，只播未来保存事件；手机不显示音效控件。同事件最多一次，快速操作替换前音，同步／回退／恢复不补播。播放失败不影响规则，保存仍以服务确认判断。验证边界见 [验收记录](../../reference/acceptance.md)；Windows 模拟不等于实机手机、电视或现场听音。

## 牌桌背景与卡面分区（1.0.2）

历史 1.0.2 新增的花园牌桌为 1672×940 RGB WebP、101,962 字节；原图、提示词、裁切与核验保留在 artifacts/maintenance/visual-polish/imagegen。该背景仍使用，迁移后字节不变。旧版卡面分区和 320ms 翻牌／360ms 发牌证据继续保留；1.1.0 更新为上面的角色卡面与关键结果表现，旧静物原图和来源留作历史资料。
