# 开发与启动

从项目根目录运行：

```powershell
node tools/dev/dev.mjs
```

等同`pnpm dev`：构建当前源码并启动可操作的桌游盒子，不生成安装器。在游戏库选择游戏即可实际开局；修改源码后重新运行。网页、规则、资源和共享运行时来自同一次构建，不再混用独立Vite页面。服务默认仅监听`127.0.0.1:38473`；原生盒子自动使用实际服务端口。

开发启动会对刚构建且有`.tablemax-development.json`标记的`build/desktop/TableMax.exe`执行单文件Low→Medium完整性标签修正，防止从沙箱构建继承Low后系统浏览器激活无响应；原字节、属主、DACL、附加流及签名状态须完全保留，异常标签／下载标记仍拒绝。回执为`build/desktop/.tablemax-development-security.json`。不修改目录、源Node或正式交付EXE。默认回环模式只显示本机加入地址，供本机浏览器使用，不能用于手机扫码。

2026-10-20本机回归：原路径开发EXE实际为非提权Medium，可信外链与拒绝用例通过；隐藏浏览器访问实际回环加入网址并显示玩家盒子。证据为`artifacts/maintenance/dev-join-20261020/`。默认浏览器激活仅捕获已批准的系统启动目标，不把此结果写成真人默认浏览器关联或实体手机证明。旧程序须关闭后重启，本次未导出安装器。

开发配置、存档和游戏缓存默认保存在`.cache/development/`，与可重建的`build/desktop/`分离，可用已有`TABLEMAX_BOX_DIRECTORY`覆盖。每次启动使用本次构建的游戏代码和网页，新局不继承旧缓存选择；既有对局保留原发行绑定。`pnpm start`只启动已有桌面构建，配置目录沿用原行为。输出为`build/`与开发日志，进程占用期间维护保持阻塞。

[开发环境](../../docs/reference/development.md)维护具体运行要求；[工具总索引](../README.md)用于按任务定位。下表覆盖本分类文件，内部辅助不作为独立业务命令。

| 工具                     | 入口／用途   |
| ------------------------ | ------------ |
| [dev.mjs](dev.mjs)       | `pnpm dev`   |
| [launch.mjs](launch.mjs) | `pnpm start` |
