# 德国小强：来源与采用边界

## CP-S1 发行方经典40829规则

2026-10-21取得并核对[Schmidt Spiele四语规则PDF](https://www.schmidtspiele.de/files/Onlinespiele/Produkte/40829%20-%20Kakerlakenpoker/40829_Kakerlakenpoker_DE_GB_FR_IT.pdf)，对应经典Cockroach Poker／Kakerlakenpoker，排除Royal。原件在[素材工作区](../../../../TMP/TableMaxMaterial/originals/cockroach-poker/40829_Kakerlakenpoker_DE_GB_FR_IT.pdf)，SHA256 `310b23aae40dc86a52879d645556ec0729f91b8166806c9be7345bb36f18db62`。

完整PDF28页；核对英文印刷页9–14（PDF索引8–13）的组件、目标、准备、出牌／判断／转传、结束及双人规则，并对照德文页3–8和法文页15–20。卡图及转传示例用于核验动物构成、身份和流程，没有导入发行方美术。

英文目标中“run out of cards”是简写；采用结束章节页13的完整条件：须开始新轮时无手牌才失败，打出最后一张不直接失败。3–6人四同类、双人五同类；双人秘密移除10张且不可转传。逐场景采用位置见[规则](README.md#规则与来源)。

第一席起手是平台不收集年龄时的项目裁定。两步“查看并承诺转传→选择目标与声明”将经典口头动作按钮化，不允许先查看再反悔判断；这属于实现表达，不能据此修改原规则的目标资格或处罚。

## CP-A1 实体牌面与官方对照

2026-10-21按用户要求把此前搜集的实体牌美术替换到本地源码。该采用状态与出版方许可分别记录；规则PDF仍不随程序打包。

64张普通牌来自[richardcrng/cockroach-poker](https://github.com/richardcrng/cockroach-poker)，固定commit `40df590ccce0e57bca886cb34ab6aa617c2cf1a1`，路径 `client/public/assets/card-fronts/<species>-1..8.jpg`，八类各8张、450×720、64个独立SHA。已按物种抽样与[官方40829商品组件图](https://www.schmidtspiele.de/detail/product/cockroach-poker.html)和[官方商店同货号](https://www.schmidtspiele-shop.de/drei-magier-kakerlaken-poker)对照；第三方普通牌样式与实物一致，但没有所有64张的同印次实体逐一认证。原JPG按字节导入，无裁边、调色、增强或重绘。

游戏原有cardId0–63不变，物种顺序为cockroach、stinkbug、bat、spider、fly、toad、rat、scorpion；每组8个ID依次映射源编号1–8，stinkbug文件前缀为stink-bug。实际映射入口为 `ui/Theme.tsx` 的cardAssetFile；资源manifest逐张记录cardId、原图URL、固定commit、尺寸、字节及导入前后相同SHA。Royal7张、special2张及蓝色Royal背面均排除，不因同仓库而混入。

官方包装原图按字节用于库封面；官方组件图与一张普通牌原图只通过SVG data URI包装提供规则／介绍插图，不改变图像像素。此前原创八虫与牌背资产保留但不用于运行卡牌／库封面，通用流程箭头图及3个程序合成WAV继续使用。

## CP-A2 经典灰背实拍

[公开图片原件](https://cdn-ak.f.st-hatena.com/images/fotolife/b/bg4kids/20160619/20160619070202.jpg)，来自[Boardgamepark文章](https://www.boardgamepark.com/entry/Kakerlakenpoker)，1024×768。实际查看，与官方组件图一致为灰底八动物背面，无Royal皇冠/X/眼睛；有桌面背景、反光和透视，不是平整扫描。该文章部分规则叙述与CP-S1冲突，仅作图像出处，不采用其规则。

原字节导入back-photo.jpg；React内联SVG通过viewBox `225 16 640 704`和polygon `333,23 747,28 860,710 234,709`取景，不新增位图，不透视校正、不调色、不补画像素。asset('back-photo.jpg')由标准资源glob冻结，不在外部SVG隐藏相对路径。界面明确“经典牌背实拍”，剩余缺口是官方无透视扫描母版。

## 原件与使用边界

[外部搜集说明](../../../../TMP/TableMaxMaterial/work/cockroach-poker-physical-art/README.md)、[逐文件manifest](../../../../TMP/TableMaxMaterial/work/cockroach-poker-physical-art/manifest.json)及[原图预览](../../../../TMP/TableMaxMaterial/exports/cockroach-poker-physical-art/index.html)保留来源、版次排除、原件和实际观看范围。[运行清单](../../../assets/games/cockroach-poker/manifest.json)记录本地采用映射及字节SHA。

官方页标明保留权利，第三方公开仓库未提供可核实的出版美术许可；公开可访问不等于可以再分发。本轮依据用户明确授权替换其本地项目，不将此授权描述成出版方许可。未获官方全64牌母版或同印次逐张认证，不作此类声明。
