import { useEffect, useReducer, useRef, useState } from 'react';
import {
  initialState,
  reduce,
  type Role,
  type Screen,
  type Issue,
} from './model';
import { art, avatarFor } from './art';
import { Icon, IconButton, SeatTile } from './ui';
import './styles.css';

const roles: Record<Role, string> = {
  host: '房主管理',
  public: '公共屏',
  player: '手机玩家',
};
const screens: Record<Screen, string> = {
  setup: '启动与网络',
  lobby: '大厅与准备',
  session: '通用状态演示',
  result: '结束展示',
  recovery: '重启恢复',
  error: '异常提示',
};
const issues: Record<Issue, { title: string; detail: string; steps: string }> =
  {
    network: {
      title: '手机暂时无法连接',
      detail: '二维码不会帮助手机连接 Wi-Fi。请先连接电脑所在的局域网。',
      steps:
        '核对选中的网卡、局域网地址与端口；检查私人网络防火墙、访客网络与设备隔离；用系统浏览器打开显示的地址。',
    },
    port: {
      title: '本地服务未能启动',
      detail: '端口被占用。当前工程会停止启动并提示，不会静默切换端口。',
      steps:
        '关闭占用端口的程序后重新启动；后续可配置端口的入口在第三阶段确定。',
    },
    incompatible: {
      title: '存档版本不兼容',
      detail: '原存档保留，未加载到当前房间。',
      steps:
        '记录平台、游戏、规则及状态版本，使用兼容程序恢复；不要覆盖或静默重置原文件。',
    },
    corrupt: {
      title: '存档无法读取',
      detail: '原存档保留，未修改或覆盖。',
      steps:
        '查看管理端诊断和存档位置；保留原文件供排查，恢复前不会显示游戏成功状态。',
    },
  };

