import type { CSSProperties } from 'react';
import { RESOURCES, RESOURCE_LABELS } from '../data/catalog';
import { getCity } from '../data/germany';
import type { PowerGridView, Stock } from '../types';
import { PlantCard, ResourceIcon } from './components';
import { incomePreview } from './income-preview';
import { PLAYER_COLORS } from './labels';
import './company-inspector.css';

function LandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 11 12 2l10 9-2 2-2-2v11H6V11l-2 2Z" />
    </svg>
  );
}

function Inventory({
  stock,
  pending = false,
}: {
  stock: Stock;
  pending?: boolean;
}) {
  return (
    <div
      className="pg-inspector-inventory"
      aria-label={pending ? '待安置燃料' : '四类燃料库存'}
    >
      {RESOURCES.filter((resource) => !pending || stock[resource] > 0).map(
        (resource) => (
          <span
            key={resource}
            data-inspector-resource={resource}
            aria-label={`${RESOURCE_LABELS[resource]}${pending ? '待安置' : '库存'}${stock[resource]}份`}
            title={RESOURCE_LABELS[resource]}
          >
            <ResourceIcon resource={resource} />
            <span aria-hidden="true">×</span>
            <b>{stock[resource]}</b>
          </span>
        ),
      )}
    </div>
  );
}

export function CompanyInspector({
  view,
  names,
  portraits,
  artFor,
  active = true,
  onlySeat,
}: {
  view: PowerGridView;
  names: Record<string, string>;
  portraits: Record<string, string>;
  artFor(id: number): CSSProperties;
  active?: boolean;
  onlySeat?: string;
}) {
  return (
    <section
      className={`pg-company-inspector${onlySeat ? ' pg-company-inspector--single' : ''}`}
      aria-label="公司综合资料"
    >
      {view.playerOrder.map((seatId, rank) => {
        if (onlySeat && onlySeat !== seatId) return null;
        const player = view.players[seatId]!;
        const stableIndex = view.seatOrder.indexOf(seatId);
        const title = names[seatId] ?? `公司${stableIndex + 1}`;
        const acting = active && view.actor === seatId;
        const self = view.self?.seatId === seatId;
        const winner = view.winners.includes(seatId);
        const preview = incomePreview(view, seatId);
        const replacement =
          view.replacement?.buyer === seatId ? view.replacement : null;
        const pendingPlant = replacement
          ? player.plants.find((plant) => plant.id === replacement.newPlantId)
          : undefined;
        const plants = player.plants.filter(
          (plant) => plant.id !== pendingPlant?.id,
        );
        const stock = Object.fromEntries(
          RESOURCES.map((resource) => [
            resource,
            player.plants.reduce(
              (sum, plant) => sum + plant.resources[resource],
              0,
            ),
          ]),
        ) as Stock;
        const salvage =
          replacement &&
          RESOURCES.some((resource) => replacement.salvage[resource] > 0)
            ? replacement.salvage
            : null;
        return (
          <article
            key={seatId}
            className={`pg-inspector-company${acting ? ' pg-inspector-company--acting' : ''}${self ? ' pg-inspector-company--self' : ''}`}
            data-inspector-seat={seatId}
            data-company-seat={seatId}
            data-inspector-rank={rank + 1}
            data-plant-limit={view.plantLimit}
            style={
              {
                '--pg-player-color': PLAYER_COLORS[stableIndex],
              } as CSSProperties
            }
          >
            <header className="pg-inspector-heading">
              <span
                className="pg-inspector-rank"
                aria-label={`位次 ${rank + 1}`}
              >
                {rank + 1}
              </span>
              <img src={portraits[seatId]} alt="" />
              <div>
                <h2>{title}</h2>
                {(acting || self || winner) && (
                  <div className="pg-inspector-status">
                    {acting && <span>行动中</span>}
                    {self && <span>我的公司</span>}
                    {winner && (
                      <span className="pg-inspector-winner">★ 冠军</span>
                    )}
                  </div>
                )}
              </div>
              {player.cash != null && (
                <div className="pg-inspector-cash" data-company-cash>
                  <span>现金</span>
                  <strong aria-label={`${player.cash}电币`}>
                    <span aria-hidden="true">◉</span> {player.cash}
                  </strong>
                </div>
              )}
            </header>
            <dl className="pg-inspector-stats">
              <div>
                <dt>
                  <LandIcon />
                  已建地皮
                </dt>
                <dd>{player.cities.length}</dd>
              </div>
              <div>
                <dt>总产能</dt>
                <dd>{player.capacity}</dd>
              </div>
              {preview && (
                <div className="pg-inspector-supported">
                  <dt>
                    {view.phase === 'ended' ? (
                      '最终供电'
                    ) : preview.completed ? (
                      '本轮供电'
                    ) : (
                      <span className="pg-inspector-power-label">
                        <span>燃料</span>
                        <span>可供电</span>
                      </span>
                    )}
                  </dt>
                  <dd>{preview.cities}</dd>
                </div>
              )}
            </dl>
            <section className="pg-inspector-fuel">
              <h3>燃料库存</h3>
              <Inventory stock={stock} />
            </section>
            <section className="pg-inspector-factories">
              <h3>电厂</h3>
              {plants.length ? (
                <div className="pg-inspector-plants">
                  {plants.map((plant) => (
                    <div
                      className="pg-inspector-plant"
                      key={plant.id}
                      data-inspector-plant={plant.id}
                    >
                      <PlantCard
                        id={plant.id}
                        owned={plant}
                        art={artFor(plant.id)}
                      />
                      {view.phase === 'powering' && (
                        <span
                          className={`pg-inspector-run${player.ran.includes(plant.id) ? ' pg-inspector-run--completed' : ''}`}
                        >
                          {player.ran.includes(plant.id)
                            ? '本轮已运行'
                            : '本轮未运行'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pg-inspector-empty">尚未购入电厂</p>
              )}
            </section>
            {(pendingPlant || salvage) && (
              <section className="pg-inspector-pending">
                {pendingPlant && (
                  <div>
                    <h3>新购待替换</h3>
                    <div
                      className="pg-inspector-plant"
                      data-inspector-pending-plant={pendingPlant.id}
                    >
                      <PlantCard
                        id={pendingPlant.id}
                        owned={pendingPlant}
                        art={artFor(pendingPlant.id)}
                      />
                    </div>
                  </div>
                )}
                {salvage && (
                  <div className="pg-inspector-salvage">
                    <h3>待安置燃料</h3>
                    <Inventory stock={salvage} pending />
                  </div>
                )}
              </section>
            )}
            <section className="pg-inspector-network">
              <h3>已建地皮</h3>
              {player.cities.length ? (
                <ul>
                  {player.cities.map((cityId) => (
                    <li key={cityId}>
                      <LandIcon />
                      {getCity(cityId).name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pg-inspector-empty">尚未建设地皮</p>
              )}
            </section>
          </article>
        );
      })}
    </section>
  );
}
