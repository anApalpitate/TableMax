import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { RESOURCES, RESOURCE_LABELS } from '../data/catalog';
import type { PowerGridView } from '../types';
import { PlantCard, ResourceIcon } from './components';
import { PLAYER_COLORS } from './labels';
import './company-cards.css';
import { BoardIcon } from './BoardIcon';

function PlantSummary({
  id,
  artFor,
}: {
  id: number;
  artFor(id: number): CSSProperties;
}) {
  return (
    <div className="pg-company-plant-info" data-plant-summary={id}>
      <PlantCard id={id} art={artFor(id)} compact />
    </div>
  );
}

export function CompanyCards({
  view,
  names,
  portraits,
  active,
  onDetails,
  savedKey = null,
  animate = false,
  horizontal = false,
  contextKey,
  artFor,
}: {
  view: PowerGridView;
  names: Record<string, string>;
  portraits: Record<string, string>;
  active: boolean;
  onDetails(seatId: string): void;
  savedKey?: string | null;
  animate?: boolean;
  horizontal?: boolean;
  contextKey: string;
  artFor(id: number): CSSProperties;
}) {
  const list = useRef<HTMLElement>(null);
  const previous = useRef<{
    order: string;
    key: string | null;
    context: string;
    positions: Map<string, DOMRect>;
  } | null>(null);
  const order = view.playerOrder.join(',');
  useLayoutEffect(() => {
    const cards = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-company-seat]') ??
        []),
    ];
    const positions = new Map(
      cards.map((card) => [
        card.dataset.companySeat!,
        card.getBoundingClientRect(),
      ]),
    );
    const before = previous.current;
    if (
      before &&
      before.order !== order &&
      savedKey &&
      savedKey !== before.key &&
      before.context === contextKey &&
      animate &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      cards.forEach((card, index) => {
        const old = before.positions.get(card.dataset.companySeat!);
        const next = positions.get(card.dataset.companySeat!);
        if (!old?.width || !next?.width || Math.abs(old.width - next.width) > 1)
          return;
        const dx = old.left - next.left,
          dy = old.top - next.top;
        if (dx || dy)
          card.animate(
            [
              { transform: `translate(${dx}px,${dy}px)` },
              { transform: 'translate(0,0)' },
            ],
            {
              duration: 320,
              delay: index * 40,
              easing: 'ease-out',
              fill: 'backwards',
            },
          );
      });
    }
    previous.current = { order, key: savedKey, context: contextKey, positions };
  }, [order, savedKey, animate, contextKey]);
  const browse = (direction: number) =>
    list.current?.scrollBy({
      left: direction * Math.max(240, list.current.clientWidth * 0.8),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  return (
    <div
      className={`pg-company-cards-wrap${horizontal ? ' pg-company-cards-wrap--horizontal' : ''}`}
    >
      {horizontal && (
        <button
          className="pg-company-browse pg-company-browse--previous"
          aria-label="向左浏览玩家公司"
          onClick={() => browse(-1)}
        >
          <BoardIcon name="left" />
        </button>
      )}
      <section
        ref={list}
        className={`pg-company-cards${horizontal ? ' pg-company-cards--horizontal' : ''}`}
        aria-label="按位次排列的玩家公司"
      >
        {view.playerOrder.map((seatId, rank) => {
          const player = view.players[seatId]!;
          const stableIndex = view.seatOrder.indexOf(seatId);
          const replacement =
            view.replacement?.buyer === seatId ? view.replacement : null;
          const pending = replacement
            ? player.plants.find((plant) => plant.id === replacement.newPlantId)
            : undefined;
          const plants = pending
            ? player.plants.filter((plant) => plant.id !== pending.id)
            : player.plants;
          const title = names[seatId] ?? `公司${stableIndex + 1}`;
          return (
            <article
              key={seatId}
              data-company-seat={seatId}
              data-company-rank={rank + 1}
              data-plant-limit={view.plantLimit}
              className={`pg-company-card${pending ? ' pg-company-card--replacement' : ''}${view.self?.seatId === seatId ? ' pg-company-card--self' : ''}${active && view.actor === seatId ? ' pg-company-card--acting' : ''}`}
              style={
                {
                  '--pg-player-color': PLAYER_COLORS[stableIndex],
                } as CSSProperties
              }
            >
              <header>
                <img src={portraits[seatId]} alt="" />
                <strong title={title}>{title}</strong>
                <span
                  className="pg-company-rank"
                  aria-label={`位次 ${rank + 1}`}
                >
                  <b>{rank + 1}</b>
                </span>
                {player.cash != null && (
                  <span
                    className="pg-company-cash"
                    data-company-cash
                    aria-label={`现金${player.cash}电币`}
                  >
                    ◉ <b>{player.cash}</b>
                  </span>
                )}
              </header>
              <div className="pg-company-card-network">
                <span aria-label={`已建${player.cities.length}座城市`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 11 12 2l10 9-2 2-2-2v11H6V11l-2 2Z" />
                  </svg>
                  <b>{player.cities.length}</b>
                </span>
                <span>
                  {active && view.actor === seatId
                    ? '行动中'
                    : view.self?.seatId === seatId
                      ? '我的公司'
                      : `座位 ${stableIndex + 1}`}
                </span>
              </div>
              <div className="pg-company-factory-layout">
                <div
                  className="pg-company-card-plants"
                  aria-label={`电厂摘要，本局上限${view.plantLimit}座`}
                >
                  {Array.from({ length: view.plantLimit }, (_, index) =>
                    plants[index] ? (
                      <PlantSummary
                        key={index}
                        id={plants[index]!.id}
                        artFor={artFor}
                      />
                    ) : (
                      <div
                        key={index}
                        className="pg-company-plant-empty"
                        aria-label={
                          index >= view.plantLimit
                            ? `本局上限${view.plantLimit}厂`
                            : '空电厂位'
                        }
                      >
                        {index >= view.plantLimit
                          ? `${view.plantLimit}厂上限`
                          : '—'}
                      </div>
                    ),
                  )}
                </div>
                {pending && (
                  <div className="pg-company-pending">
                    <strong>新购待替换</strong>
                    <PlantSummary id={pending.id} artFor={artFor} />
                  </div>
                )}
              </div>
              <div className="pg-company-card-stock" aria-label="四类燃料库存">
                <span
                  className="pg-company-stock-house"
                  aria-label={`已建${player.cities.length}座城市`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M2 11 12 2l10 9-2 2-2-2v11H6V11l-2 2Z"
                      fill="var(--pg-player-color)"
                      stroke="#443e32"
                    />
                  </svg>
                  <b>{player.cities.length}</b>
                </span>
                {RESOURCES.map((resource) => {
                  const count = player.plants.reduce(
                    (sum, plant) => sum + plant.resources[resource],
                    0,
                  );
                  return (
                    <span
                      key={resource}
                      data-company-resource={resource}
                      aria-label={`${RESOURCE_LABELS[resource]}库存${count}份`}
                    >
                      <ResourceIcon resource={resource} />×{count}
                    </span>
                  );
                })}
              </div>
              {replacement &&
                RESOURCES.some(
                  (resource) => replacement.salvage[resource] > 0,
                ) && (
                  <div className="pg-company-salvage">
                    <strong>待安置</strong>
                    {RESOURCES.filter(
                      (resource) => replacement.salvage[resource] > 0,
                    ).map((resource) => (
                      <span
                        key={resource}
                        aria-label={`${RESOURCE_LABELS[resource]}待安置${replacement.salvage[resource]}份`}
                      >
                        <ResourceIcon resource={resource} />×
                        {replacement.salvage[resource]}
                      </span>
                    ))}
                  </div>
                )}
              <button
                className="pg-company-details"
                onClick={() => onDetails(seatId)}
                aria-label={`查看${title}的电厂与库存`}
              >
                查看详情
              </button>
            </article>
          );
        })}
      </section>
      {horizontal && (
        <button
          className="pg-company-browse pg-company-browse--next"
          aria-label="向右浏览玩家公司"
          onClick={() => browse(1)}
        >
          <BoardIcon name="right" />
        </button>
      )}
    </div>
  );
}
