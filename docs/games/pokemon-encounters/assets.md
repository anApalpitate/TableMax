# 本地资源、卡牌映射与声音

正式资源已随 1.0.0 打包。规则名称、数值和能力使用 HTML／可访问文本排版，与位图分离；同类牌实例复用同一图，不将秘密实例映射放进清单、URL、alt 或动画键。来源原图 S14 仍仅作规则证据，没有裁剪为正式卡面。

## 已导入资源

| 资源 ID／数量                               | 实际位置与用途                                                                                | 来源／状态                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| pokemon-encounters/face/<categoryId>／16    | games/pokemon-encounters/assets/face/<categoryId>-v1.webp；对应 cards.json 16 类，56 实例复用 | 内置 imagegen 原创植物、矿物和天气静物；427×640，已生成／视觉核验／UI 导入          |
| pokemon-encounters/back／1                  | card-back-v1.webp；所有未知牌使用相同背面                                                     | 原创自然纸纹，529×740，已导入                                                       |
| pokemon-encounters/cover／1                 | cover-v1.webp；大厅和主机主题图                                                               | 原创花园桌游聚会，1200×800，已导入                                                  |
| pokemon-encounters/coin/<meowth/pikachu>／2 | coin-meowth-v1.webp／coin-pikachu-v1.webp；只展示已保存公开币面                               | 原创自然徽章，427×640；名称由代码标注，无角色形象                                   |
| 能力标记／文字                              | ✦ 及能力／阶段短句；六类能力对应规则 ID                                                       | 代码文本，不依赖识图猜能力，完整帮助本地加载                                        |
| 平台 avatar／6 与骰子／1                    | 复用 apps/web/src/prototype/assets 的核验 WebP                                                | 既有原创平台资源，按稳定座位选择头像，不代表游戏牌或人数上限                        |
| 字体                                        | Segoe UI／微软雅黑／sans-serif                                                                | 系统默认，无在线字体                                                                |
| 帮助／1                                     | ui/public 的 GameHelp                                                                         | 当前采用版本的本地规则／来源说明，不依赖外链                                        |
| 提示音／5                                   | assets/audio 的 draw、replace、effect-complete、round-result、error-v1.wav                    | TableMax 原创程序合成短音，PCM 16-bit mono、22050Hz、0.24–0.42 秒；已导入和解码验证 |

20 张主题 WebP 共 667,616 字节。[主题清单](../../../games/pokemon-encounters/assets/manifest.json) 记录完整提示词、类别／规则映射、版本、尺寸、alpha、字节数／SHA-256、来源及生成／核验／导入状态；[音频清单](../../../games/pokemon-encounters/assets/audio/manifest.json) 记录编码、时长、哈希和生成脚本。[平台清单](../../../apps/web/src/prototype/assets/manifest.json) 保留既有头像等来源。

## 美术方案与保留材料

最初角色生成请求被工具拒绝，原失败记录保留。随后采用不含人物、动物、角色或相似轮廓的原创自然静物，与独立排版的游戏名称和数字搭配；未冒充出版方卡图或声称用户明确选过该替代风格。此选择与理由见 [决策 006](../../decisions/006-complete-game-and-simulated-delivery.md)。

原始 imagegen PNG、失败记录、尺寸／哈希检查与联系表保留在 artifacts/phase-05/imagegen，Git 忽略但文件树可见；最终 WebP 提交在游戏资源目录，不能只引用工具默认输出位置。既有 [自然背景候选](../../../apps/web/src/prototype/assets/theme-preparation/manifest.json) 保留未导入状态；当前界面采用主题封面与 CSS 背景保证卡牌／数字对比度，不再铺整幅背景。

## 权限、动效和声音

UI 仅为已授权公开牌／本人临时查看加载对应类别图，未知格只加载统一背面。全部类别图作为通用牌类资产本地打包，资源本身不包含本局顺序或暗格对应关系。牌堆和图像不执行随机，也不触发能力。

公共屏或主机经本屏手势开启后，只对未来新保存事件发声，可静音；手机不渲染声音控件。实例／分支／修订同事件最多一次，快速操作用新短音替换前音。同步、回退、恢复、打开帮助不补播；回退／断开停止当前声音。播放失败保留静音状态，规则继续；保存成功仍以服务确认判断。

保存后的卡位／暂持牌／阶段提示为 220ms 一次性动效，结算 240ms；减少动态关闭移动和过渡。设备范围、资源哈希与实际解码／播放调用证据见 [验收记录](../../reference/acceptance.md)；当前检查没有声称现场听音或真实手机／电视验收。
