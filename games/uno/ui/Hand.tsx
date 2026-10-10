/* eslint-disable react-refresh/only-export-components -- Color labels are shared by the player and public table. */
import { useState, type CSSProperties } from 'react';
import {
  COLORS,
  type Action,
  type Card as UnoCard,
  type Color,
  type UnoView,
} from '../types';
import { Card, cardName } from './Card';
import { useHandOrder } from './use-hand-order';

export const colorNames: Record<Color, string> = {
  red: '红色',
  yellow: '黄色',
  green: '绿色',
  blue: '蓝色',
};
const colorShapes: Record<Color, string> = {
  red: '●',
  yellow: '▲',
  green: '■',
  blue: '◆',
};

export function ColorChoice({
  locked,
  choose,
}: {
  locked: boolean;
  choose(color: Color): void;
}) {
  return (
    <div className="uno-colors" role="group" aria-label="选择下一位要跟的颜色">
      {COLORS.map((color) => (
        <button
          type="button"
          className={`uno-color-choice uno-color-choice--${color}`}
          key={color}
          disabled={locked}
          onClick={() => choose(color)}
        >
          <span aria-hidden="true">{colorShapes[color]}</span>
          {colorNames[color]}
        </button>
      ))}
    </div>
  );
}

export function Hand({
  game,
  actions,
  choose,
  locked,
  scope,
  boundary,
}: {
  scope: string;
  boundary: string;
  game: UnoView;
  actions: Action[];
  choose(action: Action): void;
  locked: boolean;
}) {
  const [selection, setSelection] = useState<{
    id: string;
    boundary: string;
  } | null>(null);
  const selected = selection?.boundary === boundary ? selection.id : null;
  const setSelected = (id: string | null) =>
    setSelection(id ? { id, boundary } : null);
  const [unoChoice, setUnoChoice] = useState({ boundary, value: false });
  const sayUno = unoChoice.boundary === boundary && unoChoice.value;
  const setSayUno = (value: boolean) => setUnoChoice({ boundary, value });
  const self = game.self;
  const plays = actions.filter(
    (action): action is Extract<Action, { type: 'play' }> =>
      action.type === 'play',
  );
  const legalIds = new Set(plays.map((action) => action.cardId));
  const {
    ids,
    mode,
    attachScroll,
    drag,
    sort,
    down,
    move,
    up,
    cancel,
    canClick,
    shift,
  } = useHandOrder(self?.hand ?? [], legalIds, scope, boundary, locked);
  if (!self) return null;
  const selectedCard = self.hand.find(
    (card) => card.id === selected && legalIds.has(card.id),
  );
  const draw = actions.find((action) => action.type === 'draw');
  const pass = actions.find((action) => action.type === 'pass');
  const play = (card: UnoCard) => {
    if (locked || !legalIds.has(card.id)) return;
    if (!card.color) {
      setSelected(card.id);
      return;
    }
    const action = plays.find((action) => action.cardId === card.id)!;
    choose({
      ...action,
      ...(self.hand.length === 2 && sayUno ? { uno: true } : {}),
    });
  };
  return (
    <section className="uno-hand-section" aria-label="我的手牌">
      <div className="uno-hand-heading">
        <h2>
          我的手牌 <span>{self.hand.length} 张</span>
        </h2>
        <div className="uno-hand-actions">
          <button
            type="button"
            className="uno-icon-button"
            onClick={sort}
            aria-label={mode === 'color' ? '按数字排序' : '按颜色排序'}
            title={mode === 'color' ? '按数字排序' : '按颜色排序'}
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 4v16m-3-3 3 3 3-3M12 5h9M12 12h6M12 19h3" />
            </svg>
          </button>
          {self.hand.length === 2 && plays.length > 0 && (
            <button
              className={`uno-call-toggle${sayUno ? ' uno-call-toggle--on' : ''}`}
              type="button"
              aria-pressed={sayUno}
              disabled={locked}
              onClick={() => setSayUno(!sayUno)}
            >
              <span>UNO!</span>
              {sayUno ? '随出牌喊出' : '出牌时喊出'}
            </button>
          )}
          {draw && (
            <button
              className="uno-primary"
              type="button"
              disabled={locked}
              onClick={() => choose(draw)}
            >
              摸一张
            </button>
          )}
          {pass && (
            <button
              className="uno-primary"
              type="button"
              disabled={locked}
              onClick={() => choose(pass)}
            >
              保留，过牌
            </button>
          )}
        </div>
      </div>
      <div
        className="uno-hand-scroll"
        ref={attachScroll}
        tabIndex={0}
        aria-label="横向浏览全部手牌"
      >
        <div
          className="uno-hand-cards"
          data-insert-end={drag && drag.before === null ? true : undefined}
        >
          {ids
            .map((id) => self.hand.find((card) => card.id === id)!)
            .map((card) => (
              <button
                type="button"
                key={card.id}
                data-card-id={card.id}
                className={`uno-hand-card${legalIds.has(card.id) ? ' uno-hand-card--legal' : ''}${card.id === self.drawnCardId ? ' uno-hand-card--drawn' : ''}${drag?.id === card.id ? ' uno-hand-card--dragging' : ''}${drag?.before === card.id ? ' uno-hand-card--insert' : ''}`}
                aria-disabled={locked || !legalIds.has(card.id)}
                onPointerDown={(event) => down(event, card.id)}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={cancel}
                onClick={() => {
                  if (canClick()) play(card);
                }}
                onKeyDown={(event) => {
                  if (
                    event.altKey &&
                    ['ArrowLeft', 'ArrowRight'].includes(event.key)
                  ) {
                    event.preventDefault();
                    shift(card.id, event.key === 'ArrowLeft' ? -1 : 1);
                  }
                }}
                aria-label={`${cardName(card)}${card.id === self.drawnCardId ? '，刚摸到' : ''}${legalIds.has(card.id) ? '，可出牌' : ''}`}
                style={
                  {
                    '--card-tilt': `${((Array.from(card.id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5) - 2) * 0.65}deg`,
                  } as CSSProperties
                }
              >
                <Card card={card} />
                {card.id === self.drawnCardId && (
                  <span className="uno-new-card">刚摸到</span>
                )}
              </button>
            ))}
        </div>
      </div>
      {selectedCard && (
        <div
          className="uno-wild-selection"
          role="group"
          aria-label="万能牌颜色选择"
        >
          <div className="uno-wild-heading">
            <strong>{cardName(selectedCard)}，选择颜色</strong>
            <button type="button" onClick={() => setSelected(null)}>
              取消
            </button>
          </div>
          {selectedCard.kind === 'wild-draw-four' && (
            <p>无当前颜色才可合法出 +4；对方可以质疑。</p>
          )}
          <ColorChoice
            locked={locked}
            choose={(color) => {
              const action = plays.find(
                (action) =>
                  action.cardId === selectedCard.id && action.color === color,
              );
              if (action)
                choose({
                  ...action,
                  ...(self.hand.length === 2 && sayUno ? { uno: true } : {}),
                });
            }}
          />
        </div>
      )}
    </section>
  );
}
