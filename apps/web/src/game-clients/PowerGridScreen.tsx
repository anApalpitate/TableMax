/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import { useState, type CSSProperties } from 'react';
import type { JsonValue } from '../../../../packages/game-sdk/src';
import type { Action, PowerGridView } from '../../../../games/power-grid/types';
import {
  AuctionDisplay,
  PlantMarket,
  PlayerCompanies,
} from '../../../../games/power-grid/ui/components';
import { ResourceMarket } from '../../../../games/power-grid/ui/ResourceMarket';
import { TurnOrder } from '../../../../games/power-grid/ui/TurnOrder';
import {
  PHASE_LABELS,
  PLAYER_COLORS,
} from '../../../../games/power-grid/ui/labels';
import { PlayerControls } from '../../../../games/power-grid/ui/player';
import { GermanyMap } from '../../../../games/power-grid/ui/map';
import {
  PowerGridSoundControl,
  PowerGridSavedEffects,
} from '../../../../games/power-grid/ui/audio';
import {
  mapTerrain,
  plantImage,
} from '../../../../assets/games/power-grid/catalog';
import { getPlant } from '../../../../games/power-grid/data/catalog';
import '../../../../games/power-grid/ui/style.css';
import type { GameClient } from './registry';
import type { RoomSession } from '../session/useRoomSession';
import { ScreenLink } from '../components/ScreenLink';
import { SessionFeedback } from '../components/SessionFeedback';
import { OverlayPanel } from '../components/OverlayPanel';
import { RoomManagement } from '../components/RoomManagement';
import { FullscreenControl } from '../components/FullscreenControl';
import { DisplaySettings } from '../components/DisplaySettings';
import { PlayModeBadge } from '../components/PlayModeBadge';
import { PlayModeControl } from '../components/PlayModeControl';
import { DecisionCountdown } from '../components/DecisionCountdown';
import { RulesGuide } from '../components/RulesGuide';
import { powerGridRulebook } from '../../../../games/power-grid/ui/RulesGuide';
import { avatarFor } from '../assets/avatars';
import { useAudioOutput } from '../session/useAudioOutput';

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
    'menu' | 'map' | 'companies' | 'market' | 'rules' | 'order' | null
  >(null);
  const [city, setCity] = useState<string | null>(null);
  const [plant, setPlant] = useState<number | null>(null);
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
    })) ?? [];
  const map = game && (
    <GermanyMap
      regions={
        game.regions.length
          ? game.regions
          : ['north', 'northeast', 'northwest', 'southwest', 'east', 'south']
      }
      networks={networks}
      selected={city}
      select={setCity}
      available={game.buildOptions.map((option) => option.cityId)}
      terrain={mapTerrain}
    />
  );
  const actor = active && game?.actor ? names[game.actor] : undefined;
  const ownTurn = actor && game?.actor === game?.self?.seatId;
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
            <span>{result.cash} E</span>
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
        </strong>
        {game && (
          <span className="pg-round">
            第 {game.round} 轮 <b>第 {game.step} 步</b>
          </span>
        )}
        <FullscreenControl />
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
          <button onClick={() => setPanel('companies')}>各家</button>
        )}
        {role !== 'player' &&
          game &&
          game.phase !== 'regions' &&
          game.phase !== 'ended' && (
            <button
              className="pg-order-entry"
              onClick={() => setPanel('order')}
            >
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
          {panel !== 'order' && (
            <TurnOrder
              view={game}
              names={names}
              active={Boolean(active)}
              compact={role === 'player'}
            />
          )}
          {game.phase === 'ended' ? (
            results
          ) : role === 'player' ? (
            <div className="pg-phone-table">
              {game.phase === 'building' && (
                <div className="pg-phone-map">{map}</div>
              )}
              {(game.phase === 'auction' || game.phase === 'offer') &&
                game.auction && (
                  <AuctionDisplay
                    view={game}
                    names={names}
                    artFor={artFor}
                    compact
                  />
                )}
              {game.phase === 'resources' && (
                <ResourceMarket view={game} compact />
              )}
              {active && view.actions.length > 0 ? (
                <PlayerControls
                  key={`${view.instanceId}:${view.branch}:${view.selectionToken}`}
                  view={game}
                  actions={view.actions as Action[]}
                  locked={locked || !active}
                  choose={choose}
                  city={city}
                  selectCity={setCity}
                  selectedPlant={plant}
                  selectPlant={setPlant}
                  artFor={artFor}
                />
              ) : (
                <div className="pg-waiting">
                  <span className="pg-electric-symbol" aria-hidden="true">
                    ϟ
                  </span>
                  <strong>
                    {notice || (actor ? `等待 ${actor}` : '等待下一步')}
                  </strong>
                  {game.latest && <span>{game.latest.text}</span>}
                </div>
              )}
              <div className="pg-phone-tools">
                <button onClick={() => setPanel('map')}>德国地图</button>
                <button onClick={() => setPanel('companies')}>各家公司</button>
                <button onClick={() => setPanel('market')}>电厂市场</button>
              </div>
            </div>
          ) : (
            <div className="pg-desktop-table">
              <div className="pg-board-stage">
                {map}
                <div className="pg-board-stamp">
                  <strong>DEUTSCHLAND</strong>
                  <span>德国电力网络</span>
                </div>
              </div>
              <aside className="pg-desktop-market">
                {game.auction && (
                  <AuctionDisplay view={game} names={names} artFor={artFor} />
                )}
                {game.phase === 'resources' && <ResourceMarket view={game} />}
                <PlantMarket view={game} artFor={artFor} />
                {game.phase !== 'resources' && <ResourceMarket view={game} />}
                {game.latest && (
                  <div className="pg-latest" role="status">
                    <span>最新行动</span>
                    <strong>{game.latest.text}</strong>
                  </div>
                )}
              </aside>
              <PlayerCompanies
                view={game}
                names={names}
                portraits={portraits}
                active={Boolean(active)}
                artFor={artFor}
              />
            </div>
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
            ) : panel === 'order' ? (
              '本轮行动顺序'
            ) : panel === 'map' ? (
              '德国电网'
            ) : panel === 'companies' ? (
              '各家电力公司'
            ) : panel === 'market' ? (
              '电厂市场'
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
                />
              ) : panel === 'market' && game ? (
                <>
                  <PlantMarket view={game} artFor={artFor} />
                  <ResourceMarket view={game} />
                </>
              ) : (
                <>
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
