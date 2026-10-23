import type { ReactNode } from 'react';
import type { PokerView } from '../view';
import { kinds, kindOf, names } from '../../rules/cards';
import { Back, Card, Critter } from '../Theme';
export function PlayerBadge({
  name = '玩家',
  avatar,
  active = false,
}: {
  name?: string | undefined;
  avatar?: string | undefined;
  active?: boolean;
}) {
  return (
    <span className={`cp-person ${active ? 'cp-person-active' : ''}`}>
      <span className="cp-avatar">
        {avatar ? <img src={avatar} alt="" /> : name.slice(0, 1)}
      </span>
      <strong title={name}>{name}</strong>
    </span>
  );
}
export function Table({
  game,
  names: players,
  avatars = {},
  children,
}: {
  game: PokerView;
  names: Record<string, string>;
  avatars?: Record<string, string>;
  children?: ReactNode;
}) {
  const offer = game.offer,
    actor = offer?.target ?? game.turn;
  return (
    <div className="cp-table-layout">
      <section className="cp-stage" aria-label="当前传牌">
        <span className="cp-table-stamp" aria-hidden="true">
          ✦
        </span>
        <div className="cp-stage-heading">
          <span className="cp-state-label">
            {game.loser
              ? '本局结束'
              : offer
                ? offer.passing
                  ? '转传'
                  : '接牌'
                : '出牌'}
          </span>
          <PlayerBadge
            name={players[actor] ?? actor}
            avatar={avatars[actor]}
            active={!game.loser}
          />
        </div>
        {game.loser ? (
          <div className="cp-ending">
            <span className="cp-trophy" aria-hidden="true">
              ✧
            </span>
            <h2>{game.winners.length > 1 ? '共同获胜' : '获胜'}</h2>
            <div className="cp-winners">
              {game.winners.map((id) => (
                <PlayerBadge key={id} name={players[id]} avatar={avatars[id]} />
              ))}
            </div>
            <p>{players[game.loser]} 本局失利</p>
          </div>
        ) : offer ? (
          <div className="cp-exchange">
            <PlayerBadge
              name={players[offer.sender]}
              avatar={avatars[offer.sender]}
            />
            <span className="cp-arrow" aria-hidden="true">
              →
            </span>
            <div className="cp-inflight">
              <Back />
              <span
                className="cp-claim-bubble"
                aria-label={`声称${names[offer.claim]}`}
              >
                <Critter kind={offer.claim} />
                <span>声称</span>
              </span>
            </div>
            <span className="cp-arrow" aria-hidden="true">
              →
            </span>
            <PlayerBadge
              name={players[offer.target]}
              avatar={avatars[offer.target]}
            />
          </div>
        ) : (
          <div className={`cp-opening ${game.last ? 'cp-last' : ''}`}>
            {game.last ? (
              <>
                <Card card={game.last.card} />
                <span className="cp-arrow" aria-hidden="true">
                  →
                </span>
                <PlayerBadge
                  name={players[game.last.collector]}
                  avatar={avatars[game.last.collector]}
                />
              </>
            ) : (
              <Back />
            )}
          </div>
        )}
        {offer && (
          <details className="cp-route">
            <summary aria-label="流转记录">
              ↝ <span>{offer.route.length}</span>
            </summary>
            <div className="cp-route-nodes">
              {offer.route.map((r, i) => (
                <span key={i}>
                  {players[r.sender]} → {players[r.target]}{' '}
                  <Critter kind={r.claim} />
                </span>
              ))}
            </div>
          </details>
        )}
      </section>
      {children}
      <section className="cp-players" aria-label="公开收牌区">
        {game.seats.map((id) => (
          <article
            key={id}
            className={`cp-seat ${actor === id && !game.loser ? 'cp-active' : ''}`}
          >
            <div className="cp-seat-heading">
              <PlayerBadge
                name={players[id]}
                avatar={avatars[id]}
                active={actor === id && !game.loser}
              />
              <span
                className="cp-seat-stats"
                aria-label={`手牌${game.handCounts[id]}张`}
              >
                <span aria-hidden="true">▤</span> {game.handCounts[id]}
              </span>
            </div>
            <div className="cp-collection">
              {!game.piles[id]!.length && (
                <span className="cp-empty-collection" aria-label="尚未收牌">
                  —
                </span>
              )}
              {kinds.map((kind) => {
                const cards = game.piles[id]!.filter(
                  (card) => kindOf(card) === kind,
                );
                return (
                  <div
                    key={kind}
                    className={`cp-species-pile ${cards.length >= game.threshold - 1 ? 'cp-danger' : ''} ${cards.length ? 'cp-occupied' : ''}`}
                    aria-label={`${names[kind]}${cards.length}/${game.threshold}`}
                  >
                    {cards.length ? (
                      <div className="cp-pile-faces">
                        {cards.map((card) => (
                          <Card key={card} card={card} />
                        ))}
                      </div>
                    ) : (
                      <Critter kind={kind} />
                    )}
                    <span className="cp-pile-count">{cards.length || '–'}</span>
                    <span className="cp-risk-track" aria-hidden="true">
                      {Array.from({ length: game.threshold }, (_, i) => (
                        <i
                          key={i}
                          className={i < cards.length ? 'cp-filled' : ''}
                        />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
