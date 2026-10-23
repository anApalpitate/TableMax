# 历史证据地址逐项核查（2026-10-23）

性质：本轮对原有24处失效引用的只读可用性核查，涉及17个不同原路径。当前状态归[当前验收](../reference/acceptance.md)，证明与复用要求归[验证](../reference/validation.md)。本记录不重建原件、不安装、不发布、不修改退役清单、原报告或历史通过结论。

24项逐条保留原文位置、原地址、可用性、现存相关材料及SHA。只有H14／H21的原EXE删除已由逐文件清单及完成journal确认；H15存在同字节附件备份；其余原件缺失仍是证据缺口，不能推定均已获准退役。历史文字不等于可复用原证明，相关报告或同SHA副本也不能替代原EXE原路径启动。缺失限制只作用于依赖该文件的证明项；未依赖缺失件且完整绑定的其它独立证据仍按原范围评估。

原始失败基线及机器逐项表保存在`artifacts/maintenance/documentation-round3-20261023/`，旧基线不改写。失效文件链接改为本核查入口，并在原文附近保留原路径；链接审计通过只表示入口不再误称缺失文件可打开，不表示原件全部恢复或历史验收已重新通过。

## 本轮整理与检查

本轮第三轮只整理文档：当前验收页改为源码／候选／本地current／上次线上核查的状态与证明索引，验证页只维护范围、失败预算、证据等级和复用，安装页保留正式身份、隔离账户、原EXE原路径及封存等必需条件，服务载荷压缩契约回到构建运行正文。精确操作命令仍归工具README，未因迁移创建第二套注册表或降低失败阈值。

两份整理前正文保留48个原章节，当前验收／验证的147／36个旧标题或显式锚点全部保留；3份已有历史文档只改失效引用的可用性入口，原结论、数字、版本和失败不倒改。33项现行约束定向核对，30个现存相关证据文件重核SHA。原24项基线和逐条记录仍在，不靠更改基线消账；导航链接通过与21处原件／报告仍缺失分开报告。

本地current1.0.8.9的原EXE、payload、安装清单及原正式证明只读匹配，原件／隔离证据摘要匹配；本轮未再次安装、启动或联网复核发布状态，不把旧证明升级为当前源码或实体设备通过。所有本轮报告在`artifacts/maintenance/documentation-round3-20261023/`；没有临时输出，不需要任务删除脚本。

用户2026-10-23明确暂缓修改其它活动任务拥有的`tools/test/README.md`，其默认失败阈值旧注释5待文件释放后改为实际10，已进入[文档接续](../tasks/documentation-wiki-and-skills.md)。本轮不混入该文件其它改动；现行验证政策、根入口及实际`failure-policy.mjs`仍采用默认10。

## H01：TableMax-1.0.7.26-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 马尼拉完整港湾安装候选（2026-10-17，待验收）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.26/TableMax-1.0.7.26-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.26/TableMax-1.0.7.26-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[verified-source.json](../../artifacts/maintenance/manila-harbor-rebuild-20261017/verified-source.json)，72441字节，SHA `891510ee4e0a6f55dd38711ef477f150d5ea3c2c83ebdff988219f0be7412a03`。仅按其原版本／方法／范围阅读。
- 现存材料：[visual-review.json](../../artifacts/maintenance/manila-harbor-rebuild-20261017/visual-review.json)，2996字节，SHA `73428d45e5ca55f0cbb81452145f9136e1075a532ce66fb3d008d319e6614d12`。仅按其原版本／方法／范围阅读。

