# Phase 0 Research: Next Tasks Execution

## Decision: Single source of truth in specs/tasks.md

**Decision**: Use `/Users/nakatsugawa/Code/MOONGIFT/sheet-db/specs/tasks.md` as
 the single task list and update it directly when selecting or completing
 tasks.

**Rationale**: A single shared file reduces divergence and keeps task tracking
visible.

**Alternatives considered**:
- Separate per-feature task lists (rejected: increases fragmentation)
- Issue tracker only (rejected: drifts from repo documentation)

## Decision: Manual status updates with explicit markers

**Decision**: Mark completed tasks in `specs/tasks.md` using checkbox status
updates and, where needed, add a short note for context.

**Rationale**: Simple, auditable changes fit the lightweight planning process.

**Alternatives considered**:
- Automated scripts (rejected: unnecessary complexity for current scope)
