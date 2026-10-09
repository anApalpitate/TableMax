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
}: {
  game: UnoView;
  actions: Action[];
  choose(action: Action): void;
  locked: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [sayUno, setSayUno] = useState(false);
  const self = game.self;
  if (!self) return null;
  const plays = actions.filter(
    (action): action is Extract<Action, { type: 'play' }> =>
      action.type === 'play',
  );
  const legalIds = new Set(plays.map((action) => action.cardId));
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
      <p className="uno-hand-hint">
        {locked
          ? '等待连接或继续对局'
          : plays.length
            ? game.stage === 'drawn'
              ? '这回合只能出刚摸到的牌'
              : '点亮起的牌，直接打出'
            : draw
              ? '没有可出的牌，或选择摸一张'
              : '看好手牌，等待你的回合'}
      </p>
      <div
        className="uno-hand-scroll"
        tabIndex={0}
        aria-label="横向浏览全部手牌"
      >
        <div className="uno-hand-cards">
          {self.hand.map((card, index) => (
            <button
              type="button"
              key={card.id}
              data-card-id={card.id}
              className={`uno-hand-card${legalIds.has(card.id) ? ' uno-hand-card--legal' : ''}${card.id === self.drawnCardId ? ' uno-hand-card--drawn' : ''}`}
              disabled={locked || !legalIds.has(card.id)}
              onClick={() => play(card)}
              aria-label={`${cardName(card)}${card.id === self.drawnCardId ? '，刚摸到' : ''}${legalIds.has(card.id) ? '，可出牌' : ''}`}
              style={
                {
                  '--card-tilt': `${((index % 5) - 2) * 0.65}deg`,
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
