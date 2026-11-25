import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  BotLearningOptionsSchema,
  type BotLearningOptions,
  type BotLearningStatus,
} from '@tablemax/protocol';
import type {
  BotLearningStore,
  LearningEvent,
  LearningPosition,
} from '@tablemax/platform-core';

const defaultLogByteLimit = 16 * 1024 * 1024;

interface LocalSettings {
  version: 1;
  options: BotLearningOptions;
  captureSegment: string;
  startedFrom: LearningPosition | null;
}

export class LocalBotLearning implements BotLearningStore {
  private readonly learningDir: string;
  private settings: LocalSettings = {
    version: 1,
    options: { capture: null, training: false },
    captureSegment: randomUUID(),
    startedFrom: null,
  };
  private error: 'quota' | 'unavailable' | null = null;
  private lastRecordedMatch: string | null = null;
  private readonly writerSession = randomUUID();

  constructor(
    private readonly dataDir: string,
    private readonly development: boolean,
    private readonly logByteLimit = defaultLogByteLimit,
  ) {
    if (!Number.isSafeInteger(logByteLimit) || logByteLimit < 1)
      throw new Error('Invalid learning log quota');
    this.learningDir = join(dataDir, 'learning');
    try {
      if (this.directory(false)) {
        const file = this.file('preferences.json');
        if (file.stats) {
          if (file.stats.size > 4096)
            throw new Error('Invalid learning preferences');
          const saved = JSON.parse(
            readFileSync(file.path, 'utf8'),
          ) as LocalSettings;
          if (saved?.version !== 1 || typeof saved.captureSegment !== 'string')
            throw new Error('Invalid learning preferences');
          this.settings = {
            ...saved,
            options: BotLearningOptionsSchema.parse(saved.options),
          };
        }
      }
    } catch {
      this.error = 'unavailable';
    }
  }

  private directory(create: boolean) {
    const parent = lstatSync(this.dataDir, { throwIfNoEntry: false });
    if (!parent?.isDirectory() || parent.isSymbolicLink())
      throw new Error('Unavailable learning directory');
    const directory = lstatSync(this.learningDir, { throwIfNoEntry: false });
    if (!directory) {
      if (create) mkdirSync(this.learningDir);
      return create;
    }
    if (!directory.isDirectory() || directory.isSymbolicLink())
      throw new Error('Unavailable learning directory');
    return true;
  }

  private file(name: string) {
    const path = join(this.learningDir, name);
    const stats = lstatSync(path, { throwIfNoEntry: false });
    if (stats && (!stats.isFile() || stats.isSymbolicLink()))
      throw new Error('Unavailable learning file');
    return { path, stats };
  }

  status(): BotLearningStatus {
    const captureEnabled = this.settings.options.capture ?? this.development;
    return {
      ...this.settings.options,
      defaultCapture: this.development,
      captureEnabled,
      captureState: captureEnabled ? (this.error ?? 'ready') : 'off',
    };
  }

  update(input: BotLearningOptions, position: LearningPosition | null): void {
    const options = BotLearningOptionsSchema.parse(input);
    this.directory(true);
    const file = this.file('preferences.json');
    const captureChanged = options.capture !== this.settings.options.capture;
    const next: LocalSettings = captureChanged
      ? {
          version: 1,
          options,
          captureSegment: randomUUID(),
          startedFrom: position,
        }
      : { ...this.settings, options };
    const temporary = join(
      this.learningDir,
      '.preferences-' + randomUUID() + '.json',
    );
    writeFileSync(temporary, JSON.stringify(next), {
      flag: 'wx',
      flush: true,
      mode: 0o600,
    });
    try {
      renameSync(temporary, file.path);
    } catch (error) {
      unlinkSync(temporary);
      throw error;
    }
    this.settings = next;
    if (captureChanged) this.lastRecordedMatch = null;
    this.error = null;
  }

  wants(gameId: string): boolean {
    return gameId === 'uno' && this.status().captureState === 'ready';
  }

  record(event: LearningEvent): void {
    if (!this.wants(event.gameId)) return;
    try {
      this.directory(true);
      const file = this.file('uno-decisions-v1.jsonl');
      const first = this.lastRecordedMatch !== event.instanceId;
      const entry =
        JSON.stringify({
          version: 1,
          segment: this.settings.captureSegment,
          writerSession: this.writerSession,
          ...(first
            ? {
                firstForSessionMatch: true,
                openedFrom: this.settings.startedFrom,
              }
            : {}),
          ...event,
        }) + '\n';
      if (
        (file.stats?.size ?? 0) + Buffer.byteLength(entry) >
        this.logByteLimit
      ) {
        this.error = 'quota';
        return;
      }
      appendFileSync(file.path, entry, { mode: 0o600 });
      this.lastRecordedMatch = event.instanceId;
    } catch {
      this.error = 'unavailable';
    }
  }
}