## H02：TableMax-1.0.7.25-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 马尼拉手机调位与主机布局安装候选（2026-10-17，待验收）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.25/TableMax-1.0.7.25-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.25/TableMax-1.0.7.25-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[verified-source.json](../../artifacts/maintenance/manila-touch-layout-20261017/verified-source.json)，5358字节，SHA `903d73506dccf3fd689613be296aa457a1fcd50f33366f7def8f22c66300df8e`。仅按其原版本／方法／范围阅读。
- 现存材料：[visual-review.json](../../artifacts/maintenance/manila-touch-layout-20261017/visual-review.json)，1445字节，SHA `9819da9ad2b8cdee19a799a72d2c288c30b5e013cf562bde2bccd1641f33f924`。仅按其原版本／方法／范围阅读。

## H03：TableMax-1.0.7.25-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 马尼拉手机调位与主机布局安装候选（2026-10-17，待验收）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.25/TableMax-1.0.7.25-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.25/TableMax-1.0.7.25-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[verified-source.json](../../artifacts/maintenance/manila-touch-layout-20261017/verified-source.json)，5358字节，SHA `903d73506dccf3fd689613be296aa457a1fcd50f33366f7def8f22c66300df8e`。仅按其原版本／方法／范围阅读。
- 现存材料：[visual-review.json](../../artifacts/maintenance/manila-touch-layout-20261017/visual-review.json)，1445字节，SHA `9819da9ad2b8cdee19a799a72d2c288c30b5e013cf562bde2bccd1641f33f924`。仅按其原版本／方法／范围阅读。

## H04：TableMax-1.0.7.24-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 马尼拉竞拍与保存反馈安装候选（2026-10-17，待验收）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.24/TableMax-1.0.7.24-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.24/TableMax-1.0.7.24-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[verified-source.json](../../artifacts/maintenance/save-overlay-auction-20261017/verified-source.json)，5038字节，SHA `e64290aabeb3e0b0057265b6aa4650e6b869c919dc2f5d70048c49d7e4b76d98`。仅按其原版本／方法／范围阅读。
- 现存材料：[frozen-inputs.json](../../artifacts/maintenance/save-overlay-auction-20261017/frozen-inputs.json)，1226字节，SHA `12611b6635cce20daf6143fdd096682b101b6fbbee998c4b0f4405ef198291e0`。仅按其原版本／方法／范围阅读。
- 现存材料：[delivery-input-check.json](../../artifacts/maintenance/save-overlay-auction-20261017/delivery-input-check.json)，3489字节，SHA `5bd5df554e8e281b52b50123d336e382e7b6a715ea6868b9d94c83a64447f7f1`。仅按其原版本／方法／范围阅读。

## H05：TableMax-1.0.7.24-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 马尼拉竞拍与保存反馈安装候选（2026-10-17，待验收）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.24/TableMax-1.0.7.24-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.24/TableMax-1.0.7.24-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[verified-source.json](../../artifacts/maintenance/save-overlay-auction-20261017/verified-source.json)，5038字节，SHA `e64290aabeb3e0b0057265b6aa4650e6b869c919dc2f5d70048c49d7e4b76d98`。仅按其原版本／方法／范围阅读。
- 现存材料：[frozen-inputs.json](../../artifacts/maintenance/save-overlay-auction-20261017/frozen-inputs.json)，1226字节，SHA `12611b6635cce20daf6143fdd096682b101b6fbbee998c4b0f4405ef198291e0`。仅按其原版本／方法／范围阅读。
- 现存材料：[delivery-input-check.json](../../artifacts/maintenance/save-overlay-auction-20261017/delivery-input-check.json)，3489字节，SHA `5bd5df554e8e281b52b50123d336e382e7b6a715ea6868b9d94c83a64447f7f1`。仅按其原版本／方法／范围阅读。

