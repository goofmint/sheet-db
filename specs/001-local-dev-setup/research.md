# Phase 0 Research: Local Development Setup

## Decision 1: Local Execution Strategy
- **Decision**: Use Wrangler/Miniflare local execution for the Workers app.
- **Rationale**: Wrangler is the official local runtime for Workers and aligns with
  production constraints and bindings (D1/KV).
- **Alternatives considered**: Pure Node.js server mock (rejected due to runtime drift).

## Decision 2: Parity Checklist Scope
- **Decision**: Track edge runtime constraints that commonly break local parity:
  CPU time limits, memory limits, request/response size constraints, and restricted
  Node.js APIs.
- **Rationale**: These constraints are the most likely sources of production-only
  failures for Workers applications.
- **Alternatives considered**: Only document limits without checks (rejected due to
  lack of actionable feedback).

## Decision 3: Smoke Check Mechanism
- **Decision**: Provide a scripted smoke check that performs one read and one write
  against a local test dataset.
- **Rationale**: Matches the spec acceptance criteria and validates baseline readiness
  without requiring full integration testing.
- **Alternatives considered**: Manual checklist only (rejected due to inconsistency).

## Decision 4: Local Reset Behavior
- **Decision**: Provide a reset command that re-seeds local data to a documented
  baseline dataset.
- **Rationale**: Enables repeatable testing and aligns with the spec requirement for
  fast reset.
- **Alternatives considered**: Manual deletion and re-creation (rejected due to time cost).

## Decision 5: Baseline Dataset Format
- **Decision**: Store a canonical baseline dataset as structured JSON fixtures for
  reuse by smoke checks and resets.
- **Rationale**: JSON fixtures are human-readable, versionable, and compatible with
  setup scripts.
- **Alternatives considered**: Spreadsheet-only baseline (rejected due to automation cost).
