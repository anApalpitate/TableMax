/* eslint-disable react-refresh/only-export-components -- Shared presentation context. */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  canvasFits,
  canvasSizes,
  clientPointToLogical,
  logicalPointToClient,
  readCanvasPreference,
  saveCanvasPreference,
  selectCanvasLayout,
  type CanvasLayout,
  type CanvasPoint,
  type CanvasPreference,
  type CanvasRect,
  type CanvasRole,
} from './fixed-layout';
import './fixed-canvas.css';

export interface GameLayout {
  layout: CanvasLayout;
  logicalSize: { width: number; height: number };
  availableRect: CanvasRect;
  offset: CanvasPoint;
  scale: 1;
  fitStatus: 'fits' | 'fallback' | 'overflow';
  selectionReason: string;
  revision: number;
  preference: CanvasPreference;
  setPreference(value: CanvasPreference): void;
  clientToLogical(point: CanvasPoint): CanvasPoint;
  logicalToClient(point: CanvasPoint): CanvasPoint;
}
const Context = createContext<GameLayout | null>(null);
export function useGameLayout() {
  return useContext(Context);
}
function initialSpace(): CanvasRect {
  return {
    x: 0,
    y: 0,
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  };
}
function storedPreference() {
  try {
    return readCanvasPreference(window.localStorage);
  } catch {
    return 'auto' as const;
  }
}
export function FixedCanvasFrame({
  role,
  children,
  preference: controlledPreference,
}: {
  role: CanvasRole;
  children: ReactNode;
  preference?: CanvasPreference;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [preference, updatePreference] = useState(storedPreference);
  const effectivePreference = controlledPreference ?? preference;
  const [space, setSpace] = useState(initialSpace);
  const [selection, setSelection] = useState(() =>
    selectCanvasLayout(space, role, effectivePreference),
  );
  const current = useRef(selection);
  const selectionSpace = useRef(space);
  const explicitChange = useRef(false);
  const [revision, setRevision] = useState(0);
  const setPreference = useCallback((next: CanvasPreference) => {
    explicitChange.current = true;
    updatePreference(next);
    try {
      saveCanvasPreference(window.localStorage, next);
    } catch {
      // Storage-less windows still keep this explicit selection in memory.
    }
  }, []);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let animation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastWidth = element.clientWidth;
    const commit = (next: typeof selection) => {
      if (
        current.current.layout !== next.layout ||
        current.current.fitStatus !== next.fitStatus ||
        current.current.selectionReason !== next.selectionReason
      ) {
        current.current = next;
        setSelection(next);
        setRevision((value) => value + 1);
      }
    };
    const measure = () => {
      animation = 0;
      clearTimeout(timer);
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const left = parseFloat(style.paddingLeft) || 0;
      const right = parseFloat(style.paddingRight) || 0;
      const top = parseFloat(style.paddingTop) || 0;
      const bottom = parseFloat(style.paddingBottom) || 0;
      const nextSpace = {
        x: rect.x + left - element.scrollLeft,
        y: rect.y + top - element.scrollTop,
        width: Math.max(0, element.clientWidth - left - right),
        height: Math.max(0, element.clientHeight - top - bottom),
      };
      setSpace((old) =>
        Object.keys(nextSpace).every(
          (key) =>
            old[key as keyof CanvasRect] === nextSpace[key as keyof CanvasRect],
        )
          ? old
          : nextSpace,
      );
      const focused = document.activeElement?.matches(
        'input,textarea,[contenteditable="true"]',
      );
      const keyboardOnly = focused && lastWidth === nextSpace.width;
      lastWidth = nextSpace.width;
      if (!keyboardOnly) selectionSpace.current = nextSpace;
      let selected = selectCanvasLayout(
        selectionSpace.current,
        role,
        effectivePreference,
        current.current.layout,
      );
      // A keyboard may hold composition steady, but visible-space reporting
      // must still expose the shortage and keep the scroll fallback available.
      if (keyboardOnly && !canvasFits(nextSpace, selected.layout))
        selected = {
          ...selected,
          fitStatus: 'overflow',
          selectionReason: 'overflow',
        };
      if (
        selected.layout !== current.current.layout &&
        canvasFits(nextSpace, current.current.layout) &&
        !explicitChange.current
      ) {
        timer = setTimeout(() => commit(selected), 150);
      } else commit(selected);
      explicitChange.current = false;
    };
    const schedule = () => {
      if (!animation) animation = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    element.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('focusout', schedule);
    document.addEventListener('focusin', schedule);
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animation);
      clearTimeout(timer);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      element.removeEventListener('scroll', schedule);
      document.removeEventListener('focusout', schedule);
      document.removeEventListener('focusin', schedule);
    };
  }, [role, effectivePreference]);
  const value = useMemo<GameLayout>(() => {
    const logicalSize = canvasSizes[selection.layout];
    const renderedRect = () =>
      canvas.current?.getBoundingClientRect() ?? {
        x: space.x,
        y: space.y,
        ...logicalSize,
      };
    return {
      ...selection,
      logicalSize,
      availableRect: space,
      offset: {
        x: space.x + Math.max(0, (space.width - logicalSize.width) / 2),
        y: space.y + Math.max(0, (space.height - logicalSize.height) / 2),
      },
      scale: 1,
      revision,
      preference: effectivePreference,
      setPreference,
      clientToLogical: (point) =>
        clientPointToLogical(point, renderedRect(), logicalSize),
      logicalToClient: (point) =>
        logicalPointToClient(point, renderedRect(), logicalSize),
    };
  }, [selection, space, revision, effectivePreference, setPreference]);
  const logicalSize = canvasSizes[selection.layout];
  const style = {
    '--tablemax-canvas-width': `${logicalSize.width}px`,
    '--tablemax-canvas-height': `${logicalSize.height}px`,
  } as CSSProperties;
  return (
    <Context.Provider value={value}>
      <div
        ref={viewport}
        className="tablemax-canvas-viewport"
        data-canvas-viewport
        data-fit-status={selection.fitStatus}
        data-layout-revision={revision}
        data-available-width={space.width}
        data-available-height={space.height}
      >
        <div
          ref={canvas}
          className="tablemax-fixed-canvas"
          data-fixed-canvas
          data-player-layout-contract={
            role === 'player' ? 'fixed-v1' : undefined
          }
          data-canvas-layout={selection.layout}
          data-player-layout={
            role === 'player'
              ? selection.layout === 'player-landscape'
                ? 'wide'
                : 'portrait'
              : undefined
          }
          style={style}
        >
          {children}
        </div>
        {selection.fitStatus === 'overflow' && (
          <p className="tablemax-viewport-notice" role="status">
            空间不足，可滚动查看或调整窗口
          </p>
        )}
      </div>
    </Context.Provider>
  );
}
/** Insert into the game's existing action/header slot; never add a frame rail. */
export function PlayerLayoutControl() {
  const layout = useGameLayout();
  if (!layout || layout.layout === 'host-landscape') return null;
  return (
    <label className="tablemax-layout-control">
      <span className="tablemax-visually-hidden">显示布局</span>
      <select
        aria-label="显示布局"
        value={layout.preference}
        onChange={(event) =>
          layout.setPreference(event.target.value as CanvasPreference)
        }
      >
        <option value="auto">自动</option>
        <option value="portrait">竖屏</option>
        <option value="wide">横屏</option>
      </select>
      {layout.fitStatus === 'fallback' && (
        <span className="tablemax-visually-hidden" role="status">
          已切换到可容纳的布局，保留你的显示选择
        </span>
      )}
    </label>
  );
}
