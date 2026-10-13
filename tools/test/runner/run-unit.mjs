import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { resolve } from 'node:path';
import { failureLimit } from './history.mjs';
import { finishVerificationRound } from './round.mjs';
import { createOutputBudget } from './log-output.mjs';

async function execute(root, files, env, logs) {
  const streams = logs.map((path) => createWriteStream(path, { flags: 'wx' }));
  const result = await new Promise((done) => {
    const child = spawn(
      process.execPath,
      [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', ...files],
      { cwd: root, windowsHide: true, shell: false, env },
    );
    child.stdout.pipe(streams[0]);
    child.stderr.pipe(streams[1]);
    let spawnError;
    child.once('error', (error) => {
      spawnError = error.message;
    });
    child.once('close', (code, signal) => done({ code, signal, spawnError }));
  });
  await Promise.all(streams.map((stream) => finished(stream)));
  return result;
}

export async function runUnitTests(
  files,
  scope,
  history,
  {
    executeChild = execute,
    finish = (context) => finishVerificationRound(history.root, context),
  } = {},
) {
  const limit = failureLimit(),
    runId = history.start(limit);
  const output = resolve(history.directory, 'runs', runId);
  mkdirSync(output, { recursive: true });
  const logs = ['stdout.log', 'stderr.log'].map((name) =>
    resolve(output, name),
  );
  let state = 'interrupted',
    result;
  try {
    result = await executeChild(
      history.root,
      files,
      {
        ...process.env,
        TABLEMAX_TEST_SCOPE: scope,
        TABLEMAX_TEST_SOUND: 'off',
        TABLEMAX_TEST_AUDIO: '0',
        TABLEMAX_AUTO_MAINTENANCE: '0',
        TABLEMAX_TEST_HISTORY_DIR: history.directory,
        TABLEMAX_TEST_HISTORY_RUN_ID: runId,
        TABLEMAX_TEST_MAX_FAILURES: String(limit),
      },
      logs,
    );
    const failures = history.failures(runId);
    state =
      failures >= limit
        ? 'stopped'
        : failures || result.code !== 0 || result.signal
          ? 'failed'
          : 'passed';
  } finally {
    history.finish(runId, state, history.failures(runId));
    if (finish) {
      try {
        result = { ...result, maintenance: await finish({ runId, output }) };
      } catch (error) {
        result = {
          ...result,
          maintenance: { result: 'blocked', error: error.message },
        };
      }
    }
  }
  const report = { ...result, ...history.report(runId), output, logs };
  writeFileSync(
    resolve(output, 'results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  const terminal = createOutputBudget();
  terminal.line(`Vitest: ${state}; ${resolve(output, 'results.json')}`);
  if (state !== 'passed' && !result?.spawnError) terminal.failure(logs);
  return report;
}
