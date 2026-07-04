# Agent rules — farm-smoke-lander-a1

For ANY coding agent (Claude, Codex, other) working in this repo:

1. Branch + worktree per task; PR-only; no pushes to main; no force-push anywhere.
2. CI must be green before merge is even requested (compile-gate: build + tests-if-present).
3. You may not edit: .github/workflows/*, branch protection, repo settings. Flag instead.
4. Reviewer is never the implementer. If you wrote it, you don't approve it.
5. Quote receipts: PR URL, CI run link, deploy tag. No receipt = it didn't happen.
6. Read the repo-local CONTEXT.md when present and update it for new domain terms, non-obvious decisions, or ADR-style notes introduced by your slice.
7. Prefer changed-file or slice-local lint/test/typecheck commands when safe before running full CI; full CI is still required at merge/deploy gates.
8. Preserve option value: justify irreversible schema/API/framework choices and major dependencies, especially own-vs-import decisions for core product primitives. Commodity plumbing can be imported normally.
9. Parallel builders should be rare and isolated. If multiple builders touch this repo, follow the named conflict boundaries and integration owner in the brief.
10. See CLAUDE.md for build/deploy specifics.
