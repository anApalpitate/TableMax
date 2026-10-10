import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TestHistory,
  failureLimit,
  testFile,
  testIdentity,
} from './history.mjs';

export function importVitest(history, report, sourceRoot = history.root) {
  if (!Number.isFinite(report.startTime) || !Array.isArray(report.testResults))
    throw new Error(
      'Import requires a complete Vitest JSON report with startTime and assertionResults; aggregate results cannot identify case outcomes',
    );
  const records = [];
  for (const file of report.testResults) {
    if (!Array.isArray(file.assertionResults))
      throw new Error('Missing per-case historical results');
    for (const [index, item] of file.assertionResults.entries()) {
      if (!['passed', 'failed'].includes(item.status)) continue;
      const identity = testIdentity(
        'vitest',
        testFile(sourceRoot, file.name),
        [...(item.ancestorTitles ?? []), item.title],
        file.projectName ?? '',
      );
      const eventId = createHash('sha256')
        .update(
          JSON.stringify(['vitest-json', report.startTime, identity.id, index]),
        )
        .digest('hex');
      const duration = item.duration ?? 0;
      if (!Number.isFinite(duration) || duration < 0)
        throw new Error('Invalid historical duration');
      records.push({
        identity,
        eventId,
        status: item.status,
        duration,
        errors: item.failureMessages ?? [],
      });
    }
  }
  if (!records.length)
    throw new Error('No completed individual historical cases');
  const runId = history.start(failureLimit());
  let imported = 0,
    failures = 0;
  try {
    for (const item of records) {
      const result = history.record(
        runId,
        item.eventId,
        item.identity,
        item.status,
        item.duration,
        {
          source: 'Vitest JSON',
          startTime: report.startTime,
          errors: item.errors,
        },
      );
      if (result.added) {
        imported++;
        failures += Number(item.status === 'failed');
      }
    }
    history.finish(runId, failures ? 'failed' : 'passed', failures);
    return { imported, duplicates: records.length - imported };
  } catch (error) {
    history.finish(runId, 'interrupted', failures);
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--import'))
    throw new Error(
      'Usage: node tools/test/runner/test-history.mjs [--import <Vitest JSON>]',
    );
  const history = new TestHistory(process.cwd());
  try {
    if (args.length)
      console.log(
        JSON.stringify(
          importVitest(history, JSON.parse(readFileSync(args[1], 'utf8'))),
        ),
      );
    else
      console.table(
        history.all().map((row) => ({
          kind: row.kind,
          file: row.file,
          test: row.name,
          passed: row.passed,
          total: row.total,
          passRate: `${((100 * row.passed) / row.total).toFixed(1)}%`,
          fraction: `${row.passed}/${row.total}`,
        })),
      );
  } finally {
    history.close();
  }
}
