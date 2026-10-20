import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { avatarFor, type GameHost } from '@tablemax/web-host';
import type { Action, ManilaView, ShareView, SpaceView } from '../rules/view';
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
  CopperMark,
  DockDetail,
  SpecialistDetail,
  VoyageDetail,
} from './Theme';
type Seats = NonNullable<GameHost['view']>['seats'];

function HoldMark() {
  return (
    <svg className="mn-hold-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8h16v11H4zM8 8V5h8v3M8 12h8M8 16h5" />
    </svg>
  );
}

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
                  ? '小领航'
                  : '大领航'
                : '承保'}
      </span>
      <span className="mn-space-value">
        {space.occupant ? (
          <Worker
            number={game.seatOrder.indexOf(space.occupant) + 1}
            color={
              seatColors[game.seatOrder.indexOf(space.occupant)] ?? '#315a7f'
            }
            label={names[space.occupant] ?? space.occupant}
          />
        ) : (
          <span
            className="mn-space-price mn-money"
            title={`入驻费用 ${space.cost} 比索`}
            aria-label={`入驻费用 ${space.cost} 比索`}
          >
            {space.cost === 0 ? '免费' : `−${space.cost} ₱`}
          </span>
        )}
      </span>
      {(space.kind === 'port' ||
        space.kind === 'shipyard' ||
        space.kind === 'insurance') &&
        space.payout != null && (
          <span
            className="mn-space-earn"
            title={
              space.kind === 'insurance'
                ? `即收 ${space.payout} 比索，同时承担修船赔付`
                : `${space.kind === 'port' ? '抵港' : '进坞'}条件满足时收入 ${space.payout} 比索，未扣除入驻费用`
            }
            aria-label={
              space.kind === 'insurance'
                ? `立即收入 ${space.payout} 比索，有修船赔付风险`
                : `条件收益 ${space.payout} 比索，未扣除费用`
            }
          >
            <CopperMark kind={space.kind === 'insurance' ? 'risk' : 'income'} />
            <span className="mn-money">
              {space.kind === 'insurance' ? '即收 ' : '+'}
              {space.payout} ₱
            </span>
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
  compactHeading = false,
  market,
  children,
}: {
  game: ManilaView;
  names: Record<string, string>;
  actions: Action[];
  draft: Action | null;
  locked: boolean;
  select(action: Action): void;
  compactHeading?: boolean;
  market?: ReactNode;
  children?: ReactNode;
}) {
  const work = useManilaInteraction();
  const [vertical, setVertical] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 620px)');
    const sync = () => setVertical(!compactHeading && query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [compactHeading]);
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
  const pirateLineActive =
    game.phase === 'board' ||
    game.phase === 'plunder' ||
    game.boats.some(
      (boat) => boat.destination === 'sea' && boat.position === 13,
    );
  return (
    <div className="mn-board-scroll">
      <section
        className="mn-harbor"
        data-mn-axis={vertical ? 'vertical' : 'horizontal'}
        data-stage={setup ? 'setup' : pilot ? 'pilot' : game.phase}
        style={
          {
            '--harbor-image': `url("${manilaAsset('harbor-v1.webp')}")`,
            '--portrait-harbor-image': `url("${manilaAsset('harbor-portrait-v2.webp')}")`,
          } as CSSProperties
        }
        aria-label="三条向港口前进的航道与港湾岗位"
      >
        {!compactHeading && (
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
        )}
        <div className="mn-shore">
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
                  {game.spaces
                    .filter((entry) => entry.kind === kind)
                    .map(space)}
                </div>
              </section>
            ))}
          </div>
        </div>
        {market && <div className="mn-board-market">{market}</div>}
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
                  ? `进坞${boat.destinationIndex === null ? '' : 'ABC'[boat.destinationIndex]}`
                  : `${boat.position}格`;
            const crewLostIncome =
              boat.plundered || boat.destination === 'shipyard';
            const payoutHint = crewLostIncome
              ? `本船船员无分红：${boat.plundered ? '已被掠夺' : '进入修船坞'}`
              : '整船分红池，抵港后由船上同伙均分；不是每人收入';
            const crewMembers = crew.filter((entry) => entry.occupant);
            const laneState =
              setup || pilot
                ? 'adjusting'
                : boat.plundered
                  ? 'plundered'
                  : boat.destination !== 'sea'
                    ? 'docked'
                    : cargo
                      ? 'sea'
                      : 'empty';
            const delta = cargo ? (work.deltas[cargo] ?? 0) : 0;
            const preview = setup
              ? work.positions[index]!
              : boat.position + delta;
            const image = (
              <picture>
                {!compactHeading && (
                  <source
                    media="(max-width:620px)"
                    srcSet={manilaAsset('boat-portrait-v2.webp')}
                  />
                )}
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
                data-mn-lane-state={laneState}
                data-mn-adjust-active={Boolean(
                  !locked &&
                  (work.activeRail === index ||
                    (work.carry?.kind === 'start' &&
                      work.carry.lane === index) ||
                    (work.carry?.kind === 'pilot' &&
                      work.carry.cargo === cargo)),
                )}
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
                      {!compactHeading && (
                        <span
                          className="mn-cargo-payout"
                          title={payoutHint}
                          aria-label={
                            crewLostIncome
                              ? payoutHint
                              : `整船分红池 ${data?.payout} 比索，船员均分`
                          }
                        >
                          <span>{crewLostIncome ? '船员' : '整船'}</span>
                          <strong>{crewLostIncome ? 0 : data?.payout} ₱</strong>
                        </span>
                      )}
                    </DetailButton>
                  ) : (
                    <strong>第{index + 1}航道</strong>
                  )}
                  {cargo && !setup && !pilot && boat.destination === 'sea' && (
                    <span className="mn-saved-position">
                      船位 {boat.position}格
                    </span>
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
                    {Array.from({ length: 14 }, (_, cell) => {
                      const token = setup
                        ? { kind: 'start' as const, lane: index }
                        : cargo
                          ? { kind: 'pilot' as const, cargo }
                          : null;
                      const target = setup
                        ? `start:${index}:${cell}`
                        : `pilot:${cargo}:${cell - boat.position}`;
                      const legal = Boolean(
                        token &&
                        ((setup && work.setupStep === 2) || pilot) &&
                        work.canDrop(token, target),
                      );
                      return (
                        <span
                          data-mn-legal={legal}
                          data-mn-cell={cell}
                          data-mn-cell-hovered={work.hoverTarget === target}
                          className={[
                            cell === boat.position ? 'mn-cell-current' : '',
                            [0, 5, 10, 13].includes(cell) &&
                            Math.abs(cell - boat.position) > 1
                              ? 'mn-cell-milestone'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          key={cell}
                          style={
                            {
                              '--mn-cell-position': `${(cell / 13) * 100}%`,
                            } as CSSProperties
                          }
                        >
                          {cell}
                        </span>
                      );
                    })}
                  </div>
                  <div
                    className="mn-boat"
                    data-mn-cargo={cargo ?? undefined}
                    data-mn-preview={
                      (setup && work.setupStep === 2) || pilot
                        ? true
                        : undefined
                    }
                    style={
                      {
                        '--boat-position': `${(Math.min(13, Math.max(0, (setup && work.setupStep === 2) || pilot ? preview : boat.position)) / 13) * 100}%`,
                      } as CSSProperties
                    }
                  >
                    {setup && work.setupStep === 1 ? (
                      <DropTarget
                        target={`cargo:${index}`}
                        token={{ kind: 'cargo', cargo: work.cargos[index]! }}
                        className="mn-boat-cargo-target"
                        aria-label={`第${index + 1}航道装货`}
                      >
                        {image}
                      </DropTarget>
                    ) : pilot && cargo && boat.destination === 'sea' ? (
                      <>
                        <span className="mn-boat-touch-image">{image}</span>
                        <DragSource
                          token={{ kind: 'pilot', cargo }}
                          label={`拖动${cargoNames[cargo]}领航`}
                          className="mn-boat-handle mn-pilot-drag"
                        >
                          {image}
                        </DragSource>
                      </>
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
                    {(setup && work.setupStep === 2) || pilot ? (
                      <span className="mn-boat-preview">
                        <span>{preview > 13 ? '靠港' : `${preview}格`}</span>
                      </span>
                    ) : (
                      <span className="mn-lane-position">{destination}</span>
                    )}
                  </div>
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
                      {vertical ? '↕' : '↔'}
                    </DragSource>
                  )}
                </div>
                <div className="mn-lane-control">
                  {setup && work.setupStep === 1 && (
                    <label className="mn-lane-cargo-select">
                      <span>装货</span>
                      <select
                        aria-label={`第${index + 1}航道货物`}
                        value={work.cargos[index]}
                        disabled={locked}
                        onChange={(event) =>
                          work.setCargo(
                            index,
                            event.target.value as (typeof work.cargos)[number],
                          )
                        }
                      >
                        {game.cargos.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {cargoNames[entry.id]}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {((setup && work.setupStep === 2) ||
                    (pilot && cargo && boat.destination === 'sea')) && (
                    <div
                      className="mn-position-controls"
                      onFocusCapture={() => work.setActiveRail(index)}
                      onBlurCapture={(event) => {
                        if (
                          event.relatedTarget &&
                          !event.currentTarget.contains(
                            event.relatedTarget as Node | null,
                          )
                        )
                          work.setActiveRail(null);
                      }}
                      aria-label={`第${index + 1}航道调位`}
                    >
                      <output aria-live="polite">
                        {setup ? '起点' : '草稿'}{' '}
                        {preview > 13 ? '靠港' : `${preview}格`}
                      </output>
                      <div>
                        {(vertical
                          ? ([1, -1] as const)
                          : ([-1, 1] as const)
                        ).map((step) => {
                          const value = setup ? preview + step : delta + step;
                          const allowed = setup
                            ? value >= 0 && value <= 5
                            : Boolean(
                                cargo &&
                                work.canDrop(
                                  { kind: 'pilot', cargo },
                                  `pilot:${cargo}:${value}`,
                                ),
                              );
                          return (
                            <button
                              key={step}
                              type="button"
                              data-mn-step={step}
                              disabled={locked || !allowed}
                              aria-label={`${cargo ? cargoNames[cargo] : `第${index + 1}船`}${step > 0 ? '前进' : '后退'}一格`}
                              onClick={() => {
                                work.setCarry(null);
                                work.setActiveRail(index);
                                if (setup) work.setPosition(index, value);
                                else if (cargo) work.setDelta(cargo, value);
                              }}
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d={
                                    vertical
                                      ? step > 0
                                        ? 'm6 15 6-6 6 6'
                                        : 'm6 9 6 6 6-6'
                                      : step > 0
                                        ? 'm9 6 6 6-6 6'
                                        : 'm15 6-6 6 6 6'
                                  }
                                />
                              </svg>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div
                    className={`mn-crew mn-crew--${laneState}`}
                    data-mn-adjusting={setup || pilot ? true : undefined}
                    data-mn-lane-state={laneState}
                    data-mn-crew-count={crewMembers.length}
                    aria-label={
                      compactHeading
                        ? undefined
                        : boat.plundered
                          ? '被掠夺'
                          : boat.destination !== 'sea'
                            ? destination
                            : cargo
                              ? `船员 ${crewMembers.length} 人`
                              : '等待装货'
                    }
                  >
                    {compactHeading ? (
                      <>
                        <span className="mn-lane-meta">
                          <span className="mn-position-readout">
                            {(boat.plundered || boat.destination !== 'sea') && (
                              <SiteArt
                                kind={
                                  boat.plundered
                                    ? 'pirate'
                                    : boat.destination === 'port'
                                      ? 'port'
                                      : 'shipyard'
                                }
                              />
                            )}
                            {boat.plundered
                              ? '被掠夺'
                              : boat.destination !== 'sea'
                                ? destination
                                : cargo
                                  ? `船员 ${crewMembers.length}`
                                  : '空舱'}
                          </span>
                          {cargo ? (
                            <span
                              className="mn-payout-label"
                              title={payoutHint}
                            >
                              {crewLostIncome
                                ? '船员 0'
                                : `整船 ${data?.payout}`}{' '}
                              ₱
                            </span>
                          ) : null}
                        </span>
                        {cargo ? (
                          <div className="mn-crew-slots">{crew.map(space)}</div>
                        ) : vacancy ? (
                          space(vacancy)
                        ) : crewMembers.length ? (
                          <span className="mn-crew-summary mn-crew-members">
                            {crewMembers.map((entry) => (
                              <Worker
                                key={entry.id}
                                number={
                                  game.seatOrder.indexOf(entry.occupant!) + 1
                                }
                                color={
                                  seatColors[
                                    game.seatOrder.indexOf(entry.occupant!)
                                  ]!
                                }
                                label={
                                  names[entry.occupant!] ?? entry.occupant!
                                }
                              />
                            ))}
                          </span>
                        ) : null}
                      </>
                    ) : boat.plundered ? (
                      <span className="mn-manifest-state mn-manifest-state--plunder">
                        <SiteArt kind="pirate" />
                        <span>被掠夺</span>
                      </span>
                    ) : boat.destination !== 'sea' ? (
                      <span className="mn-manifest-state">
                        <SiteArt kind={boat.destination} />
                        <span>{destination}</span>
                      </span>
                    ) : cargo ? (
                      <>
                        <span
                          className="mn-manifest-kicker"
                          title={`船员 ${crewMembers.length} 人；棋子数字对应商人座号`}
                          aria-label={`船员 ${crewMembers.length} 人`}
                        >
                          <CopperMark kind="worker" />
                          <span className="mn-sr-only">船员</span>
                          <b>{crewMembers.length}</b>
                        </span>
                        <span className="mn-manifest-members">
                          {crewMembers.map((entry) => (
                            <Worker
                              key={entry.id}
                              number={
                                game.seatOrder.indexOf(entry.occupant!) + 1
                              }
                              color={
                                seatColors[
                                  game.seatOrder.indexOf(entry.occupant!)
                                ]!
                              }
                              label={names[entry.occupant!] ?? entry.occupant!}
                            />
                          ))}
                          {!crewMembers.length && (
                            <span className="mn-manifest-empty">空舱</span>
                          )}
                        </span>
                        {vacancy && (
                          <span className="mn-manifest-target">
                            {space(vacancy)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="mn-manifest-state mn-manifest-state--empty">
                        <span className="mn-manifest-hold" aria-hidden="true">
                          <HoldMark />
                        </span>
                        <span>空舱</span>
                      </span>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
          {!compactHeading && (
            <div
              className={`mn-pirate-line${pirateLineActive ? ' is-active' : ''}`}
              role="note"
              aria-label="第13格为海盗拦截线"
            >
              <DetailButton
                className="mn-pirate-line-flag"
                title="海盗拦截线"
                detail={
                  <div className="mn-pirate-line-detail">
                    <p>第 13 格为海盗拦截线。</p>
                    <p>
                      船停在 13 格时可能被海盗登船；第三次航行仍停 13
                      格时可能被掠夺。
                    </p>
                  </div>
                }
              >
                <SiteArt kind="pirate" />
              </DetailButton>
              <span className="mn-pirate-line-rule" aria-hidden="true" />
              <span className="mn-pirate-line-label" aria-hidden="true">
                13 海盗拦截
              </span>
            </div>
          )}
        </div>
        {children && <div className="mn-board-actions">{children}</div>}
      </section>
    </div>
  );
}

export function Market({ game }: { game: ManilaView }) {
  return (
    <section className="mn-panel mn-market-panel">
      <h2>股价 · ₱/股</h2>
      <div className="mn-market">
        {game.cargos.map((cargo) => (
          <div
            className="mn-market-row"
            data-mn-cargo={cargo.id}
            key={cargo.id}
            style={cargoStyle(cargoColors[cargo.id])}
          >
            <div className="mn-market-title">
              <span
                className="mn-cargo"
                aria-label={cargoNames[cargo.id]}
                title={cargoNames[cargo.id]}
              >
                <CargoArt cargo={cargo.id} />
                <span className="mn-cargo-name">{cargoNames[cargo.id]}</span>
              </span>
              <span
                className="mn-market-stock"
                title={`库存 ${game.stock[cargo.id]} 股`}
                aria-label={`库存 ${game.stock[cargo.id]} 股`}
              >
                <CopperMark kind="shares" />
                <span>×{game.stock[cargo.id]}</span>
              </span>
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
                  aria-current={
                    price === game.market[cargo.id] ? 'true' : undefined
                  }
                  title={
                    price === game.market[cargo.id]
                      ? `当前每股 ${price} 比索`
                      : `每股 ${price} 比索`
                  }
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

export function RevealedShares({ shares }: { shares: ShareView[] }) {
  const groups = new Map<
    string,
    { cargo: ShareView['cargo']; mortgaged: boolean; count: number }
  >();
  for (const share of shares) {
    const key = `${share.cargo}:${share.mortgaged ? 'mortgaged' : 'clear'}`;
    const group = groups.get(key) ?? {
      cargo: share.cargo,
      mortgaged: share.mortgaged,
      count: 0,
    };
    group.count++;
    groups.set(key, group);
  }
  if (!groups.size) return null;
  return (
    <ul className="mn-revealed-shares" aria-label="公开股份">
      {[...groups.values()].map((group) => {
        const name = cargoNames[group.cargo];
        return (
          <li
            className={`mn-share-chip${group.mortgaged ? ' mn-share-chip--mortgaged' : ''}`}
            key={`${group.cargo}:${group.mortgaged ? 'mortgaged' : 'clear'}`}
            style={cargoStyle(cargoColors[group.cargo])}
            title={`${name}股份 ×${group.count}${group.mortgaged ? '，已抵押' : ''}`}
            aria-label={`${name}股份 ${group.count} 张${group.mortgaged ? '，已抵押' : ''}`}
          >
            <CargoArt cargo={group.cargo} />
            {group.count > 1 && <b aria-hidden="true">×{group.count}</b>}
            {group.mortgaged && (
              <i className="mn-share-seal" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MerchantRack({
  game,
  seats,
}: {
  game: ManilaView;
  seats: Seats;
}) {
  return (
    <section className="mn-merchant-rack" aria-label="商人">
      <h2 className="mn-rack-heading">商人</h2>
      <div className="mn-merchant-cards">
        {game.seatOrder.map((id, index) => {
          const player = game.players[id]!;
          const seat = seats.find((entry) => entry.id === id);
          const name = seat?.name ?? `商人${index + 1}`;
          const active =
            game.turnSeat === id &&
            !['round-result', 'ended'].includes(game.phase);
          const self = game.self?.seatId === id;
          const master = game.harborMaster === id;
          const income = game.result?.income[id];
          const score = game.scores?.[id];
          const rank = game.scores
            ? 1 +
              game.seatOrder.filter(
                (other) => game.scores![other]! > game.scores![id]!,
              ).length
            : null;
          return (
            <div
              className="mn-merchant-slot"
              data-seat-id={id}
              key={id}
              aria-label={
                game.phase === 'ended' && score !== undefined
                  ? `${name}，${game.winners.includes(id) ? '赢家，' : ''}财富 ${score} 比索`
                  : undefined
              }
            >
              <DetailButton
                className={`mn-merchant-card${active ? ' mn-merchant-card--active' : ''}${self ? ' mn-merchant-card--self' : ''}`}
                title={`${name}的商人详情`}
                detail={
                  <div className="mn-merchant-detail">
                    <header>
                      <img
                        src={avatarFor(seat?.avatarId ?? 'avatar-1')}
                        alt=""
                      />
                      <strong>{name}</strong>
                      {master && <span>港务长</span>}
                      {active && <span>行动中</span>}
                      {self && <span>你</span>}
                    </header>
                    <dl>
                      <div>
                        <dt>现金</dt>
                        <dd>{player.cash} ₱</dd>
                      </div>
                      <div>
                        <dt>股份</dt>
                        <dd>{player.shareCount} 张</dd>
                      </div>
                      <div>
                        <dt>可用伙伴</dt>
                        <dd>{player.availableWorkers}</dd>
                      </div>
                      {income !== undefined && (
                        <div>
                          <dt>结算变动</dt>
                          <dd>
                            {income >= 0 ? '+' : ''}
                            {income} ₱
                          </dd>
                        </div>
                      )}
                      {score !== undefined && (
                        <div>
                          <dt>终局财富</dt>
                          <dd>
                            {score} ₱ · 第{rank}名
                          </dd>
                        </div>
                      )}
                    </dl>
                    <RevealedShares shares={player.revealedShares} />
                  </div>
                }
              >
                <span
                  className="mn-merchant-seat"
                  style={cargoStyle(seatColors[index]!)}
                  title={`${index + 1}号商人；对应同号伙伴棋子`}
                  aria-label={`${index + 1}号商人`}
                >
                  {index + 1}
                </span>
                <img
                  className="mn-merchant-avatar"
                  src={avatarFor(seat?.avatarId ?? 'avatar-1')}
                  alt=""
                />
                <strong className="mn-merchant-name">{name}</strong>
                <span className="mn-merchant-tags">
                  {game.phase === 'ended' && score !== undefined && (
                    <span className="mn-tag mn-tag--rank">
                      第{rank}名{game.winners.includes(id) ? ' ★' : ''}
                    </span>
                  )}
                  {master && (
                    <span className="mn-tag mn-tag--master">港务长</span>
                  )}
                  {active && (
                    <span className="mn-tag mn-tag--active">行动中</span>
                  )}
                  {self && <span className="mn-tag mn-tag--self">你</span>}
                </span>
                <span className="mn-merchant-assets">
                  <span
                    aria-label={`现金 ${player.cash} 比索`}
                    title={`现金 ${player.cash} 比索`}
                  >
                    <CopperMark kind="coin" />
                    <b>{player.cash}</b>
                  </span>
                  <span
                    aria-label={`股份 ${player.shareCount} 张`}
                    title={`股份 ${player.shareCount} 张`}
                  >
                    <CopperMark kind="shares" />
                    <b>{player.shareCount}</b>
                  </span>
                  <span
                    aria-label={`可用伙伴 ${player.availableWorkers} 人`}
                    title={`可用伙伴 ${player.availableWorkers} 人；棋子数字对应商人座号`}
                  >
                    <CopperMark kind="worker" />
                    <b>{player.availableWorkers}</b>
                  </span>
                </span>
              </DetailButton>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Players({
  game,
  seats,
  compact = false,
}: {
  game: ManilaView;
  seats: Seats;
  compact?: boolean;
}) {
  return (
    <section className="mn-panel mn-players-panel">
      <h2>商人</h2>
      <div className="mn-seats">
        {(game.phase === 'ended' && game.scores
          ? [...game.seatOrder].sort(
              (a, b) => game.scores![b]! - game.scores![a]!,
            )
          : game.seatOrder
        ).map((id) => {
          const index = game.seatOrder.indexOf(id);
          const rank = game.scores
            ? 1 +
              game.seatOrder.filter(
                (other) => game.scores![other]! > game.scores![id]!,
              ).length
            : null;
          const player = game.players[id]!;
          const seat = seats.find((entry) => entry.id === id);
          return (
            <article
              className={`mn-seat${game.turnSeat === id && !['round-result', 'ended'].includes(game.phase) ? ' mn-seat--current' : ''}`}
              key={id}
              data-seat-id={id}
              data-mn-player={id}
              data-mn-seat-number={index + 1}
              aria-label={
                game.phase === 'ended'
                  ? `${seat?.name ?? id}，${game.winners.includes(id) ? '赢家，' : ''}财富 ${game.scores?.[id]} 比索`
                  : undefined
              }
            >
              <div className="mn-seat-portrait">
                <img src={avatarFor(seat?.avatarId ?? 'avatar-1')} alt="" />
              </div>
              <div className="mn-seat-body">
                <strong className="mn-seat-heading mn-seat-identity">
                  <span
                    className="mn-seat-number"
                    style={cargoStyle(seatColors[index]!)}
                  >
                    {index + 1}
                  </span>
                  <span>{seat?.name ?? `商人${index + 1}`}</span>
                  {id === game.self?.seatId && (
                    <span className="mn-seat-role">你</span>
                  )}
                  {id === game.harborMaster && (
                    <span className="mn-seat-role">港务长</span>
                  )}
                  {game.turnSeat === id &&
                    !['round-result', 'ended'].includes(game.phase) && (
                      <span className="mn-seat-active">行动中</span>
                    )}
                </strong>
                <div className="mn-seat-meta mn-seat-assets">
                  <span className="mn-seat-asset">
                    <span>现金</span>
                    <strong>{player.cash} ₱</strong>
                  </span>
                  <span className="mn-seat-asset">
                    <span>股份</span>
                    <strong>{player.shareCount}</strong>
                  </span>
                  <span
                    className="mn-seat-asset"
                    title={compact ? '可用伙伴' : undefined}
                  >
                    <span>{compact ? '伙伴' : '可用伙伴'}</span>
                    <strong>{player.availableWorkers}</strong>
                  </span>
                </div>
                {(game.phase === 'round-result' || game.phase === 'ended') && (
                  <div
                    className={`mn-seat-result${game.phase === 'ended' && game.winners.includes(id) ? ' mn-seat-result--winner' : ''}`}
                  >
                    {game.phase === 'ended' ? (
                      <>
                        <span>
                          第{rank}名{game.winners.includes(id) ? ' ★' : ''}
                        </span>
                        <strong>财富 {game.scores?.[id]} ₱</strong>
                      </>
                    ) : game.phase === 'round-result' && game.result ? (
                      <>
                        <span>结算变动</span>
                        <strong>
                          {game.result.income[id]! >= 0 ? '+' : ''}
                          {game.result.income[id]} ₱
                        </strong>
                      </>
                    ) : null}
                  </div>
                )}
                {!compact && <RevealedShares shares={player.revealedShares} />}
              </div>
            </article>
          );
        })}
      </div>
      {compact && game.seatOrder.length < 5 && (
        <div className="mn-ledger-legend" aria-label="座号图例">
          {game.seatOrder.map((id, index) => (
            <span className="mn-ledger-legend-seat" key={id}>
              <i aria-hidden="true" style={cargoStyle(seatColors[index]!)}>
                {index + 1}
              </i>
              {seats.find((seat) => seat.id === id)?.name ?? `商人${index + 1}`}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
