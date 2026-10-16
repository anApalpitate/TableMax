1. 原版玩家等待他人行动（G06）：牌桌只保留本人，提示只有他人姓名。调整：提示并列公开头像；初始同时翻牌展示未完成者集合，不扩大牌面权限。证据：`games/pokemon-encounters/ui/public/index.tsx:154`、`games/pokemon-encounters/ui/table.tsx:160`。
2. 原版及扩展顶栏（G05）：菜单仍为文字按钮。调整：采用与卡牌质感协调的菜单图标，保留提示、可访问名称和44px热区，渲染核验视觉居中。证据：`games/pokemon-encounters/web/index.tsx:130`、`games/pokemon-encounters/expansion/web/index.tsx:1429`。
3. 扩展玩家等待他人行动（G06）：横条只显示姓名，可见头像属于本人。调整：行动横条显示行动者公开头像；投票／同时翻牌表达未完成者集合。证据：`games/pokemon-encounters/expansion/web/index.tsx:637`、`games/pokemon-encounters/expansion/web/index.tsx:1555`。
4. 扩展投票、换入、天气与结算（G03）：多处“·”串联动作、来源、条件和结果。调整：短动作与独立状态标签分组，保留“提交锁定”“必须换入”等条件。证据：`games/pokemon-encounters/expansion/web/index.tsx:102`、`games/pokemon-encounters/expansion/web/index.tsx:633`、`games/pokemon-encounters/expansion/web/event-presentation.ts:24`。
5. 原版牌名（G03／P01）：手机规则将名称设为12px，电脑自适应下限也为12px，低于16px信息下限。调整：扩大名称区、减少重复标签并重排；验证能力选位和六人桌面，勿整体缩牌。证据：`games/pokemon-encounters/ui/layout.css:562`、`games/pokemon-encounters/ui/layout.css:785`、`games/pokemon-encounters/ui/layout.css:1151`。
6. 扩展主机／公共屏短窗口（G07／G18）：宽≥761px时，舞台`min-height:720px`强制撑高480／600px窗口。调整：允许根舞台收缩，按人数重排牌桌与供给，次要资料按需展开；保留字号下限。证据：`games/pokemon-encounters/expansion/web/refinement.css:676`。
