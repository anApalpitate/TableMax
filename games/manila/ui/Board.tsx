import type { CSSProperties } from 'react';
import { avatarFor, type GameHost } from '@tablemax/web-host';
import type { Action, ManilaView, SpaceView } from '../rules/view';
import { cargoColors, cargoNames, seatColors, spaceName } from './labels';
import {
  CargoArt,
  SiteArt,
  cargoStyle,
  Die,
  manilaAsset,
  Worker,
} from './pieces';
import {
  DetailButton,
  DragSource,
  DropTarget,
  useManilaInteraction,
} from './interaction';
import {
  CargoDetail,
  DockDetail,
  SpecialistDetail,
  VoyageDetail,
} from './Theme';
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
  const content = (
    <>
      <span className="mn-space-name">
        {space.kind === 'cargo'
          ? `${space.index + 1}号位`
          : space.kind === 'port' || space.kind === 'shipyard'
            ? 'ABC'[space.index]
            : space.kind === 'pirate'
              ? space.index === 0
                ? '船长'
                : '船员'
              : space.kind === 'pilot'
                ? space.index === 0
                  ? '小'
                  : '大'
                : '保险'}
      </span>
      {space.occupant ? (
        <Worker
          number={game.seatOrder.indexOf(space.occupant) + 1}
          color={
            seatColors[game.seatOrder.indexOf(space.occupant)] ?? '#315a7f'
          }
          label={names[space.occupant] ?? space.occupant}
        />
      ) : (
        <span className="mn-space-price">
          {space.cost === 0 ? '免费' : `${space.cost} ₱`}
        </span>
      )}
    </>
  );
  return (
    <div
      className={`mn-space-wrap mn-space-wrap--${space.kind}`}
      data-mn-space={space.id}
      data-mn-insurance={space.kind === 'insurance' ? 'true' : undefined}
    >
      {action ? (
        <DropTarget
          target={`space:${space.id}`}
          token={{ kind: 'worker' }}
          className="mn-space mn-space--legal"
          aria-pressed={selected}
          disabled={locked}
          aria-label={`${spaceName(space)}，${space.cost}比索`}
          onClick={() => select(action)}
        >
          {content}
        </DropTarget>
      ) : (
        <div
          className={`mn-space${space.occupant ? ' mn-space--occupied' : ''}`}
        >
          {content}
        </div>
      )}
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
  const work = useManilaInteraction();
  const setup = actions.some((action) => action.type === 'setup');
  const pilot = actions.some((action) => action.type === 'pilot');
  const boarding = actions.some((action) => action.type === 'board');
  const plunder = actions.find(
    (action): action is Extract<Action, { type: 'plunder' }> =>
      action.type === 'plunder',
  );
  const visible = game.boats.length
    ? game.boats
    : [0, 1, 2].map((index) => ({
        cargo: setup ? work.cargos[index]! : null,
        position: 0,
        destination: 'sea' as const,
        destinationIndex: null,
        plundered: false,
        crew: [],
      }));
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
  return (
    <div className="mn-board-scroll">
      <section
        className="mn-harbor"
        data-stage={setup ? 'setup' : pilot ? 'pilot' : game.phase}
        style={
          {
            '--harbor-image': `url("${manilaAsset('harbor-v1.webp')}")`,
            '--portrait-harbor-image': `url("${manilaAsset('harbor-portrait-v2.webp')}")`,
          } as CSSProperties
        }
        aria-label="三条向港口前进的航道与港湾岗位"
      >
        <header className="mn-board-heading">
          <h2>马尼拉港湾</h2>
          <DetailButton
            title="航次与岗位说明"
            detail={<VoyageDetail game={game} />}
          >
            <span>航行 {Math.min(game.movement, 3)}/3</span>
            <span aria-hidden="true">ⓘ</span>
          </DetailButton>
        </header>
        <div className="mn-docks">
          {(['port', 'shipyard'] as const).map((kind) => (
            <section className="mn-dock-group" key={kind}>
              <DetailButton
                title={kind === 'port' ? '港口岗位' : '修船坞岗位'}
                detail={<DockDetail game={game} kind={kind} />}
              >
                <SiteArt kind={kind} />
                <strong>{kind === 'port' ? '港口' : '修船坞'}</strong>
              </DetailButton>
              {plunder ? (
                <DropTarget
                  target={`destination:${kind}`}
                  token={{ kind: 'plunder', cargo: plunder.cargo }}
                  className="mn-destination"
                  aria-pressed={
                    draft?.type === 'plunder' && draft.destination === kind
                  }
                  aria-label={`掠夺${cargoNames[plunder.cargo]}，送往${kind === 'port' ? '港口' : '修船坞'}`}
                >
                  送往{kind === 'port' ? '港口' : '修船坞'}
                </DropTarget>
              ) : (
                <div className="mn-dock-slots">
                  {game.spaces
                    .filter((entry) => entry.kind === kind)
                    .map(space)}
                </div>
              )}
            </section>
          ))}
        </div>
        <div className="mn-lanes">
          {visible.map((boat, index) => {
            const cargo = boat.cargo;
            const data = game.cargos.find((entry) => entry.id === cargo);
            const crew = game.spaces.filter(
              (entry) => entry.kind === 'cargo' && entry.cargo === cargo,
            );
            const vacancy = crew.find((entry) =>
              actions.some(
                (action) =>
                  action.type === 'place' && action.space === entry.id,
              ),
            );
            const destination =
              boat.destination === 'port'
                ? `靠港${'ABC'[boat.destinationIndex ?? 0]}`
                : boat.destination === 'shipyard'
                  ? '进修船坞'
                  : `${boat.position}格`;
            const delta = cargo ? (work.deltas[cargo] ?? 0) : 0;
            const preview = setup
              ? work.positions[index]!
              : boat.position + delta;
            const image = (
              <picture>
                <source
                  media="(max-width:1050px)"
                  srcSet={manilaAsset('boat-portrait-v2.webp')}
                />
                <img
                  src={manilaAsset('boat-v1.webp')}
                  alt={
                    cargo
                      ? `${cargoNames[cargo]}木船，第${index + 1}航道`
                      : '等待装载的空木船'
                  }
                  width="220"
                  height="60"
                  draggable={false}
                />
              </picture>
            );
            return (
              <section
                className="mn-lane"
                key={index}
                data-mn-cargo={cargo ?? undefined}
                style={cargoStyle(cargo ? cargoColors[cargo] : '#527b7b')}
              >
                <div className="mn-lane-heading">
                  {cargo ? (
                    <DetailButton
                      title={`${cargoNames[cargo]}货船详情`}
                      detail={
                        <CargoDetail
                          game={game}
                          cargo={cargo}
                          names={names}
                          destination={destination}
                          plundered={boat.plundered}
                        />
                      }
                    >
                      <CargoArt cargo={cargo} />
                      <strong>{cargoNames[cargo]}</strong>
                    </DetailButton>
                  ) : (
                    <strong>第{index + 1}航道</strong>
                  )}
                  <div className="mn-dice">
                    {cargo && game.dice.at(-1)?.values[cargo] !== undefined && (
                      <Die
                        value={game.dice.at(-1)!.values[cargo]!}
                        label={cargoNames[cargo]}
                      />
                    )}
                  </div>
                </div>
                <div
                  className="mn-track"
                  data-manila-rail={setup || pilot ? 'true' : undefined}
                  data-rail-lane={setup ? index : undefined}
                  data-rail-cargo={pilot ? cargo : undefined}
                  data-rail-position={pilot ? boat.position : undefined}
                  data-mn-hovered={Boolean(
                    work.carry &&
                    work.hoverTarget?.startsWith(
                      setup ? `start:${index}:` : `pilot:${cargo}:`,
                    ),
                  )}
                >
                  <div className="mn-track-cells">
                    {Array.from({ length: 14 }, (_, cell) => (
                      <span
                        className={
                          cell === boat.position ? 'mn-cell-current' : ''
                        }
                        key={cell}
                        style={
                          {
                            '--mn-cell-position': `${(cell / 13) * 100}%`,
                          } as CSSProperties
                        }
                      >
                        {cell}
                      </span>
                    ))}
                  </div>
                  <div
                    className="mn-boat"
                    data-mn-cargo={cargo ?? undefined}
                    style={
                      {
                        '--boat-position': `${(Math.min(13, Math.max(0, boat.position)) / 13) * 100}%`,
                      } as CSSProperties
                    }
                  >
                    {setup ? (
                      <DropTarget
                        target={`cargo:${index}`}
                        token={{ kind: 'cargo', cargo: work.cargos[index]! }}
                        className="mn-boat-cargo-target"
                        aria-label={`第${index + 1}航道装货`}
                      >
                        {image}
                        <span>放入货物</span>
                      </DropTarget>
                    ) : pilot && cargo && boat.destination === 'sea' ? (
                      <DragSource
                        token={{ kind: 'pilot', cargo }}
                        label={`拖动${cargoNames[cargo]}领航`}
                        className="mn-boat-handle"
                      >
                        {image}
                      </DragSource>
                    ) : plunder?.cargo === cargo && cargo ? (
                      <DragSource
                        token={{ kind: 'plunder', cargo }}
                        label={`拖动${cargoNames[cargo]}送港口或修船坞`}
                        className="mn-boat-handle"
                      >
                        {image}
                      </DragSource>
                    ) : boarding &&
                      cargo &&
                      actions.some(
                        (action) =>
                          action.type === 'board' && action.cargo === cargo,
                      ) ? (
                      <DropTarget
                        target={`board:${cargo}`}
                        token={{ kind: 'pirate' }}
                        className="mn-boat-handle"
                        aria-label={`登上${cargoNames[cargo]}船`}
                        aria-pressed={
                          draft?.type === 'board' && draft.cargo === cargo
                        }
                      >
                        {image}
                        <span>登船</span>
                      </DropTarget>
                    ) : vacancy ? (
                      <DropTarget
                        target={`space:${vacancy.id}`}
                        token={{ kind: 'worker' }}
                        className="mn-boat-handle"
                        aria-label={`派遣到${cargo ? cargoNames[cargo] : ''}船${vacancy.index + 1}号位，${vacancy.cost}比索`}
                        aria-pressed={
                          draft?.type === 'place' && draft.space === vacancy.id
                        }
                      >
                        {image}
                      </DropTarget>
                    ) : (
                      image
                    )}
                    <span className="mn-lane-position">{destination}</span>
                  </div>
                  {((setup && work.setupStep === 2) ||
                    (pilot && delta !== 0)) && (
                    <div
                      className="mn-boat-preview"
                      style={
                        {
                          '--boat-position': `${(Math.min(13, Math.max(0, preview)) / 13) * 100}%`,
                        } as CSSProperties
                      }
                    >
                      <span>草稿 {preview > 13 ? '靠港' : `${preview}格`}</span>
                    </div>
                  )}
                  {setup && work.setupStep === 2 && (
                    <DragSource
                      token={{ kind: 'start', lane: index }}
                      label={`拖动第${index + 1}航道起点`}
                      className="mn-start-handle"
                      style={
                        {
                          '--boat-position': `${(work.positions[index]! / 13) * 100}%`,
                        } as CSSProperties
                      }
                    >
                      起点 {work.positions[index]}
                    </DragSource>
                  )}
                </div>
                <div className="mn-crew">
                  {vacancy ? (
                    space(vacancy)
                  ) : (
                    <span className="mn-crew-summary">
                      {crew.filter((entry) => entry.occupant).length
                        ? `伙伴 ${crew.filter((entry) => entry.occupant).length}`
                        : cargo
                          ? '暂无伙伴'
                          : '等待装船'}
                    </span>
                  )}
                  {cargo && (
                    <DetailButton
                      title={`${cargoNames[cargo]}分红与伙伴`}
                      detail={
                        <CargoDetail game={game} cargo={cargo} names={names} />
                      }
                    >
                      <span>{data?.payout} ₱</span>
                    </DetailButton>
                  )}
                </div>
              </section>
            );
          })}
        </div>
        <div className="mn-specialists">
          {(['pirate', 'pilot', 'insurance'] as const).map((kind) => (
            <section
              className={`mn-specialist-group mn-specialist-group--${kind}`}
              key={kind}
            >
              <DetailButton
                title={
                  kind === 'pirate'
                    ? '海盗'
                    : kind === 'pilot'
                      ? '领航员'
                      : '保险行'
                }
                detail={<SpecialistDetail kind={kind} />}
              >
                <SiteArt kind={kind} />
                <span>
                  {kind === 'pirate'
                    ? '海盗'
                    : kind === 'pilot'
                      ? '领航'
                      : '保险'}
                </span>
              </DetailButton>
              <div className="mn-specialist-slots">
                {game.spaces.filter((entry) => entry.kind === kind).map(space)}
              </div>
            </section>
          ))}
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
            data-mn-cargo={cargo.id}
            key={cargo.id}
            style={cargoStyle(cargoColors[cargo.id])}
          >
            <div className="mn-market-title">
              <span className="mn-cargo">
                <CargoArt cargo={cargo.id} />
                {cargoNames[cargo.id]}
              </span>
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
              data-mn-player={id}
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
                  <span>现金 {player.cash} ₱</span>
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
