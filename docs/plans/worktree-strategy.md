# KATHA — Git Worktree Strategy (Boris Principle #1)

> Run parallel Claude sessions on independent components.

---

## Worktree Layout

```bash
# Phase 1: Single worktree (foundation — everything depends on it)
# Work in main: C:\Github\Katha

# Phase 2+3: Two parallel worktrees (both depend only on Phase 1)
git worktree add "../Katha-ingest" -b feature/ingest-pipeline
git worktree add "../Katha-engine" -b feature/wisdom-engine

# Phase 4: Two parallel worktrees (dashboard + globe are independent)
git worktree add "../Katha-dashboard" -b feature/dashboard-ui
git worktree add "../Katha-globe" -b feature/globe-viz

# Phase 5: Back to main for deployment
git worktree remove "../Katha-ingest"
git worktree remove "../Katha-engine"
git worktree remove "../Katha-dashboard"
git worktree remove "../Katha-globe"
```

## Terminal Tab Color Coding

| Worktree | Branch | Color | Port |
|----------|--------|-------|------|
| Main (Vault) | `main` | Blue | 3001 |
| Ingest | `feature/ingest-pipeline` | Green | — |
| Engine | `feature/wisdom-engine` | Orange | 3002 |
| Dashboard | `feature/dashboard-ui` | Purple | 3000 |
| Globe | `feature/globe-viz` | Teal | 3000 |

## Merge Order

1. `feature/ingest-pipeline` → `main` (after CP-2 passes)
2. `feature/wisdom-engine` → `main` (after CP-3 passes)
3. `feature/dashboard-ui` → `main` (after screens work)
4. `feature/globe-viz` → `main` (after 12 dots render)
5. CP-4 verification on `main` with everything merged

## Rules

- Vault stays on `main` — it's the shared dependency
- Each worktree runs its own Claude session
- Merge only after the phase's testing agent passes
- Never merge without running the checkpoint test first
