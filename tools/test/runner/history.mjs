import { historyPath, executionPath } from '../../shared/migration-paths.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export function failureLimit(
  value = process.env.TABLEMAX_TEST_MAX_FAILURES ?? 3,
) {
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new Error(
      'TABLEMAX_TEST_MAX_FAILURES must be an integer from 1 to 1000',
    );
  return limit;
}

export function testFile(root, file) {
  const path = relative(root, resolve(root, file)).replaceAll('\\', '/');
  if (!path || path.startsWith('../') || isAbsolute(path))
    throw new Error('Test file must belong to this workspace');
  return path;
}

export function testIdentity(kind, file, names, project = '') {
  if (
    !kind ||
    !file ||
    !Array.isArray(names) ||
    !names.length ||
    names.some((n) => typeof n !== 'string' || !n)
  )
    throw new Error(
      'A test needs a namespace, workspace file and complete name',
    );
  file = historyPath(file);
  return {
    id: JSON.stringify([kind, project, file, names]),
    kind,
    file,
    name: names.join(' > '),
  };
}

export function compareRates(a, b) {
  // Unknown is due for verification. A known 0% failure precedes an unknown.
  const rate = (s) => (s?.total ? s.passed / s.total : 0);
  return (
    rate(a) - rate(b) || Number(Boolean(b?.total)) - Number(Boolean(a?.total))
  );
}

export function weakest(stats) {
  return stats.reduce(
    (best, value) => (compareRates(value, best) < 0 ? value : best),
    stats[0],
  );
}

