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
import {
  fixedFocusedCanvasSelection,
  fixedVisualViewportClip,
} from './fixed-visible-viewport';
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
  const boundary = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [preference, updatePreference] = useState(storedPreference);
  const effectivePreference = controlledPreference ?? preference;
  const [space, setSpace] = useState(initialSpace);
  const [selection, setSelection] = useState(() =>
    selectCanvasLayout(space, role, effectivePreference),
  );
  const current = useRef(selection);
  const [offset, setOffset] = useState<CanvasPoint>(() => ({
    x:
      space.x +
      Math.max(0, (space.width - canvasSizes[selection.layout].width) / 2),
    y:
      space.y +
      Math.max(0, (space.height - canvasSizes[selection.layout].height) / 2),
  }));
  const measuredPreference = useRef(effectivePreference);
  const measuredSpace = useRef(space);
  const measuredOffset = useRef(offset);
  const measuredScroll = useRef({ left: 0, top: 0 });
  const measureNow = useRef<(() => void) | null>(null);
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
    const container = boundary.current;
    if (!element || !container) return;
    const visualViewport = window.visualViewport;
    let animation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastWidth = element.offsetWidth;
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
      const containerRect = container.getBoundingClientRect();
      const clip = fixedVisualViewportClip(containerRect, visualViewport);
      Object.assign(element.style, {
        left: `${clip.x}px`,
        top: `${clip.y}px`,
        width: `${clip.width}px`,
        height: `${clip.height}px`,
      });
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const left = parseFloat(style.paddingLeft) || 0;
      const right = parseFloat(style.paddingRight) || 0;
      const top = parseFloat(style.paddingTop) || 0;
      const bottom = parseFloat(style.paddingBottom) || 0;
      const nextSpace = {
        x: rect.x + element.clientLeft + left,
        y: rect.y + element.clientTop + top,
        width: Math.max(0, element.clientWidth - left - right),
        height: Math.max(0, element.clientHeight - top - bottom),
      };
      container.style.setProperty(
        '--tablemax-visible-left',
        `${nextSpace.x - containerRect.x}px`,
      );
      container.style.setProperty(
        '--tablemax-visible-top',
        `${nextSpace.y - containerRect.y}px`,
      );
      container.style.setProperty(
        '--tablemax-visible-width',
        `${nextSpace.width}px`,
      );
      container.style.setProperty(
        '--tablemax-visible-height',
        `${nextSpace.height}px`,
      );
      // An overflowing composition can create scrollbars which disappear when
      // another composition fits. Do not let those transient bars lock out that
      // candidate. The context still reports the actual visible client area.
      const candidateSpace = {
        ...nextSpace,
        width:
          style.overflowY === 'auto' && style.scrollbarGutter === 'auto'
            ? Math.max(
                0,
                element.offsetWidth -
                  (parseFloat(style.borderLeftWidth) || 0) -
                  (parseFloat(style.borderRightWidth) || 0) -
                  left -
                  right,
              )
            : nextSpace.width,
        height:
          style.overflowX === 'auto'
            ? Math.max(
                0,
                element.offsetHeight -
                  (parseFloat(style.borderTopWidth) || 0) -
                  (parseFloat(style.borderBottomWidth) || 0) -
                  top -
                  bottom,
              )
            : nextSpace.height,
      };
      let geometryChanged = false;
      if (
        !Object.keys(nextSpace).every(
          (key) =>
            measuredSpace.current[key as keyof CanvasRect] ===
            nextSpace[key as keyof CanvasRect],
        )
      ) {
        measuredSpace.current = nextSpace;
        setSpace(nextSpace);
        geometryChanged = true;
      }
      const canvasRect = canvas.current?.getBoundingClientRect();
      const nextOffset = canvasRect
        ? { x: canvasRect.x, y: canvasRect.y }
        : {
            x: nextSpace.x - element.scrollLeft,
            y: nextSpace.y - element.scrollTop,
          };
      if (
        measuredOffset.current.x !== nextOffset.x ||
        measuredOffset.current.y !== nextOffset.y
      ) {
        measuredOffset.current = nextOffset;
        setOffset(nextOffset);
        geometryChanged = true;
      }
      if (
        measuredScroll.current.left !== element.scrollLeft ||
        measuredScroll.current.top !== element.scrollTop
      ) {
        measuredScroll.current = {
          left: element.scrollLeft,
          top: element.scrollTop,
        };
        geometryChanged = true;
      }
      // A scroll changes coordinates even when the visible scrollport is stable.
      if (geometryChanged) setRevision((value) => value + 1);
      const focused = document.activeElement?.matches(
        'input,textarea,[contenteditable="true"]',
      );
      const keyboardOnly =
        focused &&
        lastWidth === element.offsetWidth &&
        measuredPreference.current === effectivePreference &&
        !explicitChange.current;
      lastWidth = element.offsetWidth;
      measuredPreference.current = effectivePreference;
      // Keep the focused composition, while deriving both shortage and recovery
      // from the current scrollport rather than a space captured before blur.
      const selected = keyboardOnly
        ? fixedFocusedCanvasSelection(
            nextSpace,
            role,
            effectivePreference,
            current.current.layout,
          )
        : selectCanvasLayout(
            candidateSpace,
            role,
            effectivePreference,
            current.current.layout,
          );
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
    observer.observe(container);
    observer.observe(element);
    if (canvas.current) observer.observe(canvas.current);
    window.addEventListener('resize', schedule);
    visualViewport?.addEventListener('resize', schedule);
    visualViewport?.addEventListener('scroll', schedule);
    element.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('focusout', schedule);
    document.addEventListener('focusin', schedule);
    measureNow.current = measure;
    measure();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animation);
      clearTimeout(timer);
      window.removeEventListener('resize', schedule);
      visualViewport?.removeEventListener('resize', schedule);
      visualViewport?.removeEventListener('scroll', schedule);
      element.removeEventListener('scroll', schedule);
      document.removeEventListener('focusout', schedule);
      document.removeEventListener('focusin', schedule);
      measureNow.current = null;
    };
  }, [role, effectivePreference]);
  useLayoutEffect(() => {
    measureNow.current?.();
  }, [selection.layout]);
  const value = useMemo<GameLayout>(() => {
    const logicalSize = canvasSizes[selection.layout];
    const renderedRect = () =>
      canvas.current?.getBoundingClientRect() ?? {
        ...offset,
        ...logicalSize,
      };
    return {
      ...selection,
      logicalSize,
      availableRect: space,
      offset,
      scale: 1,
      revision,
      preference: effectivePreference,
      setPreference,
      clientToLogical: (point) =>
        clientPointToLogical(point, renderedRect(), logicalSize),
      logicalToClient: (point) =>
        logicalPointToClient(point, renderedRect(), logicalSize),
    };
  }, [selection, space, offset, revision, effectivePreference, setPreference]);
  const logicalSize = canvasSizes[selection.layout];
  const style = {
    '--tablemax-canvas-width': `${logicalSize.width}px`,
    '--tablemax-canvas-height': `${logicalSize.height}px`,
  } as CSSProperties;
  return (
    <Context.Provider value={value}>
      <div
        ref={boundary}
        className="tablemax-canvas-boundary"
        data-canvas-boundary
      >
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
