import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  RoomProjectionSchema,
  RoomSyncReplySchema,
  RoomProbeReplySchema,
  RoomCommandStatusReplySchema,
  CommandReplySchema,
  CommandSchema,
  RoomFeedbackSchema,
  NetworkSchema,
  type RoomFeedback,
  type Command,
  type RoomView,
  type AvatarId,
  InteractionEventSchema,
  InteractionReplySchema,
  type InteractionEvent,
  type InteractionPayload,
  type InteractionReply,
} from '@tablemax/protocol';
import { changedGameSlots, gameMotionDuration } from './presentation';
import { navigate, type ScreenRole } from '../navigation';
import { useAdmission } from './useAdmission';
import { randomId } from './randomId';
import { InteractionInbox } from './interactionInbox';
import { recordRoomSyncDiagnostic } from './syncDiagnostics';
import { recordInteractionDiagnostic } from '../interactions/diagnostics';
import {
  feedbackKind,
  feedbackReason,
  feedbackText,
} from '../content/feedback';
import {
  ReliableRoomSync,
  ROOM_SYNC_INTERVAL,
  ROOM_SYNC_TIMEOUT,
  ACTION_CONFIRM_DELAY,
} from './reliableRoomSync';
function credentialFor(role: string) {
  if (role === 'player') return localStorage.getItem('tablemax-player') ?? '';
  if (role === 'public') return '';
  const value = new URLSearchParams(location.hash.slice(1)).get('host');
  if (value) {
    sessionStorage.setItem('tablemax-host', value);
    history.replaceState(null, '', location.pathname);
  }
  return sessionStorage.getItem('tablemax-host') ?? '';
}
export function useRoomSession(role: ScreenRole) {
  const [credential, setCredential] = useState(() => credentialFor(role));
  const [view, setView] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [addresses, setAddresses] = useState<string[]>([]);
  const [adapters, setAdapters] = useState<
    Array<{
      address: string;
      name: string;
      kind: 'lan' | 'virtual' | 'link-local';
    }>
  >([]);
  const [address, setAddress] = useState('');
  const [networkMessage, setNetworkMessage] = useState('');
  const [externalJoinUrl, setExternalJoinUrl] = useState<string | null>(null);
  const refreshNetworkRef = useRef<(() => Promise<void>) | null>(null);
  const saveExternalJoinUrlRef = useRef<
    ((value: string | null) => Promise<boolean>) | null
  >(null);
  const [port, setPort] = useState(38473);
  const [feedback, setFeedback] = useState<RoomFeedback | null>(null);
  const [interaction, setInteraction] = useState<InteractionEvent | null>(null);
  const [interactionResetKey, setInteractionResetKey] = useState(0);
  const interactionListeners = useRef(
    new Set<(event: InteractionEvent, receivedAt: number) => void>(),
  );
  const interactionResetListeners = useRef(new Set<() => void>());
  const resetInteractions = useCallback(() => {
    for (const listener of interactionResetListeners.current) listener();
    setInteraction(null);
    setInteractionResetKey((value) => value + 1);
  }, []);
  const subscribeInteractionResets = useCallback((listener: () => void) => {
    interactionResetListeners.current.add(listener);
    return () => {
      interactionResetListeners.current.delete(listener);
    };
  }, []);
  const subscribeInteractions = useCallback(
    (listener: (event: InteractionEvent, receivedAt: number) => void) => {
      interactionListeners.current.add(listener);
      return () => {
        interactionListeners.current.delete(listener);
      };
    },
    [],
  );
  const interactionSender = useRef<
    (payload: InteractionPayload) => Promise<InteractionReply>
  >(async () => ({ ok: false, reason: 'invalid-identity' }));
  const [errorId, setErrorId] = useState('');
  const [motion, setMotion] = useState<string[]>([]);
  const synced = useRef<RoomView | null>(null);
  const changedSlots = useRef<string[]>([]);
  const lastFeedback = useRef('');
  const motionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pending = useRef<Command | null>(null);
  const pendingImage = useRef<string | null>(null);
  const recoveredImage = useRef(false);
  const sendRef = useRef<(envelope: Command) => void>(() => {});
  const synchronizeRef = useRef<(() => void) | null>(null);
  const queryCommandRef = useRef<(() => void) | null>(null);
  const commandReceiveRef = useRef<(envelope: Command, reply: unknown) => void>(
    () => {},
  );
  const commandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyForAction = useRef<() => boolean>(() => false);
  const identityEpoch = useRef({ value: 0 });
  const admission = useAdmission(
    role === 'player' && !credential,
    setCredential,
    setMessage,
  );
  const cancelAdmission = admission.cancel;
  useEffect(() => {
    const identity = identityEpoch.current;
    identity.value++;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let managedReconnect = false;
    let statusAttempt = 0;
    let queriedEnvelope: Command | null = null;
    let queriedActionId = '';
    const interactionInbox = new InteractionInbox();
    const socket = io({
      auth: credential ? { token: credential } : {},
      transports: ['polling', 'websocket'],
      tryAllTransports: true,
      timeout: ROOM_SYNC_TIMEOUT,
      forceNew: true,
      reconnection: false,
    });
    socketRef.current = socket;
    const applyView = (
      next: RoomView,
      source: 'broadcast' | 'sync',
      restoring: boolean,
    ) => {
      const appliedAt = performance.now();
      const previous = synced.current;
      if (synchronization.stamp)
        interactionInbox.setContext(synchronization.stamp);
      if (
        restoring ||
        previous?.instanceId !== next.instanceId ||
        previous.branch !== next.branch
      )
        resetInteractions();
      if (
        previous &&
        (previous.instanceId !== next.instanceId ||
          previous.branch !== next.branch)
      ) {
        const envelope = pending.current;
        const transitions = [
          'new-room',
          'replay',
          'select-game',
          'select-variant',
          'remove-seat',
        ];
        if (envelope && !transitions.includes(envelope.command.type)) {
          pending.current = null;
          pendingImage.current = null;
          if (commandTimer.current) clearTimeout(commandTimer.current);
          setBusy(false);
          setAwaitingConfirmation(false);
          setMessage(feedbackText('session.tableChanged'));
        }
      }
      const sameStep =
        previous?.instanceId === next.instanceId &&
        previous.branch === next.branch &&
        previous.revision === next.revision;
      // A healthy periodic acknowledgement must not cut short a live saved
      // animation. Recovery snapshots update the table without replaying it.
      if (source !== 'sync' || !sameStep || restoring) {
        if (
          restoring ||
          source === 'sync' ||
          previous?.revision !== next.revision ||
          next.playMode === 'test'
        )
          setMotion([]);
        changedSlots.current = [];
        if (
          !restoring &&
          source === 'broadcast' &&
          previous?.game?.id === next.game?.id &&
          previous?.game?.variantId === next.game?.variantId &&
          previous?.gameView &&
          next.gameView &&
          next.playMode === 'play' &&
          previous.instanceId === next.instanceId &&
          previous.branch === next.branch
        ) {
          changedSlots.current = changedGameSlots(previous, next);
        }
        if (
          restoring ||
          source === 'sync' ||
          !previous ||
          next.paused ||
          previous.status !== next.status ||
          previous.branch !== next.branch ||
          previous.instanceId !== next.instanceId
        ) {
          setMotion([]);
          setFeedback(null);
        }
        if (restoring || source === 'sync')
          lastFeedback.current = `${next.instanceId}:${next.branch}:${next.revision}`;
      }
      if (previous?.status === 'lobby' && next.gameView)
        navigate(`/${role}/game`);
      if (next.status === 'lobby' && location.pathname.endsWith('/game'))
        navigate(`/${role}`, true);
      synced.current = next;
      setView(next);
      recordRoomSyncDiagnostic({
        phase: 'apply',
        viewSeq: synchronization.stamp?.viewSeq,
        durationMs: performance.now() - appliedAt,
      });
      requestAnimationFrame(() => {
        if (!disposed && synced.current === next)
          recordRoomSyncDiagnostic({
            phase: 'frame',
            viewSeq: synchronization.stamp?.viewSeq,
            durationMs: performance.now() - appliedAt,
          });
      });
    };
    const synchronization = new ReliableRoomSync<RoomView>({
      connected: () => socket.connected,
      request: (kind, stamp, timeout, receive) => {
        const startedAt = performance.now();
        recordRoomSyncDiagnostic({ phase: 'request', kind });
        const envelope = pending.current;
        if (kind === 'command') {
          queriedEnvelope = envelope;
          if (queriedActionId !== envelope?.actionId) {
            queriedActionId = envelope?.actionId ?? '';
            statusAttempt = 0;
          }
        }
        const callback = (error: Error | null, input: unknown) => {
          recordRoomSyncDiagnostic({
            phase: 'reply',
            kind,
            durationMs: performance.now() - startedAt,
          });
          if (error) return receive(error, null);
          const schema =
            kind === 'probe'
              ? RoomProbeReplySchema
              : kind === 'command'
                ? RoomCommandStatusReplySchema
                : RoomSyncReplySchema;
          const parsed = schema.safeParse(input);
          receive(
            parsed.success ? null : new Error('invalid-sync-reply'),
            parsed.success ? parsed.data : null,
          );
        };
        if (kind === 'probe' && stamp)
          socket.timeout(timeout).emit('room:probe', { stamp }, callback);
        else if (kind === 'command' && envelope)
          socket
            .timeout(timeout)
            .emit('room:command:status', envelope, callback);
        else socket.timeout(timeout).emit('room:sync', callback);
      },
      apply: applyView,
      phase: (phase) => {
        const ready = phase === 'ready' || phase === 'degraded';
        setConnected(ready);
        if (!ready) {
          resetInteractions();
          if (motionTimer.current) clearTimeout(motionTimer.current);
          changedSlots.current = [];
          setMotion([]);
          setFeedback(null);
        }
        if (phase === 'reconnecting')
          setMessage(feedbackText('session.reconnecting'));
      },
      reconnect: (delay) => {
        if (disposed) return;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (disposed) return;
          managedReconnect = true;
          socket.disconnect().connect();
          managedReconnect = false;
        }, delay);
      },
      rejected: (reason) => {
        if (reason === 'invalid-identity') revoked();
        else {
          setMessage(feedbackReason(reason, 'session.syncFailed'));
          synchronization.transportDisconnected();
        }
      },
      hasCommand: () => Boolean(pending.current && !pendingImage.current),
      commandReply: (input) => {
        const parsed = RoomCommandStatusReplySchema.safeParse(input);
        const envelope = pending.current;
        if (
          !parsed.success ||
          !parsed.data.ok ||
          !envelope ||
          envelope !== queriedEnvelope
        )
          return;
        const outcome = parsed.data.outcome;
        if (outcome.status === 'completed') {
          statusAttempt = 0;
          commandReceiveRef.current(envelope, outcome.reply);
        } else if (outcome.status === 'processing') {
          if (commandTimer.current) clearTimeout(commandTimer.current);
          const delay = Math.min(
            4000,
            1000 * 2 ** Math.min(statusAttempt++, 2),
          );
          commandTimer.current = setTimeout(() => {
            if (pending.current === envelope && !disposed)
              synchronization.queryCommand();
          }, delay);
        } else if (outcome.status === 'unknown') {
          setAwaitingConfirmation(true);
          setMessage(feedbackText('session.saveUnconfirmed'));
        } else {
          pending.current = null;
          if (commandTimer.current) clearTimeout(commandTimer.current);
          setBusy(false);
          setAwaitingConfirmation(false);
          setMessage(
            feedbackReason(outcome.reason, 'session.operationUnavailable'),
          );
        }
      },
      confirmed: (projection, restoring) => {
        const next = projection.view;
        setMessage((current) =>
          feedbackKind(current) === 'connection' ? '' : current,
        );
        if (!restoring) return;
        interactionInbox.restore(projection);
        if (!recoveredImage.current && next.self.role === 'player') {
          recoveredImage.current = true;
          try {
            const saved = JSON.parse(
              localStorage.getItem('tablemax-avatar-upload') ?? 'null',
            ) as { seatId: string; envelope: Command; image: string } | null;
            if (
              saved?.seatId === next.self.seatId &&
              typeof saved.image === 'string'
            ) {
              const parsed = CommandSchema.safeParse(saved.envelope);
              if (parsed.success) {
                pendingImage.current = saved.image;
                pending.current = parsed.data;
              }
            }
          } catch {
            /* A corrupt local draft is never submitted. */
          }
        }
        const envelope = pending.current;
        if (envelope)
          queueMicrotask(() => {
            if (
              !disposed &&
              synchronization.ready &&
              pending.current === envelope
            ) {
              if (pendingImage.current) sendRef.current(envelope);
              else synchronization.queryCommand();
            }
          });
      },
    });
    synchronizeRef.current = () => synchronization.request();
    queryCommandRef.current = () => synchronization.queryCommand();
    readyForAction.current = () => synchronization.ready;
    if (document.visibilityState === 'hidden')
      synchronization.setForeground(false);
    interactionSender.current = async (payload) => {
      const current = synced.current;
      if (
        disposed ||
        !synchronization.ready ||
        !socket.connected ||
        current?.self.role !== 'player'
      )
        return { ok: false, reason: 'invalid-identity' };
      return new Promise((resolve) => {
        socket.timeout(5000).emit(
          'room:interaction:send',
          {
            requestId: randomId(),
            instanceId: current.instanceId,
            branch: current.branch,
            interaction: payload,
          },
          (error: Error | null, reply: unknown) => {
            const parsed = InteractionReplySchema.safeParse(reply);
            resolve(
              !error && parsed.success
                ? parsed.data
                : { ok: false, reason: 'invalid-message' },
            );
          },
        );
      });
    };
    socket.on('room:interaction', (input: unknown) => {
      const receivedAt = performance.now();
      const parsed = InteractionEventSchema.safeParse(input);
      const current = synced.current;
      if (!parsed.success || !current) return;
      const event = parsed.data;
      const allowed =
        synchronization.ready &&
        document.visibilityState !== 'hidden' &&
        (role !== 'player' || current.self.role === 'player');
      if (!interactionInbox.receive(event, allowed)) return;
      recordInteractionDiagnostic({
        phase: 'receive',
        eventId: event.eventId,
        channel: event.interaction.type,
        receivedAt,
      });
      for (const listener of interactionListeners.current)
        listener(event, receivedAt);
      setInteraction(event);
    });
    socket.on('connect', () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      const engine = socket.io.engine;
      engine.on('packet', (packet: { data?: unknown }) => {
        if (
          !disposed &&
          engine === socket.io.engine &&
          typeof packet.data === 'string'
        )
          recordRoomSyncDiagnostic({
            phase: 'wire',
            bytes: new TextEncoder().encode(packet.data).byteLength,
          });
      });
      synchronization.transportConnected();
    });
    socket.on('connect_error', () => synchronization.transportDisconnected());
    socket.on('disconnect', () => {
      if (!managedReconnect) synchronization.transportDisconnected();
    });
    socket.on('room:view', (input: unknown) => {
      const receivedAt = performance.now();
      recordRoomSyncDiagnostic({ phase: 'receive' });
      const parsed = RoomProjectionSchema.safeParse(input);
      recordRoomSyncDiagnostic({
        phase: 'validate',
        durationMs: performance.now() - receivedAt,
      });
      if (parsed.success) synchronization.observe(parsed.data);
      else {
        setConnected(false);
        setMessage(feedbackText('session.incompatibleData'));
        synchronization.request(true);
      }
    });
    socket.on('room:feedback', (input: unknown) => {
      const parsed = RoomFeedbackSchema.safeParse(input);
      const current = synced.current;
      if (!parsed.success || !current) return;
      if (current.paused) return;
      const item = parsed.data,
        key = `${item.instanceId}:${item.branch}:${item.revision}`;
      if (
        key === lastFeedback.current ||
        item.instanceId !== current.instanceId ||
        item.branch !== current.branch ||
        item.revision !== current.revision
      )
        return;
      lastFeedback.current = key;
      if (!synchronization.ready || document.visibilityState === 'hidden')
        return;
      setFeedback(item);
      setMotion(current.playMode === 'test' ? [] : changedSlots.current);
      if (motionTimer.current) clearTimeout(motionTimer.current);
      if (current.playMode === 'play') {
        motionTimer.current = setTimeout(
          () => setMotion([]),
          gameMotionDuration(current),
        );
      }
    });
    const revoked = () => {
      resetInteractions();
      synchronization.dispose();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (commandTimer.current) clearTimeout(commandTimer.current);
      socket.disconnect();
      identity.value++;
      setConnected(false);
      setView(null);
      synced.current = null;
      setMotion([]);
      setFeedback(null);
      pending.current = null;
      pendingImage.current = null;
      recoveredImage.current = false;
      setBusy(false);
      setAwaitingConfirmation(false);
      setMessage(feedbackText('sessionErrors.invalid-identity'));
      if (role === 'player') {
        localStorage.removeItem('tablemax-avatar-upload');
        localStorage.removeItem('tablemax-player');
        setCredential('');
      }
    };
    socket.on('room:revoked', revoked);
    socket.on('connect_error', (error: Error) => {
      if (error.message === 'invalid-identity') revoked();
      else setMessage(feedbackText('session.connectionFailed'));
    });
    let networkRequest: AbortController | null = null;
    let networkSequence = 0;
    let networkSaving = false;
    const applyNetwork = (network: ReturnType<typeof NetworkSchema.parse>) => {
      setAddresses(network.addresses);
      setAdapters(network.adapters);
      setAddress((selected) => {
        const preferred =
          selected || localStorage.getItem('tablemax-address') || '';
        return network.addresses.includes(preferred)
          ? preferred
          : (network.addresses[0] ?? '');
      });
      setPort(network.port);
      setExternalJoinUrl(network.externalJoinUrl);
      setNetworkMessage(
        network.networkMessage
          ? feedbackText('network.configurationReadFailed')
          : network.addresses.length || network.externalJoinUrl
            ? ''
            : feedbackText('network.noAddress'),
      );
    };
    socket.on('room:network', (input: unknown) => {
      if (role === 'player' || disposed || networkSaving) return;
      const parsed = NetworkSchema.safeParse(input);
      if (!parsed.success) return;
      // A pre-change GET may still be in flight when another host saves.
      networkSequence++;
      networkRequest?.abort();
      applyNetwork(parsed.data);
    });
    const refreshNetwork = async () => {
      if (networkRequest || role === 'player') return;
      const controller = new AbortController();
      networkRequest = controller;
      const sequence = ++networkSequence;
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('/api/room/network', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('network-refresh-failed');
        const network = NetworkSchema.parse(await response.json());
        if (disposed || sequence !== networkSequence) return;
        applyNetwork(network);
      } catch {
        if (!disposed && sequence === networkSequence)
          setNetworkMessage(feedbackText('network.refreshFailed'));
      } finally {
        clearTimeout(timeout);
        if (networkRequest === controller) networkRequest = null;
      }
    };
    const saveExternalJoinUrl = async (value: string | null) => {
      if (role !== 'host' || disposed) return false;
      const sequence = ++networkSequence;
      networkRequest?.abort();
      const controller = new AbortController();
      networkRequest = controller;
      networkSaving = true;
      const timeout = setTimeout(() => controller.abort(), 5000);
      let failureMessage = feedbackText('network.saveUnconfirmed');
      try {
        const response = await fetch('/api/room/network', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ token: credential, externalJoinUrl: value }),
        });
        const input: unknown = await response.json();
        if (!response.ok) {
          const failure = input as {
            reason?: unknown;
          } | null;
          const reason = failure?.reason;
          failureMessage =
            reason === 'unauthorized'
              ? feedbackText('network.unauthorized')
              : reason === 'invalid-external-url' ||
                  reason === 'invalid-message'
                ? feedbackText('network.invalidUrl')
                : feedbackText('network.saveFailed');
          throw new Error('network-save-failed');
        }
        const parsed = NetworkSchema.safeParse(input);
        if (!parsed.success) {
          failureMessage = feedbackText('network.invalidConfirmation');
          throw new Error('invalid-network-confirmation');
        }
        if (disposed || sequence !== networkSequence) return false;
        applyNetwork(parsed.data);
        return true;
      } catch {
        if (!disposed && sequence === networkSequence)
          setNetworkMessage(failureMessage);
        return false;
      } finally {
        clearTimeout(timeout);
        if (networkRequest === controller) {
          networkRequest = null;
          networkSaving = false;
        }
      }
    };
    refreshNetworkRef.current = refreshNetwork;
    saveExternalJoinUrlRef.current = saveExternalJoinUrl;
    void refreshNetwork();
    const interval = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        void refreshNetwork();
      }
    }, ROOM_SYNC_INTERVAL);
    const wake = () => {
      if (document.visibilityState === 'hidden') {
        synchronization.setForeground(false);
        return;
      }
      synchronization.setForeground(true);
      synchronization.request(true);
      void refreshNetwork();
    };
    window.addEventListener('online', wake);
    window.addEventListener('pageshow', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      disposed = true;
      resetInteractions();
      synchronization.dispose();
      identity.value++;
      networkRequest?.abort();
      refreshNetworkRef.current = null;
      saveExternalJoinUrlRef.current = null;
      synchronizeRef.current = null;
      queryCommandRef.current = null;
      readyForAction.current = () => false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (commandTimer.current) clearTimeout(commandTimer.current);
      clearInterval(interval);
      window.removeEventListener('online', wake);
      window.removeEventListener('pageshow', wake);
      document.removeEventListener('visibilitychange', wake);
      // Changing identity closes the old socket deliberately. Its disconnect
      // message must not overwrite a successful admission result.
      socket.removeAllListeners();
      socket.disconnect();
      setConnected(false);
      setView(null);
      synced.current = null;
      socketRef.current = null;
      pending.current = null;
      pendingImage.current = null;
      recoveredImage.current = false;
      setBusy(false);
      setAwaitingConfirmation(false);
      if (motionTimer.current) clearTimeout(motionTimer.current);
    };
  }, [credential, role, resetInteractions]);
  const setPlayerCredential = useCallback(
    (token: string) => {
      // Store before switching sockets. A browser storage failure keeps the
      // current identity and lets the transfer receipt be confirmed again.
      localStorage.setItem('tablemax-player', token);
      cancelAdmission();
      if (token === credential) return;
      resetInteractions();
      identityEpoch.current.value++;
      pending.current = null;
      pendingImage.current = null;
      localStorage.removeItem('tablemax-avatar-upload');
      recoveredImage.current = false;
      setConnected(false);
      setView(null);
      synced.current = null;
      setCredential(token);
    },
    [cancelAdmission, credential, resetInteractions],
  );
  const isHost = view?.self.role === 'host';
  const self = view?.seats.find((s) => s.id === view.self.seatId);
  const locked = busy || admission.busy || !connected || !view;
  function send(envelope: Command) {
    if (!socketRef.current?.connected || !readyForAction.current()) {
      setAwaitingConfirmation(Boolean(pending.current));
      setMessage(feedbackText('session.connectionUnconfirmed'));
      return;
    }
    const epoch = identityEpoch.current.value;
    pending.current = envelope;
    setBusy(true);
    setAwaitingConfirmation(false);
    setMessage(feedbackText('session.submitting'));
    const receive = (error: Error | null, input: unknown) => {
      if (pending.current !== envelope || epoch !== identityEpoch.current.value)
        return;
      if (error) {
        setAwaitingConfirmation(true);
        setMessage(feedbackText('session.saveUnconfirmed'));
        synchronizeRef.current?.();
        return;
      }
      const parsed = CommandReplySchema.safeParse(input);
      if (!parsed.success) {
        setAwaitingConfirmation(true);
        setMessage(feedbackText('session.invalidConfirmation'));
        synchronizeRef.current?.();
        return;
      }
      pending.current = null;
      if (commandTimer.current) clearTimeout(commandTimer.current);
      if (pendingImage.current)
        localStorage.removeItem('tablemax-avatar-upload');
      pendingImage.current = null;
      setBusy(false);
      setAwaitingConfirmation(false);
      const reply = parsed.data;
      if (reply.ok) {
        setMessage(feedbackText('session.saved'));
      } else {
        setErrorId(envelope.actionId);
        setMessage(feedbackReason(reply.reason, 'session.operationFailed'));
        synchronizeRef.current?.();
      }
    };
    commandReceiveRef.current = (candidate, input) => {
      if (candidate === envelope) receive(null, input);
    };
    if (commandTimer.current) clearTimeout(commandTimer.current);
    if (!pendingImage.current)
      commandTimer.current = setTimeout(() => {
        if (
          pending.current === envelope &&
          epoch === identityEpoch.current.value
        )
          queryCommandRef.current?.();
      }, ACTION_CONFIRM_DELAY);
    if (pendingImage.current) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const metadata = {
        actionId: envelope.actionId,
        instanceId: envelope.instanceId,
        revision: envelope.revision,
        branch: envelope.branch,
      };
      void fetch('/api/session/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          token: credential,
          envelope: metadata,
          avatarImage: pendingImage.current,
        }),
      })
        .then(async (response) => receive(null, await response.json()))
        .catch(() => receive(new Error('upload-unconfirmed'), null))
        .finally(() => clearTimeout(timeout));
    } else
      socketRef.current?.timeout(5000).emit('room:command', envelope, receive);
  }
  function command(value: Command['command']) {
    if (!view || locked || pending.current || !readyForAction.current()) return;
    send({
      actionId: randomId(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command: value,
    });
  }
  useEffect(() => {
    sendRef.current = send;
  });
  return {
    role,
    view,
    connected,
    busy: busy || admission.busy,
    admissionPending: admission.pending,
    admissionAvatarId: admission.avatarId,
    retryAdmission: admission.retry,
    awaitingConfirmation,
    message,
    messageKind: feedbackKind(message),
    name,
    setName,
    addresses,
    adapters,
    networkMessage,
    externalJoinUrl,
    saveExternalJoinUrl: (value: string | null) =>
      saveExternalJoinUrlRef.current?.(value) ?? Promise.resolve(false),
    refreshNetwork: () => refreshNetworkRef.current?.(),
    address,
    setAddress: (selected: string) => {
      localStorage.setItem('tablemax-address', selected);
      setAddress(selected);
    },
    port,
    feedback,
    interaction,
    interactionResetKey,
    subscribeInteractions,
    subscribeInteractionResets,
    sendInteraction: (payload: InteractionPayload) =>
      interactionSender.current(payload),
    errorId,
    motion,
    credential,
    setPlayerCredential,
    isHost,
    canControl: view?.capabilities.control ?? false,
    canManageSeats: view?.capabilities.manageSeats ?? false,
    self,
    locked,
    command,
    join: (avatarId?: AvatarId, avatarImage?: string) =>
      admission.join(name, avatarId, avatarImage),
    admissionAvatarImage: admission.avatarImage,
    uploadAvatar: (image: string) => {
      if (!view || locked || pending.current || !self) return;
      const envelope: Command = {
        actionId: randomId(),
        instanceId: view.instanceId,
        revision: view.revision,
        branch: view.branch,
        command: { type: 'set-avatar', avatarId: self.avatarId },
      };
      try {
        localStorage.setItem(
          'tablemax-avatar-upload',
          JSON.stringify({ seatId: self.id, envelope, image }),
        );
      } catch {
        setMessage(feedbackText('session.uploadStorageFailed'));
        return;
      }
      pendingImage.current = image;
      send(envelope);
    },
    retry: () => {
      if (pending.current) send(pending.current);
    },
  };
}
export type RoomSession = ReturnType<typeof useRoomSession>;
