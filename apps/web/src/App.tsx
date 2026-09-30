import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { EchoReplySchema, HealthSchema, type Health } from '@tablemax/protocol';

export function App() {
  const role =
    location.pathname === '/public'
      ? 'public'
      : location.pathname === '/player'
        ? 'player'
        : 'host';
  const [health, setHealth] = useState<Health | null>(null);
  const [connected, setConnected] = useState(false);
  const [addresses, setAddresses] = useState<string[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [text, setText] = useState('你好，TableMax');
  const [echoResult, setEchoResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    const socket = io({ transports: ['websocket', 'polling'] });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('foundation:ready', (value: unknown) => {
      const result = HealthSchema.safeParse(value);
      if (result.success) setHealth(result.data);
    });
    void fetch('/api/foundation/health', { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('服务暂时不可用');
        setHealth(HealthSchema.parse(await response.json()));
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted)
          setError(cause instanceof Error ? cause.message : '连接失败');
      });
    if (role === 'host') {
      void fetch('/api/foundation/addresses', { signal: abort.signal })
        .then(async (response) => {
          const input: unknown = await response.json();
          if (
            typeof input !== 'object' ||
            !input ||
            !('addresses' in input) ||
            !Array.isArray(input.addresses) ||
            !input.addresses.every((item: unknown) => typeof item === 'string')
          )
            return;
          const values: string[] = input.addresses;
          setAddresses(values);
          setSelectedAddress(values[0] ?? '');
        })
        .catch(() => {
          /* Health request supplies the connection error. */
        });
    }
    return () => {
      abort.abort();
      socket.disconnect();
    };
  }, [role]);

  function echo() {
    setEchoResult('正在验证…');
    const socket = io({ forceNew: true });
    socket
      .timeout(5_000)
      .emit(
        'foundation:echo',
        { text },
        (cause: Error | null, input: unknown) => {
          socket.disconnect();
          const result = EchoReplySchema.safeParse(input);
          setEchoResult(
            cause
              ? '连接超时，请重试'
              : result.success && result.data.ok
                ? `已收到：${result.data.text}`
                : '消息未通过校验',
          );
        },
      );
  }

  return (
    <main className={`shell ${role}`}>
      <header>
        <a className="brand" href="/host" aria-label="TableMax 工程入口">
          <span className="brand-mark">T</span>TableMax
        </a>
        <span
          className={`connection ${connected ? 'online' : ''}`}
          role="status"
        >
          {connected ? '本地连接已就绪' : '正在连接本地服务'}
        </span>
      </header>
      <section className="intro">
        <p className="eyebrow">一起坐下来，开始一场游戏</p>
        <h1>
          {role === 'public'
            ? '一张桌子，无限可能。'
            : role === 'player'
              ? '欢迎来到桌边。'
              : '你的桌游，从这里开始。'}
        </h1>
        <p className="description">
          {role === 'public'
            ? '公共屏入口已就绪，游戏内容将在后续阶段接入。'
            : role === 'player'
              ? '手机入口已就绪，玩家加入与游戏操作将在后续阶段接入。'
              : '工程基础验证版 · 当前用于检查本地服务、网页连接与打包环境。'}
        </p>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="grid">
        <section className="card status-card">
          <p className="eyebrow">
            {role === 'public'
              ? '公共空间'
              : role === 'player'
                ? '个人空间'
                : '运行状态'}
          </p>
          <h2>{health ? '已经准备好了' : '正在准备'}</h2>
          <p className="muted">
            这一版本验证工程基础，尚未实现大厅、身份或游戏规则。
          </p>
          <ul className="checks">
            <li>
              <span>网页服务</span>
              <strong>{health ? '可用' : '连接中'}</strong>
            </li>
            <li>
              <span>实时连接</span>
              <strong>{connected ? '可用' : '连接中'}</strong>
            </li>
            <li>
              <span>本地数据库</span>
              <strong>
                {health?.database === 'ok' ? '已验证' : '等待验证'}
              </strong>
            </li>
          </ul>
          {role === 'host' && health && (
            <p className="runtime">
              启动记录 {health.starts} · Node {health.runtime.node} · SQLite{' '}
              {health.runtime.sqlite}
            </p>
          )}
        </section>
        {role === 'host' && (
          <section className="card join-card">
            <p className="eyebrow">另一块屏幕</p>
            <h2>检查手机连接</h2>
            <p className="muted">
              手机与电脑连接同一局域网，选择可访问的电脑地址后扫码。
            </p>
            {addresses.length > 0 ? (
              <>
                <label htmlFor="address">电脑地址</label>
                <select
                  id="address"
                  value={selectedAddress}
                  onChange={(event) => setSelectedAddress(event.target.value)}
                >
                  {addresses.map((address) => (
                    <option key={address} value={address}>
                      {address}
                    </option>
                  ))}
                </select>
                {selectedAddress && (
                  <img
                    className="qr"
                    src={`/api/foundation/qr?address=${encodeURIComponent(selectedAddress)}`}
                    alt="手机工程验证入口二维码"
                  />
                )}
              </>
            ) : (
              <p className="muted">尚未发现局域网地址，请检查网络连接。</p>
            )}
            <a className="button secondary" href="/public">
              打开公共屏
            </a>
          </section>
        )}
        {role !== 'public' && (
          <section className="card echo-card">
            <p className="eyebrow">连接验证</p>
            <h2>发一声问候</h2>
            <label htmlFor="echo">验证消息</label>
            <div className="echo-row">
              <input
                id="echo"
                value={text}
                maxLength={80}
                onChange={(event) => setText(event.target.value)}
              />
              <button onClick={echo} disabled={!connected || !text.trim()}>
                发送验证消息
              </button>
            </div>
            <p className="echo-result" role="status" aria-live="polite">
              {echoResult || '发送后，本地服务会返回同一条消息。'}
            </p>
          </section>
        )}
      </div>
      <footer>
        TableMax · 工程基础阶段 <span>全部资源随程序本地打包</span>
      </footer>
    </main>
  );
}
