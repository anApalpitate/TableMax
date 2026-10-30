import { resultRows } from './settlement-model';
import { useState } from 'react';
import type { PokemonView } from '../rules/project';
import type { TableSeat } from './table';
import { SeatResult } from './public';
import { WinTrack } from './WinTrack';
import { SavedEffects } from './effects';
import './settlement.css';

type Props = {
  game: PokemonView;
  seats: readonly TableSeat[];
  selfId: string | null;
  player: boolean;
  layout: 'H' | 'P' | 'L';
  locked: boolean;
  nextRound?: (() => void) | undefined;
  playAgain?: (() => void) | undefined;
  showHistory: () => void;
};
export function Settlement(props: Props) {
  const { game, seats, selfId, player, layout } = props;
  const [selected, setSelected] = useState(selfId ?? seats[0]!.id);
  const rows = resultRows(game, seats),
    current = rows.find((s) => s.id === selected) ?? rows[0]!;
  const winners = rows.filter((s) =>
    game.matchWinners.length ? s.matchWinner : s.roundWinner,
  );
  const header = (
    <header className="settlement-heading round-banner">
      <div>
        <p className="eyebrow">
          {game.matchWinners.length
            ? '三胜达成 · 大局结束'
            : `第 ${game.roundNumber} 小局 · 最低分获胜`}
        </p>
        <h2>
          <span className="winner-emblem" aria-hidden="true">
            {game.matchWinners.length ? '♛' : '✦'}
          </span>{' '}
          {winners.length === 1
            ? winners[0]!.name
            : `${winners.length} 位朋友共同获胜`}
        </h2>
      </div>
      <div className="settlement-winners">
        {winners.map((s) => (
          <img key={s.id} src={s.portrait} alt={s.name} />
        ))}
      </div>
      <button className="secondary" onClick={props.showHistory}>
        记录
      </button>
    </header>
  );
  const continuation = (
    <footer className="settlement-continuation">
      {props.nextRound ? (
        <button disabled={props.locked} onClick={props.nextRound}>
          开始下一局
        </button>
      ) : props.playAgain ? (
        <button disabled={props.locked} onClick={props.playAgain}>
          再玩一局
        </button>
      ) : (
        <p>等待{game.matchWinners.length ? '开始新大局' : '开始下一局'}</p>
      )}
    </footer>
  );
  const card = (s: typeof current) => (
    <article
      key={s.id}
      className={`settlement-card settlement-seat ${s.roundWinner ? 'winner' : ''}`}
      data-seat={s.id}
    >
      <header>
        <img src={s.portrait} alt="" />
        <div>
          <h3>
            {s.name}
            {s.id === selfId ? ' · 你' : ''}
          </h3>
          <span
            className="settlement-place"
            data-rank={s.rank}
            title={`第 ${s.rank} 名${s.matchWinner ? ' · 大局赢家' : s.roundWinner ? ' · 本局获胜' : ''}`}
          >
            第 {s.rank} 名
            {s.matchWinner ? ' · 大局赢家' : s.roundWinner ? ' · 本局获胜' : ''}
          </span>
        </div>
        <WinTrack
          wins={game.winsBySeat[s.id] ?? 0}
          winner={s.matchWinner ? 'match' : s.roundWinner ? 'round' : undefined}
        />
      </header>
      <SeatResult view={game} seatId={s.id} />
    </article>
  );
  const roster = (
    <nav className="settlement-roster" aria-label="查看各玩家终局牌阵">
      {[...rows]
        .sort(
          (a, b) =>
            a.score - b.score ||
            seats.findIndex((s) => s.id === a.id) -
              seats.findIndex((s) => s.id === b.id),
        )
        .map((s) => (
          <button
            className="secondary"
            key={s.id}
            aria-pressed={s.id === current.id}
            title={s.name}
            onClick={(e) => {
              setSelected(s.id);
              e.currentTarget.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
              });
            }}
          >
            <span className="settlement-rank">{s.rank}</span>
            <span className="settlement-roster-name">
              {s.name}
              <small>
                {s.matchWinner
                  ? '大局赢家'
                  : s.roundWinner
                    ? '本局获胜'
                    : `${game.winsBySeat[s.id] ?? 0} 胜`}
              </small>
            </span>
            <strong>
              {s.score}
              <small>分</small>
            </strong>
          </button>
        ))}
    </nav>
  );
  const content = {
    header,
    continuation,
    roster,
    boards: rows.map(card),
    board: card(current),
  };
  return (
    <section
      className={`settlement result-table settlement-${player ? layout : 'H'}`}
      data-count={seats.length}
      aria-label="终局成绩与牌阵"
    >
      <SavedEffects game={game} />
      {!player ? (
        <HostResults {...content} />
      ) : layout === 'L' ? (
        <LandscapeResults {...content} />
      ) : (
        <PortraitResults {...content} />
      )}
    </section>
  );
}
type Content = {
  header: React.ReactNode;
  continuation: React.ReactNode;
  roster: React.ReactNode;
  boards: React.ReactNode;
  board: React.ReactNode;
};
function HostResults({ header, continuation, boards }: Content) {
  return (
    <>
      <div className="settlement-top">
        {header}
        {continuation}
      </div>
      <div className="settlement-boards">{boards}</div>
    </>
  );
}
function LandscapeResults({ header, continuation, roster, board }: Content) {
  return (
    <>
      <aside className="settlement-sidebar">
        {header}
        {roster}
        {continuation}
      </aside>
      <div className="settlement-selected">{board}</div>
    </>
  );
}
function PortraitResults({ header, continuation, roster, board }: Content) {
  return (
    <>
      {header}
      {roster}
      <div className="settlement-selected">{board}</div>
      {continuation}
    </>
  );
}
