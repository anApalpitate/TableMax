---
name: tablemax-scoped-validation
description: 为 TableMax 本任务改动选择或执行范围检查、判断证据复用、处理失败及定向复验时使用。普通项目问答不触发；用户只要求一条明确命令时直接执行该命令，不增无关规划或检查。
---

# TableMax scoped validation

Work from the repository root containing AGENTS.md and package.json. Inputs are task-owned changes, actual dependencies, validation goals and existing evidence. Git state helps identify ownership; unrelated uncommitted work must not enlarge this task.

1. Read only relevant sections of docs/reference/validation.md for content-bound plans, scope selection and failure policy. Use the corresponding operations in tools/test/README.md to choose a scope, preset or explicit plan; do not create another test registry.
2. Verify owned changes against current byte SHA values, deletions and path ownership. Stop on a stale manifest and explain differences; generate a replacement only after reviewing actual authorized changes, never silently absorb other work. Documentation needs only applicable format/content/link checks; single-game work stays in that game; shared changes select actual dependencies.
3. Inspect command side effects before preview, execution or reuse. For execution use tools/test/runner/test-scoped.mjs with documented scope/plan/changes parameters. Some --list branches write selection reports; for a strictly read-only selection use the existing pure selectUnitTests export from tools/test/runner/scopes.mjs or return a plan. Exact parameters and side effects belong in existing tool documentation and implementation. Read-only requests must not write statistics/reports, build or launch products; leave dependent actions explicitly unexecuted. For text, prefer `node tools/maintenance/read-doc.mjs` or Node UTF-8 file reads and check fallback side effects.
4. Reuse requires complete binding of inputs, method, parameters, combination, environment and actual evidence hashes. Reject missing, failed, damaged, changed or incompletely bound evidence. Preserve old proofs' original versions and scope; source or simulated-device results cannot become current EXE, real-device or installation acceptance.
5. Execute through the existing runner, plans, ledgers and failure policy. Stop dispatch at the documented threshold and preserve failures and unexecuted items. After a substantive repair or environment correction, record cause, changed inputs and impact; open the documented independent-budget round automatically and verify only affected items. No unchanged retries or weakened assertions.

Report execution, reuse, exclusions and unexecuted items with reasons, actual results and evidence paths. This skill grants no extra system-operation, installation, publication, deployment or cleanup authority.
