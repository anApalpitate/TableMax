---
name: tablemax-doc-maintenance
description: 整理 TableMax 项目文档、接入规则或研究资料、处理来源冲突、迁移归档主题并修复入链时使用。普通问答、单次检索读取和仅执行一条明确命令不触发文档维护或写入。
---

# TableMax document maintenance

Work from the repository root containing AGENTS.md, package.json and docs/README.md. All paths below are relative to that root. Establish the task's goal, writable scope, Git state and owned diff; preserve unrelated changes.

- Locate the unique maintained text through docs/README.md. Read the relevant sections of docs/reference/maintenance.md for classification, source integration and migration. Keep confirmed requirements, implementation, research, pending acceptance and historical conclusions distinct; detailed policy stays in its existing topic.
- Locate sections with `node tools/maintenance/find-doc.mjs <query> --path=docs/<topic> --limit=5 --max-bytes=8192`; add `--history` only for historical tracing. Use `node tools/maintenance/read-doc.mjs <file.md> --outline`, then the exact heading or heading-line. Continue with the returned SHA and v1 cursor; relocate after file changes rather than joining different versions. Parameters belong in tools/maintenance/README.md. If an entry is unavailable, inspect its documented script before selecting a direct read-only fallback; do not repeatedly issue the same failing command.
- Classify new material as addition, replacement, conflict or duplicate. Reuse unchanged evidence; a source identity change requires review only of associated conclusions. Preserve missing/unverified originals, version boundaries, conflicting positions and adoption reasons; summaries and project interpretations are not official facts.
- Update only affected text, source references and necessary inbound links. Close migrations in reviewable batches and preserve required old anchors. Add YAML only for an actual consumer; do not create parallel summaries or bulk metadata.
- Save using project Prettier. Select applicable checks from docs/reference/validation.md; use tablemax-scoped-validation when scope planning is needed. Reuse `node tools/maintenance/audit-efficiency-docs.mjs --changes=<owned-version1-SHA-manifest>` for link/migration auditing after checking its actual parameters and side effects. Document maintenance does not itself authorize product startup, installation, publishing or cleanup.

The pnpm aliases are equivalent when available; a read-only lookup does not require repairing the package manager. Read-only preparation must remain read-only: prefer docs:read or Node UTF-8 file reads and inspect actual tool side effects before calling a fallback. Return proposed locations and conclusions without edits or audit reports. Report changed paths, adopted evidence, check results and remaining gaps when authorized maintenance is complete.
