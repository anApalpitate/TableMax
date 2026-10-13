import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

/** Content memoization belongs to one read/verification phase, never a later boundary. */
export function createReadPhase(name) {
  const reads = new Map(),
    hashes = new Map(),
    parses = new Map();
  const stats = {
    name,
    reads: 0,
    bytes: 0,
    hashes: 0,
    parses: 0,
    readHits: 0,
    hashHits: 0,
    parseHits: 0,
    // Sum individual activities, including overlapping reads; these are not phase wall time.
    timingKind: 'cumulative-activity-ms',
    readMs: 0,
    hashMs: 0,
    parseMs: 0,
  };
  const phase = {
    stats,
    read(path) {
      const file = resolve(path);
      if (reads.has(file)) {
        stats.readHits += 1;
        return reads.get(file);
      }
      const pending = (async () => {
        const started = performance.now();
        let bytes;
        try {
          bytes = await readFile(file);
        } finally {
          stats.readMs += performance.now() - started;
        }
        stats.reads += 1;
        stats.bytes += bytes.length;
        return bytes;
      })();
      reads.set(file, pending);
      return pending;
    },
    async json(path) {
      const source = (await phase.read(path)).toString('utf8');
      const started = performance.now();
      try {
        return JSON.parse(source);
      } finally {
        // Include JSON decoding; the existing parses counter tracks memoized source parses.
        stats.parseMs += performance.now() - started;
      }
    },
    sha(path) {
      const file = resolve(path);
      if (hashes.has(file)) {
        stats.hashHits += 1;
        return hashes.get(file);
      }
      const pending = phase.read(file).then((bytes) => {
        const started = performance.now();
        try {
          const digest = createHash('sha256').update(bytes).digest('hex');
          stats.hashes += 1;
          return digest;
        } finally {
          stats.hashMs += performance.now() - started;
        }
      });
      hashes.set(file, pending);
      return pending;
    },
    parse(path, source, parse) {
      const file = resolve(path);
      const prior = parses.get(file);
      if (prior?.source === source) {
        stats.parseHits += 1;
        return prior.value;
      }
      const started = performance.now();
      let value;
      try {
        value = parse();
      } finally {
        stats.parseMs += performance.now() - started;
      }
      stats.parses += 1;
      parses.set(file, { source, value });
      return value;
    },
  };
  return phase;
}
