import { useEffect, useRef, useState } from 'react';
import type { Action } from '../../rules';
import type { PokerView } from '../view';
import { kinds, names as labels, type Kind } from '../../rules/cards';
import { Card, Critter } from '../Theme';
import { PlayerBadge } from '../public';
export function PlayerControls({
  game,
  actions,
  disabled,
  choose,
  names,
  avatars = {},
}: {
  game: PokerView;
  actions: Action[];
  disabled: boolean;
  choose(a: Action): void;
  names: Record<string, string>;
  avatars?: Record<string, string>;
}) {
  const [card, setCard] = useState<number | null>(null),
    [target, setTarget] = useState(''),
    [claim, setClaim] = useState<Kind | null>(null);
  const selecting = actions.some(
    (a) => a.type === 'offer' || a.type === 'pass',
  );
  const passing = game.offer?.passing ?? false;
  const candidate: Action | null =
    target && claim && (passing || card !== null)
      ? passing
        ? { type: 'pass', target, claim }
        : { type: 'offer', target, claim, card: card! }
      : null;
  const allowed =
    !!candidate &&
    actions.some((a) =>
      Object.keys(a).every(
        (k) =>
          (a as unknown as Record<string, unknown>)[k] ===
          (candidate as unknown as Record<string, unknown>)[k],
      ),
    );
  const targets = [
    ...new Set(
      actions.flatMap((a) =>
        a.type === 'offer' || a.type === 'pass' ? [a.target] : [],
      ),
    ),
  ];
  const known = game.offer?.knownCard;
  const hand = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = hand.current;
    if (!element) return;
    const measure = () =>
      setOverflow(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [game.ownHand.length]);
  return (
    <section
      className={`cp-controls ${selecting ? 'cp-composing' : ''}`}
      aria-label="本人操作"
    >
      {selecting && (
        <div className="cp-composer">
          <fieldset className="cp-targets">
            <legend className="cp-sr">交给谁</legend>
            {targets.map((id) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                aria-pressed={target === id}
                aria-label={`交给${names[id]}`}
                onClick={() => setTarget(id)}
              >
                <PlayerBadge name={names[id]} avatar={avatars[id]} />
              </button>
            ))}
          </fieldset>
          <fieldset className="cp-claim-picker">
            <legend className="cp-sr">声明是什么</legend>
            <div className="cp-claims">
              {kinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={disabled}
                  aria-pressed={claim === kind}
                  aria-label={labels[kind]}
                  title={labels[kind]}
                  onClick={() => setClaim(kind)}
                >
                  <Critter kind={kind} />
                </button>
              ))}
            </div>
          </fieldset>
          <div className="cp-draft-preview" aria-label="传牌确认">
            <span
              className="cp-preview-card"
              aria-label={passing && known != null ? '你已看过此牌' : undefined}
            >
              {passing && known != null ? (
                <Card card={known} />
              ) : card !== null ? (
                <Card card={card} />
              ) : (
                <span aria-hidden="true">▤</span>
              )}
            </span>
            <span className="cp-arrow" aria-hidden="true">
              →
            </span>
            {target ? (
              <PlayerBadge name={names[target]} avatar={avatars[target]} />
            ) : (
              <span className="cp-empty-choice" aria-label="尚未选择接收者">
                ?
              </span>
            )}
            {claim && (
              <span className="cp-preview-claim">
                <Critter kind={claim} />
              </span>
            )}
            <button
              type="button"
              className="cp-confirm"
              disabled={disabled || !allowed}
              aria-label={
                target && claim
                  ? `向 ${names[target]} 声明“${labels[claim]}”`
                  : '传出'
              }
              onClick={() => candidate && choose(candidate)}
            >
              传出 <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      )}
      {actions.some((a) => a.type === 'judge') && (
        <div className="cp-judgments">
          <button
            disabled={disabled}
            onClick={() => choose({ type: 'judge', belief: true })}
          >
            <span aria-hidden="true">✓</span>
            <strong>相信</strong>
          </button>
          <button
            disabled={disabled}
            onClick={() => choose({ type: 'judge', belief: false })}
          >
            <span aria-hidden="true">✕</span>
            <strong>质疑</strong>
          </button>
          {actions.some((a) => a.type === 'peek') && (
            <button
              className="cp-peek"
              disabled={disabled}
              onClick={() => choose({ type: 'peek' })}
              title="查看后必须转传"
            >
              <span aria-hidden="true">↝</span>
              <strong>看后转传</strong>
            </button>
          )}
        </div>
      )}
      {known != null && !selecting && (
        <div className="cp-known" aria-label="你已看过此牌">
          <Card card={known} />
          <span aria-hidden="true">◉</span>
        </div>
      )}
      <div className="cp-hand-heading">
        <h2>{actions.length ? '轮到你' : '你的手牌'}</h2>
        <span
          className={overflow ? 'cp-hand-hint' : 'cp-hand-count'}
          aria-label={overflow ? '横向浏览手牌' : '手牌张数'}
        >
          ↔ {game.ownHand.length}
        </span>
      </div>
      <div className="cp-hand" ref={hand} aria-label="本人手牌">
        {kinds
          .flatMap((kind) =>
            game.ownHand.filter(
              (c) => Math.floor(c / 8) === kinds.indexOf(kind),
            ),
          )
          .map((c) => (
            <button
              type="button"
              key={c}
              disabled={disabled || !actions.some((a) => a.type === 'offer')}
              aria-pressed={card === c}
              onClick={() => setCard(c)}
            >
              <Card card={c} />
            </button>
          ))}
      </div>
    </section>
  );
}
