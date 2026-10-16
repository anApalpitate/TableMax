1. 玩家等待他人选画（G06）：选画台只有姓名，其他玩家头像藏在博物馆浮窗。调整：将公开头像与姓名、动作并排；暂停时移除行动中表达。证据：`games/modern-art/ui/public/index.tsx:229`、`games/modern-art/web/index.tsx:290`。
2. 三端顶栏（G05）：菜单仍为文字按钮。调整：采用艺术拍卖主题菜单图标，保留提示、可访问名称和44px热区，渲染复核视觉居中。证据：`games/modern-art/web/index.tsx:195`。
3. 历轮行情（G03）：说明以“·”串联增值与累计价值。调整：分别标为表格行标签，保留“千元／幅”和两种数值的区别。证据：`games/modern-art/ui/public/index.tsx:213`。
4. 已完成（2026-10-17，3/3项）：选画台并列公开头像、完整姓名与动作，暂停保留身份及恢复入口；菜单改为44px主题图标并校正轮廓居中；行情分列增值、累计价值及单位。局部ESLint、类型检查、现代艺术Web增量构建通过；实际源码渲染30组、48张截图通过，覆盖三端、3–5人及320／390／1280px，验证合法轮换、暂停、行情数值、浮窗关闭与焦点恢复，未产生对局动作。证据：`artifacts/maintenance/ui-preference-implementation-20261017/modern-art-round02/report.json`。模拟视口不替代实体设备、Windows DPI或安装验收；安装器未重封。
