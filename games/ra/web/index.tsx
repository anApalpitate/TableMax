/* eslint-disable react-refresh/only-export-components -- Lazy adapter exports a GameClient. */
import { useState } from 'react';
import {
  RoomManagement,
  ScreenLink,
  SessionFeedback,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { Action, RaView } from '../rules';
import { tileNames, type Tile } from '../rules/data';
import { SunDisk, TableArt, TileFace } from './art';
import './ra.css';

const causes = {
  drawRa: '抽到拉',
  invokeFull: '满行呼唤拉',
  invokeOpen: '呼唤拉',
};
const parts = {
  pharaoh: '法老',
  god: '神明',
  gold: '黄金',
  river: '河流',
  civilization: '文明',
  monument: '纪念物',
  disks: '圆盘',
};
const simple = {
  draw: '抽板块',
  invokeRa: '呼唤拉',
  pass: '跳过',
  finishGod: '结束神明行动',
};
const actionArt = { draw: 'tile-bag', invokeRa: 'ra-statue' } as const;

function tileGroups(held: Tile[]) {
  const groups = new Map<string, { tile: Tile; count: number }>();
  for (const tile of held) {
    const group = groups.get(tile.face);
    if (group) group.count++;
    else groups.set(tile.face, { tile, count: 1 });
  }
  return [...groups.values()];
}

function Controls({ session, game }: { session: GameHost; game: RaView }) {
  const [pending, setPending] = useState<Action>();
  const [selection, setSelection] = useState<string[]>([]);
  const actions = (session.view?.actions ?? []) as Action[];
  const send = (action: Action) => {
    const decisionId = session.view?.decisionId;
    if (decisionId && !session.locked)
      session.command({ type: 'game', decisionId, action });
  };
  const slotActions = actions.filter((action) => action.type === 'spendGod');
  const discards = actions.filter((action) => action.type === 'discard');
  const held =
    game.players.find((p) => p.seat === session.self?.id)?.held ?? [];
  const label = (id: string) =>
    tileNames[held.find((tile) => tile.id === id)?.face ?? ''] ?? id;
  const discardChoice = discards.find(
    (action) =>
      selection.length === action.tileIds.length &&
      action.tileIds.every((id) => selection.includes(id)),
  );
  const selected = discardChoice ?? pending;

  return (
    <section aria-label="本席操作" className="ra-actions">
      {game.phase === 'auction' && !actions.some((a) => a.type === 'pass') && (
        <strong>必须出价</strong>
      )}
      {actions.map((action) => {
        if (action.type === 'discard' || action.type === 'spendGod')
          return null;
        return (
          <button
            type="button"
            key={JSON.stringify(action)}
            disabled={session.locked}
            className={
              action.type === 'bid'
                ? 'ra-bid'
                : action.type === 'draw' || action.type === 'invokeRa'
                  ? 'ra-component-action'
                  : undefined
            }
            aria-label={
              action.type === 'bid' ? `出价 ${action.disk}` : undefined
            }
            onClick={() => send(action)}
          >
            {action.type === 'bid' ? (
              <SunDisk value={action.disk} />
            ) : (
              <>
                {(action.type === 'draw' || action.type === 'invokeRa') && (
                  <TableArt
                    piece={actionArt[action.type]}
                    className="ra-action-art"
                  />
                )}
                {simple[action.type]}
              </>
            )}
          </button>
        );
      })}
      {slotActions.length > 0 && (
        <fieldset>
          <legend>神明换取</legend>
          <div className="ra-options">
            {slotActions
              .filter(
                (action, index) =>
                  slotActions.findIndex(
                    (other) => other.slot === action.slot,
                  ) === index,
              )
              .map((action) => (
                <button
                  type="button"
                  key={action.slot}
                  className="ra-choice"
                  aria-label={`换取第 ${action.slot + 1} 格 ${tileNames[game.lot[action.slot]!.face]}`}
                  aria-pressed={
                    pending?.type === 'spendGod' && pending.slot === action.slot
                  }
                  disabled={session.locked}
                  onClick={() => setPending(action)}
                >
                  <TileFace tile={game.lot[action.slot]!} decorative />
                </button>
              ))}
          </div>
        </fieldset>
      )}
      {discards.length > 0 && (
        <fieldset>
          <legend>弃置 {selection.length}／2</legend>
          <div className="ra-options">
            {held
              .filter((tile) =>
                discards.some((action) => action.tileIds.includes(tile.id)),
              )
              .map((tile) => {
                const pressed = selection.includes(tile.id);
                const allowed =
                  !pressed &&
                  discards.some(
                    (action) =>
                      action.tileIds.includes(tile.id) &&
                      selection.every((id) => action.tileIds.includes(id)),
                  );
                return (
                  <button
                    type="button"
                    className="ra-choice"
                    key={tile.id}
                    aria-label={`选择${label(tile.id)}`}
                    aria-pressed={pressed}
                    disabled={session.locked || (!pressed && !allowed)}
                    onClick={() =>
                      setSelection(
                        pressed
                          ? selection.filter((id) => id !== tile.id)
                          : [...selection, tile.id],
                      )
                    }
                  >
                    <TileFace tile={tile} decorative />
                  </button>
                );
              })}
          </div>
          {selection.length > 0 && (
            <button
              type="button"
              disabled={session.locked}
              onClick={() => setSelection([])}
            >
              取消选择
            </button>
          )}
        </fieldset>
      )}
      {selected && (
        <button
          type="button"
          className="ra-confirm"
          aria-label={
            selected.type === 'spendGod'
              ? `确认换取第 ${selected.slot + 1} 格 ${tileNames[game.lot[selected.slot]!.face]}`
              : selected.type === 'discard'
                ? `确认弃置${selected.tileIds.map(label).join('、')}`
                : '确认'
          }
          disabled={session.locked}
          onClick={() => {
            send(selected);
          }}
        >
          {selected.type === 'spendGod'
            ? '确认换取'
            : selected.type === 'discard'
              ? '确认弃置'
              : '确认'}
        </button>
      )}
    </section>
  );
}

function RaScreen({ session }: { session: GameHost }) {
  const game = session.view?.gameView as RaView | null;
  const name = (id: string) =>
    session.view?.seats.find((seat) => seat.id === id)?.name ?? id;
  return (
    <main className="ra-table shell" data-role={session.role}>
      <header className="ra-header">
        <ScreenLink className="button secondary" href={`/${session.role}`}>
          返回盒子
        </ScreenLink>
        <h1>
          <SunDisk />
          太阳神
        </h1>
        <details className="ra-help">
          <summary>规则</summary>
          <div>
            <TableArt piece="rulebook-illustration" className="ra-rules-art" />
            <p>
              轮到你时，抽一枚板块、呼唤拉，或使用神明取走拍卖行的一枚非神明板块。
            </p>
            <p>
              从呼唤者下一席顺时针依次出价。最高出价者赢整行，并用出价盘换中央盘。换回的盘本时代停用。
            </p>
            <p>
              主动呼唤且拍卖行未满时，其他人都跳过则呼唤者必须出价。拉轨到终点或所有圆盘用尽即结算。
            </p>
            <p>
              法老、尼罗河和纪念物跨时代保留。纪念物与圆盘只在第三时代结算。
            </p>
          </div>
        </details>
      </header>
      <SessionFeedback session={session} />
      {game && (
        <>
          <section className="ra-board" aria-label="公共牌桌">
            <div className="ra-status">
              <h2>
                {game.epoch < 3 && (
                  <TableArt
                    piece={game.epoch === 1 ? 'epoch-first' : 'epoch-second'}
                    className="ra-epoch-art"
                  />
                )}
                第 {game.epoch} 时代
              </h2>
              <strong>
                {game.winner
                  ? `${name(game.winner)}获胜`
                  : game.actor
                    ? `${name(game.actor)}行动`
                    : '对局结束'}
              </strong>
              <span>
                <span className="ra-center-label">中央盘</span>{' '}
                <SunDisk value={game.center} />
              </span>
            </div>
            <div className="ra-track">
              <span>
                拉轨 {game.raDrawn}／{game.limit}
              </span>
              <div
                className="ra-track-slots"
                role="progressbar"
                aria-label="拉轨"
                aria-valuenow={game.raDrawn}
                aria-valuemin={0}
                aria-valuemax={game.limit}
              >
                {Array.from({ length: game.limit }, (_, index) => (
                  <span key={index} data-filled={index < game.raDrawn}>
                    {index + 1 === game.raDrawn && (
                      <TableArt piece="sun-boat" className="ra-track-boat" />
                    )}
                  </span>
                ))}
              </div>
            </div>
            <ol className="ra-lot" aria-label="拍卖行">
              {game.lot.map((tile, index) => (
                <li
                  key={index}
                  data-occupied={tile !== null}
                  aria-label={`第 ${index + 1} 格 ${tile ? tileNames[tile.face] : '空'}`}
                >
                  {tile && <TileFace tile={tile} decorative />}
                </li>
              ))}
            </ol>
            <TableArt piece="auction-board" className="ra-board-ornament" />
            {game.auction && (
              <div className="ra-result">
                <strong>
                  <TableArt piece="ra-statue" className="ra-auction-statue" />
                  {name(game.auction.caller)} · {causes[game.auction.cause]}
                </strong>
                <span>
                  最高出价{' '}
                  {game.auction.bids.filter((bid) => bid.disk !== null).at(-1)
                    ?.disk ?? '—'}
                </span>
                {game.auction.bids.map((bid) => (
                  <span key={bid.seat}>
                    {name(bid.seat)} {bid.disk ?? '跳过'}
                  </span>
                ))}
              </div>
            )}
            {game.pending && (
              <strong className="ra-pending" role="status">
                <TileFace tile={game.pending.tile} />
                {name(game.pending.owner)}处理灾难
              </strong>
            )}
            {game.phase === 'ended' && game.lot.some(Boolean) && (
              <p>拍卖行剩余板块未获，不计分。</p>
            )}
          </section>
          {session.view?.decisionId &&
            (session.view.actions?.length ?? 0) > 0 && (
              <Controls
                key={`${session.view.branch}-${session.view.decisionId}`}
                session={session}
                game={game}
              />
            )}
          {game.phase === 'ended' ? (
            <FinalScores game={game} name={name} />
          ) : (
            game.epoch > 1 && (
              <p className="ra-epoch" role="status">
                第 {game.epoch - 1} 时代已结算，个人圆盘已重新启用
              </p>
            )
          )}
          <section className="ra-seats" aria-label="玩家所持板块">
            {game.players.map((player) => (
              <article
                key={player.seat}
                className="ra-seat"
                data-active={player.seat === game.actor}
              >
                <TableArt piece="player-board" className="ra-player-ornament" />
                <h2>
                  {name(player.seat)}{' '}
                  {player.private && <small>{player.private.score} 分</small>}
                </h2>
                <div className="ra-disks" aria-label="太阳圆盘">
                  {player.disks.map((disk) => (
                    <SunDisk value={disk} key={disk} />
                  ))}
                  {player.spent > 0 && (
                    <span>
                      已用{' '}
                      {player.private
                        ? player.private.spentDisks.join('、')
                        : `${player.spent} 枚`}
                    </span>
                  )}
                </div>
                <div className="ra-holdings">
                  {tileGroups(player.held).map(({ tile, count }) => (
                    <span key={tile.face}>
                      <TileFace tile={tile} />
                      {count > 1 && <b>×{count}</b>}
                    </span>
                  ))}
                  {player.held.length === 0 && <span>暂无板块</span>}
                </div>
                {player.private && player.private.scores.length > 0 && (
                  <details>
                    <summary>
                      {game.phase === 'ended' ? '时代计分' : '我的时代计分'}
                    </summary>
                    {player.private.scores.map((score) => (
                      <section key={score.epoch}>
                        <strong>
                          第 {score.epoch} 时代 · 累计 {score.total} 分
                        </strong>
                        <p>
                          本次变动 {score.delta > 0 ? '+' : ''}
                          {score.delta} 分
                        </p>
                        {score.total === 0 &&
                          Object.values(score.parts).reduce(
                            (sum, value) => sum + value,
                            0,
                          ) < score.delta && <p>累计分按 0 分下限记录。</p>}
                        <ul>
                          {Object.entries(score.parts).map(([part, value]) => (
                            <li key={part}>
                              {parts[part as keyof typeof parts]} {value}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </details>
                )}
              </article>
            ))}
          </section>
          {game.lastAuction && (
            <details className="ra-record">
              <summary>上一场拍卖</summary>
              <p>
                {game.lastAuction.winner
                  ? `${name(game.lastAuction.winner)}赢标，换得圆盘 ${game.lastAuction.received}`
                  : '无人赢标'}
              </p>
              <ul>
                {game.lastAuction.bids.map((bid) => (
                  <li key={bid.seat}>
                    {name(bid.seat)} {bid.disk ?? '跳过'}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {session.canControl && (
        <details className="ra-management">
          <summary>桌面管理</summary>
          <RoomManagement session={session} />
        </details>
      )}
    </main>
  );
}

function FinalScores({
  game,
  name,
}: {
  game: RaView;
  name: (seat: string) => string;
}) {
  const ranked = game.players
    .flatMap((player) =>
      player.private
        ? [
            {
              seat: player.seat,
              total: player.private.score,
              highest: Math.max(...player.disks, ...player.private.spentDisks),
            },
          ]
        : [],
    )
    .sort((a, b) => b.total - a.total || b.highest - a.highest);
  const top = ranked[0],
    next = ranked[1];
  return (
    <section className="ra-final" aria-label="终局排名">
      <h2>终局排名</h2>
      {top && top.total === next?.total && (
        <p>
          {name(top.seat)}与{name(next.seat)}同为 {top.total} 分，以最高圆盘{' '}
          {top.highest} 对 {next.highest} 决胜。
        </p>
      )}
      <ol>
        {ranked.map((player) => (
          <li key={player.seat}>
            <span>{name(player.seat)}</span>
            <b>{player.total} 分</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

export const client: GameClient = {
  Screen: RaScreen,
  savedChanges: () => [],
  motionDuration: 0,
};
