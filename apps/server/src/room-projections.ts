import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  RoomProbeRequestSchema,
  type RoomProbeReply,
  type RoomProjection,
  type RoomStamp,
  type RoomSyncMetadata,
  type RoomView,
  type SyncHint,
} from '@tablemax/protocol';
import { SyncDiagnostics } from './sync-diagnostics';

interface ProjectionAuthority {
  identity(credential?: string): unknown;
  synchronizationState(): {
    instanceId: string;
    branch: number;
    syncHint: SyncHint;
    nextExpiryAt: number | null;
  };
  view(credential?: string, online?: ReadonlySet<string>): RoomView;
}

/** Runtime-only ordering; neither cheap probes nor interaction sends advance it. */
export class RoomProjectionState {
  private sequence = 0;
  private state: ReturnType<ProjectionAuthority['synchronizationState']>;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  constructor(
    private authority: ProjectionAuthority,
    private watermark: () => number,
    private changed: () => void,
    readonly serverSessionId = randomUUID(),
    private diagnostics = new SyncDiagnostics(),
  ) {
    this.state = authority.synchronizationState();
    this.scheduleExpiry();
  }
  advance() {
    if (this.disposed) return;
    this.sequence++;
    this.state = this.authority.synchronizationState();
    this.scheduleExpiry();
  }
  private scheduleExpiry() {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    if (this.state.nextExpiryAt === null || this.disposed) return;
    this.expiryTimer = setTimeout(
      () => {
        this.expiryTimer = null;
        this.refreshExpired();
      },
      Math.max(1, this.state.nextExpiryAt - Date.now()),
    );
    this.expiryTimer.unref();
  }
  private refreshExpired() {
    if (
      !this.disposed &&
      this.state.nextExpiryAt !== null &&
      this.state.nextExpiryAt <= Date.now()
    )
      this.changed();
  }
  metadata(): RoomSyncMetadata {
    // A suspended event loop may deliver a probe before the expiry timer.
    this.refreshExpired();
    return {
      stamp: {
        serverSessionId: this.serverSessionId,
        instanceId: this.state.instanceId,
        branch: this.state.branch,
        viewSeq: this.sequence,
      },
      syncHint: this.state.syncHint,
      interactionWatermark: this.watermark(),
    };
  }
  project(credential?: string, online?: ReadonlySet<string>): RoomProjection {
    this.authority.identity(credential);
    const metadata = this.metadata();
    return { ...metadata, view: this.view(credential, online) };
  }
  private view(credential?: string, online?: ReadonlySet<string>) {
    const startedAt = performance.now();
    try {
      return this.authority.view(credential, online);
    } finally {
      this.diagnostics.record('projection', performance.now() - startedAt);
    }
  }
  probe(
    credential: string | undefined,
    input: unknown,
    online: () => ReadonlySet<string>,
  ): RoomProbeReply {
    const startedAt = performance.now();
    this.authority.identity(credential);
    const parsed = RoomProbeRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, reason: 'invalid-message' };
    const metadata = this.metadata();
    if (sameStamp(parsed.data.stamp, metadata.stamp)) {
      this.diagnostics.record('probeUnchanged', performance.now() - startedAt);
      return { ok: true, unchanged: true, ...metadata };
    }
    return {
      ok: true,
      unchanged: false,
      ...metadata,
      view: this.view(credential, online()),
    };
  }
  dispose() {
    this.disposed = true;
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
  }
}

function sameStamp(a: RoomStamp, b: RoomStamp) {
  return (
    a.serverSessionId === b.serverSessionId &&
    a.instanceId === b.instanceId &&
    a.branch === b.branch &&
    a.viewSeq === b.viewSeq
  );
}
