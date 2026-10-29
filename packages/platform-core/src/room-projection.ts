import type { RoomView } from '@tablemax/protocol';
import { DEFAULT_COUNTDOWN_SECONDS } from '@tablemax/protocol';
import type { Save } from './model';
import type { Identity } from './room';
import type { LoadedGame } from './game-registry';
import { projectDecisionClock } from './countdown';
import { projectAutomaticTiming } from './automatic-timing';
import { projectActionTimings } from './action-timing';
import { pendingTransfers } from './device-transfer';
type ProjectionContext = {
  game: LoadedGame | null;
  catalog: RoomView['catalog'];
  restored: boolean;
  missingRelease: string | null;
  restorationReason: string | null;
  transientBotError: string | null;
};
export function controlsRoom(data: Save, identity: Identity) {
  return (
    identity.role === 'host' ||
    (identity.role === 'player' && identity.seatId === data.ownerSeatId)
  );
}
/** Stateless authorized projection. Never receives a repository, credential or commit callback. */
export function projectRoomView(
  d: Save,
  identity: Identity,
  online: ReadonlySet<string>,
  context: ProjectionContext,
): RoomView {
  const rules = context.game?.rules;
  const seatId = identity.role === 'player' ? identity.seatId : null;
  const snap = d.snapshot;
  const pending =
    snap && seatId && context.game
      ? rules!.decisions(snap.state).find((p) => p.seatId === seatId)
      : undefined;
  return {
    instanceId: d.instanceId,
    revision: d.revision,
    branch: d.branch,
    status: d.status,
    paused: d.paused,
    restored: context.restored,
    joinOpen: d.joinOpen,
    playMode: d.playMode ?? 'play',
    countdownSeconds: d.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS,
    decisionClock: projectDecisionClock(
      d,
      context.game?.rules ?? null,
      seatId,
      Date.now(),
    ),
    game: context.game
      ? {
          id: rules!.manifest.id,
          name: rules!.manifest.name,
          ...rules!.manifest.players,
          decisionTimer: rules!.manifest.decisionTimer !== false,
          ...(d.variantId === undefined ? {} : { variantId: d.variantId }),
          ...(d.releaseRef === undefined ? {} : { releaseRef: d.releaseRef }),
          ...(context.game.restoreOnly ? { restoreOnly: true } : {}),
          ...(rules!.setup
            ? {
                setup: structuredClone(
                  snap && rules!.setup.fromState
                    ? rules!.setup.fromState(snap.state)
                    : (d.gameSetup ?? rules!.setup.defaults),
                ),
              }
            : {}),
        }
      : null,
    catalog: context.catalog,
    ownerSeatId: d.ownerSeatId ?? null,
    ...(identity.role === 'host'
      ? { transferRequests: pendingTransfers(d) }
      : {}),
    capabilities: {
      manage: identity.role === 'host',
      manageSeats: controlsRoom(d, identity),
      control: controlsRoom(d, identity),
    },
    seats: d.seats.map(
      ({ id, name, avatarId, controller, ready, botDifficulty }) => ({
        id,
        name,
        avatarId: avatarId!,
        controller,
        ready,
        online: controller === 'bot' || online.has(id),
        botDifficulty:
          controller === 'bot' ? (botDifficulty ?? 'default') : null,
      }),
    ),
    self: { role: identity.role, seatId },
    gameView:
      snap && context.game
        ? rules!.project(
            structuredClone(snap.state),
            seatId ? { role: 'player', seatId } : { role: 'public' },
          )
        : null,
    decisionId: pending?.id ?? null,
    selectionToken: pending?.id ?? null,
    ...(context.game?.rules.automaticAction
      ? { automaticTiming: projectAutomaticTiming(d, Date.now()) }
      : {}),
    actions:
      pending && !d.paused && d.status === 'playing'
        ? [...rules!.legalActions(structuredClone(snap!.state), seatId!)]
        : [],
    ...(context.game?.rules.actionTiming
      ? {
          actionTiming: projectActionTimings(d, rules!, seatId, Date.now()),
        }
      : {}),
    history:
      identity.role === 'host'
        ? d.history.map(
            (
              { id, label, revealedInformation, seatId, roundNumber },
              index,
            ) => ({
              id,
              label,
              revealedInformation,
              step: index + 1,
              seatId: seatId ?? null,
              roundNumber: roundNumber ?? null,
            }),
          )
        : [],
    lifecycleActions:
      controlsRoom(d, identity) &&
      context.game &&
      snap &&
      !d.paused &&
      !['房主结束', '管理员结束'].includes(d.endReason ?? '')
        ? [...rules!.lifecycleActions(structuredClone(snap.state))].filter(
            (action) =>
              identity.role === 'host' ||
              rules!.lifecyclePermission?.(
                structuredClone(snap.state),
                action,
              ) !== 'host',
          )
        : [],
    botError: context.missingRelease
      ? `${context.restorationReason === 'ambiguous-legacy-release' ? '旧存档匹配到多个游戏发行，无法确定原版本' : context.restorationReason?.startsWith('incompatible-') ? '旧游戏或存档接口与当前程序不兼容' : '旧对局所需游戏版本缺失或损坏'}（${d.manifest?.id ?? '未知游戏'}，游戏 ${d.manifest?.gameVersion ?? '?'}／规则 ${d.manifest?.rulesVersion ?? '?'}，引用 ${context.missingRelease}）。请使用包含该版本且支持此存档格式的旧完整 EXE；原存档已保留。`
      : (d.botError ?? context.transientBotError),
    endReason: d.endReason,
  };
}
