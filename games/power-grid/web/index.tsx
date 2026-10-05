/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import '../ui/style.css';
import { useEffect, useState, type CSSProperties } from 'react';
import type { JsonValue } from '../../../packages/game-sdk/src';
import type { Action, PowerGridView } from '../types';
import { AuctionDisplay, PlantMarket, PlayerCompanies } from '../ui/components';
import { ResourceMarket } from '../ui/ResourceMarket';
import { IncomeCard } from '../ui/IncomeCard';
import { StageSection, PlantMarketSummary } from '../ui/StageSection';
import { PhonePages } from '../ui/PhonePages';
import '../ui/focus-layout.css';
import { TurnOrder } from '../ui/TurnOrder';
import { PHASE_LABELS, PLAYER_COLORS } from '../ui/labels';
import { PlayerControls } from '../ui/player';
import { GermanyMap } from '../ui/map';
import { PowerGridSoundControl, PowerGridSavedEffects } from '../ui/audio';
import {
  mapTerrain,
  plantImage,
} from '../../../assets/games/power-grid/catalog';
import { getPlant } from '../data/catalog';
import type { GameClient, GameHost as RoomSession } from '@tablemax/web-host';
import { ScreenLink } from '@tablemax/web-host';
import { SessionFeedback } from '@tablemax/web-host';
import { OverlayPanel } from '@tablemax/web-host';
import { RoomManagement } from '@tablemax/web-host';
import { FullscreenControl } from '@tablemax/web-host';
import { DisplaySettings } from '@tablemax/web-host';
import { PlayModeBadge } from '@tablemax/web-host';
import { PlayModeControl } from '@tablemax/web-host';
import { DecisionCountdown } from '@tablemax/web-host';
import { RulesGuide } from '@tablemax/web-host';
import { powerGridRulebook } from '../ui/RulesGuide';
import { avatarFor } from '@tablemax/web-host';
import { useAudioOutput } from '@tablemax/web-host';

function artFor(id: number): CSSProperties {
  const art = plantImage(getPlant(id).fuel, id);
  return {
    backgroundImage: `url(${art.url})`,
    backgroundPosition: art.position,
    backgroundSize: art.size,
  };
}

