import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { spawn } from 'node:child_process';
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve, sep } from 'node:path';
import { finished } from 'node:stream/promises';
import {
  TestHistory,
  compareRates,
  failureLimit,
  testFile,
  testIdentity,
} from './history.mjs';

export async function runBatch(plan, history, { limit = failureLimit() } = {}) {
  failureLimit(limit);
  if (plan.version !== 1 || !Array.isArray(plan.tests) || !plan.tests.length)
    throw new Error('A version 1 plan requires explicit tests');
  const seen = new Set();
  const tests = plan.tests
    .map((item) => {
      if (
        !/^[a-z0-9][a-z0-9/_.-]*$/i.test(item.id) ||
        seen.has(item.id) ||
        !['node', 'powershell'].includes(item.runtime) ||
        !Array.isArray(item.args) ||
        item.args.some((arg) => typeof arg !== 'string')
      )
        throw new Error('Invalid/duplicate batch test or argument vector');
      seen.add(item.id);
      const script = resolve(history.root, item.script);
      if (
        !realpathSync(script).startsWith(history.root + sep) ||
        !statSync(script).isFile()
      )
        throw new Error('Verification script must stay inside the workspace');
      const identity = testIdentity(
        'verification',
        testFile(history.root, script),
        [item.id],
      );
      return { ...item, script, identity, rate: history.get(identity.id) };
    })
    .sort((a, b) => compareRates(a.rate, b.rate));
  const runId = history.start(limit);
  const output = resolve(history.directory, 'runs', runId);
  mkdirSync(output, { recursive: true });
  let failures = 0;
  const executed = [];
  try {
    for (const item of tests) {
      const stdout = createWriteStream(
        resolve(output, `${executed.length}-stdout.log`),
      );
      const stderr = createWriteStream(
        resolve(output, `${executed.length}-stderr.log`),
      );
      const start = performance.now();
      const command =
        item.runtime === 'node' ? process.execPath : 'powershell.exe';
      const args =
        item.runtime === 'node'
          ? [item.script, ...item.args]
          : [
              '-NoProfile',
              '-NonInteractive',
              '-File',
              item.script,
              ...item.args,
            ];
      const result = await new Promise((done) => {
        const child = spawn(command, args, {
          cwd: history.root,
          windowsHide: true,
          shell: false,
          env: { ...process.env, TABLEMAX_TEST_SOUND: 'off' },
        });
        child.stdout.pipe(stdout);
        child.stderr.pipe(stderr);
        let spawnError;
        child.once('error', (error) => {
          spawnError = error.message;
        });
        child.once('close', (code, signal) =>
          done({ code, signal, spawnError }),
        );
      });
      await Promise.all([finished(stdout), finished(stderr)]);
      const status =
        result.code === 0 && !result.signal && !result.spawnError
          ? 'passed'
          : 'failed';
      const stat = history.record(
        runId,
        `${runId}:${item.id}`,
        item.identity,
        status,
        performance.now() - start,
        { ...result, command, args, logs: output },
      );
      executed.push({
        ...item,
        id: item.id,
        status,
        passed: stat.passed,
        total: stat.total,
      });
      if (status === 'failed') failures++;
      console.log(
        `${item.id}: ${status}, 历史通过 ${stat.passed}/${stat.total} (${((100 * stat.passed) / stat.total).toFixed(1)}%)`,
      );
      if (failures >= limit) break;
    }
    const stopped = failures >= limit;
    history.finish(
      runId,
      stopped ? 'stopped' : failures ? 'failed' : 'passed',
      failures,
    );
    const report = {
      ...history.report(runId),
      order: tests.map((item) => item.id),
      unexecuted: tests.slice(executed.length).map((item) => item.id),
      nextStep: failures
        ? '先修复失败项，再运行受影响测试。'
        : '本轮所选检查通过。',
    };
    writeFileSync(
      resolve(output, 'results.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    if (stopped)
      console.error(
        `达到出错阈值 ${failures}/${limit}，停止后续测试，先修复。`,
      );
    return report;
  } catch (error) {
    history.finish(runId, 'interrupted', failures);
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.filename)
) {
  if (process.argv.length !== 3)
    throw new Error('Usage: node tools/test/runner/test-batch.mjs <plan.json>');
  const history = new TestHistory(process.cwd());
  try {
    const result = await runBatch(
      JSON.parse(readFileSync(process.argv[2], 'utf8')),
      history,
    );
    if (result.run.state !== 'passed') process.exitCode = 1;
  } finally {
    history.close();
  }
}