export function Prototype() {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState('192.168.1.12');
  const [dialog, setDialog] = useState<'rollback' | 'rebind' | 'end' | null>(
    null,
  );
  const [target, setTarget] = useState('决策示例 B 之前');
  const [bindingSeat, setBindingSeat] = useState('S1');
  const [sound, setSound] = useState(false);
  const [soundNotice, setSoundNotice] = useState('提示音尚未启用');
  const audio = useRef<AudioContext | null>(null);
  const review = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent | KeyboardEvent) {
      const drawer = review.current;
      if (!drawer?.open || event.defaultPrevented) return;
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        drawer.open = false;
        drawer.querySelector<HTMLElement>('summary')?.focus();
      } else if (
        event instanceof PointerEvent &&
        event.target instanceof Node &&
        !drawer.contains(event.target)
      ) {
        drawer.open = false;
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, []);
  const dialogTrigger = useRef<HTMLElement | null>(null);
  function openDialog(value: 'rollback' | 'rebind' | 'end') {
    dialogTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDialog(value);
  }
  useEffect(() => {
    if (!dialog) return;
    const trigger = dialogTrigger.current;
    document
      .querySelector<HTMLElement>('.modal select, .modal button')
      ?.focus();
    return () => trigger?.focus();
  }, [dialog]);
  const canChoose =
    state.connection === 'online' &&
    !state.paused &&
    !['pending', 'uncertain'].includes(state.submission);
  const joined = state.seats.find((seat) => seat.id === state.joinedSeat);
  const url = `http://${address}:38473/player`;

  function switchScreen(screen: Screen) {
    setDialog(null);
    dispatch({ type: 'screen', screen });
  }
  function switchRole(role: Role) {
    setDialog(null);
    setSound(false);
    setSoundNotice('提示音尚未启用');
    void audio.current?.suspend();
    dispatch({ type: 'role', role });
  }
  async function enableSound() {
    try {
      audio.current ??= new AudioContext();
      await audio.current.resume();
      setSound(true);
      setSoundNotice('提示音已启用，可随时静音');
    } catch {
      setSoundNotice('声音不可用，仍可继续使用');
    }
  }
  function previewSound() {
    if (!sound || state.role !== 'public' || !audio.current) return;
    try {
      const context = audio.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 440;
      gain.gain.setValueAtTime(0.05, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      setSoundNotice('播放失败，仍可继续使用');
    }
  }

  const seatList = (
    <ul className="seat-list">
      {state.seats.map((seat, index) => (
        <SeatTile
          key={seat.id}
          seat={seat}
          own={state.role === 'player' && state.joinedSeat === seat.id}
          first={index === 0}
          {...(state.role === 'host'
            ? { move: () => dispatch({ type: 'move-seat', id: seat.id }) }
            : {})}
        />
      ))}
    </ul>
  );
  const stageImage = state.connection !== 'online' ? art.offline : art.waiting;
  return (
    <div className={`prototype ${state.role} screen-${state.screen}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="box" />
          </span>
          <span>
            TableMax<small>{roles[state.role]}</small>
          </span>
        </div>
        <div className="header-tools">
          <span
            className={`badge ${state.connection === 'online' ? 'connected' : 'warning'}`}
            role="status"
          >
            <Icon name="wifi" />
            {state.connection === 'online'
              ? '连接演示'
              : state.connection === 'offline'
                ? '已断开 · 座位保留'
                : '同步中'}
          </span>
          <span className="demo-label">演示</span>
          <details className="review-drawer" ref={review}>
            <summary aria-label="审阅工具">
              <Icon name="settings" />
              <span>审阅工具</span>
            </summary>
            <aside aria-label="原型走查工具" className="review-content">
              <h2>原型审阅</h2>
              <p className="muted">仅本页模拟 · 刷新会重置 · 规则未核验</p>
              <div className="review-controls">
                <label>
                  角色
                  <select
                    aria-label="角色"
                    value={state.role}
                    onChange={(event) => switchRole(event.target.value as Role)}
                  >
                    {Object.entries(roles).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  页面
                  <select
                    aria-label="页面"
                    value={state.screen}
                    onChange={(event) =>
                      switchScreen(event.target.value as Screen)
                    }
                  >
                    {Object.entries(screens).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <IconButton
                icon="back"
                onClick={() => {
                  setDialog(null);
                  dispatch({ type: 'reset' });
                }}
              >
                重置示例
              </IconButton>
              {state.screen === 'lobby' && (
                <button onClick={() => dispatch({ type: 'all-ready' })}>
                  模拟全员准备
                </button>
              )}
              {state.screen === 'session' && (
                <div className="simulation">
                  <h3>模拟反馈与异常</h3>
                  <div className="simulation-buttons">
                    <button
                      disabled={state.submission !== 'pending'}
                      onClick={() =>
                        dispatch({ type: 'reply', outcome: 'saved' })
                      }
                    >
                      模拟保存确认
                    </button>
                    <button
                      disabled={state.submission !== 'pending'}
                      onClick={() =>
                        dispatch({ type: 'reply', outcome: 'rejected' })
                      }
                    >
                      模拟拒绝
                    </button>
                    <button
                      disabled={state.submission !== 'pending'}
                      onClick={() =>
                        dispatch({ type: 'reply', outcome: 'uncertain' })
                      }
                    >
                      模拟确认丢失
                    </button>
                    <button
                      onClick={() =>
                        dispatch({ type: 'connection', connection: 'offline' })
                      }
                    >
                      模拟掉线
                    </button>
                    <button onClick={() => dispatch({ type: 'synchronize' })}>
                      模拟完整同步
                    </button>
                    <button onClick={() => dispatch({ type: 'late-reply' })}>
                      模拟旧分支迟到动作
                    </button>
                  </div>
                  <small data-testid="revision">
                    示例修订 {state.revision} · 分支 {state.branch} · 绑定代数{' '}
                    {state.bindingGeneration}
                  </small>
                </div>
              )}
              {state.screen === 'error' && (
                <label>
                  异常类型
                  <select
                    aria-label="异常类型"
                    value={state.issue}
                    onChange={(event) =>
                      dispatch({
                        type: 'issue',
                        issue: event.target.value as Issue,
                      })
                    }
                  >
                    {Object.entries(issues).map(([key, issue]) => (
                      <option key={key} value={key}>
                        {issue.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <details className="review-notes">
                <summary>边界与工程说明</summary>
                <p>
                  示例地址、人数、座位、分支与 A／B
                  选项是合成数据，不代表游戏配置。没有真实服务、身份凭证或存档。
                </p>
                <p>
                  房主参与时使用独立手机座位。管理权限不包含其他玩家秘密；完整恢复状态保留在服务端。
                </p>
                <p>
                  没有默认倒计时，掉线不代操作。首版采用规则支持 2–5 位及 2×3
                  卡位；具体操作见游戏原型，正式规则引擎尚未实现。
                </p>
                <p>
                  关闭公共屏保留服务；退出整个程序停止服务。地址变化后需重新生成真实加入二维码。
                </p>
              </details>
            </aside>
          </details>
        </div>
      </header>
      <main>
        {state.notice && (
          <p className="notice" role="status">
            {state.notice}
          </p>
        )}
        {state.screen === 'setup' && (
          <div className="columns setup-layout">
            <section className="cover-stage">
              <div className="stage-caption">
                <p className="eyebrow">朋友 · 手机 · 一张桌子</p>
                <h1>今晚，玩一局。</h1>
              </div>
              <div className="game-box">
                <img
                  src={art.cover}
                  alt="木质棋子、骰子与卡片组成的原创桌游封面"
                />
                <div className="box-title">
                  <small>TABLEMAX / 原型示意</small>
                  <strong>桌边奇遇</strong>
                </div>
              </div>
              <span className="cover-note">原创平台美术 · 采用规则已整理</span>
            </section>
            <section className="control-sheet">
              <p className="eyebrow">准备好相聚了吗？</p>
              <h2>你的桌游盒子</h2>
              <div className="game-meta">
                <Icon name="box" />
                <span>
                  宝可梦奇遇<small>皮卡丘和朋友们 · 采用规则</small>
                </span>
              </div>
              <IconButton
                icon="arrow"
                className="primary"
                onClick={() => switchScreen('lobby')}
              >
                查看大厅原型
              </IconButton>
              <details className="network-settings">
                <summary>
                  <Icon name="settings" />
                  网络设置
                </summary>
                <p className="muted">示例地址 · 不读取或更改本机网络</p>
                <label>
                  网卡地址
                  <select
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  >
                    <option value="192.168.1.12">
                      家庭 Wi-Fi · 192.168.1.12
                    </option>
                    <option value="172.20.0.1">
                      虚拟网卡示例 · 172.20.0.1
                    </option>
                  </select>
                </label>
                <p className="address">{url}</p>
              </details>
              <IconButton
                icon="help"
                className="quiet"
                onClick={() => dispatch({ type: 'issue', issue: 'network' })}
              >
                查看连接帮助
              </IconButton>
              <div className="sheet-decoration" aria-hidden="true">
                <img src={art.cards} alt="" />
                <img src={art.chips} alt="" />
              </div>
            </section>
          </div>
        )}
        {state.screen === 'lobby' && (
          <div className="columns lobby-layout">
            <section className="lobby-stage">
              <div className="game-heading">
                <img src={art.cover} alt="原创桌游封面示意" />
                <div>
                  <p className="eyebrow">示例大厅</p>
                  <h1>
                    {state.role === 'player'
                      ? '找到你的座位。'
                      : '等朋友，开一桌。'}
                  </h1>
                  <p className="game-name">宝可梦奇遇：皮卡丘和朋友们</p>
                  <span className="rule-label">采用规则</span>
                </div>
              </div>
              {state.role === 'player' ? (
                <>
                  <div className="personal-seat">
                    <img
                      src={joined ? avatarFor(joined.id) : art.meeple}
                      alt=""
                    />
                    <div>
                      <small>
                        {joined ? `你的座位 ${joined.id}` : '在桌边留个名字'}
                      </small>
                      <h2>{joined ? joined.nickname : '欢迎入座'}</h2>
                      <span>
                        {joined
                          ? joined.ready
                            ? '已准备，等朋友到齐'
                            : '准备好了就告诉大家'
                          : '手机与电脑连接同一 Wi-Fi'}
                      </span>
                    </div>
                  </div>
                  {!joined && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        dispatch({ type: 'join', nickname });
                      }}
                    >
                      <label>
                        昵称
                        <input
                          autoComplete="off"
                          value={nickname}
                          maxLength={20}
                          onChange={(event) => setNickname(event.target.value)}
                        />
                      </label>
                      {state.seats.some(
                        (seat) => seat.nickname === nickname.trim(),
                      ) && (
                        <p className="muted">
                          已有同名玩家，加入后用座位区分。
                        </p>
                      )}
                      <div className="player-action-bar">
                        <IconButton
                          icon="people"
                          className="primary"
                          disabled={!nickname.trim() || !state.joiningOpen}
                        >
                          取得座位（模拟）
                        </IconButton>
                      </div>
                    </form>
                  )}
                  {joined && (
                    <div className="player-action-bar">
                      <IconButton
                        icon="check"
                        className="primary"
                        onClick={() => dispatch({ type: 'ready' })}
                      >
                        {joined.ready ? '取消准备' : '我已准备'}
                      </IconButton>
                      <IconButton
                        icon="play"
                        onClick={() => switchScreen('session')}
                      >
                        查看游玩状态原型
                      </IconButton>
                    </div>
                  )}
                  <details className="friends-fold">
                    <summary>
                      <Icon name="people" />
                      桌边的朋友 · {state.seats.length}
                    </summary>
                    {seatList}
                  </details>
                  <IconButton
                    icon="help"
                    className="quiet"
                    onClick={() =>
                      dispatch({ type: 'issue', issue: 'network' })
                    }
                  >
                    无法连接？查看帮助
                  </IconButton>
                </>
              ) : (
                <>
                  <div className="panel-heading">
                    <h2>桌边的朋友</h2>
                    <span>{state.seats.length} 位示例玩家</span>
                  </div>
                  {seatList}
                  <div className="table-decor" aria-hidden="true">
                    <img src={art.dice} alt="" />
                    <span>在桌边，一起玩。</span>
                    <img src={art.meeple} alt="" />
                  </div>
                </>
              )}
            </section>
            {state.role !== 'player' && (
              <section className="control-sheet join-panel">
                <p className="eyebrow">手机就是你的控制器</p>
                <h2>加入这张桌子</h2>
                <div
                  className="qr-placeholder"
                  aria-label="二维码占位，不能扫码"
                >
                  <Icon name="qr" />
                  <strong>加入入口示意</strong>
                  <small>无可扫描二维码</small>
                </div>
                <p className="address">{url}</p>
                <p className="join-status">
                  <Icon name={state.joiningOpen ? 'wifi' : 'lock'} />
                  {state.joiningOpen
                    ? '加入已开放 · 演示'
                    : '新玩家加入已关闭；已有身份仍可恢复。'}
                </p>
                {state.role === 'host' && (
                  <div className="stack host-lobby-actions">
                    <IconButton
                      icon={state.joiningOpen ? 'lock' : 'people'}
                      onClick={() => dispatch({ type: 'toggle-joining' })}
                    >
                      {state.joiningOpen ? '关闭新玩家加入' : '重新开放加入'}
                    </IconButton>
                    <div className="bot-lobby-actions">
                      <button
                        onClick={() => dispatch({ type: 'add-bot' })}
                        disabled={state.seats.length >= 5}
                      >
                        添加电脑
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'remove-bot' })}
                        disabled={
                          !state.seats.some((seat) => seat.control === 'bot')
                        }
                      >
                        移除电脑
                      </button>
                    </div>
                    <IconButton
                      icon="play"
                      className="primary"
                      disabled={
                        !state.seats.every((seat) => seat.ready) ||
                        state.seats.length < 2
                      }
                      onClick={() => {
                        location.href =
                          './prototype.html?game=pokemon-encounters';
                      }}
                    >
                      开始游戏原型
                    </IconButton>
                    <IconButton
                      icon="arrow"
                      className="quiet"
                      onClick={() => switchScreen('session')}
                    >
                      进入通用状态演示
                    </IconButton>
                  </div>
                )}
                <IconButton
                  icon="help"
                  className="quiet"
                  onClick={() => dispatch({ type: 'issue', issue: 'network' })}
                >
                  无法连接？查看帮助
                </IconButton>
              </section>
            )}
          </div>
        )}
        {state.screen === 'session' && (
          <>
            <div className="session-heading">
              <div>
                <p className="eyebrow">通用交互演示</p>
                <h1>
                  {state.paused
                    ? '对局已暂停。'
                    : state.connection !== 'online'
                      ? '等待连接恢复。'
                      : '等待玩家作出选择。'}
                </h1>
              </div>
              <span className="rule-label">游戏布局待规则核验</span>
            </div>
            <div className="columns session-layout">
              <section className="gameplay">
                <h2>
                  {state.role === 'player' ? '我的操作区' : '公共游戏展示区'}
                </h2>
                <div className="scene-stage">
                  <span className="scene-label">主题示意 · 非游戏棋盘</span>
                  <img
                    className="state-art"
                    src={stageImage}
                    alt={
                      state.connection !== 'online'
                        ? '狐狸连接玩具线缆的异常状态插画'
                        : '小熊与棋子等待的主题插画'
                    }
                  />
                  <p>
                    {state.paused
                      ? '等待房主恢复'
                      : state.connection !== 'online'
                        ? '座位保留，等待同步'
                        : '轮到你时，在手机上操作'}
                  </p>
                </div>
                {state.role === 'player' && (
                  <>
                    <fieldset disabled={!canChoose}>
                      <legend>交互样例 · 不代表游戏动作</legend>
                      <div className="choices">
                        {['选项 A', '选项 B'].map((value, index) => (
                          <button
                            key={value}
                            className={
                              state.selected === value ? 'selected' : ''
                            }
                            aria-pressed={state.selected === value}
                            onClick={() => dispatch({ type: 'select', value })}
                          >
                            <img
                              src={index === 0 ? art.dice : art.cards}
                              alt=""
                            />
                            {value}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="player-action-bar">
                      <p
                        className="submission"
                        role="status"
                        data-testid="submission"
                      >
                        {
                          {
                            idle: '选择后提交',
                            pending: '提交中 · 请勿重复操作',
                            saved: '已保存并确认',
                            rejected: '被拒绝 · 请重新选择',
                            uncertain: '结果未知 · 需要同步',
                          }[state.submission]
                        }
                      </p>
                      <IconButton
                        icon="check"
                        className="primary"
                        disabled={!state.selected || !canChoose}
                        onClick={() => dispatch({ type: 'submit' })}
                      >
                        提交示例选择
                      </IconButton>
                      {state.connection !== 'online' && (
                        <IconButton
                          icon="wifi"
                          onClick={() => dispatch({ type: 'synchronize' })}
                        >
                          模拟重连并同步
                        </IconButton>
                      )}
                    </div>
                  </>
                )}
                {state.role !== 'player' && state.connection !== 'online' && (
                  <IconButton
                    icon="wifi"
                    className="primary"
                    onClick={() => dispatch({ type: 'synchronize' })}
                  >
                    模拟重连并同步
                  </IconButton>
                )}
              </section>
              {state.role !== 'player' && (
                <section className="control-sheet session-controls">
                  <h2>{state.role === 'host' ? '房主管理' : '桌面状态'}</h2>
                  <div className="session-status">
                    <Icon name={state.paused ? 'pause' : 'people'} />
                    {state.paused ? '暂停' : '等待玩家'}
                  </div>
                  {state.role === 'host' ? (
                    <div className="stack">
                      <IconButton
                        icon={state.paused ? 'play' : 'pause'}
                        onClick={() => dispatch({ type: 'pause' })}
                      >
                        {state.paused ? '恢复对局' : '暂停对局'}
                      </IconButton>
                      <IconButton
                        icon="back"
                        onClick={() => openDialog('rollback')}
                      >
                        选择决策点回退
                      </IconButton>
                      <IconButton
                        icon="phone"
                        onClick={() => openDialog('rebind')}
                      >
                        确认换手机绑定
                      </IconButton>
                      <IconButton
                        icon="close"
                        className="danger"
                        onClick={() => openDialog('end')}
                      >
                        结束当前对局
                      </IconButton>
                    </div>
                  ) : (
                    <div className="sound-controls">
                      <IconButton
                        icon={sound ? 'mute' : 'sound'}
                        onClick={() => {
                          if (sound) {
                            setSound(false);
                            setSoundNotice('提示音已静音');
                          } else {
                            void enableSound();
                          }
                        }}
                      >
                        {sound ? '静音' : '启用提示音'}
                      </IconButton>
                      <IconButton
                        icon="sound"
                        disabled={!sound}
                        onClick={previewSound}
                      >
                        试听示例音
                      </IconButton>
                      <p className="muted" role="status">
                        {soundNotice}
                      </p>
                      <small>同步与回退不重播历史声音</small>
                    </div>
                  )}
                  <img className="control-decoration" src={art.chips} alt="" />
                </section>
              )}
            </div>
          </>
        )}
        {state.screen === 'result' && (
          <section className="state-page result">
            <img src={art.waiting} alt="小熊坐在桌边的结束示意插画" />
            <div>
              <p className="eyebrow">结束展示</p>
              <h1>这场相聚，告一段落。</h1>
              <p>结束示意 · 胜负与计分待规则核验</p>
              <IconButton
                icon="back"
                className="primary"
                onClick={() => switchScreen('lobby')}
              >
                返回大厅原型
              </IconButton>
            </div>
          </section>
        )}
        {state.screen === 'recovery' && (
          <section className="state-page recovery">
            <img src={art.recovery} alt="兔子从盒中取回卡片的恢复插画" />
            <div>
              <p className="eyebrow">重新回到桌边</p>
              <h1>发现未结束的对局。</h1>
              <p>座位与选择恢复示意</p>
              {state.role === 'host' ? (
                <div className="stack">
                  <IconButton
                    icon="back"
                    className="primary"
                    onClick={() => dispatch({ type: 'restore' })}
                  >
                    模拟恢复存档
                  </IconButton>
                  <button
                    onClick={() =>
                      dispatch({ type: 'issue', issue: 'incompatible' })
                    }
                  >
                    查看版本不兼容提示
                  </button>
                  <button
                    onClick={() =>
                      dispatch({ type: 'issue', issue: 'corrupt' })
                    }
                  >
                    查看损坏存档提示
                  </button>
                </div>
              ) : (
                <p>等待房主恢复。</p>
              )}
              <details className="help-details">
                <summary>恢复说明</summary>
                <p>
                  原浏览器身份有效时恢复原座位；地址变化后重新生成二维码。正式管理端显示存档位置，游戏状态与版本校验待实现。
                </p>
              </details>
            </div>
          </section>
        )}
        {state.screen === 'error' && (
          <section className="state-page error-panel">
            <img src={art.offline} alt="狐狸修复连接的异常插画" />
            <div>
              <p className="eyebrow">帮助与反馈</p>
              <h1>{issues[state.issue].title}</h1>
              <p>{issues[state.issue].detail}</p>
              <details className="help-details">
                <summary>排查步骤</summary>
                <p>{issues[state.issue].steps}</p>
              </details>
              <IconButton
                icon="back"
                className="primary"
                onClick={() =>
                  switchScreen(
                    state.issue === 'corrupt' || state.issue === 'incompatible'
                      ? 'recovery'
                      : 'setup',
                  )
                }
              >
                返回原型
              </IconButton>
            </div>
          </section>
        )}
      </main>
      {dialog && (
        <div
          className="modal-backdrop"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setDialog(null);
            }
            if (event.key === 'Tab') {
              const controls =
                event.currentTarget.querySelectorAll<HTMLElement>(
                  'button:not(:disabled), select, input',
                );
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <h2 id="dialog-title">
              {dialog === 'rollback'
                ? '恢复到哪个决策之前？'
                : dialog === 'rebind'
                  ? '确认换手机绑定'
                  : '结束当前对局？'}
            </h2>
            {dialog === 'rollback' && (
              <>
                <label>
                  目标决策点
                  <select
                    autoFocus
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    {[
                      '决策示例 A 之前',
                      '决策示例 B 之前',
                      '决策示例 C 之前',
                    ].map((label) => (
                      <option key={label}>{label}</option>
                    ))}
                  </select>
                </label>
                <p className="warning-box">
                  已有信息可能被看见。回退无法消除记忆；随机状态与已生成结果保持对应边界，不重新随机。
                </p>
                <p>恢复后清空各端旧选择与提交状态，旧分支动作失效。</p>
              </>
            )}
            {dialog === 'rebind' && (
              <>
                <label>
                  需要换手机的座位
                  <select
                    autoFocus
                    value={bindingSeat}
                    onChange={(event) => setBindingSeat(event.target.value)}
                  >
                    {state.seats.map((seat) => (
                      <option key={seat.id} value={seat.id}>
                        {seat.id} · {seat.nickname}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  当面确认玩家身份后再继续。保留该座位游戏数据，原凭证失效；这不等于允许中途替换玩家。
                </p>
              </>
            )}
            {dialog === 'end' && (
              <p>
                结束后停止接受游戏动作，并说明“房主结束”。本原型不产生真实存档或游戏结算。
              </p>
            )}
            <div className="dialog-actions">
              <button
                autoFocus={dialog === 'end'}
                onClick={() => setDialog(null)}
              >
                取消
              </button>
              <button
                className="primary"
                onClick={() => {
                  if (dialog === 'rollback')
                    dispatch({ type: 'rollback', label: target });
                  else if (dialog === 'rebind')
                    dispatch({ type: 'rebind', id: bindingSeat });
                  else dispatch({ type: 'screen', screen: 'result' });
                  setDialog(null);
                }}
              >
                {dialog === 'rollback'
                  ? '确认回退（模拟）'
                  : dialog === 'rebind'
                    ? '确认重新绑定（模拟）'
                    : '确认结束（模拟）'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
