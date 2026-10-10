# 阿瓦隆规则来源

2026-10-10 核验。目标为 Indie Boards & Cards／Don Eskridge **The Resistance: Avalon（2012经典原版）**，没有将 Big Box、其他扩展、其他游戏或民间在线规则混入。

| 编号 | 原文与获取                                                                                                                                            | 用途／边界                                                                                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| S01  | [2012原版8页规则书扫描](https://cdn.1j1ju.com/medias/a6/dc/c1-the-resistance-avalon-rulebook.pdf)，[本地原始资料](reference/avalon-2012-rulebook.pdf) | 原书为图像扫描，逐页渲染核验第2–7页：角色比例、任务人数、投票、匿名任务、胜负、四种原版可选角色及夜间知识 |
| S02  | [Indie Boards & Cards 产品页](https://indieboardsandcards.com/our-games/the-resistance-avalon/)                                                       | 发布方确认2012、Don Eskridge、官方5–10人与原版背景。当前产品页没有规则PDF下载链接；S01的托管站不是出版方  |
| S03  | [Dized发布方维护官方规则](https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/the-resistance-avalon)                                                  | 页内声明由发布方维护核验。交叉核对设置、提名顺序、投票与任务、刺杀；不把其中可选变体默认开启              |

S01 PDF SHA-256：94a34e8d57b1a5f8c0901f0962dac3bd5ffb8a3eb89aaa02b7721b0d012515dd。原书版权及美术属于原作者／出版方，仅作规则参考；产品美术另为本地原创资源。

## 逐项核验

- S01第2页与S03[发牌](https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/3blsBDWxT2-DsBsywtDKOg/2-deal-character-cards-and-tokens)：5／6人分别3／4善良、2邪恶；随机初任队长、本人秘密身份及初始知识。
- S01第3页：5人任务数2、3、2、3、3；6人2、3、4、3、4；队长可参加也可不参加，同一人只能一枚队伍标记。
- S01第4页与S03[投票结果](https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/V3eSkuHJSIi-qfEWDXPTAw/result-of-voting)：全员密投一起翻开，严格多数，平票拒绝，队长轮转，连续五次否决邪恶胜。
- S01第5页与S03[任务牌](https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/UUQVWxChTdmzBFZGf6cjsw/support-or-sabotage)、[任务结算](https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/_kkXSpYFS2qit8JIEWz-yA/resolve-quest)：善良只能成功，邪恶可成功／失败；牌打乱再揭，无提交者对应关系；仅7人以上第4任务有两败门槛。
- S01第6页与S03[终局及刺杀](https://rules.dized.com/game/rZluqS52QmGdpoVxcmVLtg/ZXYBfRlqRC2sEzECCLLmHA/ending-the-game-and-assassinating-merlin)：三失败邪恶胜；三成功后刺客指认善良一人，梅林是否被刺中决定最终阵营胜负。
- S01第7页：派西维尔／莫甘娜、莫德雷德／奥伯伦的知识差异。本次宫廷组合只启用前两者；原书允许可选角色组合，五人带派西维尔时建议加莫德雷德或莫甘娜。

## 固定版取舍与数字适配

S01第6页要求刺杀讨论时不揭任何角色牌；S03当前在线文字说刺客先揭本人角色牌再指认。本次以2012固定版S01的秘密边界为准，不将在线改写写成原书明文。

平台公开刺客当前决策席位，使各端明确谁执行最后指认；其他角色直到最终结果才公开。浏览器私密角色页与逐人确认代替闭眼主持；密投提交锁定本人选择，最后一位提交后同步揭示；任务只发布匿名失败张数。上述属于数字实施适配，在[规格](spec.md)与[权限](secrets.md)分别记录。