## H06：TableMax-1.0.7.23-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 偏好改造完整安装候选（2026-10-17，待验收）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.23/TableMax-1.0.7.23-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.23/TableMax-1.0.7.23-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[frozen-inputs.json（原件待退役）](history-cleanup-20261024.md)，726字节，SHA `20a6ed5f79c676fd91c11c87e26b4b02162392c199c4d087ad2daa0d0d0be322`。仅按其原版本／方法／范围阅读。
- 现存材料：[original-executable-security-normalization.json（原件待退役）](history-cleanup-20261024.md)，3519字节，SHA `110c352c842672f36402c46008ab1fb8f2cd09d57dbb7cacf50d479f4574c2d5`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，88104字节，SHA `2231682fb7360eb78f85eb2dec6f2d2644a6fa309cc93f19e39f65130fd311d7`。仅按其原版本／方法／范围阅读。

## H07：TableMax-1.0.7.23-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 偏好改造完整安装候选（2026-10-17，待验收）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.23/TableMax-1.0.7.23-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.23/TableMax-1.0.7.23-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[frozen-inputs.json（原件待退役）](history-cleanup-20261024.md)，726字节，SHA `20a6ed5f79c676fd91c11c87e26b4b02162392c199c4d087ad2daa0d0d0be322`。仅按其原版本／方法／范围阅读。
- 现存材料：[original-executable-security-normalization.json（原件待退役）](history-cleanup-20261024.md)，3519字节，SHA `110c352c842672f36402c46008ab1fb8f2cd09d57dbb7cacf50d479f4574c2d5`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，88104字节，SHA `2231682fb7360eb78f85eb2dec6f2d2644a6fa309cc93f19e39f65130fd311d7`。仅按其原版本／方法／范围阅读。

## H08：TableMax-1.0.7.18-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 设置与马尼拉体验深化（2026-10-16）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.18/TableMax-1.0.7.18-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.18/TableMax-1.0.7.18-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[runtime-equivalence-17-18.json](../../artifacts/manila/validation/runtime-equivalence-17-18.json)，4078字节，SHA `13f71ce51a335a5da0770fd9582d37bdd5aac9bf5c9dd6defda8da98acc77354`。仅按其原版本／方法／范围阅读。
- 现存材料：[deepening-18-security-normalization.json](../../artifacts/manila/deepening-18-security-normalization.json)，3519字节，SHA `edf405ccd416222d08be2382e764bdcb1d186e065412951da21c637e9060cb17`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，38172字节，SHA `fb8e122b2fdbc650a8b9e9cbe71e5ea25103ac1ce3ea6188ddd0bd8f7143a09e`。仅按其原版本／方法／范围阅读。

## H09：TableMax-1.0.7.18-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 设置与马尼拉体验深化（2026-10-16）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.18/TableMax-1.0.7.18-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.18/TableMax-1.0.7.18-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[runtime-equivalence-17-18.json](../../artifacts/manila/validation/runtime-equivalence-17-18.json)，4078字节，SHA `13f71ce51a335a5da0770fd9582d37bdd5aac9bf5c9dd6defda8da98acc77354`。仅按其原版本／方法／范围阅读。
- 现存材料：[deepening-18-security-normalization.json](../../artifacts/manila/deepening-18-security-normalization.json)，3519字节，SHA `edf405ccd416222d08be2382e764bdcb1d186e065412951da21c637e9060cb17`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，38172字节，SHA `fb8e122b2fdbc650a8b9e9cbe71e5ea25103ac1ce3ea6188ddd0bd8f7143a09e`。仅按其原版本／方法／范围阅读。

## H10：TableMax-1.0.7.9-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 马尼拉本地候选（2026-10-16）；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.9/TableMax-1.0.7.9-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.9/TableMax-1.0.7.9-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[package-09.json（原件待退役）](history-cleanup-20261024.md)，6797字节，SHA `7fc6aa70ba680577b904de209d20ae55126311b9915936e5ebcdbc840f820622`。仅按其原版本／方法／范围阅读。
- 现存材料：[runtime-equivalence-07-09.json（原件待退役）](history-cleanup-20261024.md)，1170字节，SHA `51344237dd53542a3be1ada74d224dac456c15711ea1e66b179c5b1d0d07a80f`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，34592字节，SHA `77a4e96014b612e08ab970c6c46ce7e12ab30b5bf820ab5799b53aa992c67958`。仅按其原版本／方法／范围阅读。