export class TestHistory {
  constructor(
    root,
    directory = process.env.TABLEMAX_TEST_HISTORY_DIR ??
      'artifacts/maintenance/test-history',
  ) {
    this.root = realpathSync(root);
    this.directory = resolve(this.root, directory);
    const inside = (path) => path.startsWith(this.root + sep);
    if (!inside(this.directory))
      throw new Error('Test history must stay inside this workspace');
    let parent = this.directory;
    while (!existsSync(parent)) parent = dirname(parent);
    if (parent !== this.root && !inside(realpathSync(parent)))
      throw new Error('Linked history directory escapes workspace');
    mkdirSync(this.directory, { recursive: true });
    if (!inside(realpathSync(this.directory)))
      throw new Error('Linked history directory escapes workspace');
    this.db = new DatabaseSync(resolve(this.directory, 'history.sqlite'));
    try {
      this.db.exec('PRAGMA busy_timeout=10000;');
      const version = this.db.prepare('PRAGMA user_version').get().user_version;
      if (version !== 0 && version !== 1)
        throw new Error(
          'Unknown test history format; original history retained',
        );
      this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cases (
          id TEXT PRIMARY KEY, kind TEXT NOT NULL, file TEXT NOT NULL, name TEXT NOT NULL,
          passed INTEGER NOT NULL CHECK(passed >= 0), total INTEGER NOT NULL CHECK(total >= passed),
          last_status TEXT NOT NULL, last_finished TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY, started TEXT NOT NULL, finished TEXT, state TEXT NOT NULL,
          failure_limit INTEGER NOT NULL, failures INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS attempts (
          event_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, case_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('passed','failed')), finished TEXT NOT NULL,
          duration_ms REAL NOT NULL, details TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS cases_file ON cases(file);
        CREATE INDEX IF NOT EXISTS attempts_run ON attempts(run_id);
        PRAGMA user_version=1;
      `);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  close() {
    this.db.close();
  }
  get(id) {
    return this.db.prepare('SELECT * FROM cases WHERE id=?').get(id);
  }
  all() {
    return this.db
      .prepare('SELECT * FROM cases ORDER BY file, name')
      .all()
      .map((row) => ({ ...row, file: executionPath(row.file) }));
  }
  fileRate(file) {
    return weakest(
      this.db
        .prepare('SELECT passed,total FROM cases WHERE file=?')
        .all(historyPath(file)),
    );
  }
  start(limit) {
    const id = randomUUID();
    this.db
      .prepare(
        "INSERT INTO runs(id,started,state,failure_limit) VALUES(?,?,'running',?)",
      )
      .run(id, new Date().toISOString(), failureLimit(limit));
    return id;
  }
  failures(id) {
    return (
      this.db.prepare('SELECT failures FROM runs WHERE id=?').get(id)
        ?.failures ?? 0
    );
  }
  finish(id, state, failures) {
    if (!['passed', 'failed', 'stopped', 'interrupted'].includes(state))
      throw new Error('Invalid run state');
    this.db
      .prepare('UPDATE runs SET finished=?,state=?,failures=? WHERE id=?')
      .run(new Date().toISOString(), state, failures, id);
  }

  record(runId, eventId, identity, status, duration = 0, details = {}) {
    if (!['passed', 'failed'].includes(status))
      throw new Error('Only completed tests count');
    if (!runId || !eventId || !Number.isFinite(duration) || duration < 0)
      throw new Error('Invalid test event');
    const finished = new Date().toISOString();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const added = this.db
        .prepare('INSERT OR IGNORE INTO attempts VALUES(?,?,?,?,?,?,?)')
        .run(
          eventId,
          runId,
          identity.id,
          status,
          finished,
          duration,
          JSON.stringify(details),
        );
      if (added.changes) {
        this.db
          .prepare(
            `INSERT INTO cases VALUES(?,?,?,?,?,1,?,?)
          ON CONFLICT(id) DO UPDATE SET passed=passed+excluded.passed,total=total+1,
          last_status=excluded.last_status,last_finished=excluded.last_finished`,
          )
          .run(
            identity.id,
            identity.kind,
            identity.file,
            identity.name,
            Number(status === 'passed'),
            status,
            finished,
          );
        if (status === 'failed')
          this.db
            .prepare('UPDATE runs SET failures=failures+1 WHERE id=?')
            .run(runId);
      }
      this.db.exec('COMMIT');
      return { ...this.get(identity.id), added: Boolean(added.changes) };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  report(runId) {
    return {
      run: this.db.prepare('SELECT * FROM runs WHERE id=?').get(runId),
      cases: this.db
        .prepare(
          `SELECT a.event_id,a.status,a.duration_ms,a.details,c.id,c.kind,c.file,c.name,c.passed,c.total
        FROM attempts a JOIN cases c ON c.id=a.case_id WHERE a.run_id=? ORDER BY a.rowid`,
        )
        .all(runId)
        .map((row) => ({
          ...row,
          details: JSON.parse(row.details),
          passRate: row.passed / row.total,
          fraction: `${row.passed}/${row.total}`,
        })),
    };
  }
}

export function rawIdentity(root, task, project = '') {
  const names = [task.name];
  for (
    let suite = task.suite;
    suite && !('filepath' in suite);
    suite = suite.suite
  )
    names.unshift(suite.name);
  return testIdentity(
    'vitest',
    testFile(root, task.file.filepath),
    names,
    project,
  );
}

export function lifecycleIdentity(root, suite, project = '') {
  return 'filepath' in suite
    ? testIdentity(
        'vitest-module',
        testFile(root, suite.filepath),
        ['模块收集／生命周期'],
        project,
      )
    : testIdentity(
        'vitest-suite',
        testFile(root, suite.file.filepath),
        [rawIdentity(root, suite, project).name, '组生命周期'],
        project,
      );
}

export function sortSuite(suite, history, project = '') {
  const scores = new Map();
  function score(task) {
    if (!scores.has(task)) {
      if (task.type === 'test')
        scores.set(
          task,
          history.get(rawIdentity(history.root, task, project).id),
        );
      else {
        const rates = task.tasks.map(score);
        const lifecycle = history.get(
          lifecycleIdentity(history.root, task, project).id,
        );
        // Imported case reports have no lifecycle check; do not turn every
        // otherwise healthy group into an unknown 0% group.
        if (lifecycle) rates.push(lifecycle);
        scores.set(task, weakest(rates));
      }
    }
    return scores.get(task);
  }
  suite.tasks.sort((a, b) => compareRates(score(a), score(b)));
  suite.shuffle = false;
  for (const task of suite.tasks) {
    task.concurrent = false;
    if (task.type === 'suite') sortSuite(task, history, project);
  }
}
