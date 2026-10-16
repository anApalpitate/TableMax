import type { CSSProperties } from 'react';
import { avatarFor, type GameHost } from '@tablemax/web-host';
import type { Action, ManilaView, SpaceView } from '../rules/view';
import { cargoColors, cargoNames, seatColors, spaceName } from './labels';
import { cargoStyle, Die, manilaAsset, Worker } from './pieces';

type Seats = NonNullable<GameHost['view']>['seats'];
export function Space({
  space,
  game,
  names,
  action,
  selected,
  locked,
  select,
}: {
  space: SpaceView;
  game: ManilaView;
  names: Record<string, string>;
  action?: Action | undefined;
  selected?: boolean | undefined;
  locked: boolean;
  select(action: Action): void;
}) {
  const occupant = space.occupant;
  const content = (
    <>
      <span className="mn-space-name">
        {space.kind === 'cargo' ? `${space.index + 1}号位` : spaceName(space)}
      </span>
      {occupant ? (
        <Worker
          number={game.seatOrder.indexOf(occupant) + 1}
          color={seatColors[game.seatOrder.indexOf(occupant)] ?? '#315a7f'}
          label={names[occupant] ?? occupant}
        />
      ) : (
        <span className="mn-space-price">
          {space.cost === 0 ? '免费' : `${space.cost} ₱`}
          {space.payout !== null && space.kind !== 'cargo'
            ? ` → ${space.payout} ₱`
            : ''}
        </span>
      )}
    </>
  );
  return action ? (
    <button
      className="mn-space mn-space--legal"
      aria-pressed={selected}
      disabled={locked}
      aria-label={`${spaceName(space)}，${space.cost}比索`}
      onClick={() => select(action)}
    >
      {content}
    </button>
  ) : (
    <div
      className={`mn-space${occupant ? ' mn-space--occupied' : ''}`}
      title={occupant ? `${names[occupant] ?? occupant}已派遣` : undefined}
    >
      {content}
    </div>
  );
}

export function HarborBoard({
  game,
  names,
  actions,
  draft,
  locked,
  select,
}: {
  game: ManilaView;
  names: Record<string, string>;
  actions: Action[];
  draft: Action | null;
  locked: boolean;
  select(action: Action): void;
}) {
  const space = (entry: SpaceView) => (
    <Space
      key={entry.id}
      space={entry}
      game={game}
      names={names}
      action={actions.find(
        (action) => action.type === 'place' && action.space === entry.id,
      )}
      selected={draft?.type === 'place' && draft.space === entry.id}
      locked={locked}
      select={select}
    />
  );
  const latestDice = game.dice.at(-1);
  return (
    <div
      className="mn-board-scroll"
      tabIndex={0}
      aria-label="港湾沙盘，小屏可左右滑动查看全图"
    >
      <section
        className="mn-harbor"
        style={
          {
            '--harbor-image': `url("${manilaAsset('harbor-v1.webp')}")`,
          } as CSSProperties
        }
        aria-label="三条航道与港湾岗位"
      >
        <div className="mn-board-heading">
          <h2>马尼拉港湾</h2>
          <span>
            航行 {Math.min(game.movement, 3)} / 3 · 派遣第 {game.placementRound}{' '}
            轮
          </span>
        </div>
        <div className="mn-lanes">
          {game.boats.length === 0 && (
            <div className="mn-water-wait">
              <strong>等待港务长装船</strong>
              <p>三条航道将在选择货物与起点后开放。</p>
              <img src={manilaAsset('boat-v1.webp')} alt="等待装载的空木船" />
            </div>
          )}
          {game.boats.map((boat, index) => (
            <section
              className="mn-lane"
              key={boat.cargo}
              style={cargoStyle(cargoColors[boat.cargo])}
            >
              <div className="mn-lane-heading">
                <span className="mn-cargo">
                  {cargoNames[boat.cargo]}{' '}
                  <span>
                    分红池{' '}
                    {
                      game.cargos.find((cargo) => cargo.id === boat.cargo)
                        ?.payout
                    }{' '}
                    ₱ · 均分
                  </span>
                </span>
                <div className="mn-dice">
                  {latestDice?.values[boat.cargo] !== undefined && (
                    <Die
                      value={latestDice.values[boat.cargo]!}
                      label={cargoNames[boat.cargo]}
                    />
                  )}
                  <span className="mn-lane-position">
                    {boat.destination === 'port'
                      ? `已靠港 ${'ABC'[boat.destinationIndex ?? 0]}`
                      : boat.destination === 'shipyard'
                        ? '进入修船坞'
                        : `${boat.position} 格`}
                    {boat.plundered && ' · 被掠夺'}
                  </span>
                </div>
              </div>
              <div className="mn-track">
                <div className="mn-track-cells">
                  {Array.from({ length: 14 }, (_, cell) => (
                    <span
                      className={
                        cell === boat.position ? 'mn-cell-current' : ''
                      }
                      key={cell}
                    >
                      {cell}
                    </span>
                  ))}
                </div>
                <div
                  className="mn-boat"
                  style={
                    {
                      '--boat-position': `${(Math.min(13, Math.max(0, boat.position)) / 13) * 100}%`,
                    } as CSSProperties
                  }
                >
                  <img
                    src={manilaAsset('boat-v1.webp')}
                    alt={`${cargoNames[boat.cargo]}木船，第${index + 1}航道`}
                  />
                  <span className="mn-boat-cargo" />
                </div>
              </div>
              <div className="mn-crew">
                {game.spaces
                  .filter(
                    (entry) =>
                      entry.kind === 'cargo' && entry.cargo === boat.cargo,
                  )
                  .map(space)}
              </div>
            </section>
          ))}
        </div>
        <div className="mn-docks">
          {(['port', 'shipyard'] as const).map((kind) => (
            <section className="mn-dock-group" key={kind}>
              <h3>{kind === 'port' ? '成功靠港' : '修船坞'}</h3>
              <div className="mn-dock-slots">
                {game.spaces.filter((entry) => entry.kind === kind).map(space)}
              </div>
            </section>
          ))}
        </div>
        <div className="mn-specialists">
          {game.spaces
            .filter((entry) =>
              ['pirate', 'pilot', 'insurance'].includes(entry.kind),
            )
            .map(space)}
        </div>
      </section>
    </div>
  );
}