## H11：TableMax-1.0.7.7-installer-win-x64-manifest.json

- 原文：`docs/archive/acceptance-2026-10-16-to-18.md` → 首轮开发候选1.0.7.7；源SHA `16b7c5351b78152049479264b36dafe6a270d6c00e43b6ba94bcdfaf4a51be89`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.7/TableMax-1.0.7.7-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.7/TableMax-1.0.7.7-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[package-candidate07.json](../../artifacts/manila/validation/package-candidate07.json)，6789字节，SHA `98729d47c07c5232917717ac2942de467af6f5708a2643f5a8897d7069bc80f3`。仅按其原版本／方法／范围阅读。

## H12：TableMax-1.0.7.22-installer-win-x64.exe

- 原文：`docs/archive/box-manila-ui-polish-2026-10-17.md` → 安装与交付；源SHA `f63c19b7f4120b60a4fcc7fb84805bc22fef573668dc05e85c37504542220430`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64.exe`，解析为`artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64.exe`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[executable-security-22.json（原件待退役）](history-cleanup-20261024.md)，3519字节，SHA `083f1a62906502026ba6012c9109e38c4bedb32549b6686cb4d20845db471b6b`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，38190字节，SHA `7afca08003e914f4991a1f36f91c4b68f30ee113a4f014af880433da2a7ed110`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，34676字节，SHA `0f967b6c4b6fc3579e74b0f4939ae85a611b672247b2ed4ebf9f922315e5e58a`。仅按其原版本／方法／范围阅读。

## H13：TableMax-1.0.7.22-installer-win-x64-manifest.json

- 原文：`docs/archive/box-manila-ui-polish-2026-10-17.md` → 安装与交付；源SHA `f63c19b7f4120b60a4fcc7fb84805bc22fef573668dc05e85c37504542220430`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[executable-security-22.json（原件待退役）](history-cleanup-20261024.md)，3519字节，SHA `083f1a62906502026ba6012c9109e38c4bedb32549b6686cb4d20845db471b6b`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，38190字节，SHA `7afca08003e914f4991a1f36f91c4b68f30ee113a4f014af880433da2a7ed110`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，34676字节，SHA `0f967b6c4b6fc3579e74b0f4939ae85a611b672247b2ed4ebf9f922315e5e58a`。仅按其原版本／方法／范围阅读。

## H14：TableMax-1.0.7.34-installer-win-x64.exe

- 原文：`docs/archive/installer34-deep-audit-2026-10-18.md` → 构建与原件；源SHA `87b6cdb57f11479b0e7cad7fd040b7902183516163453c6ef7e7ffacc07c7dd0`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.34/TableMax-1.0.7.34-installer-win-x64.exe`，解析为`artifacts/releases/v1.0.7/1.0.7.34/TableMax-1.0.7.34-installer-win-x64.exe`。
- 状态：**已确认退役**。原EXE在已完成且SHA绑定的退役清单中；配套sidecar仍在，只供身份追溯，不是可启动EXE。
- 原EXE身份SHA：`15230898d50fbafc52761a7735561d42352d0f24fe564485bed5ee71cce6d32c`。
- 现存材料：[TableMax-1.0.7.34-installer-win-x64-manifest.json](../../artifacts/releases/v1.0.7/1.0.7.34/TableMax-1.0.7.34-installer-win-x64-manifest.json)，56823字节，SHA `9901af19166858211cff94d8608484e6152da7836b9ff2b1916db2b97d36b5cd`。仅按其原版本／方法／范围阅读。
- 现存材料：[reviewed-files-r5.json（原件待退役）](history-cleanup-20261024.md)，44641820字节，SHA `73df0d4adcbf409b0a4bfa236e021244198dc0548ca7705b98e88c7f64355ead`。仅按其原版本／方法／范围阅读。
- 现存材料：[deep-slim-20261021-reviewed-once.json](../../artifacts/maintenance/reviewed-retirements/deep-slim-20261021-reviewed-once.json)，158141字节，SHA `0b7fd35f91592c6190e3871b0a2cfbd5d42e2e81464130429ec4591a39549a57`。仅按其原版本／方法／范围阅读。

