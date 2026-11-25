import { createHash, randomUUID } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  mkdirSync,
  rmdirSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  assertLearningBudget,
  learningModelByteLimit,
} from '../../../packages/platform-core/src/learning-storage';
import type { JsonValue } from '@tablemax/game-sdk';
import type {
  BotModelBinding,
  BotModelProvider,
} from '@tablemax/platform-core';

const digest = /^[a-f0-9]{64}$/;
const modelByteLimit = 16 * 1024;

export interface ModelEnvelope {
  version: 1;
  binding: BotModelBinding;
  reviews: {
    calibration: string;
    comparison: string;
    runtime: string;
  };
  model: JsonValue;
}

/** Locally promoted data only; game module bytes stay under the game package store. */
export class LocalBotModels implements BotModelProvider {
  private readonly learningDir: string;
  private readonly modelsDir: string;

  constructor(
    private readonly dataDir: string,
    private readonly byteLimit = learningModelByteLimit,
  ) {
    this.learningDir = join(dataDir, 'learning');
    this.modelsDir = join(this.learningDir, 'models');
  }

  private readFile(name: string) {
    for (const directory of [this.learningDir, this.modelsDir]) {
      const stats = lstatSync(directory, { throwIfNoEntry: false });
      if (!stats) throw new Error('missing-bot-model');
      if (!stats.isDirectory() || stats.isSymbolicLink())
        throw new Error('incompatible-bot-model');
    }
    const path = join(this.modelsDir, name);
    const stats = lstatSync(path, { throwIfNoEntry: false });
    if (!stats) throw new Error('missing-bot-model');
    if (
      !stats.isFile() ||
      stats.isSymbolicLink() ||
      stats.size > modelByteLimit
    )
      throw new Error('incompatible-bot-model');
    const bytes = readFileSync(path);
    if (bytes.length > modelByteLimit)
      throw new Error('incompatible-bot-model');
    return bytes;
  }

  private read(ref: string): ModelEnvelope {
    if (!digest.test(ref)) throw new Error('incompatible-bot-model');
    const bytes = this.readFile(ref + '.json');
    if (createHash('sha256').update(bytes).digest('hex') !== ref)
      throw new Error('incompatible-bot-model');
    try {
      const value = JSON.parse(bytes.toString('utf8')) as ModelEnvelope;
      if (
        value?.version !== 1 ||
        !value.binding ||
        !value.reviews ||
        !digest.test(value.reviews.calibration) ||
        !digest.test(value.reviews.comparison) ||
        !digest.test(value.reviews.runtime) ||
        value.model === undefined
      )
        throw new Error('incompatible-bot-model');
      return value;
    } catch (cause) {
      throw new Error('incompatible-bot-model', { cause });
    }
  }

  private activeRefs(): string[] {
    let bytes: Buffer;
    try {
      bytes = this.readFile('active.json');
    } catch (error) {
      if (error instanceof Error && error.message === 'missing-bot-model')
        return [];
      throw error;
    }
    const index = JSON.parse(bytes.toString('utf8')) as {
      version: number;
      refs: string[];
    };
    if (
      index?.version !== 1 ||
      !Array.isArray(index.refs) ||
      index.refs.length > 32 ||
      new Set(index.refs).size !== index.refs.length ||
      index.refs.some((ref) => typeof ref !== 'string' || !digest.test(ref))
    )
      throw new Error('incompatible-bot-model');
    return index.refs;
  }

  /** The caller verifies the independent promotion reports before invoking this method. */
  promote(envelope: ModelEnvelope): string {
    const parent = lstatSync(this.dataDir, { throwIfNoEntry: false });
    if (!parent?.isDirectory() || parent.isSymbolicLink())
      throw new Error('incompatible-bot-model');
    for (const directory of [this.learningDir, this.modelsDir]) {
      const existing = lstatSync(directory, { throwIfNoEntry: false });
      if (!existing) mkdirSync(directory);
      else if (!existing.isDirectory() || existing.isSymbolicLink())
        throw new Error('incompatible-bot-model');
    }
    const bytes = Buffer.from(JSON.stringify(envelope));
    if (
      bytes.length > modelByteLimit ||
      !digest.test(envelope.reviews.calibration) ||
      !digest.test(envelope.reviews.comparison) ||
      !digest.test(envelope.reviews.runtime)
    )
      throw new Error('incompatible-bot-model');
    const ref = createHash('sha256').update(bytes).digest('hex');
    const path = join(this.modelsDir, ref + '.json');
    this.mutateIndex(() => {
      try {
        if (!lstatSync(path, { throwIfNoEntry: false }))
          assertLearningBudget(this.modelsDir, bytes.length, this.byteLimit);
        writeFileSync(path, bytes, { flag: 'wx', flush: true });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !('code' in error) ||
          error.code !== 'EEXIST'
        )
          throw error;
      }
      this.load(envelope.binding, ref);
      const existing = this.activeRefs().filter((activeRef) => {
        try {
          return !isDeepStrictEqual(
            this.read(activeRef).binding,
            envelope.binding,
          );
        } catch {
          return true;
        }
      });
      this.updateActive([...existing, ref]);
    });
    return ref;
  }

  deactivate(ref: string): void {
    if (!digest.test(ref)) throw new Error('incompatible-bot-model');
    if (!this.activeRefs().includes(ref)) return;
    this.mutateIndex(() => {
      const refs = this.activeRefs();
      if (refs.includes(ref))
        this.updateActive(refs.filter((active) => active !== ref));
    });
  }

  private mutateIndex(operation: () => void) {
    const lock = join(this.modelsDir, '.activation-lock');
    mkdirSync(lock);
    try {
      operation();
    } finally {
      rmdirSync(lock);
    }
  }

  private updateActive(refs: string[]) {
    if (refs.length > 32) throw new Error('model-activation-limit');
    const next = join(this.modelsDir, '.active-' + randomUUID() + '.json');
    writeFileSync(next, JSON.stringify({ version: 1, refs }), {
      flag: 'wx',
      flush: true,
    });
    try {
      renameSync(next, join(this.modelsDir, 'active.json'));
    } catch (error) {
      unlinkSync(next);
      throw error;
    }
  }

  active(binding: BotModelBinding): string | undefined {
    try {
      const refs = this.activeRefs();
      const matching = [];
      for (const ref of refs) {
        try {
          if (isDeepStrictEqual(this.read(ref).binding, binding))
            matching.push(ref);
        } catch {
          // A missing candidate cannot affect a new match that has no model binding.
        }
      }
      return matching.length === 1 ? matching[0] : undefined;
    } catch {
      return undefined;
    }
  }

  load(binding: BotModelBinding, ref: string): JsonValue {
    const envelope = this.read(ref);
    if (!isDeepStrictEqual(envelope.binding, binding))
      throw new Error('incompatible-bot-model');
    return envelope.model;
  }
}
