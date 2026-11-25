import { randomUUID } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { join } from 'node:path';
import {
  readTrainingControl,
  writeTrainingControl,
  type TrainingWorkerStatus,
} from '../../../packages/platform-core/src/training-lease';

type TrainingStatus =
  | 'disabled'
  | 'waiting'
  | 'paused'
  | 'running'
  | 'candidate'
  | 'quota'
  | 'failed';
const heartbeat = 750;
const lifetime = 2500;
const quietPeriod = 5000;

interface TrainingRoom {
  readonly canTrainWhileIdle: boolean;
  subscribe(listener: () => void): () => void;
}

/** A capability lease for a separate, explicitly launched local training environment. */
export class IdleTrainingLease {
  private readonly directory: string;
  private readonly file: string;
  private readonly session = randomUUID();
  private timer: ReturnType<typeof setInterval> | undefined;
  private unsubscribe?: () => void;
  private lastActivity = Date.now();
  private lastAllowed: boolean | null = null;
  private error = false;

  constructor(
    dataDir: string,
    private readonly room: TrainingRoom,
    private readonly trainingEnabled: () => boolean,
    private readonly now = Date.now,
  ) {
    this.directory = join(dataDir, 'learning');
    this.file = join(this.directory, 'training-lease.json');
  }

  start() {
    if (this.timer) return;
    this.lastActivity = this.now();
    this.unsubscribe = this.room.subscribe(() => {
      this.lastActivity = this.now();
      this.refresh();
    });
    this.timer = setInterval(() => this.refresh(), heartbeat);
    this.timer.unref();
    this.refresh();
  }

  private refresh() {
    const enabled = this.trainingEnabled();
    if (!enabled && this.lastAllowed !== true) return;
    const allowed =
      enabled &&
      this.room.canTrainWhileIdle &&
      this.now() - this.lastActivity >= quietPeriod;
    // Revocations are written immediately. Idle permission alone needs renewal.
    if (!allowed && this.lastAllowed === false) return;
    this.publish(allowed);
  }

  private publish(allowed: boolean) {
    try {
      const folder = lstatSync(this.directory, { throwIfNoEntry: false });
      if (!folder?.isDirectory() || folder.isSymbolicLink())
        throw new Error('Unavailable training directory');
      writeTrainingControl(this.file, {
        version: 1,
        session: this.session,
        allowed,
        expiresAt: this.now() + lifetime,
      });
      this.lastAllowed = allowed;
      this.error = false;
    } catch {
      this.error = true;
    }
  }

  status(): TrainingStatus {
    if (!this.trainingEnabled()) return 'disabled';
    if (this.error) return 'failed';
    if (!this.lastAllowed || !this.room.canTrainWhileIdle) return 'paused';
    try {
      const worker = readTrainingControl(
        join(this.directory, 'training-worker.json'),
      ) as Partial<TrainingWorkerStatus> | undefined;
      if (
        worker?.version === 1 &&
        worker.session === this.session &&
        typeof worker.writtenAt === 'number' &&
        (worker.stage === 'quota' ||
          worker.stage === 'candidate' ||
          worker.writtenAt >= this.now() - 2 * lifetime) &&
        worker.writtenAt <= this.now() + heartbeat &&
        (worker.stage === 'running' ||
          worker.stage === 'candidate' ||
          worker.stage === 'quota' ||
          worker.stage === 'failed' ||
          worker.stage === 'paused')
      )
        return worker.stage;
    } catch {
      return 'failed';
    }
    return 'waiting';
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
    this.unsubscribe?.();
    if (this.lastAllowed) this.publish(false);
  }
}