## H15：TableMax-1.0.8.6-installer-win-x64.exe

- 原文：`docs/reference/acceptance.md` → v1.0.8发行验收（2026-10-19）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/releases/v1.0.8/1.0.8.6/TableMax-1.0.8.6-installer-win-x64.exe`，解析为`artifacts/releases/v1.0.8/1.0.8.6/TableMax-1.0.8.6-installer-win-x64.exe`。
- 状态：**原路径缺失，既有同字节备份**。原路径缺失；既有发行附件备份与原文EXE的SHA一致。只恢复字节身份的可追溯入口，不证明原路径启动或补回缺失的正式报告。
- 原EXE身份SHA：`a520c73f0f94291c18960e0b4de19716aa994531670fe5eac8a4dd505e806fc2`。
- 现存材料：[TableMax-1.0.8-installer-win-x64.exe](../../artifacts/maintenance/v1.0.8/replacement-20261021/original-release/TableMax-1.0.8-installer-win-x64.exe)，38116181字节，SHA `a520c73f0f94291c18960e0b4de19716aa994531670fe5eac8a4dd505e806fc2`。仅按其原版本／方法／范围阅读。
- 现存材料：[backup-verification.json](../../artifacts/maintenance/v1.0.8/replacement-20261021/original-release/backup-verification.json)，472字节，SHA `18d1c08df7a3634a434afcf2a830f0b7b865897f0d42c0d6cf8c0c55494c87be`。仅按其原版本／方法／范围阅读。

## H16：report.json

- 原文：`docs/reference/acceptance.md` → v1.0.8发行验收（2026-10-19）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/maintenance/v1.0.8/release/production-r6/original-executable/report.json`，解析为`artifacts/maintenance/v1.0.8/release/production-r6/original-executable/report.json`。
- 状态：**原发行证明缺失**。原发行工作树的报告路径在本工作树不存在，当前Git工作树列表也没有原发行工作树。现存附件备份不能替代执行／账户清理／封存／推广或发布审计；原历史声明保留，但不得作为可复用证明。
- 现存材料：[backup-verification.json](../../artifacts/maintenance/v1.0.8/replacement-20261021/original-release/backup-verification.json)，472字节，SHA `18d1c08df7a3634a434afcf2a830f0b7b865897f0d42c0d6cf8c0c55494c87be`。仅按其原版本／方法／范围阅读。

## H17：isolated-account.json

- 原文：`docs/reference/acceptance.md` → v1.0.8发行验收（2026-10-19）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/maintenance/v1.0.8/release/production-r6/isolated-account.json`，解析为`artifacts/maintenance/v1.0.8/release/production-r6/isolated-account.json`。
- 状态：**原发行证明缺失**。原发行工作树的报告路径在本工作树不存在，当前Git工作树列表也没有原发行工作树。现存附件备份不能替代执行／账户清理／封存／推广或发布审计；原历史声明保留，但不得作为可复用证明。
- 现存材料：[backup-verification.json](../../artifacts/maintenance/v1.0.8/replacement-20261021/original-release/backup-verification.json)，472字节，SHA `18d1c08df7a3634a434afcf2a830f0b7b865897f0d42c0d6cf8c0c55494c87be`。仅按其原版本／方法／范围阅读。

## H18：finalized-installation-r6.json

- 原文：`docs/reference/acceptance.md` → v1.0.8发行验收（2026-10-19）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/maintenance/v1.0.8/release/finalized-installation-r6.json`，解析为`artifacts/maintenance/v1.0.8/release/finalized-installation-r6.json`。
- 状态：**原发行证明缺失**。原发行工作树的报告路径在本工作树不存在，当前Git工作树列表也没有原发行工作树。现存附件备份不能替代执行／账户清理／封存／推广或发布审计；原历史声明保留，但不得作为可复用证明。
- 现存材料：[backup-verification.json](../../artifacts/maintenance/v1.0.8/replacement-20261021/original-release/backup-verification.json)，472字节，SHA `18d1c08df7a3634a434afcf2a830f0b7b865897f0d42c0d6cf8c0c55494c87be`。仅按其原版本／方法／范围阅读。

