# farm-smoke-lander-a1 — project contract

Built and maintained by the Wright farm (type: lander). Builders: read this FIRST.

## Build & run
- `npm ci` then `npm run build` (must stay green — CI's compile-gate blocks merge)
- `npm test` — if tests exist they must pass; add tests for behavior you rely on
- Dev server: `npm run dev` (never run servers from this checkout on the farm — worktrees only)

## Deploy
- Merging to main IS deploying (GitHub Action). Never deploy by hand.
- Rollback: Railway dashboard one-click / redeploy previous Pages build. Deploys are tagged `deploy-*`.

## Farm rules (non-negotiable)
- Work in your assigned worktree on your assigned branch. Never touch main directly.
- PR-only. Small vertical slices. No force-push. Squash-merge happens after review.
- The serving tree (`~/Farm/farm-smoke-lander-a1/farm-smoke-lander-a1`) stays on main — edit only in `.worktrees/`.
- Secrets live in GitHub Actions secrets / 1Password — never in code, env files, or logs.
- Stuck or context filling up? Use the handoff skill and open a draft PR with notes — don't thrash.

## Conventions
- Match existing file/naming/comment style. Plain language. No drive-by refactors outside your slice.
