# 开发与启动

从项目根目录运行：

```powershell
node tools/dev/dev.mjs
```

等同`pnpm dev`：构建当前源码并启动可操作的桌游盒子，不生成安装器。在游戏库选择游戏即可实际开局；修改源码后重新运行。网页、规则、资源和共享运行时来自同一次构建，不再混用独立Vite页面。服务默认仅监听`127.0.0.1:38473`；原生盒子自动使用实际服务端口。

开发启动会对刚构建且有`.tablemax-development.json`标记的`build/desktop/TableMax.exe`执行单文件Low→Medium完整性标签修正，防止从沙箱构建继承Low后系统浏览器激活无响应；原字节、属主、DACL、附加流及签名状态须完全保留，异常标签／下载标记仍拒绝。回执为`build/desktop/.tablemax-development-security.json`。不修改目录、源Node或正式交付EXE。默认回环模式只显示本机加入地址，供本机浏览器使用，不能用于手机扫码。

2026-10-20本机回归：原路径开发EXE实际为非提权Medium，可信外链与拒绝用例通过；隐藏浏览器访问实际回环加入网址并显示玩家盒子。证据为`artifacts/maintenance/dev-join-20261020/`。默认浏览器激活仅捕获已批准的系统启动目标，不把此结果写成真人默认浏览器关联或实体手机证明。旧程序须关闭后重启，本次未导出安装器。

开发启动每次创建全新会话，配置、对局、身份及WebView2浏览器状态使用`.cache/development/sessions/session-*`，退出后只清理本次会话。`TABLEMAX_BOX_DIRECTORY`可指定会话父目录；继承的`TABLEMAX_DATA_DIR`不用于这个入口，避免意外恢复或清空正式存档。原`.cache/development/`中的历史资料及配置指向的其他目录保持原样，不自动载入；异常退出残留的会话也不会被下次启动复用。外部手机／系统浏览器自己的本地偏好不会被删除，但服务端房间与身份为新会话。

每次启动使用本次构建的游戏代码和网页；开发入口不保留跨次对局。要检查存档恢复可用`pnpm start`启动已有桌面构建并明确配置数据目录，该入口沿用原持久化行为。输出为`build/`，进程占用期间维护保持阻塞；需要保留开发诊断日志时须在退出前从本次会话复制。

构建按每个`game-module.json`的ID递归发现`assets/games/<id>/`内现有媒体扩展的资源，合并源码导入和glob依赖；动态`resourceUrl(id, import.meta.url)`也能取得当前发行自己的资源，新游戏无需补中心名单或仅为收录资源而添加glob。普通／扩展资源分别入对应单元，不重复收录；PDF、JSON等原始资料不作为媒体输出，链接和跨游戏资源拒绝。资源新增、删除或内容变化重新绑定对应单元。开发启动始终完成全套开发组装，传给桌面程序的参数不会把它改成局部构建后误开旧目录；退出已运行旧盒子后再重启才能加载本次快照，旧存档继续固定其原发行。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                                                   | 入口／用途                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [dev.mjs](dev.mjs)                                     | `pnpm dev`                                                                                                                                     |
| [launch.mjs](launch.mjs)                               | `pnpm start`                                                                                                                                   |
| [session.mjs](session.mjs)                             | 开发会话隔离与限于本次目录的清理                                                                                                               |
| [session.test.mjs](session.test.mjs)                   | 隔离、旧数据保护与链接替换防护单测                                                                                                             |
| [verify-session.mjs](verify-session.mjs)               | 使用相同会话提供器连续启动两次现有原生构建，隐藏静音、仅回环；验证首次数据库、实际WebView2目录及退出清理，不重建运行中的EXE                    |
| [verify-game-resources.mjs](verify-game-resources.mjs) | 连接独立启动的开发会话：`--cdp-port=<本机测试CDP端口> --evidence=<新名称>`，核对两款实体牌游戏的实际发行资源字节、图像解码及主机／模拟手机渲染 |

两项会话检查归`tooling`范围，通过[范围检查入口](../test/README.md#计划预设与业务入口)的显式计划执行；单测使用version 2与`nodeArgs:["--test"]`，原生检查使用普通Node。后者不等同于完整开发命令的构建／启动验收，也不代表安装器或实体手机证明。

实体牌资源检查归`tooling,game:cockroach-poker,game:cockroach-salad`。先独立启动实际`node tools/dev/dev.mjs --foundation-test`并为该进程设置隔离数据、`TABLEMAX_TEST_CDP_PORT`、静音及回环地址，待构建和隐藏原生窗口就绪后，再由范围计划运行上述连接检查；工程占用保护继续阻止同一构建树中的其他活动进程，不将等待构建的验收器冒充空闲协调器。验证器只断开自己的CDP连接，原开发进程由启动者正常退出。

2026-10-21实体牌资源回归：[实际开发命令](../../artifacts/maintenance/cockroach-art-integration-20261021/direct-launch-final.json)构建、原生启动及正常退出通过；[资源证明](../../artifacts/maintenance/dev-game-resources/physical-art-final-r4-20261021/report.json)核对德国小强和蟑螂沙拉97个资源，并验证主机与模拟手机显示实体牌图。新增游戏资源自动发现及安全回归见[源码验收](../../docs/reference/acceptance.md#实体牌美术与开发资源加载2026-10-21)。不生成新安装器，不代表实体手机或真实LAN验收。

2026-10-21早期隔离回归：四项隔离／数据保护单测通过；使用现有原生构建连续两次启动均为数据库首次启动，实际WebView2目录不同，退出清理完成，旧目录及外部目录内容保留。证据为`artifacts/maintenance/dev-session-h1I7Rv/report.json`。当时完整开发命令在组装阶段因现有开发盒子占用而停止，原失败记录保留，未关闭原实例或重写其构建目录；后续完整命令证明见上段。
