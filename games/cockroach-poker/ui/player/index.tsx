import { useEffect, useRef, useState } from 'react';
import type { Action } from '../../rules';
import type { PokerView } from '../view';
import { kinds, names as labels, type Kind } from '../../rules/cards';
import { Card, Critter } from '../Theme';
export function PlayerControls({
  game,
  actions,
  disabled,
  choose,
  names,
}: {
  game: PokerView;
  actions: Action[];
  disabled: boolean;
  choose(a: Action): void;
  names: Record<string, string>;
}) {
  const [card, setCard] = useState<number | null>(null);
  const [target, setTarget] = useState('');
  const [claim, setClaim] = useState<Kind | null>(null);
  const hand = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const element = hand.current;
    if (!element) return;
    const measure = () =>
      setOverflow(element.scrollWidth > element.clientWidth + 1);
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [game.ownHand.length]);
  const selecting = actions.some(
    (a) => a.type === 'offer' || a.type === 'pass',
  );
  const type = game.offer?.passing ? 'pass' : 'offer';
  const candidate: Action | null =
    target && claim && (type === 'pass' || card !== null)
      ? type === 'pass'
        ? { type, claim, target }
        : { type, claim, target, card: card! }
      : null;
  const allowed =
    candidate &&
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
  return (
    <section className="cp-controls" aria-label="本人操作">
      <div className="cp-hand-heading">
        <h2>{actions.length ? '轮到你' : '你的手牌'}</h2>
        {overflow && <span className="cp-hand-hint">↔ 左右滑动看牌</span>}
      </div>
      {game.offer?.knownCard !== null &&
        game.offer?.knownCard !== undefined && (
          <p className="cp-known">
            你已看过此牌：
            <Card card={game.offer.knownCard} />
          </p>
        )}
      <div className="cp-hand" ref={hand}>
        {game.ownHand.map((c) => (
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
      {selecting && (
        <>
          <fieldset>
            <legend>交给谁</legend>
            {targets.map((t) => (
              <button
                type="button"
                key={t}
                disabled={disabled}
                aria-pressed={target === t}
                onClick={() => setTarget(t)}
              >
                {names[t]}
              </button>
            ))}
          </fieldset>
          <fieldset>
            <legend>声明是什么</legend>
            <div className="cp-claims">
              {kinds.map((k) => (
                <button
                  type="button"
                  key={k}
                  disabled={disabled}
                  aria-pressed={claim === k}
                  onClick={() => setClaim(k)}
                >
                  <Critter kind={k} />
                  {labels[k]}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            className="cp-confirm"
            disabled={disabled || !allowed}
            onClick={() => candidate && choose(candidate)}
          >
            {target && claim
              ? `向 ${names[target]} 声明“${labels[claim]}”`
              : '选好牌、接收者与声明'}
          </button>
        </>
      )}
      {actions.some((a) => a.type === 'judge') && (
        <div className="cp-judgments">
          <button
            disabled={disabled}
            onClick={() => choose({ type: 'judge', belief: true })}
          >
            <strong>相信</strong>
            <span>声明是真的</span>
          </button>
          <button
            disabled={disabled}
            onClick={() => choose({ type: 'judge', belief: false })}
          >
            <strong>质疑</strong>
            <span>声明是假的</span>
          </button>
          {actions.some((a) => a.type === 'peek') ? (
            <button
              disabled={disabled}
              onClick={() => choose({ type: 'peek' })}
            >
              秘密查看，并承诺转传
            </button>
          ) : (
            <p>已无未看过的其他玩家，必须判断。</p>
          )}
        </div>
      )}
      {game.offer?.passing && actions.length > 0 && (
        <p>你已经选择转传；请交给尚未看过此牌的人。</p>
      )}
    </section>
  );
}
