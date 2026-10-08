/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import '../ui/style.css';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { JsonValue } from '../../../packages/game-sdk/src';
import type { Action, PowerGridView } from '../types';
import { AuctionDisplay, PlantMarket } from '../ui/components';
import { ResourceMarket } from '../ui/ResourceMarket';
import { IncomeCard } from '../ui/IncomeCard';
import { DesktopBoard } from '../ui/DesktopBoard';
import { CompanyCards } from '../ui/CompanyCards';
import { initialCamera, type MapCamera } from '../ui/map-camera';
import { PhonePages } from '../ui/PhonePages';
import '../ui/focus-layout.css';
import { BoardIcon } from '../ui/BoardIcon';
import { CompanyInspector } from '../ui/CompanyInspector';
import { GameProgress } from '../ui/GameProgress';
import '../ui/market-scrollbars.css';
import '../ui/toolbar-refinement.css';
import '../ui/player-wide.css';
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
    'menu' | 'map' | 'companies' | 'rules' | null
  >(null);
  const [marketTab, setMarketTab] = useState<{
    phase: string;
    type: 'plants' | 'resources';
  }>({ phase: '', type: 'plants' });
  const [suppressedFocus, setSuppressedFocus] = useState<string | null>(null);
  const [viewport, setViewport] = useState(initialCamera);
  const [city, setCity] = useState<string | null>(null);
  const [citySource, setCitySource] = useState<'manual' | 'saved'>('manual');
  const [selectionRequest, setSelectionRequest] = useState(0);
  const updateViewport = useCallback(
    (next: MapCamera) => {
      if (role !== 'player' && next.follow && !viewport.follow) {
        setCity(null);
        setSuppressedFocus(null);
      }
      setViewport(next);
    },
    [role, viewport.follow],
  );
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
  const layoutPhase =
    game && ['offer', 'auction', 'replace'].includes(game.phase)
      ? 'auction'
      : (game?.phase ?? '');
  useEffect(() => {
    if (role === 'player') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [role, layoutPhase, view?.instanceId, view?.branch]);
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
  const contextKey =
    String(view?.instanceId ?? '') + ':' + String(view?.branch ?? '');
  const currentFeedback =
    session.feedback?.instanceId === view?.instanceId &&
    session.feedback?.branch === view?.branch &&
    session.feedback?.revision === view?.revision
      ? session.feedback
      : null;
  const savedKey = currentFeedback
    ? contextKey + ':' + currentFeedback.revision
    : null;
  const [mapFeedback, setMapFeedback] = useState<{
    key: string | null;
    scope: string;
    focus: { scope: string; key: string; city: string } | null;
  }>({ key: savedKey, scope: '', focus: null });
  const focusScope = contextKey + ':' + layoutPhase + ':' + game?.actor;
  const selectMapCity = useCallback(
    (id: string) => {
      setCity(id || null);
      setCitySource('manual');
      setSuppressedFocus(id ? null : focusScope);
      if (!id) setMapFeedback((previous) => ({ ...previous, focus: null }));
      setSelectionRequest((value) => value + 1);
    },
    [focusScope],
  );
  useEffect(() => {
    if (!city) return;
    const outside = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (
        event.target
          .closest('dialog')
          ?.querySelector('[data-map-selection-preserve]')
      )
        return;
      if (
        event.target.closest(
          '.pg-map-panel,[data-map-selection-preserve],.pg-build-controls select,.pg-build-preview .pg-primary',
        )
      )
        return;
      selectMapCity('');
    };
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('dialog[open]')
      )
        selectMapCity('');
    };
    document.addEventListener('click', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [city, selectMapCity]);
  if (mapFeedback.scope !== focusScope) {
    setMapFeedback({ key: savedKey, scope: focusScope, focus: null });
    if (role !== 'player' && viewport.follow && city !== null) setCity(null);
  }
  const followBuild =
    role !== 'player' &&
    currentFeedback?.events.some((event) => event.action?.verb === 'build') &&
    game?.latest?.verb === 'build'
      ? game.latest.cityId
      : null;
  if (savedKey && savedKey !== mapFeedback.key) {
    if (suppressedFocus !== null) setSuppressedFocus(null);
    setMapFeedback({
      key: savedKey,
      scope: focusScope,
      focus:
        followBuild && !feedbackDisabled
          ? { scope: focusScope, key: savedKey, city: followBuild }
          : mapFeedback.focus,
    });
    if (followBuild && !feedbackDisabled) {
      setCity(followBuild);
      setCitySource('saved');
    }
  }
  const savedMapFocus = mapFeedback.focus;
  const mapFocus = game
    ? city
      ? { key: 'selected:' + city, cities: [city] }
      : suppressedFocus === focusScope
        ? undefined
        : savedMapFocus?.scope === focusScope
          ? { key: savedMapFocus.key, cities: [savedMapFocus.city] }
          : {
              key:
                layoutPhase + ':' + game.actor + ':' + game.regions.join(','),
              ...(game.phase === 'building' &&
              game.actor &&
              game.players[game.actor]!.cities.length
                ? { cities: game.players[game.actor]!.cities }
                : { regions: candidateRegions ?? game.regions }),
            }
    : undefined;
  const mapProps = game
    ? {
        regions:
          candidateRegions ??
          (game.regions.length
            ? game.regions
            : [
                'north',
                'northeast',
                'northwest',
                'southwest',
                'east',
                'south',
              ]),
        previewRegions: candidateRegions !== undefined,
        networks,
        selected: city,
        select: selectMapCity,
        selectionRequest,
        selectionColor:
          role === 'player'
            ? (PLAYER_COLORS[game.seatOrder.indexOf(game.self?.seatId ?? '')] ??
              '#167b85')
            : citySource === 'saved'
              ? (PLAYER_COLORS[
                  game.seatOrder.indexOf(game.latest?.actor ?? '')
                ] ?? '#167b85')
              : '#167b85',
        available: game.buildOptions.map((option) => option.cityId),
        terrain: mapTerrain,
        phase: game.phase,
        step: game.step,
        actor: game.actor,
        role,
        viewport,
        onViewportChange: updateViewport,
        contextKey,
        ...(role !== 'player' && mapFocus
          ? { focus: mapFocus }
          : city
            ? { focus: { key: 'selected:' + city, cities: [city] } }
            : {}),
        animateFocus: !feedbackDisabled,
      }
    : null;
  const map = mapProps && <GermanyMap {...mapProps} />;
  const actor = active && game?.actor ? names[game.actor] : undefined;
  const ownTurn = actor && game?.actor === game?.self?.seatId;
  const shownMarket =
    marketTab.phase === layoutPhase
      ? marketTab.type
      : game?.phase === 'resources'
        ? 'resources'
        : 'plants';
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
      <header className="pg-toolbar pg-toolbar--grouped">
        <ScreenLink className="pg-box-link" href={`/${role}`}>
          ‹ 盒子
        </ScreenLink>
        <strong className="pg-brand" aria-label="电力公司" title="电力公司">
          ⚡ <span className="pg-brand-name">电力公司</span>
          {role === 'player' && game && (
            <span className="pg-brand-round">
              {game.round}轮 第{game.step}阶段
            </span>
          )}
        </strong>
        {game && role !== 'player' && (
          <div
            className="pg-turn-heading"
            data-current-actor={game.actor ?? ''}
            style={
              {
                '--pg-actor-color':
                  PLAYER_COLORS[game.seatOrder.indexOf(game.actor ?? '')] ??
                  '#167b85',
              } as CSSProperties
            }
          >
            <span className="pg-stage-label">{PHASE_LABELS[game.phase]}</span>
            {actor && (
              <strong className="pg-actor-name" title={actor}>
                {actor}
              </strong>
            )}
          </div>
        )}
        {game && (
          <span className="pg-round">
            第 {game.round} 轮 <b>第{game.step}阶段</b>
          </span>
        )}
        {role !== 'player' && view && (
          <DecisionCountdown view={view} connected={connected} compact />
        )}
        {role !== 'player' && <FullscreenControl />}
        <DisplaySettings role={role} />
        <div className="pg-toolbar-tools">
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
            <button
              className="pg-company-inspect-entry"
              aria-label="查看各家公司"
              title="查看各家公司"
              onClick={() => showCompany()}
            >
              <BoardIcon name="search" />
            </button>
          )}
          <button
            className="game-rulebook-entry"
            onClick={() => setPanel('rules')}
          >
            规则
          </button>
          <button onClick={() => setPanel('menu')}>菜单</button>
        </div>
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
          {(role === 'player' || notice) && (
            <div className="pg-status-bar">
              <div>
                {role === 'player' && (
                  <strong>{PHASE_LABELS[game.phase]}</strong>
                )}
                {role === 'player' && actor && (
                  <span className={ownTurn ? 'pg-own-turn' : ''} title={actor}>
                    {ownTurn ? '轮到你' : actor}
                  </span>
                )}
                {notice && <span role="status">{notice}</span>}
              </div>
              {game.self && !ended && (
                <strong className="pg-cash">现金 {game.self.cash} E</strong>
              )}
              {role === 'player' && (
                <DecisionCountdown view={view} connected={connected} compact />
              )}
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
          )}
          {role !== 'player' && <GameProgress view={game} names={names} />}
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
                  <GameProgress view={game} names={names} mobile />
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
                      selectCity={selectMapCity}
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
                <CompanyCards
                  artFor={artFor}
                  key="companies"
                  view={game}
                  names={names}
                  portraits={portraits}
                  active={Boolean(active)}
                  onDetails={showCompany}
                  savedKey={savedKey}
                  contextKey={contextKey}
                  animate={!feedbackDisabled}
                />,
              ]}
            </PhonePages>
          ) : (
            <DesktopBoard
              view={game}
              names={names}
              portraits={portraits}
              active={Boolean(active)}
              mapProps={mapProps!}
              artFor={artFor}
              contextKey={contextKey}
              savedKey={savedKey}
              animate={!feedbackDisabled}
              onDetails={showCompany}
            />
          )}
        </>
      )}
      <PowerGridSavedEffects
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
              {panel === 'map' ? (
                <div className="pg-panel-map">{map}</div>
              ) : panel === 'companies' && game ? (
                <CompanyInspector
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
