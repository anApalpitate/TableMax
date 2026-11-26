import type { JsonValue } from '@tablemax/game-sdk';
import { loadUnoLeafScorer } from './calibration';
import { loadUnoCorrection } from './correction';
import { isUnoSearchSamples } from './search-budget';

export function readUnoRuntimeModel(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid saved UNO model');
  const value = input as Record<string, unknown>;
  if (
    value.version !== 1 ||
    !isUnoSearchSamples(value.samples) ||
    typeof value.calibrationDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.calibrationDigest) ||
    Object.keys(value).some(
      (key) =>
        ![
          'version',
          'samples',
          'calibrationDigest',
          'calibration',
          'correction',
        ].includes(key),
    )
  )
    throw new Error('Saved UNO model uses an incompatible format');
  return {
    samples: value.samples,
    scoring: loadUnoLeafScorer(value.calibration),
    correction:
      value.correction === undefined
        ? undefined
        : loadUnoCorrection(value.correction, value.calibrationDigest),
  };
}

export function validateUnoRuntimeModel(input: unknown): JsonValue {
  readUnoRuntimeModel(input);
  return structuredClone(input) as JsonValue;
}
