import { spawn } from 'node:child_process';
import {
  createWriteStream,
  mkdirSync,
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import {
  EvidenceIndex,
  atomicJson,
  fingerprint,
  fileRecord,
  localFile,
} from './evidence.mjs';
import { testIdentity, compareRates, failureLimit } from './history.mjs';

export async function runPlan(
  prepared,
  history,
  {
    limit = failureLimit(),
    index = new EvidenceIndex(history.root),
    finish,
  } = {},
) {
  const runId = history.start(limit),
    output = resolve(history.directory, 'runs', runId);
  mkdirSync(output, { recursive: true });
  atomicJson(history.root, resolve(output, 'prepared.json'), prepared);
  const result = {
    version: 2,
    startedAt: new Date().toISOString(),
    runId,
    scope: prepared.scope,
    selections: [],
    unexecuted: [],
    failures: 0,
    timings: {
      fingerprintMs: prepared.tests.reduce(
        (sum, item) => sum + item.binding.durationMs,
        0,
      ),
      executionMs: 0,
      finishMs: 0,
    },
    executed: 0,
    reused: 0,
  };
  const tests = prepared.tests.map((item) => ({
    ...item,
    identity: testIdentity('verification', item.script, [item.id]),
  }));
  tests.sort((a, b) =>
    compareRates(history.get(a.identity.id), history.get(b.identity.id)),
  );
  let state = 'interrupted';
  try {
    for (const [sequence, item] of tests.entries()) {
      const selection = {
        id: item.id,
        selectedBy: item.selectedBy,
        decision: item.decision,
        reason: item.reason,
        fingerprint: item.binding.key,
        evidencePath: item.evidencePath,
        gaps: item.binding.value.gaps,
      };
      if (item.decision === 'not-applicable') {
        result.selections.push(selection);
        continue;
      }
      if (history.failures(runId) >= limit) {
        result.unexecuted.push(item.id);
        continue;
      }
      const current = fingerprint(history.root, item);
      if (current.key !== item.binding.key)
        throw new Error('Inputs changed after planning: ' + item.id);
      if (item.decision === 'reuse') {
        const verified = index.find(current);
        if (!verified.proof)
          throw new Error('Evidence changed after planning: ' + item.id);
        result.reused++;
        result.selections.push({ ...selection, status: 'reused' });
        continue;
      }
      const itemOutput = resolve(output, String(sequence));
      mkdirSync(itemOutput);
      const logs = ['stdout.log', 'stderr.log'].map((name) =>
        resolve(itemOutput, name),
      );
      const streams = logs.map((path) =>
        createWriteStream(path, { flags: 'wx' }),
      );
      const command =
        item.runtime === 'powershell' ? 'powershell.exe' : process.execPath;
      const args =
        item.runtime === 'powershell'
          ? [
              '-NoProfile',
              '-NonInteractive',
              '-File',
              resolve(history.root, item.script),
              ...item.args,
            ]
          : item.runtime === 'vitest'
            ? [
                resolve(history.root, 'node_modules/vitest/vitest.mjs'),
                'run',
                item.script,
                ...item.args,
              ]
            : [
                ...(item.nodeArgs ?? []),
                resolve(history.root, item.script),
                ...item.args,
              ];
      const failuresBefore = history.failures(runId),
        started = performance.now();
      const priorEvidence = new Map(
        (item.evidence ?? []).map((path) => [
          path,
          existsSync(resolve(history.root, path))
            ? fileRecord(history.root, path).sha256
            : null,
        ]),
      );
      const execution = await new Promise((done) => {
        const child = spawn(command, args, {
          cwd: history.root,
          windowsHide: true,
          shell: false,
          env: {
            ...process.env,
            TABLEMAX_TEST_SCOPE: prepared.scope,
            TABLEMAX_TEST_SOUND: 'off',
            TABLEMAX_TEST_AUDIO: '0',
            TABLEMAX_AUTO_MAINTENANCE: '0',
            TABLEMAX_TEST_HISTORY_DIR: history.directory,
            TABLEMAX_TEST_HISTORY_RUN_ID: runId,
            TABLEMAX_TEST_MAX_FAILURES: String(limit),
            TABLEMAX_TEST_OUTPUT_DIR: itemOutput,
          },
        });
        child.stdout.pipe(streams[0]);
        child.stderr.pipe(streams[1]);
        let spawnError;
        child.once('error', (error) => {
          spawnError = error.message;
        });
        child.once('close', (code, signal) =>
          done({ code, signal, spawnError }),
        );
      });
      await Promise.all(streams.map((stream) => finished(stream)));
      const durationMs = performance.now() - started;
      result.timings.executionMs += durationMs;
      result.executed++;
      let error;
      if (fingerprint(history.root, item).key !== item.binding.key)
        error = 'Inputs changed during execution';
      const artifacts = [...logs];
      let complete = true;
      const resultFile =
        item.resultFile ??
        ([
          'tools/test/desktop/verify-delivery-session.mjs',
          'tools/test/platform/verify-download-loopback.mjs',
        ].includes(item.script)
          ? 'results.json'
          : undefined);
      if (resultFile) {
        try {
          const evidence = JSON.parse(
            readFileSync(localFile(itemOutput, resultFile), 'utf8'),
          );
          if (
            (evidence.result ?? evidence.status) !== 'passed' ||
            evidence.failures
          )
            complete = false;
        } catch {
          complete = false;
        }
      }
      function collect(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          if (entry.isSymbolicLink() || entry.name === '.git')
            throw new Error('Linked or nested repository evidence rejected');
          if (entry.isDirectory()) collect(path);
          else if (!artifacts.includes(path)) artifacts.push(path);
        }
      }
      collect(itemOutput);
      for (const path of item.evidence ?? []) {
        if (
          !existsSync(resolve(history.root, path)) ||
          fileRecord(history.root, path).sha256 === priorEvidence.get(path)
        ) {
          complete = false;
          continue;
        }
        artifacts.push(path);
      }
      if (!complete)
        error = 'Required evidence missing or not refreshed by this execution';
      const status =
        execution.code === 0 &&
        !execution.signal &&
        !execution.spawnError &&
        !error
          ? 'passed'
          : 'failed';
      const childCounted = history.failures(runId) > failuresBefore;
      if (!(status === 'failed' && childCounted))
        history.record(
          runId,
          `${runId}:${item.id}`,
          item.identity,
          status,
          durationMs,
          { ...execution, error, command, args, logs },
        );
      const recordPath = resolve(itemOutput, 'execution.json');
      atomicJson(history.root, recordPath, {
        status,
        complete,
        ...execution,
        error,
        durationMs,
        binding: item.binding.value,
        artifacts: artifacts.map((path) => fileRecord(history.root, path)),
      });
      if (status === 'passed' && complete)
        index.save(current, [recordPath, ...artifacts], { durationMs });
      result.selections.push({
        ...selection,
        status,
        complete,
        durationMs,
        evidencePath: recordPath,
      });
      atomicJson(history.root, resolve(output, 'selection.json'), result);
      console.log(`${item.id}: ${status} (${Math.round(durationMs)}ms)`);
    }
    result.failures = history.failures(runId);
    state =
      result.failures >= limit
        ? 'stopped'
        : result.failures
          ? 'failed'
          : 'passed';
  } catch (error) {
    result.error = error.message;
    state = 'interrupted';
  } finally {
    result.failures = history.failures(runId);
    history.finish(runId, state, result.failures);
    if (finish) {
      const started = performance.now();
      try {
        result.maintenance = await finish({ runId, output });
      } catch (error) {
        result.maintenance = { result: 'blocked', error: error.message };
      }
      result.timings.finishMs = performance.now() - started;
    }
    result.finishedAt = new Date().toISOString();
    const report = { ...result, ...history.report(runId) };
    atomicJson(history.root, resolve(output, 'results.json'), report);
  }
  return { ...result, ...history.report(runId), output };
}
