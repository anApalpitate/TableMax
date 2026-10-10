import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { BaseSequencer } from 'vitest/node';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TestHistory,
  compareRates,
  testFile,
  testIdentity,
  failureLimit,
} from './history.mjs';
export { failureLimit } from './history.mjs';

export class HistorySequencer extends BaseSequencer {
  async sort(files) {
    const history = new TestHistory(this.ctx.config.root);
    try {
      const rates = new Map(
        files.map((file) => [
          file,
          history.fileRate(testFile(history.root, file.moduleId)),
        ]),
      );
      return [...files].sort((a, b) =>
        compareRates(rates.get(a), rates.get(b)),
      );
    } finally {
      history.close();
    }
  }
}

function reportedIdentity(root, test) {
  const names = [test.name];
  for (
    let parent = test.parent;
    parent.type === 'suite';
    parent = parent.parent
  )
    names.unshift(parent.name);
  return testIdentity(
    'vitest',
    testFile(root, test.module.moduleId),
    names,
    test.project.name ?? '',
  );
}

export class HistoryReporter {
  onInit(vitest) {
    this.vitest = vitest;
  }
  onTestRunStart() {
    this.history = new TestHistory(this.vitest.config.root);
    this.limit = failureLimit(this.vitest.config.bail ?? undefined);
    this.runId = this.history.start(this.limit);
    this.vitest.provide('tablemaxTestHistoryRun', this.runId);
    this.failures = 0;
    this.stopped = false;
  }
  async threshold() {
    if (this.failures >= this.limit && !this.stopped) {
      this.stopped = true;
      this.vitest.logger.error(
        `达到出错阈值 ${this.failures}/${this.limit}，停止本轮测试；先修复失败项，再运行受影响测试。`,
      );
      // cancelCurrentRun waits for the run itself; awaiting it from a reporter
      // would deadlock the worker's awaited result callback.
      void this.vitest
        .cancelCurrentRun('test-failure')
        .catch((error) => this.vitest.logger.error(error));
    }
  }
  async onTestCaseResult(test) {
    const result = test.result();
    const diagnostic = test.diagnostic();
    if (!['passed', 'failed'].includes(result.state) || !diagnostic?.startTime)
      return;
    const identity = reportedIdentity(this.history.root, test);
    const stat = this.history.record(
      this.runId,
      `${this.runId}:${test.id}`,
      identity,
      result.state,
      diagnostic.duration,
      {
        retryCount: diagnostic.retryCount,
        repeatCount: diagnostic.repeatCount,
        errors:
          result.errors?.map((error) => ({
            message: error.message,
            stack: error.stack,
          })) ?? [],
      },
    );
    if (result.state === 'failed') {
      this.vitest.logger.error(
        `${identity.file} · ${identity.name}：历史通过 ${stat.passed}/${stat.total}（${((100 * stat.passed) / stat.total).toFixed(1)}%）`,
      );
    }
    this.failures = this.history.failures(this.runId);
    await this.threshold();
  }
  async onTestModuleEnd(module) {
    // Import/beforeAll/afterAll failures are infrastructure checks, not invented case executions.
    const errors = module.errors();
    if (!['passed', 'failed'].includes(module.state())) return;
    const identity = testIdentity(
      'vitest-module',
      testFile(this.history.root, module.moduleId),
      ['模块收集／生命周期'],
      module.project.name ?? '',
    );
    this.history.record(
      this.runId,
      `${this.runId}:module:${module.id}`,
      identity,
      errors.length ? 'failed' : 'passed',
      0,
      {
        errors: errors.map((error) => ({
          message: error.message,
          stack: error.stack,
        })),
      },
    );
    this.failures = this.history.failures(this.runId);
    await this.threshold();
  }
  async onTestRunEnd(_modules, errors, reason) {
    try {
      this.failures += errors.length;
      const state = this.stopped
        ? 'stopped'
        : reason === 'interrupted'
          ? 'interrupted'
          : this.failures
            ? 'failed'
            : 'passed';
      this.history.finish(this.runId, state, this.failures);
      const report = {
        ...this.history.report(this.runId),
        errors,
        counting:
          'One completed case invocation per run; skipped/unstarted cases excluded. Explicit retries/repeats retained as diagnostics.',
        nextStep: this.failures
          ? '修复失败项后，按累计低通过率优先运行受影响测试。'
          : '按变更范围选择后续检查。',
      };
      const folder = resolve(this.history.directory, 'runs');
      mkdirSync(folder, { recursive: true });
      const output = resolve(folder, `${this.runId}.json`);
      writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
      this.vitest.logger.log(
        `历史通过率：${report.cases.length} 项已记录；失败 ${this.failures}/${this.limit}；${output}`,
      );
    } finally {
      this.history.close();
    }
  }
}
export default HistoryReporter;
