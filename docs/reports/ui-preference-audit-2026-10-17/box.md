1. 连接帮助的网卡选择（G03）：网卡名与IP地址仍用“·”连接。调整：选项采用“网卡名（IP地址）”，保留虚拟网卡及无局域网地址的必要短标记。证据：`apps/web/src/components/InviteFriends.tsx:158`。
2. 已完成（2026-10-17，1/1项）：已改为“网卡名（IP）”，虚拟／VPN与无局域网地址状态保留。390px及1280px实际渲染、三类网卡切换、刷新、保存状态、关闭焦点、局部ESLint和平台增量构建通过，见[校验](../../../artifacts/maintenance/ui-preference-implementation-20261017/box-round01/report.json)。原生下拉展开及真实网络未测；仅源码改造，未重封安装器。
