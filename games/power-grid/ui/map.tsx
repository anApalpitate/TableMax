import { useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GERMANY_CITIES,
  GERMANY_EDGES,
  GERMANY_REGIONS,
} from '../data/germany';

export interface MapNetwork {
  seatId: string;
  cities: readonly string[];
  color: string;
  name: string;
}

export function House({
  color,
  x = 0,
  y = 0,
}: {
  color: string;
  x?: number;
  y?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-10 1 0-9 10 1V12H3V5H-3V12H-10Z"
        fill={color}
        stroke="#17221d"
        strokeWidth="1.5"
      />
      <path d="M-5 1H-1V5H-5Z" fill="#fff9cf" />
    </g>
  );
}

export function GermanyMap({
  regions,
  networks,
  selected,
  select,
  available = [],
  terrain,
}: {
  regions: readonly string[];
  networks: readonly MapNetwork[];
  selected: string | null;
  select(city: string): void;
  available?: readonly string[];
  terrain?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    distance: number;
    scale: number;
    moved: boolean;
  } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(0.5);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setBaseScale(
        Math.min(rect.width / BOARD_WIDTH, rect.height / BOARD_HEIGHT),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const labelSize = 16 / Math.max(0.12, baseScale * scale);
  const displayScale = baseScale * scale;
  const positions = Object.fromEntries(
    GERMANY_CITIES.map((city) => [city.id, city]),
  );
  const zoom = (value: number) => {
    setScale(Math.max(1, Math.min(4, value)));
    if (value <= 1) setOffset({ x: 0, y: 0 });
  };
  const pointerDown = (event: PointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = [...pointers.current.values()];
    drag.current = {
      x: offset.x,
      y: offset.y,
      startX: event.clientX,
      startY: event.clientY,
      distance:
        points.length === 2
          ? Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)
          : 0,
      scale,
      moved: false,
    };
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId) || !drag.current) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointers.current.values()];
    const state = drag.current;
    if (points.length === 2 && state.distance > 0) {
      zoom(
        (state.scale *
          Math.hypot(
            points[0]!.x - points[1]!.x,
            points[0]!.y - points[1]!.y,
          )) /
          state.distance,
      );
      state.moved = true;
    } else if (scale > 1) {
      const dx = event.clientX - state.startX,
        dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) > 5) state.moved = true;
      const rect = frame.current!.getBoundingClientRect();
      setOffset({
        x: Math.max(
          (-rect.width * (scale - 1)) / 2,
          Math.min((rect.width * (scale - 1)) / 2, state.x + dx),
        ),
        y: Math.max(
          (-rect.height * (scale - 1)) / 2,
          Math.min((rect.height * (scale - 1)) / 2, state.y + dy),
        ),
      });
    }
  };
  const pointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const moved = drag.current?.moved;
    pointers.current.delete(event.pointerId);
    if (!moved && event.type !== 'pointercancel') {
      const transform = event.currentTarget.getScreenCTM();
      if (transform) {
        const point = event.currentTarget.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const position = point.matrixTransform(transform.inverse());
        const candidates = GERMANY_CITIES.filter((city) =>
          regions.includes(city.region),
        )
          .map((city) => ({
            city,
            distance: Math.hypot(position.x - city.x, position.y - city.y),
          }))
          .sort((a, b) => a.distance - b.distance);
        if (
          candidates[0] &&
          candidates[0].distance <= Math.max(35, 22 / (baseScale * scale))
        )
          select(candidates[0].city.id);
      }
    }
    if (pointers.current.size === 0) drag.current = null;
  };
  const selectedCity = selected ? positions[selected] : null;
  return (
    <section className="pg-map-panel" aria-label="德国电网地图">
      <div className="pg-map-frame" ref={frame}>
        <svg
          className="pg-map"
          role="img"
          aria-label="德国地图，42座城市和连接费用"
          viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onWheel={(event) => {
            if (event.ctrlKey) {
              event.preventDefault();
              zoom(scale + (event.deltaY < 0 ? 0.15 : -0.15));
            }
          }}
          style={{
            transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
          }}
        >
          <defs>
            <pattern
              id="pg-paper"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <rect width="12" height="12" fill="#e6d6aa" />
              <path d="M0 6H12M6 0V12" stroke="#9e8657" strokeOpacity=".05" />
            </pattern>
            <filter id="pg-house-shadow">
              <feDropShadow
                dx="1"
                dy="2"
                stdDeviation="1.5"
                floodOpacity=".4"
              />
            </filter>
          </defs>
          <rect
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
            rx="28"
            fill="url(#pg-paper)"
          />
          {terrain && (
            <image
              href={terrain}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              preserveAspectRatio="none"
            />
          )}
          {!terrain &&
            GERMANY_REGIONS.map((region) => (
              <path
                key={region.id}
                d={region.path}
                fill={region.color}
                fillOpacity=".63"
                stroke="#8e7040"
                strokeOpacity=".5"
                strokeWidth="3"
              />
            ))}
          {!terrain &&
            GERMANY_REGIONS.filter(
              (region) => !regions.includes(region.id),
            ).map((region) => (
              <path
                key={region.id}
                d={region.path}
                fill="#f4e9cb"
                fillOpacity=".75"
              />
            ))}
          <g className="pg-map-routes">
            {GERMANY_EDGES.map((edge) => {
              const a = positions[edge.from]!,
                b = positions[edge.to]!;
              const active =
                regions.includes(a.region) && regions.includes(b.region);
              const selectedEdge = selected === a.id || selected === b.id;
              return (
                <g key={`${edge.from}-${edge.to}`} opacity={active ? 1 : 0.24}>
                  <path
                    d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                    stroke={selectedEdge ? '#fff9d3' : '#e2a51c'}
                    strokeWidth={selectedEdge ? 10 : 7}
                    fill="none"
                  />
                  <path
                    d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                    stroke={selectedEdge ? '#165947' : '#5a4428'}
                    strokeWidth="2"
                    fill="none"
                  />
                  {(displayScale >= 0.55 || selectedEdge) && active && (
                    <g
                      transform={`translate(${(a.x + b.x) / 2},${(a.y + b.y) / 2})`}
                    >
                      <rect
                        x={-labelSize * 0.72}
                        y={-labelSize * 0.68}
                        width={labelSize * 1.44}
                        height={labelSize * 1.26}
                        rx={labelSize * 0.25}
                        fill="#fff9d3"
                        stroke="#665232"
                        strokeWidth="2"
                      />
                      <text
                        fontSize={labelSize}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#332c20"
                        fontWeight="700"
                      >
                        {edge.cost}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
          {GERMANY_CITIES.map((city) => {
            const occupants = networks.filter((network) =>
              network.cities.includes(city.id),
            );
            const active = regions.includes(city.region);
            const isSelected = selected === city.id;
            const enabled = available.includes(city.id);
            return (
              <g
                key={city.id}
                data-city={city.id}
                role="button"
                tabIndex={active ? 0 : -1}
                aria-label={`${city.name} ${city.nameDe}，${occupants.length}家已建设`}
                aria-pressed={isSelected}
                className={`pg-map-city ${isSelected ? 'pg-map-city--selected' : ''}`}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(city.id);
                  }
                }}
                transform={`translate(${city.x},${city.y})`}
                opacity={active ? 1 : 0.28}
              >
                <title>
                  {city.name} {city.nameDe}
                </title>
                <circle
                  r={Math.max(35, 22 / (baseScale * scale))}
                  fill="transparent"
                />
                {isSelected && (
                  <circle
                    r="34"
                    fill="#fff4a7"
                    stroke="#124d40"
                    strokeWidth="5"
                  />
                )}
                <rect
                  x="-29"
                  y="-13"
                  width="58"
                  height="26"
                  rx="4"
                  fill={enabled ? '#fffdf0' : '#dedbc4'}
                  stroke={enabled ? '#255e49' : '#6c6450'}
                  strokeWidth="3"
                />
                <path
                  d="M-10-13V13M10-13V13"
                  stroke="#776b4e"
                  strokeWidth="2"
                />
                {occupants.map((network, index) => (
                  <g key={network.seatId} filter="url(#pg-house-shadow)">
                    <House x={(index - 1) * 19} y={-3} color={network.color} />
                  </g>
                ))}
                {!occupants.length && (
                  <path
                    d="M-20 0H20M0-7V7"
                    stroke={enabled ? '#3f7556' : '#9b957e'}
                    strokeWidth="3"
                  />
                )}
                {(displayScale >= 0.9 || isSelected) && active && (
                  <g pointerEvents="none">
                    <rect
                      x={-city.name.length * labelSize * 0.51 - 5}
                      y={19}
                      width={city.name.length * labelSize * 1.02 + 10}
                      height={labelSize * 1.25}
                      rx="5"
                      fill="#faf2d9"
                      fillOpacity=".95"
                    />
                    <text
                      x="0"
                      y={19 + labelSize}
                      textAnchor="middle"
                      fontSize={labelSize}
                      fill="#272b22"
                      fontWeight="700"
                    >
                      {city.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        <div className="pg-map-zoom" aria-label="地图缩放">
          <button
            type="button"
            aria-label="放大地图"
            onClick={() => zoom(scale + 0.4)}
          >
            ＋
          </button>
          <button
            type="button"
            aria-label="缩小地图"
            disabled={scale <= 1}
            onClick={() => zoom(scale - 0.4)}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              zoom(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            全图
          </button>
        </div>
      </div>
      <div className="pg-city-picker">
        <select
          aria-label="选择城市"
          value={selected ?? ''}
          onChange={(event) => select(event.target.value)}
        >
          <option value="">选择城市</option>
          {GERMANY_CITIES.filter((city) => regions.includes(city.region)).map(
            (city) => (
              <option key={city.id} value={city.id}>
                {city.name} {city.nameDe}
              </option>
            ),
          )}
        </select>
        {selectedCity && (
          <span className="pg-city-slots" aria-label="城市位置费用">
            {[10, 15, 20].map((price, index) => (
              <span
                key={price}
                className={
                  networks.filter((network) =>
                    network.cities.includes(selectedCity.id),
                  ).length > index
                    ? 'occupied'
                    : ''
                }
              >
                {price}
              </span>
            ))}
          </span>
        )}
      </div>
    </section>
  );
}
