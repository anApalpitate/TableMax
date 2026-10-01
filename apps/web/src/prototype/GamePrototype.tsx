import { useRef, useState } from 'react';
import { avatarFor } from './art';
import { scenes, sceneBoards, type Tile, type GameRole } from './game-scenes';
import './game.css';

type Feedback = 'idle' | 'pending' | 'saved' | 'rejected' | 'uncertain';
export function GamePrototype() {
  const [role, setRole] = useState<GameRole>('host');
  const [seat, setSeat] = useState('S1');
  const [sceneId, setSceneId] = useState('initial');
  const [index, setIndex] = useState(0);
  const [selection, setSelection] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>('idle');
  const [paused, setPaused] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(1);
  const [branch, setBranch] = useState(1);
  const [source, setSource] = useState('deck');
  const [boards, setBoards] = useState<Record<string, Tile[]>>(
    sceneBoards('initial'),
  );
  const [animation, setAnimation] = useState(0);
  const [history, setHistory] = useState<
    {
      sceneId: string;
      index: number;
      boards: Record<string, Tile[]>;
      source: string;
      label: string;
    }[]
  >([]);
  const [target, setTarget] = useState('0');
  const [dialog, setDialog] = useState<'rollback' | 'rebind' | null>(null);
  const [binding, setBinding] = useState(1);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scene = scenes.find((item) => item.id === sceneId)!;
  const current = scene.steps[index];
  const done = !current;
  const publicHand =
    current?.id === 'replace' && source === 'discard'
      ? '普通牌 0'
      : current?.hand;
  const canAct =
    role === 'player' &&
    current?.actor === seat &&
    current.target !== 'auto' &&
    !paused &&
    !offline &&
    !['pending', 'uncertain'].includes(feedback);
  const peekVisible =
    current?.id === 'peek-view' &&
    role === 'player' &&
    seat === 'S1' &&
    !offline;

  function clear(message = '') {
    setSelection([]);
    setFeedback('idle');
    setAnimation(0);
    setNotice(message);
  }
  function load(id: string) {
    setSceneId(id);
    setIndex(0);
    setHistory([]);
    setSource('deck');
    setBoards(sceneBoards(id));
    clear();
  }
  function choose(value: string) {
    if (!canAct) return;
    setFeedback('idle');
    setNotice('');
    if (value === 'decline') {
      setSelection(['decline']);
      return;
    }
    setSelection((old) =>
      current?.id === 'swap'
        ? old.includes(value)
          ? old.filter((item) => item !== value)
          : [...old.filter((item) => item !== 'decline').slice(-1), value]
        : [value],
    );
  }
  function submit() {
    if (
      !canAct ||
      !selection.length ||
      (current?.id === 'swap' &&
        selection[0] !== 'decline' &&
        selection.length !== 2)
    )
      return;
    setFeedback('pending');
    setNotice('正在提交，等待保存确认。');
  }
  function confirm() {
    if (
      !current ||
      (feedback !== 'pending' && current.target !== 'auto') ||
      paused ||
      offline
    )
      return;
    setHistory((old) => [
      ...old,
      {
        sceneId,
        index,
        boards,
        source,
        label: `${current.actor} · ${current.title}之前`,
      },
    ]);
    let nextBoards = boards;
    const picked = selection[0];
    if (current.id === 'source') setSource(picked ?? 'deck');
    if (current.id === 'initial-wait') {
      nextBoards = {
        ...boards,
        S2: boards.S2!.map((tile, i) =>
          i === 0 ? { faceUp: true, name: '普通牌', value: '1' } : tile,
        ),
        S3: boards.S3!.map((tile, i) =>
          i === 0 ? { faceUp: true, name: '普通牌', value: '1' } : tile,
        ),
      };
    } else if (current.id.startsWith('refill-')) {
      const owner = current.id.split('-')[1]!.toUpperCase();
      nextBoards = {
        ...boards,
        [owner]: boards[owner]!.map((tile) =>
          !tile.faceUp && tile.empty
            ? {
                faceUp: true,
                name: owner === 'S2' ? '卡比兽' : '普通牌',
                value: owner === 'S2' ? '10' : '3',
              }
            : tile,
        ),
      };
    } else if (current.id === 'rocket-p' && picked) {
      const slot = Number(picked.split(':')[1]);
      nextBoards = Object.fromEntries(
        Object.entries(boards).map(([owner, tiles]) => [
          owner,
          tiles.map((tile, i) =>
            i === slot ? { faceUp: false, empty: true } : tile,
          ),
        ]),
      );
    } else if (
      current.id === 'swap' &&
      picked !== 'decline' &&
      selection.length === 2
    ) {
      const board = [...boards.S1!];
      const a = Number(picked?.split(':')[1]);
      const b = Number(selection[1]?.split(':')[1]);
      [board[a], board[b]] = [board[b]!, board[a]!];
      nextBoards = { ...boards, S1: board };
    } else if (picked?.includes(':') && !current.id.startsWith('peek')) {
      const [owner, slotText] = picked.split(':');
      const slot = Number(slotText);
      const board = [...boards[owner!]!];
      board[slot] = {
        faceUp: true,
        name: publicHand?.split(' ')[0] ?? '普通牌',
        value: publicHand?.split(' ').at(-1) ?? '3',
      };
      nextBoards = { ...boards, [owner!]: board };
    }
    setBoards(nextBoards);
    setRevision((old) => old + 1);
    setAnimation((old) => old + 1);
    setSelection([]);
    setFeedback('saved');
    setNotice('已保存并确认（合成演示）。');
    setIndex((old) =>
      picked === 'decline' && sceneId === 'charizard'
        ? scene.steps.length
        : old + 1,
    );
  }
  function rollback() {
    const saved = history[Number(target)];
    if (!saved) return;
    setSceneId(saved.sceneId);
    setIndex(saved.index);
    setBoards(saved.boards);
    setSource(saved.source);
    setHistory((old) => old.slice(0, Number(target)));
    setBranch((old) => old + 1);
    setRevision((old) => old + 1);
    clear('已恢复所选决策之前；已有信息可能已被看见，旧选择与动画清除。');
    closeDialog();
  }
  function closeDialog() {
    dialogRef.current?.close();
    setDialog(null);
  }
  function openDialog(kind: 'rollback' | 'rebind') {
    setDialog(kind);
    dialogRef.current?.showModal();
  }
  function renderBoard(owner: string) {
    const tiles = boards[owner]!;
    const selectable =
      canAct &&
      (current?.target === 'other' ? owner !== 'S1' : owner === seat) &&
      ['self', 'other', 'ability', 'peek'].includes(current?.target ?? '') &&
      current?.id !== 'peek-view';
    return (
      <section className="game-board" key={owner} data-seat={owner}>
        <h2>
          <img src={avatarFor(owner)} alt="" />
          {owner === seat && role === 'player' ? '我的场地' : owner}{' '}
          <small>{owner === 'S3' ? '电脑' : '真人'}</small>
        </h2>
        <div className="game-grid">
          {tiles.map((tile, slot) => {
            const value = `${owner}:${slot}`;
            const allowed =
              selectable &&
              !(current?.id === 'peek-select' && tile.faceUp) &&
              (tile.faceUp || !tile.empty);
            return (
              <button
                className={`game-card ${tile.faceUp ? 'face-up' : 'card-back'} ${selection.includes(value) ? 'chosen' : ''}`}
                key={slot}
                disabled={!allowed}
                aria-label={`${owner} 第${slot + 1}格${tile.faceUp ? ` ${tile.name} ${tile.value}` : ' 暗牌'}`}
                aria-pressed={selection.includes(value)}
                onClick={() => choose(value)}
              >
                {tile.faceUp ? (
                  <>
                    <b>{tile.value}</b>
                    <span>{tile.name}</span>
                  </>
                ) : (
                  <>
                    <b>{tile.empty ? '—' : '✦'}</b>
                    <span>{tile.empty ? '待补位' : '暗牌'}</span>
                  </>
                )}
                <small>{slot + 1}</small>
              </button>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <main className={`game-demo game-role-${role}`}>
      <header className="game-top">
        <div>
          <span className="game-badge">TableMax · 原型演示</span>
          <h1>宝可梦奇遇</h1>
        </div>
        <a href="./prototype.html">启动与大厅</a>
      </header>
      <details className="game-review">
        <summary>游戏审阅工具</summary>
        <label>
          角色
          <select
            aria-label="角色"
            value={role}
            onChange={(e) => {
              setRole(e.target.value as GameRole);
              clear();
            }}
          >
            <option value="host">公共大屏兼房主管理</option>
            <option value="player">本人手机</option>
          </select>
        </label>
        <label>
          本人座位
          <select
            aria-label="本人座位"
            value={seat}
            onChange={(e) => {
              setSeat(e.target.value);
              clear();
            }}
          >
            {['S1', 'S2', 'S3'].map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          游戏场景
          <select
            aria-label="游戏场景"
            value={sceneId}
            onChange={(e) => load(e.target.value)}
          >
            {scenes.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={feedback !== 'pending'} onClick={confirm}>
          模拟保存确认
        </button>
        <button
          disabled={feedback !== 'pending'}
          onClick={() => {
            setFeedback('rejected');
            setAnimation(0);
            setNotice('操作被拒绝，请按当前状态重新选择。');
          }}
        >
          模拟拒绝
        </button>
        <button
          disabled={feedback !== 'pending'}
          onClick={() => {
            setFeedback('uncertain');
            setNotice('确认未收到，结果未知，需要同步。');
          }}
        >
          模拟确认丢失
        </button>
        <button
          onClick={() => {
            setOffline(!offline);
            clear(
              offline
                ? '正在重连，请同步最新授权视图。'
                : '连接中断，真人座位保留，不代操作。',
            );
          }}
        >
          模拟断线／重连
        </button>
        <button
          onClick={() => {
            setOffline(false);
            clear('已同步最新授权视图，旧选择已清空；不重播历史。');
          }}
        >
          模拟完整同步
        </button>
        <button
          onClick={() => {
            setOffline(true);
            clear('示例记录已读取，等待重连；恢复当前能力，不提前结算。');
          }}
        >
          模拟重启恢复
        </button>
        <button
          disabled={current?.target !== 'auto' || paused || offline}
          onClick={confirm}
        >
          推进自动步骤
        </button>
        <button onClick={() => clear('旧分支动作已失效；未推进当前选择。')}>
          模拟旧动作
        </button>
        <button
          disabled={
            current?.actor !== 'S3' ||
            current.target === 'auto' ||
            paused ||
            offline
          }
          onClick={() => {
            const slot = boards.S3!.findIndex((tile) => !tile.faceUp);
            setSelection([`S3:${slot < 0 ? 0 : slot}`]);
            setFeedback('pending');
            setNotice('电脑已返回合法意图，等待保存确认（模拟）。');
          }}
        >
          模拟电脑选择
        </button>
        <p>
          只演示投影和交互，没有规则完整秘密状态、真实授权或存档。S3
          的电脑响应在此由保存反馈演示，正式策略由服务端调度。
        </p>
      </details>
      <section className="game-status" aria-live="polite">
        <strong>
          {paused
            ? '房主已暂停'
            : offline
              ? '等待重连／同步'
              : done
                ? '操作完成 · 结算示例'
                : current.title}
        </strong>
        <span>
          正常回合 S1 · 当前选择 {current?.actor ?? '无'} · 分支 {branch} · 修订{' '}
          {revision}
        </span>
      </section>
      {notice && (
        <p className="game-notice" role="status">
          {notice}
        </p>
      )}
      {!done && (
        <section className="game-action">
          <p>{current.hint}</p>
          {publicHand && <div className="game-hand">{publicHand}</div>}
          {peekVisible && (
            <div className="game-peek" data-testid="peek-value">
              临时查看：普通牌 4
              <button onClick={() => choose('close')} disabled={!canAct}>
                确认查看结束
              </button>
            </div>
          )}
          {current.target === 'source' &&
            role === 'player' &&
            seat === current.actor && (
              <div className="game-choices">
                <button
                  disabled={!canAct}
                  aria-pressed={selection.includes('deck')}
                  onClick={() => choose('deck')}
                >
                  牌库顶 · 26 张
                </button>
                <button
                  disabled={!canAct || sceneId === 'initial'}
                  aria-pressed={selection.includes('discard')}
                  onClick={() => choose('discard')}
                >
                  {sceneId === 'initial' ? '弃牌为空' : '弃牌顶 · 普通牌 0'}
                </button>
              </div>
            )}
          {canAct &&
            (current.target === 'ability' || current.id === 'peek-select') && (
              <button onClick={() => choose('decline')}>不发动能力</button>
            )}
          {canAct && current.id === 'replace' && source === 'deck' && (
            <button onClick={() => choose('discard-drawn')}>直接弃掉</button>
          )}
          {role === 'player' && (
            <div className="game-submit">
              <span>
                {!canAct
                  ? '等待当前行动者或同步'
                  : selection.length
                    ? `已选择 ${selection.length} 项`
                    : '先选择，再提交'}
              </span>
              <button
                onClick={submit}
                disabled={
                  !canAct ||
                  !selection.length ||
                  (current.id === 'swap' &&
                    selection[0] !== 'decline' &&
                    selection.length !== 2)
                }
              >
                {' '}
                {feedback === 'pending' ? '提交中…' : '提交选择'}
              </button>
            </div>
          )}
        </section>
      )}
      {!done && (
        <div
          className="game-tables"
          key={`${branch}-${sceneId}-${index}-${animation}`}
          data-animation={animation ? 'saved' : 'none'}
        >
          {role === 'host' ? (
            ['S1', 'S2', 'S3'].map(renderBoard)
          ) : (
            <>
              {renderBoard(seat)}
              <details className="game-public">
                <summary>其他玩家公共场地</summary>
                {['S1', 'S2', 'S3']
                  .filter((id) => id !== seat)
                  .map(renderBoard)}
              </details>
            </>
          )}
        </div>
      )}
      {done && (
        <section className="game-result">
          <h2>小局结算示例</h2>
          <p>独立公开结果示例，用于核对计分呈现；不是以上选择的规则计算。</p>
          <div className="game-result-cards">
            上排：1、百变怪→5、5
            <br />
            下排：0、5、9
          </div>
          <p>各列：1 ／ 0（配对）／ 14 · 总分 15</p>
          <table>
            <thead>
              <tr>
                <th>玩家</th>
                <th>分数</th>
                <th>胜局</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>S1</td>
                <td>15</td>
                <td>3</td>
                <td>共同赢家</td>
              </tr>
              <tr>
                <td>S2</td>
                <td>15</td>
                <td>3</td>
                <td>共同赢家</td>
              </tr>
              <tr>
                <td>S3 电脑</td>
                <td>19</td>
                <td>0</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
          <p>同时达三胜，共同赢得大局。</p>
          {role === 'host' && (
            <button onClick={() => load('initial')}>开始新大局</button>
          )}
        </section>
      )}
      <details className="game-help">
        <summary>本地规则帮助</summary>
        <p>
          每人六张，一明五暗；从牌库顶或弃牌顶摸牌，弃牌取牌必须替换。新牌朝上，普通换出置顶，火箭队和闪电鸟按能力弃底。当前能力完整完成后才检查结束。相同列有效值相等计零；百变怪联合求全场最低分。最低分同分共同赢家，先赢三小局。
        </p>
        <p>
          当前采用
          tablemax-cn-s19-v1；出版原文未认证，用户确认与项目方案分别记录。
        </p>
      </details>
      {role === 'host' && (
        <details className="game-management">
          <summary>房主管理</summary>
          <button
            onClick={() => {
              setPaused(!paused);
              clear(
                paused ? '已恢复，按当前阶段操作。' : '已暂停，不能推进选择。',
              );
            }}
          >
            {paused ? '恢复游戏' : '暂停游戏'}
          </button>
          <label>
            恢复到决策之前
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {history.map((item, i) => (
                <option value={i} key={i}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!history.length}
            onClick={() => openDialog('rollback')}
          >
            恢复所选决策
          </button>
          <button onClick={() => openDialog('rebind')}>确认换手机绑定</button>
          <span>绑定代数 {binding}</span>
          <details>
            <summary>查看全部弃牌（公开示例）</summary>
            <p>底→顶：普通牌 9、普通牌 4、普通牌 0</p>
          </details>
          <p>调试修改留后续专项；普通管理不增加暗牌权限。</p>
        </details>
      )}
      <dialog ref={dialogRef} onCancel={() => setDialog(null)}>
        <h2>
          {dialog === 'rollback' ? '恢复所选决策之前' : '确认座位 S1 换手机'}
        </h2>
        <p>
          {dialog === 'rollback'
            ? '已有信息可能已被看见；新分支会清除旧选择与动画。'
            : '保留座位及游戏数据，新绑定生效后原凭证失效。'}
        </p>
        <button onClick={closeDialog}>取消</button>
        <button
          onClick={
            dialog === 'rollback'
              ? rollback
              : () => {
                  setBinding((old) => old + 1);
                  clear('新绑定生效，原凭证失效（模拟）。');
                  closeDialog();
                }
          }
        >
          确认
        </button>
      </dialog>
    </main>
  );
}
