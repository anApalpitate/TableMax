import type { CSSProperties } from 'react';
import type { PowerGridView } from '../types';
import { PLAYER_COLORS } from './labels';
import { BoardIcon } from './BoardIcon';
import './game-progress.css';

/** The original city-count track; Step is independent of the five round phases. */
export function GameProgress({
  view,
  names,
  mobile = false,
}: {
  view: PowerGridView;
  names: Record<string, string>;
  mobile?: boolean;
}) {
  const maximum = Math.max(
    view.endThreshold,
    ...Object.values(view.players).map((player) => player.cities.length),
  );
  const leader = Math.max(
    0,
    ...Object.values(view.players).map((player) => player.cities.length),
  );
  const Container = mobile ? 'details' : 'section';
  const Heading = mobile ? 'summary' : 'div';
  return (
    <Container className="pg-game-progress" data-game-step={view.step}>
      <Heading
        className="pg-progress-heading"
        title={`第二阶段：建城结束后有人达到${view.step2Threshold}块地皮；第三阶段由第三步牌触发；终局门槛${view.endThreshold}块地皮`}
      >
        <span>
          <strong>地皮进度</strong>
          <span className="pg-progress-gates">
            二阶段 {view.step2Threshold} · 终局 {view.endThreshold}
          </span>
        </span>
        <span className="pg-progress-mobile">
          {leader} / {view.endThreshold}
        </span>
        <BoardIcon name="down" />
      </Heading>
      <div className="pg-progress-scroll" data-swipe-lock>
        <ol
          style={{ '--pg-progress-columns': maximum + 1 } as CSSProperties}
          aria-label="各公司已建地皮数量"
        >
          {Array.from({ length: maximum + 1 }, (_, count) => (
            <li
              key={count}
              data-land-count={count}
              className={`${count === view.step2Threshold ? 'pg-progress-step2' : ''} ${count === view.endThreshold ? 'pg-progress-end' : ''}`}
              title={
                count === view.step2Threshold
                  ? `第二阶段门槛：${count}块地皮`
                  : count === view.endThreshold
                    ? `终局门槛：${count}块地皮`
                    : `${count}块地皮`
              }
            >
              <span>{count}</span>
              <div className="pg-progress-markers">
                {view.playerOrder
                  .filter((seat) => view.players[seat]!.cities.length === count)
                  .map((seat) => (
                    <span
                      key={seat}
                      data-progress-player={seat}
                      title={`${names[seat] ?? seat}：${count}块地皮`}
                      aria-label={`${names[seat] ?? seat}：${count}块地皮`}
                      style={
                        {
                          '--pg-progress-color':
                            PLAYER_COLORS[view.seatOrder.indexOf(seat)],
                        } as CSSProperties
                      }
                    />
                  ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Container>
  );
}