## H19：promotion-final-r6.json

- 原文：`docs/reference/acceptance.md` → v1.0.8发行验收（2026-10-19）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/maintenance/v1.0.8/release/promotion-final-r6.json`，解析为`artifacts/maintenance/v1.0.8/release/promotion-final-r6.json`。
- 状态：**原发行证明缺失**。原发行工作树的报告路径在本工作树不存在，当前Git工作树列表也没有原发行工作树。现存附件备份不能替代执行／账户清理／封存／推广或发布审计；原历史声明保留，但不得作为可复用证明。
- 现存材料：[backup-verification.json](../../artifacts/maintenance/v1.0.8/replacement-20261021/original-release/backup-verification.json)，472字节，SHA `18d1c08df7a3634a434afcf2a830f0b7b865897f0d42c0d6cf8c0c55494c87be`。仅按其原版本／方法／范围阅读。

## H20：github-publication.json

- 原文：`docs/reference/acceptance.md` → v1.0.8发行验收（2026-10-19）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/maintenance/v1.0.8/windows-editions/85bd35415a6a6dab6b2de0c0f59f6cac9feae8d15e9da78ad8aae804c10018ff/github-publication.json`，解析为`artifacts/maintenance/v1.0.8/windows-editions/85bd35415a6a6dab6b2de0c0f59f6cac9feae8d15e9da78ad8aae804c10018ff/github-publication.json`。
- 状态：**原发行证明缺失**。原发行工作树的报告路径在本工作树不存在，当前Git工作树列表也没有原发行工作树。现存附件备份不能替代执行／账户清理／封存／推广或发布审计；原历史声明保留，但不得作为可复用证明。
- 现存材料：[backup-verification.json](../../artifacts/maintenance/v1.0.8/replacement-20261021/original-release/backup-verification.json)，472字节，SHA `18d1c08df7a3634a434afcf2a830f0b7b865897f0d42c0d6cf8c0c55494c87be`。仅按其原版本／方法／范围阅读。

## H21：TableMax-1.0.7.34-installer-win-x64.exe

