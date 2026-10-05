import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from 'react';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GERMANY_CITIES,
  GERMANY_EDGES,
  GERMANY_REGIONS,
} from '../data/germany';
import type { Phase } from '../types';
import './map-polish.css';

// Only the presentation rotates and trims the outer paper margin.
const MAP_WIDTH = BOARD_HEIGHT;
const MAP_HEIGHT = BOARD_WIDTH;
const MAP_FRAME = { x: 36, y: 24, width: 1152, height: 864 };
const MAP_CITIES = GERMANY_CITIES.map((city) => ({
  ...city,
  x: BOARD_HEIGHT - city.y,
  y: city.x,
}));
const POSITIONS = Object.fromEntries(MAP_CITIES.map((city) => [city.id, city]));
const TERRAIN_ROTATION = `translate(${BOARD_HEIGHT} 0) rotate(90)`;
type MapView = 'board' | 'clear';
type MapRole = 'host' | 'public' | 'player';
const VIEW_EVENT = 'tablemax-power-grid-map-view';
const volatileViews = new Map<string, MapView>();

function viewKey(role: MapRole) {
  // Browser storage already separates devices; resizing must not change a preference.
  return `tablemax.power-grid.map-view.${role}`;
}
function savedView(role: MapRole): MapView {
  if (typeof window === 'undefined') return 'board';
  const key = viewKey(role);
  try {
    const suffixes =
      role === 'player' ? ['phone', 'desktop'] : ['desktop', 'phone'];
    for (const candidate of [
      key,
      ...suffixes.map((suffix) => `${key}.${suffix}`),
    ]) {
      const value = window.localStorage.getItem(candidate);
      if (value === 'board' || value === 'clear') return value;
    }
  } catch {
    /* The view also works when browser storage is unavailable. */
  }
  return volatileViews.get(key) ?? 'board';
}
function subscribeView(update: () => void) {
  window.addEventListener('storage', update);
  window.addEventListener(VIEW_EVENT, update);
  return () => {
    window.removeEventListener('storage', update);
    window.removeEventListener(VIEW_EVENT, update);
  };
}
type LabelBox = { x: number; y: number; width: number; height: number };
type MapLabel = LabelBox & { anchorX: number; anchorY: number };
function overlap(a: LabelBox, b: LabelBox) {
  return (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  );
}
function layoutHouses(
  networks: readonly MapNetwork[],
  regions: readonly string[],
  displayScale: number,
) {
  const houseScale = Math.max(1, 16 / (20 * displayScale));
  const placed: LabelBox[] = [];
  const layouts = new Map<string, { x: number; y: number }[]>();
  const nodes = MAP_CITIES.filter((city) => regions.includes(city.region));
  for (const city of nodes) {
    const count = networks.filter((network) =>
      network.cities.includes(city.id),
    ).length;
    if (!count) continue;
    const row = Array.from({ length: count }, (_, index) => ({
      x: (index - (count - 1) / 2) * 25 * houseScale,
      y: -3 * houseScale,
    }));
    const column = row.map((point) => ({ x: 0, y: point.x - 3 * houseScale }));
    const neighbors = nodes
      .filter((other) => other.id !== city.id)
      .map((other) => ({
        x: other.x - 31,
        y: other.y - 16,
        width: 62,
        height: 32,
      }));
    let best = row;
    let bestScore = Infinity;
    for (const shape of [row, column]) {
      for (const offset of [
        { x: 0, y: 0 },
        { x: 0, y: -8 / displayScale },
        { x: 0, y: 8 / displayScale },
        { x: -8 / displayScale, y: 0 },
        { x: 8 / displayScale, y: 0 },
      ]) {
        const positions = shape.map((point) => ({
          x: point.x + offset.x,
          y: point.y + offset.y,
        }));
        const boxes = positions.map((point) => ({
          x: city.x + point.x - 13 * houseScale,
          y: city.y + point.y - 12 * houseScale,
          width: 26 * houseScale,
          height: 28 * houseScale,
        }));
        const score =
          boxes.reduce(
            (sum, box) =>
              sum +
              (box.width * box.height - overlap(box, MAP_FRAME)) * 8 +
              neighbors.reduce((n, node) => n + overlap(box, node) * 3, 0) +
              placed.reduce((n, other) => n + overlap(box, other), 0),
            0,
          ) +
          (Math.abs(offset.x) + Math.abs(offset.y)) * houseScale;
        if (score < bestScore) {
          bestScore = score;
          best = positions;
        }
      }
    }
    layouts.set(city.id, best);
    placed.push(
      ...best.map((point) => ({
        x: city.x + point.x - 13 * houseScale,
        y: city.y + point.y - 12 * houseScale,
        width: 26 * houseScale,
        height: 28 * houseScale,
      })),
    );
  }
  return { houseScale, layouts, bounds: placed };
}
function placeLabel(
  x: number,
  y: number,
  width: number,
  height: number,
  candidates: readonly { x: number; y: number }[],
  reserved: LabelBox[],
  required: boolean,
): MapLabel | null {
  let best: LabelBox | null = null;
  let leastOverlap = Infinity;
  for (const candidate of candidates) {
    const box = {
      x: Math.max(
        MAP_FRAME.x + 6,
        Math.min(candidate.x, MAP_FRAME.x + MAP_FRAME.width - width - 6),
      ),
      y: Math.max(
        MAP_FRAME.y + 6,
        Math.min(candidate.y, MAP_FRAME.y + MAP_FRAME.height - height - 6),
      ),
      width,
      height,
    };
    const collision = reserved.reduce(
      (sum, other) => sum + overlap(box, other),
      0,
    );
    if (collision < leastOverlap) {
      leastOverlap = collision;
      best = box;
    }
    if (collision === 0) break;
  }
  if (!best || (!required && leastOverlap > 0)) return null;
  reserved.push(best);
  return { ...best, anchorX: x, anchorY: y };
}
function mapLabels(
  selected: string | null,
  regions: readonly string[],
  fontSize: number,
  displayScale: number,
  view: MapView,
  building: boolean,
  houseBounds: readonly LabelBox[],
) {
  const cities = new Map<string, MapLabel>();
  const routes = new Map<number, MapLabel>();
  const reserved: LabelBox[] = MAP_CITIES.filter((city) =>
    regions.includes(city.region),
  ).map((city) => ({ x: city.x - 31, y: city.y - 15, width: 62, height: 30 }));
  reserved.push(...houseBounds);
  const cityThreshold = view === 'clear' ? 0.62 : building ? 0.78 : 0.9;
  const addCity = (city: (typeof MAP_CITIES)[number], required: boolean) => {
    const width = city.name.length * fontSize * 1.02 + fontSize * 0.6;
    const height = fontSize * 1.35,
      gap = fontSize * 0.3;
    const label = placeLabel(
      city.x,
      city.y,
      width,
      height,
      [
        { x: city.x - width / 2, y: city.y + 16 + gap },
        { x: city.x - width / 2, y: city.y - 16 - gap - height },
        { x: city.x + 32 + gap, y: city.y - height / 2 },
        { x: city.x - 32 - gap - width, y: city.y - height / 2 },
      ],
      reserved,
      required,
    );
    if (label) cities.set(city.id, label);
  };
  const selectedCity = selected ? POSITIONS[selected] : null;
  if (selectedCity && regions.includes(selectedCity.region))
    addCity(selectedCity, true);
  const addRoute = (index: number, required: boolean) => {
    const edge = GERMANY_EDGES[index]!;
    const a = POSITIONS[edge.from]!,
      b = POSITIONS[edge.to]!;
    if (!regions.includes(a.region) || !regions.includes(b.region)) return;
    const x = (a.x + b.x) / 2,
      y = (a.y + b.y) / 2;
    const width = fontSize * 1.6,
      height = fontSize * 1.35;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    const label = placeLabel(
      x,
      y,
      width,
      height,
      [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, 3.2, -3.2].map((distance) => ({
        x: x - width / 2 + normal.x * fontSize * distance,
        y: y - height / 2 + normal.y * fontSize * distance,
      })),
      reserved,
      required,
    );
    if (label) routes.set(index, label);
  };
  GERMANY_EDGES.forEach((edge, index) => {
    if (selected === edge.from || selected === edge.to) addRoute(index, true);
  });
  // At a fitted short-screen size show a sparse, collision-free sample;
  // selected neighbours remain available regardless of density.
  if (building || displayScale >= 1.08)
    GERMANY_EDGES.forEach((edge, index) => {
      if (selected !== edge.from && selected !== edge.to)
        addRoute(index, false);
    });
  if (building || view === 'clear' || displayScale >= cityThreshold)
    MAP_CITIES.filter(
      (city) => regions.includes(city.region) && city.id !== selected,
    ).forEach((city) => addCity(city, false));
  return { cities, routes };
}
export interface MapNetwork {
  seatId: string;
  cities: readonly string[];
  color: string;
  name: string;
  seatNumber?: number;
}
function SeatSymbol({ seatNumber }: { seatNumber: number }) {
  switch (seatNumber) {
    case 1:
      return <circle r="2.8" />;
    case 2:
      return <path d="M0-3.5 3.5 0 0 3.5-3.5 0Z" />;
    case 3:
      return <rect x="-3" y="-3" width="6" height="6" />;
    case 4:
      return <path d="M0-3.8 3.8 3H-3.8Z" />;
    case 5:
      return <path d="M-1-4H1V-1H4V1H1V4H-1V1H-4V-1H-1Z" />;
    default:
      return <path d="M-3-3 3 3M3-3-3 3" fill="none" strokeWidth="2" />;
  }
}
export function House({
  color,
  x = 0,
  y = 0,
  seatNumber,
  current = false,
}: {
  color: string;
  x?: number;
  y?: number;
  seatNumber?: number;
  current?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={current ? 'pg-map-house--current' : undefined}
    >
      {current && <path d="M-10 15H10" stroke="#243d34" strokeWidth="3" />}
      <path
        d="M-10 1 0-9 10 1V12H-10Z"
        fill={color}
        stroke="#17221d"
        strokeWidth="1.7"
      />
      {seatNumber ? (
        <g
          transform="translate(0 4)"
          fill="#fffdf0"
          stroke="#17221d"
          strokeWidth=".6"
        >
          <SeatSymbol seatNumber={seatNumber} />
        </g>
      ) : (
        <path d="M-5 1H-1V5H-5Z" fill="#fff9cf" />
      )}
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
  phase,
  step = 1,
  actor = null,
  role = 'public',
  previewRegions = false,
  viewport,
  onViewportChange,
}: {
  regions: readonly string[];
  networks: readonly MapNetwork[];
  selected: string | null;
  select(city: string): void;
  available?: readonly string[];
  terrain?: string;
  phase?: Phase;
  step?: 1 | 2 | 3;
  actor?: string | null;
  role?: MapRole;
  previewRegions?: boolean;
  viewport?: { scale: number; offset: { x: number; y: number } };
  onViewportChange?(value: {
    scale: number;
    offset: { x: number; y: number };
  }): void;
}) {
  const definitionId = useId().replace(/:/g, '');
  const paperId = `${definitionId}-paper`,
    shadowId = `${definitionId}-house-shadow`;
  const mapView = useSyncExternalStore(
    subscribeView,
    () => savedView(role),
    () => 'board' as MapView,
  );
  const changeView = (value: MapView) => {
    const key = viewKey(role);
    volatileViews.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* Local-only preference. */
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  };
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
    houseCity: string | null;
  } | null>(null);
  const [localScale, setLocalScale] = useState(1);
  const [localOffset, setLocalOffset] = useState({ x: 0, y: 0 });
  const scale = viewport?.scale ?? localScale;
  const offset = viewport?.offset ?? localOffset;
  const setOffset = (value: { x: number; y: number }) => {
    if (onViewportChange) onViewportChange({ scale, offset: value });
    else setLocalOffset(value);
  };
  const [baseScale, setBaseScale] = useState(0.5);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0)
        setBaseScale(
          Math.min(
            rect.width / MAP_FRAME.width,
            rect.height / MAP_FRAME.height,
          ),
        );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const displayScale = Math.max(0.01, baseScale * scale);
  const labelSize = 16 / displayScale;
  const houses = layoutHouses(networks, regions, displayScale);
  const building = phase === undefined || phase === 'building';
  const labels = mapLabels(
    selected,
    regions,
    labelSize,
    displayScale,
    mapView,
    building,
    houses.bounds,
  );
  const occupantsFor = (cityId: string) =>
    networks.filter((network) => network.cities.includes(cityId));
  const zoom = (value: number) => {
    const next = Math.max(1, Math.min(4, value));
    if (onViewportChange)
      onViewportChange({
        scale: next,
        offset: value <= 1 ? { x: 0, y: 0 } : offset,
      });
    else {
      setLocalScale(next);
      if (value <= 1) setLocalOffset({ x: 0, y: 0 });
    }
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
      houseCity:
        event.target instanceof Element
          ? (event.target
              .closest('.pg-map-house-marker')
              ?.closest('[data-city]')
              ?.getAttribute('data-city') ?? null)
          : null,
    };
  };
  const pointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId) || !drag.current) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointers.current.values()],
      state = drag.current;
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
      const houseCity = drag.current?.houseCity;
      if (houseCity && regions.includes(POSITIONS[houseCity]!.region)) {
        select(houseCity);
        if (pointers.current.size === 0) drag.current = null;
        return;
      }
      const transform = event.currentTarget.getScreenCTM();
      if (transform) {
        const point = event.currentTarget.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const position = point.matrixTransform(transform.inverse());
        const candidates = MAP_CITIES.filter((city) =>
          regions.includes(city.region),
        )
          .map((city) => ({
            city,
            distance: Math.hypot(position.x - city.x, position.y - city.y),
          }))
          .sort((a, b) => a.distance - b.distance);
        if (
          candidates[0] &&
          candidates[0].distance <= Math.max(35, 22 / displayScale)
        )
          select(candidates[0].city.id);
      }
    }
    if (pointers.current.size === 0) drag.current = null;
  };
  const selectedCity = selected ? POSITIONS[selected] : null;
  const selectedOccupants = selectedCity ? occupantsFor(selectedCity.id) : [];
  return (
    <section
      className="pg-map-panel pg-map-polished"
      aria-label="德国电网地图"
      data-map-view={mapView}
      data-map-phase={phase ?? 'building'}
    >
      <div className="pg-map-frame" ref={frame}>
        <svg
          className="pg-map"
          role="img"
          aria-label="德国地图，42座城市和连接费用"
          viewBox={`${MAP_FRAME.x} ${MAP_FRAME.y} ${MAP_FRAME.width} ${MAP_FRAME.height}`}
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
              id={paperId}
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <rect width="12" height="12" fill="#e6d6aa" />
              <path d="M0 6H12M6 0V12" stroke="#9e8657" strokeOpacity=".05" />
            </pattern>
            <filter id={shadowId}>
              <feDropShadow
                dx="1"
                dy="2"
                stdDeviation="1.5"
                floodOpacity=".3"
              />
            </filter>
          </defs>
          <rect
            width={MAP_WIDTH}
            height={MAP_HEIGHT}
            rx="28"
            fill={mapView === 'board' ? `url(#${paperId})` : '#edf0e3'}
          />
          {mapView === 'board' && terrain && (
            <image
              className="pg-map-terrain"
              href={terrain}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              preserveAspectRatio="none"
              transform={TERRAIN_ROTATION}
            />
          )}
          {(mapView === 'clear' || !terrain) &&
            GERMANY_REGIONS.map((region) => (
              <path
                key={region.id}
                data-region={region.id}
                data-region-selected={regions.includes(region.id)}
                d={region.path}
                fill={region.color}
                fillOpacity={regions.includes(region.id) ? '.55' : '.14'}
                stroke="#596955"
                strokeOpacity={phase === 'regions' ? '.9' : '.48'}
                strokeWidth={phase === 'regions' ? 5 : 2.5}
                transform={TERRAIN_ROTATION}
              />
            ))}
          {mapView === 'board' && terrain && building && (
            <rect
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill="#fffcec"
              fillOpacity=".12"
            />
          )}
          {mapView === 'board' &&
            terrain &&
            phase === 'regions' &&
            GERMANY_REGIONS.map((region) => (
              <path
                key={region.id}
                d={region.path}
                data-region={region.id}
                data-region-selected={regions.includes(region.id)}
                fill={regions.includes(region.id) ? region.color : '#fffef5'}
                fillOpacity={regions.includes(region.id) ? '.16' : '.78'}
                stroke={regions.includes(region.id) ? '#234d3a' : '#fffdf2'}
                strokeOpacity=".95"
                strokeWidth={regions.includes(region.id) ? '8' : '3'}
                transform={TERRAIN_ROTATION}
              />
            ))}
          <g className="pg-map-routes">
            {GERMANY_EDGES.map((edge) => {
              const a = POSITIONS[edge.from]!,
                b = POSITIONS[edge.to]!;
              const active =
                  regions.includes(a.region) && regions.includes(b.region),
                selectedEdge = selected === a.id || selected === b.id;
              return (
                <g
                  key={`${edge.from}-${edge.to}`}
                  opacity={active ? 1 : 0.18}
                  data-map-edge={`${edge.from}:${edge.to}`}
                >
                  <path
                    d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                    stroke={
                      selectedEdge
                        ? '#fffdf0'
                        : building
                          ? '#f8e8a8'
                          : '#e3c765'
                    }
                    strokeWidth={selectedEdge ? 10 : building ? 7 : 5}
                    fill="none"
                  />
                  <path
                    d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                    stroke={selectedEdge ? '#165947' : '#51482f'}
                    strokeWidth={selectedEdge ? 3 : 2}
                    fill="none"
                  />
                </g>
              );
            })}
            {GERMANY_EDGES.map((edge, index) => {
              const label = labels.routes.get(index);
              const selectedEdge =
                selected === edge.from || selected === edge.to;
              return (
                label && (
                  <g
                    key={`${edge.from}-${edge.to}`}
                    className={`pg-map-route-label ${selectedEdge ? 'pg-map-route-label--selected' : ''}`}
                  >
                    <line
                      x1={label.anchorX}
                      y1={label.anchorY}
                      x2={label.x + label.width / 2}
                      y2={label.y + label.height / 2}
                      stroke="#51482f"
                      strokeWidth={1 / displayScale}
                    />
                    <rect
                      x={label.x}
                      y={label.y}
                      width={label.width}
                      height={label.height}
                      rx={labelSize * 0.25}
                      fill="#fffef7"
                      stroke={selectedEdge ? '#165947' : '#736b51'}
                      strokeWidth={1 / displayScale}
                    />
                    <text
                      x={label.x + label.width / 2}
                      y={label.y + label.height / 2}
                      fontSize={labelSize}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#282d22"
                      fontWeight="700"
                    >
                      {edge.cost}
                    </text>
                  </g>
                )
              );
            })}
          </g>
          {MAP_CITIES.map((city) => {
            const occupants = occupantsFor(city.id),
              active = regions.includes(city.region),
              isSelected = selected === city.id,
              enabled = available.includes(city.id);
            const label = labels.cities.get(city.id);
            return (
              <g
                key={city.id}
                data-city={city.id}
                role="button"
                tabIndex={active ? 0 : -1}
                aria-label={`${city.name} ${city.nameDe}，${occupants.length}家已建设${occupants.length ? `：${occupants.map((network) => `${network.seatNumber ?? networks.indexOf(network) + 1}号 ${network.name}`).join('、')}` : ''}`}
                aria-pressed={isSelected}
                className={`pg-map-city ${isSelected ? 'pg-map-city--selected' : ''}`}
                onKeyDown={(event) => {
                  if (active && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    select(city.id);
                  }
                }}
                transform={`translate(${city.x},${city.y})`}
                opacity={active ? 1 : 0.24}
              >
                <title>
                  {city.name} {city.nameDe}
                </title>
                <circle
                  r={Math.max(35, 22 / displayScale)}
                  fill="transparent"
                />
                {isSelected && (
                  <rect
                    x="-35"
                    y="-20"
                    width="70"
                    height="40"
                    rx="8"
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
                  rx="5"
                  fill={building && enabled ? '#fffef5' : '#eee8d4'}
                  stroke={building && enabled ? '#255e49' : '#635d48'}
                  strokeWidth={building ? 3.5 : 2.5}
                />
                <path
                  d="M-10-13V13M10-13V13"
                  stroke="#776b4e"
                  strokeOpacity=".45"
                  strokeWidth="1.5"
                />
                {occupants.length > 1 &&
                  (() => {
                    const positions = houses.layouts.get(city.id)!;
                    const left =
                      Math.min(...positions.map((point) => point.x)) -
                      12 * houses.houseScale;
                    const top =
                      Math.min(...positions.map((point) => point.y)) -
                      11 * houses.houseScale;
                    const right =
                      Math.max(...positions.map((point) => point.x)) +
                      12 * houses.houseScale;
                    const bottom =
                      Math.max(...positions.map((point) => point.y)) +
                      14 * houses.houseScale;
                    return (
                      <rect
                        className="pg-map-house-group"
                        x={left}
                        y={top}
                        width={right - left}
                        height={bottom - top}
                        rx={3 / displayScale}
                        fill="#fffbea"
                        fillOpacity=".85"
                        stroke="#7e7b60"
                        strokeWidth={1 / displayScale}
                      />
                    );
                  })()}
                {occupants.map((network, index) => (
                  <g
                    key={network.seatId}
                    className="pg-map-house-marker"
                    transform={`translate(${houses.layouts.get(city.id)?.[index]?.x ?? 0} ${houses.layouts.get(city.id)?.[index]?.y ?? 0}) scale(${houses.houseScale})`}
                    filter={`url(#${shadowId})`}
                  >
                    <title>
                      {network.seatNumber ?? networks.indexOf(network) + 1}号{' '}
                      {network.name}
                      {actor === network.seatId ? '，当前行动公司' : ''}
                    </title>
                    <House
                      color={network.color}
                      seatNumber={
                        network.seatNumber ?? networks.indexOf(network) + 1
                      }
                      current={active && actor === network.seatId}
                    />
                  </g>
                ))}
                {!occupants.length && (
                  <path
                    d="M-20 0H20M0-7V7"
                    stroke={building && enabled ? '#3f7556' : '#918976'}
                    strokeWidth="3"
                  />
                )}
                {label && (
                  <g pointerEvents="none" className="pg-map-city-label">
                    <line
                      x1="0"
                      y1="0"
                      x2={label.x + label.width / 2 - city.x}
                      y2={label.y + label.height / 2 - city.y}
                      stroke="#786f58"
                      strokeWidth={1 / displayScale}
                    />
                    <rect
                      x={label.x - city.x}
                      y={label.y - city.y}
                      width={label.width}
                      height={label.height}
                      rx={labelSize * 0.2}
                      fill="#fffef7"
                      fillOpacity=".97"
                      stroke={isSelected ? '#165947' : '#b2aa91'}
                      strokeWidth={1 / displayScale}
                    />
                    <text
                      className="pg-map-city-name"
                      x={label.x + label.width / 2 - city.x}
                      y={label.y + label.height / 2 - city.y}
                      textAnchor="middle"
                      dominantBaseline="central"
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
          {phase === 'regions' &&
            GERMANY_REGIONS.map((region) => {
              const cities = MAP_CITIES.filter(
                (city) => city.region === region.id,
              );
              const x =
                cities.reduce((sum, city) => sum + city.x, 0) / cities.length;
              const y =
                cities.reduce((sum, city) => sum + city.y, 0) / cities.length;
              const width = (region.name.length + 1) * labelSize;
              return (
                <g
                  key={region.id}
                  className="pg-map-region-label"
                  pointerEvents="none"
                >
                  <rect
                    x={x - width / 2}
                    y={y - labelSize}
                    width={width}
                    height={labelSize * 1.8}
                    rx={labelSize * 0.2}
                    fill="#fffef5"
                    stroke={regions.includes(region.id) ? '#234d3a' : '#999b88'}
                    strokeWidth={1.5 / displayScale}
                  />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={labelSize}
                    fill="#243b2b"
                    fontWeight="700"
                  >
                    {region.name}
                  </text>
                </g>
              );
            })}
        </svg>
        <div className="pg-map-view-switch" role="group" aria-label="地图视图">
          <button
            type="button"
            aria-pressed={mapView === 'board'}
            onClick={() => changeView('board')}
          >
            棋盘
          </button>
          <button
            type="button"
            aria-pressed={mapView === 'clear'}
            onClick={() => changeView('clear')}
          >
            清晰
          </button>
        </div>
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
            }}
          >
            全图
          </button>
        </div>
      </div>
      {previewRegions && (
        <p className="pg-region-preview" data-region-preview>
          <strong>候选区域 · 未确认</strong>
          <span>
            {GERMANY_REGIONS.filter((region) => regions.includes(region.id))
              .map((region) => region.name)
              .join('、') || '尚未选择'}
          </span>
        </p>
      )}
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
          <div className="pg-map-city-information">
            <div className="pg-city-slots" aria-label="城市位置费用图例">
              <strong>城位费（电币）</strong>
              <div className="pg-city-slot-values">
                {[10, 15, 20].map((price, index) => {
                  const occupied = selectedOccupants.length > index,
                    locked = index >= step;
                  const state = occupied ? '已占' : locked ? '未开放' : '可用';
                  return (
                    <span
                      key={price}
                      className={`${occupied ? 'occupied' : ''} ${locked ? 'pg-map-slot--locked' : ''}`}
                      title={`第${index + 1}个位置，${price}电币，${state}`}
                    >
                      <b>
                        {price}
                        {locked && (
                          <svg
                            className="pg-map-lock"
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                          >
                            <path d="M5 7V5a3 3 0 0 1 6 0v2M3 7h10v7H3Z" />
                          </svg>
                        )}
                      </b>
                      <span className="pg-map-slot-state">{state}</span>
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="pg-map-occupancy" aria-label="当前城市公开占用">
              <strong>已建 {selectedOccupants.length} 家</strong>
              {selectedOccupants.map((network) => (
                <span
                  className={`pg-map-occupant ${actor === network.seatId ? 'pg-map-occupant--current' : ''}`}
                  key={network.seatId}
                  title={`${network.seatNumber ?? networks.indexOf(network) + 1}号 ${network.name}${actor === network.seatId ? '，当前行动公司' : ''}`}
                >
                  <span
                    className="pg-map-seat"
                    style={{
                      backgroundColor: network.color,
                      color: network.color === '#f5c92b' ? '#26332a' : '#fff',
                    }}
                  >
                    {network.seatNumber ?? networks.indexOf(network) + 1}
                  </span>
                  <svg
                    className="pg-map-seat-symbol"
                    viewBox="-5 -5 10 10"
                    aria-hidden="true"
                  >
                    <SeatSymbol
                      seatNumber={
                        network.seatNumber ?? networks.indexOf(network) + 1
                      }
                    />
                  </svg>
                  <span className="pg-map-occupant-name">{network.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
