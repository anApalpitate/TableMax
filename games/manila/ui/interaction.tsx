/* eslint-disable react-refresh/only-export-components -- Manila's interaction state and its small controls share one local module. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Action, CargoId, ManilaView } from '../rules/view';
import { CloseMark } from './Theme';

export type Carry =
  | { kind: 'worker' }
  | { kind: 'cargo'; cargo: CargoId }
  | { kind: 'start'; lane: number }
  | { kind: 'pilot'; cargo: CargoId }
  | { kind: 'pirate' }
  | { kind: 'plunder'; cargo: CargoId };
type SetupAction = Extract<Action, { type: 'setup' }>;
type Interaction = {
  boundary: string;
  game: ManilaView;
  actions: Action[];
  locked: boolean;
  draft: Action | null;
  select(action: Action | null): void;
  cargos: CargoId[];
  positions: number[];
  setupStep: number;
  setSetupStep(value: number): void;
  setCargo(lane: number, cargo: CargoId): void;
  setPosition(lane: number, position: number): void;
  setupAction: SetupAction | undefined;
  deltas: Record<string, number>;
  setDelta(cargo: CargoId, delta: number): void;
  clearPilot(): void;
  pilotAction: Extract<Action, { type: 'pilot' }> | undefined;
  carry: Carry | null;
  setCarry(value: Carry | null): void;
  hoverTarget: string | null;
  setHoverTarget(value: string | null): void;
  hoverNode: string | null;
  setHoverNode(value: string | null): void;
  activeRail: number | null;
  setActiveRail(value: number | null): void;
  canDrop(token: Carry, target: string): boolean;
  drop(token: Carry, target: string): void;
  point: { x: number; y: number; label: string } | null;
  setPoint(value: { x: number; y: number; label: string } | null): void;
};
const Context = createContext<Interaction | null>(null);
export function useManilaInteraction(): Interaction {
  const value = useContext(Context);
  if (!value) throw new Error('Manila interaction provider is missing');
  return value;
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function railTarget(
  node: Element | null,
  x: number,
  y: number,
): string | undefined {
  const rail =
    node?.closest<HTMLElement>('[data-manila-rail]') ??
    node?.closest('.mn-lane')?.querySelector<HTMLElement>('[data-manila-rail]');
  if (!rail) return;
  const rect = rail.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom)
    return;
  const vertical =
    getComputedStyle(rail).getPropertyValue('--mn-vertical').trim() === '1';
  const fraction = vertical
    ? (rect.bottom - y) / rect.height
    : (x - rect.left) / rect.width;
  const position = Math.max(0, Math.min(15, Math.round(fraction * 13)));
  return rail.dataset.railLane !== undefined
    ? `start:${rail.dataset.railLane}:${position}`
    : `pilot:${rail.dataset.railCargo}:${position - Number(rail.dataset.railPosition)}`;
}
function hitTarget(
  x: number,
  y: number,
): { target: string | undefined; node: string | null } {
  const hit = document.elementFromPoint(x, y);
  const button = hit?.closest<HTMLElement>('[data-manila-drop]');
  return {
    target: button?.dataset.manilaDrop ?? railTarget(hit, x, y),
    node: button?.dataset.mnDropNode ?? null,
  };
}
export function ManilaInteraction({
  boundary = '',
  game,
  actions,
  locked,
  draft,
  select,
  children,
}: {
  boundary?: string;
  game: ManilaView;
  actions: Action[];
  locked: boolean;
  draft: Action | null;
  select(action: Action | null): void;
  children: ReactNode;
}) {
  const setups = actions.filter(
    (action): action is SetupAction => action.type === 'setup',
  );
  const pilots = actions.filter(
    (action): action is Extract<Action, { type: 'pilot' }> =>
      action.type === 'pilot',
  );
  const [cargos, setCargos] = useState<CargoId[]>(
    setups[0]?.cargos ?? game.cargos.slice(0, 3).map((cargo) => cargo.id),
  );
  const [positions, setPositions] = useState<number[]>([3, 3, 3]);
  const [setupStep, setSetupStep] = useState(1);
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const [carry, setCarried] = useState<Carry | null>(null);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [activeRail, setActiveRail] = useState<number | null>(null);
  const setCarry = useCallback(
    (value: Carry | null) => {
      setCarried(value);
      if (!value) {
        setActiveRail(null);
        setHoverTarget(null);
        setHoverNode(null);
      }
    },
    [setActiveRail, setHoverTarget, setHoverNode],
  );
  const [point, setPoint] = useState<Interaction['point']>(null);
  const [previousBoundary, setPreviousBoundary] = useState(boundary);
  const [previousLocked, setPreviousLocked] = useState(locked);
  if (previousBoundary !== boundary) {
    setPreviousBoundary(boundary);
    setCargos(
      setups[0]?.cargos ?? game.cargos.slice(0, 3).map((cargo) => cargo.id),
    );
    setPositions([3, 3, 3]);
    setSetupStep(1);
    setDeltas({});
    setCarry(null);
    setPoint(null);
  }
  if (previousLocked !== locked) {
    setPreviousLocked(locked);
    if (locked) {
      setCarry(null);
      setPoint(null);
    }
  }
  const setupAction = setups.find(
    (action) =>
      same(action.cargos, cargos) && same(action.positions, positions),
  );
  const pilotMatch = (next: Record<string, number>) =>
    pilots.find((action) =>
      game.boats.every(
        (boat) =>
          (action.moves.find((move) => move.cargo === boat.cargo)?.delta ??
            0) === (next[boat.cargo] ?? 0),
      ),
    );
  const setCargo = (lane: number, cargo: CargoId) =>
    setCargos((previous) =>
      previous.map((entry, index) =>
        index === lane ? cargo : entry === cargo ? previous[lane]! : entry,
      ),
    );
  const setPosition = (lane: number, position: number) =>
    setPositions((previous) =>
      previous.map((entry, index) => (index === lane ? position : entry)),
    );
  const setDelta = (cargo: CargoId, delta: number) =>
    setDeltas((previous) => ({ ...previous, [cargo]: delta }));
  const actionFor = (type: Action['type'], test: (action: Action) => boolean) =>
    actions.find((action) => action.type === type && test(action));
  const canDrop = (token: Carry, target: string) => {
    if (locked) return false;
    const [kind, id, amount] = target.split(':');
    if (token.kind === 'worker' && kind === 'space')
      return !!actionFor(
        'place',
        (action) => action.type === 'place' && action.space === id,
      );
    if (token.kind === 'cargo' && kind === 'cargo')
      return setups.length > 0 && Number(id) >= 0 && Number(id) < 3;
    if (token.kind === 'start' && kind === 'start')
      return (
        setups.length > 0 &&
        token.lane === Number(id) &&
        Number(amount) >= 0 &&
        Number(amount) <= 5
      );
    if (token.kind === 'pilot' && kind === 'pilot' && token.cargo === id)
      return !!pilotMatch({ ...deltas, [id]: Number(amount) });
    if (token.kind === 'pirate' && kind === 'board')
      return !!actionFor(
        'board',
        (action) => action.type === 'board' && action.cargo === id,
      );
    if (token.kind === 'plunder' && kind === 'destination')
      return !!actionFor(
        'plunder',
        (action) =>
          action.type === 'plunder' &&
          action.cargo === token.cargo &&
          action.destination === id,
      );
    return false;
  };
  const drop = (token: Carry, target: string) => {
    if (!canDrop(token, target)) return;
    const [kind, id, amount] = target.split(':');
    if (kind === 'space')
      select(
        actionFor(
          'place',
          (action) => action.type === 'place' && action.space === id,
        ) ?? null,
      );
    if (token.kind === 'cargo' && kind === 'cargo')
      setCargo(Number(id), token.cargo);
    if (kind === 'start') setPosition(Number(id), Number(amount));
    if (kind === 'pilot') setDelta(id as CargoId, Number(amount));
    if (kind === 'board')
      select(
        actionFor(
          'board',
          (action) => action.type === 'board' && action.cargo === id,
        ) ?? null,
      );
    if (token.kind === 'plunder' && kind === 'destination')
      select(
        actionFor(
          'plunder',
          (action) =>
            action.type === 'plunder' &&
            action.cargo === token.cargo &&
            action.destination === id,
        ) ?? null,
      );
    setCarry(null);
    setPoint(null);
  };
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCarry(null);
        setPoint(null);
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('.mn-position-controls')
      )
        setActiveRail(null);
    };
    window.addEventListener('keydown', cancel);
    window.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', cancel);
      window.removeEventListener('pointerdown', outside);
    };
  }, [setCarry]);
  return (
    <Context
      value={{
        boundary,
        game,
        actions,
        locked,
        draft,
        select,
        cargos,
        positions,
        setupStep,
        setSetupStep,
        setCargo,
        setPosition,
        setupAction,
        deltas,
        setDelta,
        clearPilot: () => setDeltas({}),
        pilotAction: pilotMatch(deltas),
        carry: locked ? null : carry,
        setCarry,
        hoverTarget: locked ? null : hoverTarget,
        setHoverTarget,
        hoverNode: locked ? null : hoverNode,
        setHoverNode,
        activeRail: locked ? null : activeRail,
        setActiveRail,
        canDrop,
        drop,
        point: locked ? null : point,
        setPoint,
      }}
    >
      {children}
      {point &&
        !locked &&
        createPortal(
          <div
            className="mn-drag-ghost"
            style={{ left: point.x, top: point.y }}
            aria-hidden="true"
          >
            {point.label}
          </div>,
          document.body,
        )}
      <span className="mn-sr-only" role="status" aria-live="polite">
        {carry && !locked ? '已拿起棋子，选择亮起的目标；按Esc取消。' : ''}
      </span>
    </Context>
  );
}

export function DragSource({
  token,
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  token: Carry;
  label: string;
  children: ReactNode;
}) {
  const state = useManilaInteraction();
  const { setPoint, setCarry, setHoverTarget } = state;
  const gesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pointer: number;
    target: HTMLButtonElement;
  } | null>(null);
  const suppressClick = useRef(false);
  const releaseGesture = useCallback(() => {
    const active = gesture.current;
    gesture.current = null;
    if (!active) return;
    suppressClick.current = true;
    // The browser may already have released capture during a device rotation.
    try {
      if (active.target.hasPointerCapture(active.pointer))
        active.target.releasePointerCapture(active.pointer);
    } catch {
      // A pointer that has already ended has no capture left to release.
    }
  }, []);
  useEffect(() => {
    const cancelViewportGesture = () => {
      releaseGesture();
      setPoint(null);
      setCarry(null);
    };
    const cancelKeyGesture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelViewportGesture();
    };
    window.addEventListener('resize', cancelViewportGesture);
    window.addEventListener('orientationchange', cancelViewportGesture);
    window.addEventListener('keydown', cancelKeyGesture);
    return () => {
      window.removeEventListener('resize', cancelViewportGesture);
      window.removeEventListener('orientationchange', cancelViewportGesture);
      window.removeEventListener('keydown', cancelKeyGesture);
      releaseGesture();
    };
  }, [releaseGesture, setPoint, setCarry]);
  useLayoutEffect(() => {
    releaseGesture();
    return releaseGesture;
  }, [state.boundary, releaseGesture]);
  useLayoutEffect(() => {
    if (state.locked) releaseGesture();
  }, [state.locked, releaseGesture]);
  return (
    <button
      {...props}
      type="button"
      className={`mn-drag-source ${className}`}
      data-mn-drag={
        token.kind === 'cargo' ||
        token.kind === 'pilot' ||
        token.kind === 'plunder'
          ? `${token.kind}:${token.cargo}`
          : token.kind === 'start'
            ? `setup:${token.lane}`
            : token.kind
      }
      disabled={state.locked || props.disabled}
      aria-label={label}
      aria-pressed={same(state.carry, token)}
      onPointerDown={(event) => {
        if (event.button !== 0 || state.locked || gesture.current) return;
        gesture.current = {
          x: event.clientX,
          y: event.clientY,
          moved: false,
          pointer: event.pointerId,
          target: event.currentTarget,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active || state.locked) return;
        if (
          !active.moved &&
          Math.hypot(event.clientX - active.x, event.clientY - active.y) < 7
        )
          return;
        active.moved = true;
        state.setCarry(token);
        const hit = hitTarget(event.clientX, event.clientY);
        const target = hit.target;
        setHoverTarget(target && state.canDrop(token, target) ? target : null);
        state.setHoverNode(
          target && state.canDrop(token, target) ? hit.node : null,
        );
        const amount = Number(target?.split(':')[2]);
        const hint =
          target &&
          (token.kind === 'start' || token.kind === 'pilot') &&
          state.canDrop(token, target)
            ? token.kind === 'start'
              ? `起点 ${amount} 格`
              : `${amount >= 0 ? '前进' : '后退'} ${Math.abs(amount)} 格`
            : token.kind === 'worker'
              ? '派遣伙伴'
              : token.kind === 'cargo'
                ? '装入货物'
                : token.kind === 'pirate'
                  ? '海盗登船'
                  : token.kind === 'plunder'
                    ? '选择去向'
                    : '调整位置';
        state.setPoint({ x: event.clientX, y: event.clientY, label: hint });
      }}
      onPointerUp={(event) => {
        const active = gesture.current;
        gesture.current = null;
        state.setPoint(null);
        if (active?.moved) {
          suppressClick.current = true;
          const target = hitTarget(event.clientX, event.clientY).target;
          if (target) state.drop(token, target);
          state.setCarry(null);
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        releaseGesture();
        state.setPoint(null);
        state.setCarry(null);
        suppressClick.current = true;
      }}
      onLostPointerCapture={() => {
        if (gesture.current) {
          releaseGesture();
          state.setPoint(null);
          state.setCarry(null);
        }
      }}
      onClick={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        state.setCarry(same(state.carry, token) ? null : token);
        props.onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}

export function DropTarget({
  target,
  token,
  onClick,
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  target: string;
  token: Carry;
  children: ReactNode;
}) {
  const state = useManilaInteraction();
  const nodeId = useId();
  const legal = state.canDrop(state.carry ?? token, target);
  return (
    <button
      {...props}
      type="button"
      data-manila-drop={target}
      data-mn-drop={target}
      data-mn-drop-node={nodeId}
      className={`mn-drop-target ${className}${state.carry && legal && state.hoverNode === nodeId ? ' mn-drop-ready' : ''}`}
      disabled={state.locked || props.disabled}
      onClick={(event) => {
        if (legal) state.drop(state.carry ?? token, target);
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}

export function DetailButton({
  title,
  children,
  detail,
  className = '',
}: {
  title: string;
  children: ReactNode;
  detail: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancelTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const show = () => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const viewportBottom = window.innerHeight - margin;
    const confirmationTop = [
      ...document.querySelectorAll<HTMLElement>('.mn-confirm'),
    ]
      .filter((node) => {
        const box = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return (
          box.width > 0 &&
          box.height > 0 &&
          box.top < window.innerHeight &&
          box.bottom > 0 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      })
      .reduce(
        (limit, node) =>
          Math.min(limit, node.getBoundingClientRect().top - margin),
        viewportBottom,
      );
    const bottomLimit = Math.min(viewportBottom, confirmationTop);
    const aboveEnd = Math.min(rect.top - margin, bottomLimit);
    const belowStart = Math.max(margin, rect.bottom + margin);
    const aboveSpace = Math.max(0, aboveEnd - margin);
    const belowSpace = Math.max(0, bottomLimit - belowStart);
    const above = aboveSpace > belowSpace;
    const available = above ? aboveSpace : belowSpace;
    if (available <= 0) return;
    setPosition({
      left: Math.max(
        margin,
        Math.min(
          rect.left,
          window.innerWidth - Math.min(360, window.innerWidth - 16) - margin,
        ),
      ),
      ...(above
        ? { bottom: window.innerHeight - aboveEnd }
        : { top: belowStart }),
      maxHeight: Math.min(420, available),
      overflowY: 'auto',
    });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (
        !card.current?.contains(event.target as Node) &&
        !button.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <>
      <button
        ref={button}
        type="button"
        className={`mn-detail-button ${className}`}
        aria-label={title}
        aria-expanded={open}
        aria-haspopup="dialog"
        onPointerDown={() => {
          held.current = false;
          cancelTimer();
          timer.current = setTimeout(() => {
            held.current = true;
            show();
          }, 450);
        }}
        onPointerUp={cancelTimer}
        onPointerCancel={cancelTimer}
        onPointerLeave={cancelTimer}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          if (open) setOpen(false);
          else show();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={card}
            className="mn-theme mn-detail-card"
            role="dialog"
            aria-label={title}
            style={position}
          >
            <header>
              <strong>{title}</strong>
              <button
                type="button"
                className="mn-close"
                aria-label={`关闭${title}`}
                onClick={() => {
                  setOpen(false);
                  button.current?.focus({ preventScroll: true });
                }}
              >
                <CloseMark />
              </button>
            </header>
            <div>{detail}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
