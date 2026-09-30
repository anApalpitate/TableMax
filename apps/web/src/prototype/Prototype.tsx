import { useEffect, useReducer, useRef, useState } from 'react';
import {
  initialState,
  reduce,
  type Role,
  type Screen,
  type Issue,
} from './model';
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
  useEffect(() => {
    if (!dialog) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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

  return (
    <div className={`prototype ${state.role}`}>
      <aside className="review-bar" aria-label="原型走查工具">
        <div>
          <strong>TableMax / 交互研究</strong>
          <span className="review-note">低保真 · 仅模拟 · 规则关口未通过</span>
        </div>
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
              onChange={(event) => switchScreen(event.target.value as Screen)}
            >
              {Object.entries(screens).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setDialog(null);
              dispatch({ type: 'reset' });
            }}
          >
            重置示例
          </button>
        </div>
      </aside>
      <main>
        <header className="app-header">
          <div className="brand">
            <b>T</b>
            <span>
              TableMax<small>{roles[state.role]}</small>
            </span>
          </div>
          <span
            className={`badge ${state.connection === 'online' ? 'connected' : 'warning'}`}
          >
            {state.connection === 'online'
              ? '模拟连接就绪'
              : state.connection === 'offline'
                ? '已断开 · 座位保留'
                : '同步中'}
          </span>
        </header>
        {state.notice && (
          <p className="notice" role="status">
            {state.notice}
          </p>
        )}
        {state.screen === 'setup' && (
          <>
            <section className="hero">
              <p className="eyebrow">欢迎来到桌边</p>
              <h1>先让大家连接同一张桌子。</h1>
              <p>电脑运行服务与公共屏，手机负责自己的操作。</p>
            </section>
            <div className="columns">
              <section className="panel">
                <h2>选择局域网地址</h2>
                <p>以下是示例地址，不会读取或更改本机网络。</p>
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
                <div className="address">{url}</div>
                <button
                  className="primary"
                  onClick={() => switchScreen('lobby')}
                >
                  查看大厅原型
                </button>
              </section>
              <section className="panel">
                <h2>连接前的小提醒</h2>
                <ol>
                  <li>手机连接电脑所在的 Wi-Fi。</li>
                  <li>选择手机可访问的电脑地址。</li>
                  <li>通过手机自带扫码工具打开系统浏览器。</li>
                </ol>
                <button
                  onClick={() => dispatch({ type: 'issue', issue: 'network' })}
                >
                  查看连接帮助
                </button>
                <p className="muted">
                  关闭公共屏：服务继续运行。退出整个程序：服务停止，手机失去连接。
                </p>
              </section>
            </div>
          </>
        )}
        {state.screen === 'lobby' && (
          <>
            <section className="hero">
              <p className="eyebrow">一起准备</p>
              <h1>
                {state.role === 'player'
                  ? '找到你的座位。'
                  : '朋友到齐，就可以开始。'}
              </h1>
              <p>《宝可梦奇遇：皮卡丘和朋友们》 · 对应版本规则待核验</p>
            </section>
            <div className="columns">
              <section className="panel">
                <div className="panel-heading">
                  <h2>桌边的朋友</h2>
                  <span>{state.seats.length} 位示例玩家</span>
                </div>
                <ul className="seat-list">
                  {state.seats.map((seat, index) => (
                    <li key={seat.id}>
                      <span className="seat-number">{index + 1}</span>
                      <span>
                        <strong>{seat.nickname}</strong>
                        <small>
                          座位身份 {seat.id}
                          {state.joinedSeat === seat.id ? ' · 本人' : ''}
                        </small>
                      </span>
                      <span className="seat-status">
                        {seat.ready ? '已准备' : '未准备'}
                      </span>
                      {state.role === 'host' && (
                        <button
                          aria-label={`上移座位 ${seat.id}`}
                          disabled={index === 0}
                          onClick={() =>
                            dispatch({ type: 'move-seat', id: seat.id })
                          }
                        >
                          上移
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  人数上下限与开局条件待核验；示例人数不代表游戏配置。
                </p>
                {state.role === 'host' && (
                  <div className="stack">
                    <button
                      onClick={() => dispatch({ type: 'toggle-joining' })}
                    >
                      {state.joiningOpen ? '关闭新玩家加入' : '重新开放加入'}
                    </button>
                    <button className="primary" disabled>
                      开局 · 规则待核验
                    </button>
                    <button onClick={() => switchScreen('session')}>
                      进入通用状态演示
                    </button>
                  </div>
                )}
                {state.role === 'player' &&
                  (joined ? (
                    <div className="stack">
                      <p>
                        你好，{joined.nickname}。你的座位是 {joined.id}。
                      </p>
                      <button
                        className="primary"
                        onClick={() => dispatch({ type: 'ready' })}
                      >
                        {joined.ready ? '取消准备' : '我已准备'}
                      </button>
                      <button onClick={() => switchScreen('session')}>
                        查看游玩状态原型
                      </button>
                    </div>
                  ) : (
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
                          已有同名玩家，加入后请用座位身份区分。
                        </p>
                      )}
                      <button
                        className="primary"
                        disabled={!nickname.trim() || !state.joiningOpen}
                      >
                        取得座位（模拟）
                      </button>
                    </form>
                  ))}
              </section>
              <section className="panel join-panel">
                <h2>加入这张桌子</h2>
                <div
                  className="qr-placeholder"
                  aria-label="二维码占位，不能扫码"
                >
                  扫码区域<small>占位图 · 无真实加入凭证</small>
                </div>
                <p className="address">{url}</p>
                <p>
                  {state.joiningOpen
                    ? '新玩家加入已开放（模拟）'
                    : '新玩家加入已关闭；已有身份仍可恢复。'}
                </p>
                <p className="muted">
                  二维码仅授予加入资格；正式公共屏不会展示房主凭证。
                </p>
                <button
                  onClick={() => dispatch({ type: 'issue', issue: 'network' })}
                >
                  无法连接？查看帮助
                </button>
                {state.role === 'host' && (
                  <p className="muted">
                    房主参与游戏时，在手机玩家入口使用自己的独立座位身份。
                  </p>
                )}
              </section>
            </div>
          </>
        )}
        {state.screen === 'session' && (
          <>
            <section className="hero">
              <p className="eyebrow">通用状态与反馈演示</p>
              <h1>
                {state.paused
                  ? '对局已暂停。'
                  : state.connection !== 'online'
                    ? '等待连接恢复。'
                    : '等待玩家作出选择。'}
              </h1>
              <p>
                {state.paused
                  ? '暂停期间不能提交推进游戏的操作。'
                  : '没有默认倒计时；掉线不会自动代操作。'}
              </p>
            </section>
            <div className="columns">
              <section className="panel gameplay">
                <h2>
                  {state.role === 'player' ? '我的操作区' : '公共游戏展示区'}
                </h2>
                <div className="layout-placeholder">
                  <span>游戏布局待规则核验</span>
                  <p>取得完整规则后补充卡位、牌面、阶段与合法动作。</p>
                </div>
                {state.role === 'player' && (
                  <>
                    <p className="muted">
                      此处只接收本人授权视图。具体可见字段与查看时机待核验。
                    </p>
                    <fieldset disabled={!canChoose}>
                      <legend>交互样例 · 不代表游戏动作</legend>
                      <div className="choices">
                        {['选项 A', '选项 B'].map((value) => (
                          <button
                            key={value}
                            className={
                              state.selected === value ? 'selected' : ''
                            }
                            aria-pressed={state.selected === value}
                            onClick={() => dispatch({ type: 'select', value })}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <button
                      className="primary"
                      disabled={!state.selected || !canChoose}
                      onClick={() => dispatch({ type: 'submit' })}
                    >
                      提交示例选择
                    </button>
                    <p className="submission" data-testid="submission">
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
                  </>
                )}
                {state.connection !== 'online' && (
                  <button
                    className="primary"
                    onClick={() => dispatch({ type: 'synchronize' })}
                  >
                    模拟重连并同步
                  </button>
                )}
              </section>
              <section className="panel">
                <h2>{state.role === 'host' ? '房主管理' : '桌面状态'}</h2>
                <p>当前状态：{state.paused ? '暂停' : '等待玩家'}</p>
                <p className="muted">
                  公开记录只含安全标签；完整恢复状态保留在服务端。
                </p>
                {state.role === 'host' ? (
                  <div className="stack">
                    <button onClick={() => dispatch({ type: 'pause' })}>
                      {state.paused ? '恢复对局' : '暂停对局'}
                    </button>
                    <button onClick={() => setDialog('rollback')}>
                      选择决策点回退
                    </button>
                    <button onClick={() => setDialog('rebind')}>
                      确认换手机绑定
                    </button>
                    <button className="danger" onClick={() => setDialog('end')}>
                      结束当前对局
                    </button>
                    <p className="muted">
                      管理权限不包含其他玩家秘密信息；没有任意改牌、改分入口。
                    </p>
                  </div>
                ) : (
                  <p>座位与对局保留，等待行动者继续。</p>
                )}
                {state.role === 'public' && (
                  <div className="sound-controls">
                    <h3>公共屏提示音</h3>
                    <button
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
                    </button>
                    <button disabled={!sound} onClick={previewSound}>
                      试听示例音
                    </button>
                    <p className="muted">
                      {soundNotice}。刷新、重连和回退不重播历史声音。
                    </p>
                  </div>
                )}
              </section>
            </div>
            <details className="simulation" open>
              <summary>走查工具 · 模拟反馈与异常</summary>
              <div className="simulation-buttons">
                <button
                  disabled={state.submission !== 'pending'}
                  onClick={() => dispatch({ type: 'reply', outcome: 'saved' })}
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
            </details>
          </>
        )}
        {state.screen === 'result' && (
          <section className="panel result">
            <p className="eyebrow">结束展示</p>
            <h1>这场相聚，告一段落。</h1>
            <p>此处是结束页面占位，不展示未经核验的分数或胜负。</p>
            <p className="muted">
              正常结算、房主主动结束与游戏终止需使用不同原因提示。真实计分、平局与整局条件取得原文后补齐。
            </p>
            <button className="primary" onClick={() => switchScreen('lobby')}>
              返回大厅原型
            </button>
          </section>
        )}
        {state.screen === 'recovery' && (
          <section className="panel recovery">
            <p className="eyebrow">重新回到桌边</p>
            <h1>发现未结束的对局。</h1>
            <p>对局示例 · 座位与待处理选择可恢复</p>
            <p className="muted">
              原浏览器身份仍有效时恢复原座位；地址变化时重新生成加入二维码。具体游戏状态与存档版本待后续实现。
            </p>
            {state.role === 'host' ? (
              <div className="stack">
                <button
                  className="primary"
                  onClick={() => dispatch({ type: 'restore' })}
                >
                  模拟恢复存档
                </button>
                <button
                  onClick={() =>
                    dispatch({ type: 'issue', issue: 'incompatible' })
                  }
                >
                  查看版本不兼容提示
                </button>
                <button
                  onClick={() => dispatch({ type: 'issue', issue: 'corrupt' })}
                >
                  查看损坏存档提示
                </button>
              </div>
            ) : (
              <p>等待房主恢复。玩家身份与房主授权分开保存。</p>
            )}
            <p className="muted">
              存档位置：正式管理界面显示系统解析后的本地数据目录。
            </p>
          </section>
        )}
        {state.screen === 'error' && (
          <section className="panel error-panel">
            <p className="eyebrow">帮助与反馈</p>
            <h1>{issues[state.issue].title}</h1>
            <p>{issues[state.issue].detail}</p>
            <p>{issues[state.issue].steps}</p>
            <button
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
            </button>
            <details className="simulation" open>
              <summary>走查工具 · 异常类型</summary>
              <label>
                异常类型
                <select
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
            </details>
          </section>
        )}
        <footer>
          第二阶段设计验证 · 所有操作仅更改本页模拟状态 · 刷新会重置
        </footer>
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
