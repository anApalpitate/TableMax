import { isDeepStrictEqual } from 'node:util';
import {
  unoLeafFeatureNamesFor,
  type UnoLeafFeatureVersion,
} from '../../../games/uno/bot/calibration';
import type { CalibrationSeedEvidence } from './uno-calibration-seed';
import { isCurrentUnoPilot } from './uno-pilot';
import {
  unoCalibrationLabelOptions,
  type UnoSampleOptions,
} from './uno-samples';

type FitCorpus = {
  type: 'uno-natural-fit-corpus';
  version: 1;
  pilot: unknown;
  naturalOptions: UnoSampleOptions;
  featureVersion?: UnoLeafFeatureVersion;
  sourceBatchDigest: string;
  sourceReportSha256: string;
  sourceSha256: string;
  fit: CalibrationSeedEvidence[];
};

export function naturalFitCorpus(
  value: unknown,
  options: UnoSampleOptions,
  seeds: readonly number[],
  featureVersion: UnoLeafFeatureVersion = 1,
): FitCorpus {
  const corpus = value as FitCorpus;
  const digest = /^[a-f0-9]{64}$/;
  if (
    corpus?.type !== 'uno-natural-fit-corpus' ||
    corpus.version !== 1 ||
    (corpus.featureVersion ?? 1) !== featureVersion ||
    !isCurrentUnoPilot(corpus.pilot) ||
    ![
      corpus.sourceBatchDigest,
      corpus.sourceReportSha256,
      corpus.sourceSha256,
    ].every((value) => digest.test(value)) ||
    !isDeepStrictEqual(
      corpus.naturalOptions,
      unoCalibrationLabelOptions(options),
    ) ||
    !Array.isArray(corpus.fit) ||
    !isDeepStrictEqual(
      corpus.fit.map((entry) => entry?.seed),
      seeds,
    )
  )
    throw new Error(
      'The frozen fit corpus does not match these natural calibration inputs',
    );
  const featureCount = unoLeafFeatureNamesFor(featureVersion).length;
  for (const entry of corpus.fit) {
    if (
      !Number.isInteger(entry.roots) ||
      entry.roots < 0 ||
      entry.roots > options.roots ||
      !Number.isInteger(entry.unfinished) ||
      entry.unfinished < 0 ||
      entry.rankingPairs !== 0 ||
      entry.rankingUnfinished !== 0 ||
      !Array.isArray(entry.rows) ||
      entry.rows.some(
        (row) =>
          row?.seed !== entry.seed ||
          !Array.isArray(row.features) ||
          row.features.length !== featureCount ||
          !row.features.every(Number.isFinite) ||
          !Number.isInteger(row.completed) ||
          row.completed < 1 ||
          row.completed > options.continuations ||
          !Number.isInteger(row.wins) ||
          row.wins < 0 ||
          row.wins > row.completed ||
          ![
            'turn',
            'drawn',
            'choose-color',
            'draw-four',
            'draw-penalty',
            'result',
          ].includes(row.stage),
      )
    )
      throw new Error(
        'The natural fit corpus contains a malformed or non-fit sample',
      );
  }
  return corpus;
}