function PowerGridScreen({ session }: { session: RoomSession }) {
  const { role, view, connected, command, locked, canControl, motion } =
    session;
  const game = view?.gameView as PowerGridView | null;
  const canPlay = useAudioOutput();
  const [panel, setPanel] = useState<
    'menu' | 'map' | 'companies' | 'rules' | 'order' | null
  >(null);
  const [marketTab, setMarketTab] = useState<{
    phase: string;
    type: 'plants' | 'resources';
  }>({ phase: '', type: 'plants' });
  const [viewport, setViewport] = useState({
    scale: 1,
    offset: { x: 0, y: 0 },
  });
  const [city, setCity] = useState<string | null>(null);
  const [plant, setPlant] = useState<number | null>(null);
  const [detailSeat, setDetailSeat] = useState<string | null>(null);
  const [regionDraft, setRegionDraft] = useState<{
    token: string;
    regions: string[];
  } | null>(null);
  const regionToken = `${view?.instanceId}:${view?.branch}:${view?.selectionToken}`;
  const regionAction = (view?.actions as Action[] | undefined)?.find(
    (action) => action.type === 'select-regions',
  );
  const candidateRegions = regionAction
    ? regionDraft?.token === regionToken
      ? regionDraft.regions
      : regionAction.regions
    : undefined;
  const [sections, setSections] = useState<{
    phase: string;
    plants?: boolean;
    resources?: boolean;
    company?: boolean;
  }>({ phase: '' });
  const layoutPhase =
    game && (game.phase === 'offer' || game.phase === 'auction')
      ? 'auction'
      : (game?.phase ?? '');
  // Saved actions within a stage preserve reading position. A new stage or
  // replay starts at its context, without moving the map's own viewport.
  useEffect(() => {
    if (role === 'player') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [role, layoutPhase, view?.instanceId, view?.branch]);
  const sectionOpen = (
    name: 'plants' | 'resources' | 'company',
    fallback: boolean,
  ) =>
    sections.phase === layoutPhase ? (sections[name] ?? fallback) : fallback;
  const toggleSection = (
    name: 'plants' | 'resources' | 'company',
    fallback: boolean,
  ) =>
    setSections((previous) => ({
      ...(previous.phase === layoutPhase ? previous : {}),
      phase: layoutPhase,
      [name]: !(previous.phase === layoutPhase
        ? (previous[name] ?? fallback)
        : fallback),
    }));
  const showCompany = (seat: string | null = null) => {
    setDetailSeat(seat);
    setPanel('companies');
  };
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const portraits = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, avatarFor(seat.avatarId)]) ?? [],
  );
  const active =
    connected && view?.status === 'playing' && !view.paused && !view.botError;
  const ended = view?.status === 'ended';
  const feedbackDisabled =
    !connected ||
    Boolean(view?.paused || view?.botError) ||
    view?.playMode === 'test';
  const choose = (action: Action) => {
    if (view?.decisionId)
      command({
        type: 'game',
        decisionId: view.decisionId,
        action: action as JsonValue,
      });
  };
  const networks =
    game?.seatOrder.map((seatId, index) => ({
      seatId,
      cities: game.players[seatId]!.cities,
      color: PLAYER_COLORS[index]!,
      name: names[seatId] ?? '',
      seatNumber: index + 1,
    })) ?? [];
  const map = game && (
    <GermanyMap
      regions={
        candidateRegions ??
        (game.regions.length
          ? game.regions
          : ['north', 'northeast', 'northwest', 'southwest', 'east', 'south'])
      }
      previewRegions={candidateRegions !== undefined}
      networks={networks}
      selected={city}
      select={setCity}
      available={game.buildOptions.map((option) => option.cityId)}
      terrain={mapTerrain}
      phase={game.phase}
      step={game.step}
      actor={game.actor}
      role={role}
      viewport={viewport}
      onViewportChange={setViewport}
    />
  );
  const actor = active && game?.actor ? names[game.actor] : undefined;
  const ownTurn = actor && game?.actor === game?.self?.seatId;
  const shownMarket =
    marketTab.phase === layoutPhase
      ? marketTab.type
      : game?.phase === 'resources'
        ? 'resources'
        : 'plants';
  const plantDefault = false;
  const resourceDefault = false;
  const plantSection = game && (
    <StageSection
      name="plants"
      title="电厂市场"
      expanded={sectionOpen('plants', plantDefault)}
      toggle={() => toggleSection('plants', plantDefault)}
      summary={<PlantMarketSummary view={game} />}
    >
      <PlantMarket view={game} artFor={artFor} />
    </StageSection>
  );
  const resourceSection = game && (
    <StageSection
      name="resources"
      title="燃料市场"
      expanded={sectionOpen('resources', resourceDefault)}
      toggle={() => toggleSection('resources', resourceDefault)}
      summary={<ResourceMarket view={game} summary />}
    >
      <ResourceMarket view={game} compact={role === 'player'} />
    </StageSection>
  );
  const notice = !connected
    ? '正在重新连接'
    : view?.botError
      ? view.botError
      : view?.paused
        ? view.restored
          ? '存档已恢复，等待房主继续'
          : '游戏已暂停'
        : ended && game?.phase !== 'ended'
          ? view.endReason || '对局已结束'
          : '';
  const results = game?.phase === 'ended' && (
    <section className="pg-results">
      <h1>德国电网结算</h1>
      <div>
        {game.finalResults.map((result, index) => (
          <article
            key={result.seatId}
            className={
              game.winners.includes(result.seatId) ? 'pg-result-winner' : ''
            }
          >
            <span className="pg-result-rank">
              {game.winners.includes(result.seatId) ? '★' : index + 1}
            </span>
            <img src={portraits[result.seatId]} alt="" />
            <strong>{names[result.seatId]}</strong>
            <span>
              <b>⚡ {result.powered}</b> 城
            </span>
            <span>现金 {result.cash} E</span>
          </article>
        ))}
      </div>
      {canControl && (
        <button
          className="pg-primary"
          disabled={locked}
          onClick={() => command({ type: 'replay' })}
        >
          原班人马再玩一局
        </button>
      )}
    </section>
  );
  return (
    <main
      className={`pg-screen pg-screen--${role}${motion.length && view?.playMode !== 'test' ? ' pg-saved' : ''}`}
      data-phase={game?.phase}
      data-play-mode={view?.playMode ?? 'play'}
    >
      <header className="pg-toolbar">
        <ScreenLink className="pg-box-link" href={`/${role}`}>
          ‹ 盒子
        </ScreenLink>
        <strong className="pg-brand" aria-label="电力公司" title="电力公司">
          ⚡ <span className="pg-brand-name">电力公司</span>
          {role === 'player' && game && (
            <span className="pg-brand-round">
              {game.round}轮 · STEP {game.step}
            </span>
          )}
        </strong>
        {game && (
          <span className="pg-round">
            第 {game.round} 轮 <b>第 {game.step} 步</b>
          </span>
        )}
        {role !== 'player' && <FullscreenControl />}
        {role !== 'player' && <DisplaySettings />}
        <PlayModeBadge mode={view?.playMode} />
        {role !== 'player' && (
          <PowerGridSoundControl
            feedback={session.feedback}
            game={game}
            disabled={feedbackDisabled}
            canPlay={canPlay}
          />
        )}
        {role !== 'player' && (
          <button onClick={() => showCompany()}>各家</button>
        )}
        {game && game.phase !== 'regions' && game.phase !== 'ended' && (
          <button className="pg-order-entry" onClick={() => setPanel('order')}>
            顺序
          </button>
        )}
        <button
          className="game-rulebook-entry"
          onClick={() => setPanel('rules')}
        >
          规则
        </button>
        <button onClick={() => setPanel('menu')}>菜单</button>
      </header>
      {((session.message && session.message !== '已保存') ||
        session.admissionPending ||
        session.awaitingConfirmation) && <SessionFeedback session={session} />}
      {!game || !view ? (
        <div className="pg-unavailable">
          <h1>等待德国电网开局</h1>
          <ScreenLink href={`/${role}`}>回到盒子</ScreenLink>
        </div>
      ) : (
        <>
          <div className="pg-status-bar">
            <div>
              <strong>{PHASE_LABELS[game.phase]}</strong>
              {actor && (
                <span className={ownTurn ? 'pg-own-turn' : ''} title={actor}>
                  {ownTurn ? '轮到你' : actor}
                </span>
              )}
              {notice && <span role="status">{notice}</span>}
            </div>
            {game.self && !ended && (
              <strong className="pg-cash">现金 {game.self.cash} E</strong>
            )}
            {role !== 'player' && <IncomeCard view={game} />}
            <DecisionCountdown view={view} connected={connected} compact />
            {canControl && view.paused && !ended && (
              <button
                disabled={locked}
                onClick={() => command({ type: 'resume' })}
              >
                恢复游戏
              </button>
            )}
            {canControl && ended && game.phase !== 'ended' && (
              <button
                disabled={locked}
                onClick={() => command({ type: 'replay' })}
              >
                再玩一局
              </button>
            )}
          </div>
          {role !== 'player' && panel !== 'order' && (
            <TurnOrder
              view={game}
              names={names}
              active={Boolean(active)}
              compact={false}
            />
          )}
          {game.phase === 'ended' ? (
            results
          ) : role === 'player' ? (
            <PhonePages
              stage={layoutPhase + ':' + view.instanceId + ':' + view.branch}
              turn={Boolean(ownTurn)}
              blocked={Boolean(panel || detailSeat || notice)}
            >
              {(dock) => [
                <div key="action" className="pg-phone-table">
                  {['building', 'regions'].includes(game.phase) && (
                    <div className="pg-phone-map">{map}</div>
                  )}
                  {game.auction && (
                    <AuctionDisplay
                      view={game}
                      names={names}
                      artFor={artFor}
                      compact
                    />
                  )}
                  {active && view.actions.length > 0 ? (
                    <PlayerControls
                      key={
                        view.instanceId +
                        ':' +
                        view.branch +
                        ':' +
                        view.selectionToken
                      }
                      view={game}
                      actions={view.actions as Action[]}
                      locked={locked || !active}
                      choose={choose}
                      city={city}
                      selectCity={setCity}
                      selectedPlant={plant}
                      selectPlant={setPlant}
                      artFor={artFor}
                      dock={dock}
                      {...(candidateRegions
                        ? { regionSelection: candidateRegions }
                        : {})}
                      selectRegions={(regions) =>
                        setRegionDraft({ token: regionToken, regions })
                      }
                    />
                  ) : (
                    <div className="pg-waiting">
                      <strong>
                        {notice || (actor ? '等待 ' + actor : '等待下一步')}
                      </strong>
                      {game.latest && (
                        <span>
                          <b>
                            {game.latest.actor
                              ? names[game.latest.actor]
                              : '电网'}
                          </b>{' '}
                          {game.latest.text}
                        </span>
                      )}
                      <IncomeCard view={game} mobile />
                    </div>
                  )}
                  {game.phase === 'resources' && (
                    <ResourceMarket view={game} summary />
                  )}
                </div>,
                <div key="market">
                  <div
                    className="pg-market-tabs"
                    role="group"
                    aria-label="市场类型"
                  >
                    <button
                      aria-pressed={shownMarket === 'plants'}
                      onClick={() =>
                        setMarketTab({ phase: layoutPhase, type: 'plants' })
                      }
                    >
                      电厂
                    </button>
                    <button
                      aria-pressed={shownMarket === 'resources'}
                      onClick={() =>
                        setMarketTab({ phase: layoutPhase, type: 'resources' })
                      }
                    >
                      燃料
                    </button>
                  </div>
                  {shownMarket === 'plants' ? (
                    <PlantMarket view={game} artFor={artFor} />
                  ) : (
                    <ResourceMarket view={game} compact />
                  )}
                </div>,
                <div key="map" className="pg-phone-map pg-phone-map--browse">
                  {map}
                </div>,
                <PlayerCompanies
                  key="companies"
                  view={game}
                  names={names}
                  portraits={portraits}
                  active={Boolean(active)}
                  compact
                  onDetails={showCompany}
                />,
              ]}
            </PhonePages>
          ) : (
            <div className="pg-desktop-table">
              <div className="pg-board-stage pg-primary-stage">
                {['regions', 'building'].includes(game.phase) ? (
                  map
                ) : ['offer', 'auction'].includes(game.phase) ? (
                  <>
                    {game.auction && (
                      <AuctionDisplay
                        view={game}
                        names={names}
                        artFor={artFor}
                      />
                    )}
                    <PlantMarket view={game} artFor={artFor} />
                  </>
                ) : game.phase === 'resources' ? (
                  <ResourceMarket view={game} />
                ) : (
                  <PlayerCompanies
                    view={game}
                    names={names}
                    portraits={portraits}
                    active={Boolean(active)}
                    artFor={artFor}
                    {...(game.actor ? { onlySeat: game.actor } : {})}
                  />
                )}
              </div>
              <aside className="pg-desktop-market">
                {game.phase === 'building' && (
                  <section className="pg-building-companies">
                    <h2>公司电网</h2>
                    {networks.map((network) => (
                      <button
                        key={network.seatId}
                        onClick={() => showCompany(network.seatId)}
                        style={
                          {
                            '--pg-player-color': network.color,
                          } as CSSProperties
                        }
                        aria-current={
                          network.seatId === game.actor ? 'step' : undefined
                        }
                      >
                        <span className="pg-network-seat">
                          {network.seatNumber}
                        </span>
                        <strong title={network.name}>{network.name}</strong>
                        <span>{network.cities.length} 城</span>
                      </button>
                    ))}
                  </section>
                )}
                <button
                  className="pg-map-entry"
                  onClick={() => setPanel('map')}
                >
                  德国电网
                </button>
                <PlayerCompanies
                  view={game}
                  names={names}
                  portraits={portraits}
                  active={Boolean(active)}
                  compact
                  {...(game.actor ? { onlySeat: game.actor } : {})}
                  onDetails={showCompany}
                />
                {plantSection}
                {game.phase !== 'resources' && resourceSection}
                <div className="pg-short-companies">
                  <h2>公司概览</h2>
                  <PlayerCompanies
                    view={game}
                    names={names}
                    portraits={portraits}
                    active={Boolean(active)}
                    compact
                    onDetails={showCompany}
                  />
                </div>
                {game.latest && (
                  <div className="pg-latest" role="status">
                    <span>最新行动</span>
                    <strong>
                      {game.latest.actor ? names[game.latest.actor] : '电网'}
                    </strong>
                    <span>{game.latest.text}</span>
                  </div>
                )}
              </aside>
              <PlayerCompanies
                view={game}
                names={names}
                portraits={portraits}
                active={Boolean(active)}
                artFor={artFor}
                compact
                onDetails={showCompany}
              />
            </div>
          )}
        </>
      )}
      <PowerGridSavedEffects
        names={names}
        feedback={session.feedback}
        game={game}
        disabled={feedbackDisabled}
      />
      {panel && (
        <OverlayPanel
          title={
            panel === 'rules' ? (
              <>
                <span className="rules-guide__title-part">电力公司</span>
                <span className="rules-guide__title-part">图文规则</span>
              </>
            ) : panel === 'order' ? (
              '本轮行动顺序'
            ) : panel === 'map' ? (
              '德国电网'
            ) : panel === 'companies' ? (
              '各家电力公司'
            ) : (
              '电网菜单'
            )
          }
          close={() => setPanel(null)}
        >
          {panel === 'rules' ? (
            <RulesGuide {...powerGridRulebook} />
          ) : (
            <div className="pg-screen pg-panel">
              {panel === 'order' && game ? (
                <TurnOrder view={game} names={names} active={Boolean(active)} />
              ) : panel === 'map' ? (
                <div className="pg-panel-map">{map}</div>
              ) : panel === 'companies' && game ? (
                <PlayerCompanies
                  view={game}
                  names={names}
                  portraits={portraits}
                  active={Boolean(active)}
                  artFor={artFor}
                  {...(detailSeat ? { onlySeat: detailSeat } : {})}
                />
              ) : (
                <>
                  {role === 'player' && <FullscreenControl />}
                  {canControl && <RoomManagement session={session} />}
                  <h2>已保存的电网记录</h2>
                  <ol className="pg-log">
                    {[...(game?.history ?? [])].reverse().map((entry) => (
                      <li key={entry.id}>
                        <strong>
                          {entry.actor ? names[entry.actor] : '电网'}
                        </strong>
                        <span>{entry.text}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}
        </OverlayPanel>
      )}
      <PlayModeControl session={session} />
    </main>
  );
}

export const client: GameClient = {
  Screen: PowerGridScreen,
  savedChanges(before, after) {
    const previous = before as PowerGridView,
      next = after as PowerGridView;
    return previous.latest?.id !== next.latest?.id && next.latest
      ? [`power-grid:${next.latest.id}`]
      : [];
  },
  motionDuration: 450,
};
