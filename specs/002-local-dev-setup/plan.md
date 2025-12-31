# Implementation Plan: Local Dev Setup

**Branch**: `002-local-dev-setup` | **Date**: 2025-12-31 | **Spec**: /Users/nakatsugawa/Code/MOONGIFT/sheet-db/specs/002-local-dev-setup/spec.md
**Input**: Feature specification from `/specs/002-local-dev-setup/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Provide a command-driven local development setup for the main UI and demo server
with no manual file creation and no version pinning, following the Hono
Cloudflare Workers guide for the demo server.

## Technical Context

**Language/Version**: TypeScript/JavaScript (no version pinning)  
**Primary Dependencies**: Hono, React Router, Wrangler, UI build tooling (no version pinning)  
**Storage**: N/A for local setup  
**Testing**: Manual smoke checks via local URLs  
**Target Platform**: Cloudflare Workers (demo server) + browser (main UI)
**Project Type**: Web application with separate UI and worker surfaces  
**Performance Goals**: Local dev servers start and serve pages within 2 minutes  
**Constraints**: Command-only bootstrap; no manual file creation; no version pinning; follow Hono Workers guide; keep main UI and demo server separated  
**Scale/Scope**: Two local surfaces (main UI, demo server)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Confirm the feature adheres to the SheetDB schema contract (row 1 headers,
  row 2 JSON metadata, row 3+ data) and uses row 2 metadata for validation.
- Confirm row-level ACL fields and evaluation order (public → role → user) are
  enforced, with master key handling documented.
- Confirm Cloudflare Workers + Hono runtime assumptions and domain split
  (`sheetdb.app` vs `demo.sheetdb.app`) are respected.
- Confirm read/write API flows, KV TTL expectations, and cache regeneration
  behavior are preserved.
- Confirm setup wizard/system sheets requirements are accounted for when
  configuration or bootstrapping is involved.

**Gate status**: Pass (local setup only; no schema/ACL/API changes)

## Project Structure

### Documentation (this feature)

```text
specs/002-local-dev-setup/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/
├── main-ui/             # React Router UI (sheetdb.app)
└── demo/                # Hono Cloudflare Worker (demo.sheetdb.app)
```

**Structure Decision**: Use a monorepo `apps/` layout to keep the main UI and
Cloudflare Workers demo server separate while sharing a single repo.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