export function Market({ game }: { game: ManilaView }) {
  return (
    <section className="mn-panel mn-market-panel">
      <h2>货物行情</h2>
      <div className="mn-market">
        {game.cargos.map((cargo) => (
          <div
            className="mn-market-row"
            key={cargo.id}
            style={cargoStyle(cargoColors[cargo.id])}
          >
            <div className="mn-market-title">
              <span className="mn-cargo">{cargoNames[cargo.id]}</span>
              <span>余 {game.stock[cargo.id]} 股</span>
            </div>
            <div
              className="mn-market-track"
              aria-label={`当前股价${game.market[cargo.id]}比索`}
            >
              {[0, 5, 10, 15, 20, 30].map((price) => (
                <span
                  className={
                    price === game.market[cargo.id] ? 'mn-current-price' : ''
                  }
                  key={price}
                >
                  {price}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Players({ game, seats }: { game: ManilaView; seats: Seats }) {
  return (
    <section className="mn-panel mn-players-panel">
      <h2>商人</h2>
      <div className="mn-seats">
        {game.seatOrder.map((id, index) => {
          const player = game.players[id]!;
          const seat = seats.find((entry) => entry.id === id);
          return (
            <article
              className={`mn-seat${game.turnSeat === id ? ' mn-seat--current' : ''}`}
              key={id}
              data-seat-id={id}
            >
              <span
                className="mn-seat-number"
                style={cargoStyle(seatColors[index]!)}
              >
                {index + 1}
              </span>
              <img src={avatarFor(seat?.avatarId ?? 'avatar-1')} alt="" />
              <div className="mn-seat-body">
                <strong>
                  {seat?.name ?? `商人${index + 1}`}
                  {id === game.self?.seatId ? ' · 你' : ''}
                  {id === game.harborMaster && (
                    <span className="mn-seat-role"> · 港务长</span>
                  )}
                </strong>
                <div className="mn-seat-meta">
                  <span>{player.cash} ₱</span>
                  <span>{player.shareCount} 股</span>
                  <span>伙伴 {player.availableWorkers}</span>
                </div>
                {player.revealedShares.length > 0 && (
                  <span className="mn-revealed">
                    公开：
                    {player.revealedShares
                      .map(
                        (share) =>
                          `${cargoNames[share.cargo]}${share.mortgaged ? '（抵押）' : ''}`,
                      )
                      .join('、')}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
