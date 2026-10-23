import './management-entry.css';

export function ManagementEntry({ waiting }: { waiting: boolean }) {
  return (
    <main className="shell game-loading management-entry">
      <h1>TableMax 管理兼展示端</h1>
      <p role="status">
        {waiting
          ? '正在核验管理员身份…'
          : '此入口仅供已认证管理员使用。请从本机 TableMax 管理窗口进入。'}
      </p>
      <a className="button" href="/">
        进入玩家端
      </a>
    </main>
  );
}
