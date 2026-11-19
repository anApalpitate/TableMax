import { useEffect, useRef, useState } from 'react';
import type { GameHost } from '@tablemax/web-host';
import type { Action, RaView } from '../rules';
import { tile, tileNames } from '../rules/data';
import { SunDisk, TableArt, TileFace } from './art';
import './decision-controls.css';

export type Exchange = Extract<Action, { type: 'spendGod' }>;
type Discard = Extract<Action, { type: 'discard' }>;
type Player = RaView['players'][number];
type Send = (action: Action) => void;

const disasterTargets: Record<string, string> = {
  earthquake: '纪念物',
  war: '文明',
  funeral: '法老',
  drought: '河流',
};

type Receipt = Extract<
  RaView['scenes'][number],
  { kind: 'won' | 'god' | 'disaster' }
>;

function DecisionReceipt({
  game,
  scenes,
}: {
  game: RaView;
  scenes: Receipt[];
}) {
  return (
    <div role="status">
      {scenes.map((scene) => {
        if (scene.kind === 'won') {
          const paid = game.lastAuction?.bids.find(
            (bid) => bid.seat === scene.seat,
          )?.disk;
          return (
            <div
              className="ra-decision-receipt ra-won-receipt"
              key={`won-${scene.disk}`}
            >
              <strong>赢标</strong>
              {paid != null && (
                <div>
                  付出 <b>{paid}</b>
                </div>
              )}
              <div>
                换回 <b>{scene.disk}</b>
                <span className="ra-disk-status">本时代停用</span>
              </div>
            </div>
          );
        }
        const name = tileNames[tile(scene.id).face];
        return (
          <div
            className="ra-decision-receipt"
            key={`${scene.kind}-${scene.id}`}
          >
            {scene.kind === 'god' ? (
              <strong>已换取{name}</strong>
            ) : (
              <>
                <strong>{name}已处理</strong>
                <span>
                  {scene.discarded.length
                    ? `弃置${scene.discarded.map((id) => tileNames[tile(id).face]).join('、')}`
                    : '无石板可弃'}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AuctionControls({
  game,
  player,
  actions,
  locked,
  send,
}: {
  game: RaView;
  player: Player;
  actions: Action[];
  locked: boolean;
  send: Send;
}) {
  const highest = game.auction?.bids
    .filter(({ disk }) => disk !== null)
    .at(-1)?.disk;
  const canPass = actions.some(({ type }) => type === 'pass');
  const forced = !canPass && game.auction?.cause === 'invokeOpen';
  const bids = actions.filter((action) => action.type === 'bid');
  return (
    <>
      <h2>{forced ? '你必须出价' : '轮到你出价'}</h2>
      <dl className="ra-bid-facts">
        <div>
          <dt>当前最高</dt>
          <dd>{highest ?? '无人出价'}</dd>
        </div>
        <div>
          <dt>赢标换回</dt>
          <dd>
            <strong>{game.center}</strong>
            <span className="ra-disk-status">本时代停用</span>
          </dd>
        </div>
      </dl>
      {forced && (
        <p className="ra-decision-note">
          <span>你主动开拍且拍卖行未满。</span>
          <span>其他席均已跳过。</span>
        </p>
      )}
      {highest != null && (
        <p className="ra-decision-note">须高于 {highest}。</p>
      )}
      <div className="ra-bid-options">
        {player.disks.map((disk) => {
          const bid = bids.find((action) => action.disk === disk);
          return (
            <button
              type="button"
              className="ra-bid"
              key={disk}
              disabled={locked || !bid}
              aria-label={`出价 ${disk}${!bid && highest != null ? `，须高于 ${highest}` : ''}`}
              onClick={() => bid && send(bid)}
            >
              <SunDisk value={disk} />
              {!bid && <span className="ra-bid-limit">过低</span>}
            </button>
          );
        })}
        {canPass && (
          <button
            type="button"
            disabled={locked}
            onClick={() => send({ type: 'pass' })}
          >
            跳过
          </button>
        )}
      </div>
    </>
  );
}

function DisasterControls({
  game,
  player,
  options,
  locked,
  send,
}: {
  game: RaView;
  player: Player;
  options: Discard[];
  locked: boolean;
  send: Send;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  if (!game.pending || !options.length) return null;
  const danger = game.pending.tile;
  const progress = game.disasterDecision;
  const max = options[0]!.tileIds.length;
  const chosen = options.find(
    ({ tileIds }) =>
      selection.length === tileIds.length &&
      tileIds.every((id) => selection.includes(id)),
  );
  const candidates = player.held.filter(({ id }) =>
    options.some(({ tileIds }) => tileIds.includes(id)),
  );
  return (
    <>
      <div className="ra-disaster-heading">
        <h2 className="ra-decision-warning">{tileNames[danger.face]}</h2>
        {progress?.step !== undefined &&
          progress.total !== undefined &&
          progress.total > 1 && (
            <span className="ra-disaster-progress">
              处理进度 {progress.step}／{progress.total}
            </span>
          )}
      </div>
      <fieldset>
        <legend>
          <span>弃置{disasterTargets[danger.face]}</span>{' '}
          <strong>
            {selection.length}／{max}
          </strong>
          {progress?.next && (
            <span>下一场：{tileNames[progress.next.face]}</span>
          )}
        </legend>
        <div className="ra-discard-options">
          {candidates.map((card) => {
            const pressed = selection.includes(card.id);
            const allowed = options.some(
              ({ tileIds }) =>
                tileIds.includes(card.id) &&
                selection.every((id) => tileIds.includes(id)),
            );
            const fresh = progress?.received.includes(card.id);
            return (
              <button
                type="button"
                className="ra-choice"
                key={card.id}
                aria-label={`选择${tileNames[card.face]}${fresh ? '，刚拍得' : ''}`}
                aria-pressed={pressed}
                disabled={locked || (!pressed && !allowed)}
                onClick={() =>
                  setSelection(
                    pressed
                      ? selection.filter((id) => id !== card.id)
                      : [...selection, card.id],
                  )
                }
              >
                <TileFace tile={card} decorative />
                {fresh && <span>刚拍得</span>}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="ra-decision-buttons">
        <button
          type="button"
          disabled={locked || !selection.length}
          onClick={() => setSelection([])}
        >
          取消选择
        </button>
        <button
          type="button"
          className="ra-confirm ra-discard-confirm"
          disabled={locked || !chosen}
          onClick={() => chosen && send(chosen)}
        >
          确认弃置
        </button>
      </div>
    </>
  );
}

export function DecisionControls({
  session,
  game,
  player,
  exchange,
  godMode,
  enterGod,
  exitGod,
  clearTarget,
  savedFeedback,
  decisionKey,
}: {
  session: GameHost;
  game: RaView;
  player: Player;
  exchange: Exchange | undefined;
  godMode: boolean;
  enterGod(): void;
  exitGod(): void;
  clearTarget(): void;
  savedFeedback: boolean;
  decisionKey: string;
}) {
  const actions = (session.view?.actions ?? []) as Action[];
  const receipt = savedFeedback
    ? game.scenes.filter(
        (scene): scene is Receipt =>
          'seat' in scene &&
          scene.seat === player.seat &&
          (scene.kind === 'god' ||
            scene.kind === 'disaster' ||
            (scene.kind === 'won' && game.lastAuction?.winner === player.seat)),
      )
    : [];
  const decisionId = session.view?.decisionId;
  const branch = session.view?.branch;
  const panel = useRef<HTMLElement>(null);
  const focusAfterSubmit = useRef<{
    key: string;
    branch: number | undefined;
    element: Element;
  } | null>(null);
  useEffect(() => {
    const pending = focusAfterSubmit.current;
    if (!pending || pending.key === decisionKey) return;
    focusAfterSubmit.current = null;
    if (
      branch === pending.branch &&
      (document.activeElement === pending.element ||
        document.activeElement === document.body)
    ) {
      panel.current?.focus({ preventScroll: true });
    }
  }, [branch, decisionKey]);
  const send: Send = (action) => {
    if (decisionId && !session.locked) {
      const active = document.activeElement;
      if (
        action.type !== 'draw' &&
        action.type !== 'invokeRa' &&
        active &&
        panel.current?.contains(active)
      )
        focusAfterSubmit.current = {
          key: decisionKey,
          branch,
          element: active,
        };
      session.command({ type: 'game', decisionId, action });
    }
  };
  const draw = actions.find(({ type }) => type === 'draw');
  const invoke = actions.find(({ type }) => type === 'invokeRa');
  const finish = actions.find(({ type }) => type === 'finishGod');
  const options = actions.filter((action) => action.type === 'discard');
  const ownBid = game.auction?.bids.find(({ seat }) => seat === player.seat);
  const hasActions = Boolean(decisionId && actions.length);
  if (!hasActions) {
    if (ownBid) {
      return (
        <section
          ref={panel}
          tabIndex={-1}
          className="ra-decision-wait"
          aria-label="本席竞拍状态"
          role="status"
        >
          <strong>
            {ownBid.disk === null ? '已跳过' : `已出价 ${ownBid.disk}`}
          </strong>
          <span>等待其他席位</span>
        </section>
      );
    }
    return receipt.length ? (
      <section ref={panel} tabIndex={-1} aria-label="本席操作结果">
        <DecisionReceipt game={game} scenes={receipt} />
      </section>
    ) : null;
  }
  const kind =
    game.phase === 'auction'
      ? 'auction'
      : options.length
        ? 'disaster'
        : godMode
          ? 'god'
          : 'turn';
  const target = exchange && game.lot[exchange.slot];
  const payment =
    exchange && player.held.find(({ id }) => id === exchange.godId);
  return (
    <section
      ref={panel}
      tabIndex={-1}
      aria-label="本席操作"
      className="ra-actions ra-decision-panel"
      data-kind={kind}
    >
      {receipt.length > 0 && <DecisionReceipt game={game} scenes={receipt} />}
      {kind === 'auction' ? (
        <AuctionControls
          {...{ game, player, actions, send }}
          locked={session.locked}
        />
      ) : kind === 'disaster' ? (
        <DisasterControls
          key={`${decisionKey}:${game.pending?.tile.id ?? ''}`}
          {...{ game, player, options, send }}
          locked={session.locked}
        />
      ) : kind === 'god' ? (
        <>
          <h2>{finish ? '继续神迹' : '神迹换牌'}</h2>
          {target && payment && exchange ? (
            <div className="ra-god-preview">
              <TileFace tile={payment} decorative />
              <div>
                <span>花费 1 枚神明</span>
                <strong>
                  换取第 {exchange.slot + 1} 槽
                  <span>「{tileNames[target.face]}」</span>
                </strong>
              </div>
              <TileFace tile={target} decorative />
            </div>
          ) : (
            <p className="ra-decision-note">点选拍卖行里带青框的石板。</p>
          )}
          <div className="ra-decision-buttons">
            {exchange ? (
              <button
                type="button"
                disabled={session.locked}
                onClick={clearTarget}
              >
                取消选择
              </button>
            ) : (
              <button
                type="button"
                disabled={session.locked}
                onClick={finish ? () => send(finish) : exitGod}
              >
                {finish ? '结束神迹' : '退出神迹'}
              </button>
            )}
            <button
              type="button"
              className="ra-confirm"
              disabled={session.locked || !target || !payment}
              onClick={() => exchange && send(exchange)}
            >
              确认换取
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="ra-turn-controls">
            <button
              type="button"
              className="ra-component-action"
              disabled={!draw || session.locked}
              onClick={() => draw && send(draw)}
            >
              <TableArt piece="tile-bag" className="ra-action-art" /> 抽取
            </button>
            <button
              type="button"
              className="ra-component-action"
              disabled={!invoke || session.locked}
              onClick={() => invoke && send(invoke)}
            >
              <TableArt piece="ra-statue" className="ra-action-art" /> 拍卖
            </button>
            <button
              type="button"
              disabled={
                session.locked ||
                !actions.some(({ type }) => type === 'spendGod')
              }
              onClick={enterGod}
            >
              神迹替换
            </button>
          </div>
          <p className="ra-decision-note">
            {game.lot.every(Boolean)
              ? '满行开拍，全员跳过会清空拍品。'
              : '无人出价时，发起者必须出价。'}
          </p>
        </>
      )}
      {session.awaitingConfirmation && (
        <p className="ra-decision-note" role="status">
          等待保存确认…
        </p>
      )}
    </section>
  );
}