- 原文：`docs/reference/acceptance.md` → 最新完整安装器1.0.7.34与清理门禁（2026-10-18）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.34/TableMax-1.0.7.34-installer-win-x64.exe`，解析为`artifacts/releases/v1.0.7/1.0.7.34/TableMax-1.0.7.34-installer-win-x64.exe`。
- 状态：**已确认退役**。原EXE在已完成且SHA绑定的退役清单中；配套sidecar仍在，只供身份追溯，不是可启动EXE。
- 原EXE身份SHA：`15230898d50fbafc52761a7735561d42352d0f24fe564485bed5ee71cce6d32c`。
- 现存材料：[TableMax-1.0.7.34-installer-win-x64-manifest.json](../../artifacts/releases/v1.0.7/1.0.7.34/TableMax-1.0.7.34-installer-win-x64-manifest.json)，56823字节，SHA `9901af19166858211cff94d8608484e6152da7836b9ff2b1916db2b97d36b5cd`。仅按其原版本／方法／范围阅读。
- 现存材料：[reviewed-files-r5.json（原件待退役）](history-cleanup-20261024.md)，44641820字节，SHA `73df0d4adcbf409b0a4bfa236e021244198dc0548ca7705b98e88c7f64355ead`。仅按其原版本／方法／范围阅读。
- 现存材料：[deep-slim-20261021-reviewed-once.json](../../artifacts/maintenance/reviewed-retirements/deep-slim-20261021-reviewed-once.json)，158141字节，SHA `0b7fd35f91592c6190e3871b0a2cfbd5d42e2e81464130429ec4591a39549a57`。仅按其原版本／方法／范围阅读。

## H22：TableMax-1.0.7.22-installer-win-x64.exe

- 原文：`docs/reference/acceptance.md` → 盒子与马尼拉界面优化（2026-10-17）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64.exe`，解析为`artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64.exe`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，38190字节，SHA `7afca08003e914f4991a1f36f91c4b68f30ee113a4f014af880433da2a7ed110`。仅按其原版本／方法／范围阅读。
- 现存材料：[isolated-account.json（原件待退役）](history-cleanup-20261024.md)，53377字节，SHA `80154020bd758fa19b79a6eac4c558146864123ea02d1509cb905d75a33ee1b3`。仅按其原版本／方法／范围阅读。
- 现存材料：[finalized-installation-22.json（原件待退役）](history-cleanup-20261024.md)，1991941字节，SHA `50ac8fbf24cd13344953768f7f611ea77bb933fe124221bd7eeeef6b5c9a2fe7`。仅按其原版本／方法／范围阅读。

## H23：TableMax-1.0.7.22-installer-win-x64-manifest.json

- 原文：`docs/reference/acceptance.md` → 盒子与马尼拉界面优化（2026-10-17）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.22/TableMax-1.0.7.22-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，38190字节，SHA `7afca08003e914f4991a1f36f91c4b68f30ee113a4f014af880433da2a7ed110`。仅按其原版本／方法／范围阅读。
- 现存材料：[isolated-account.json（原件待退役）](history-cleanup-20261024.md)，53377字节，SHA `80154020bd758fa19b79a6eac4c558146864123ea02d1509cb905d75a33ee1b3`。仅按其原版本／方法／范围阅读。
- 现存材料：[finalized-installation-22.json（原件待退役）](history-cleanup-20261024.md)，1991941字节，SHA `50ac8fbf24cd13344953768f7f611ea77bb933fe124221bd7eeeef6b5c9a2fe7`。仅按其原版本／方法／范围阅读。

## H24：TableMax-1.0.7.2-installer-win-x64-manifest.json

- 原文：`docs/reference/acceptance.md` → 1.0.7.2：安装进度与版本交付（2026-10-16）；源SHA `f62f2bfac272ca0e4609c17199da4bddd04ad83a45fbe9f5e903caede942d3ce`。
- 原地址：`../../artifacts/releases/v1.0.7/1.0.7.2/TableMax-1.0.7.2-installer-win-x64-manifest.json`，解析为`artifacts/releases/v1.0.7/1.0.7.2/TableMax-1.0.7.2-installer-win-x64-manifest.json`。
- 状态：**历史原件缺失，原因未确认**。本工作树原件缺失；未查得该文件逐项删除或迁移证明。相关报告只提供原身份／当时结果，不替代缺失清单或原路径复验。
- 现存材料：[retained-games-proof.json（原件待退役）](history-cleanup-20261024.md)，846字节，SHA `09f8f098cc1263f11dbbba0748b0ed2cc204c31efdd96065e625175bbbfd447e`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，1420517字节，SHA `1812aa7d42331cadf08e8951996eb1204afed5446bee0fd268cce67dbef472be`。仅按其原版本／方法／范围阅读。
- 现存材料：[report.json（原件待退役）](history-cleanup-20261024.md)，1363657字节，SHA `82d572a902a2ba24554d1a644521f6fcb9db7f260310b1b60cf1df1eca2e7c74`。仅按其原版本／方法／范围阅读。
