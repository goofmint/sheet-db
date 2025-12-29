# Implementation Plan: Local Development Setup

**Branch**: `001-local-dev-setup` | **Date**: 2025-12-29 | **Spec**: specs/001-local-dev-setup/spec.md
**Input**: Feature specification from `specs/001-local-dev-setup/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Provide a local development setup with a repeatable smoke check, parity checklist for
production edge constraints, and a resettable local baseline dataset. The approach is to
use the existing Workers project structure, add local tooling and fixtures, and document
clear steps that mirror production constraints without requiring production deployment.

## Technical Context

**Language/Version**: TypeScript (Cloudflare Workers runtime); Node.js LTS for local tooling  
**Primary Dependencies**: Cloudflare Workers, Hono, Wrangler CLI, D1, KV  
**Storage**: Google Sheets (data), D1 (configs/sessions), KV (cache), Google Drive/R2 (files)  
**Testing**: Scripted local smoke check and parity checklist (no formal test runner yet)  
**Target Platform**: Cloudflare Workers (edge) with local execution via Wrangler/Miniflare
**Project Type**: Single project (Workers backend + static assets)  
**Performance Goals**: Local smoke check and reset complete within 2 minutes  
**Constraints**: Must highlight edge-runtime limitations (CPU/memory/timeouts), avoid
non-portable APIs, and keep local behavior aligned with production limits  
**Scale/Scope**: Developer onboarding and local workflows only; no production rollout changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- API contract remains Parse-compatible; contract changes include docs + versioning note.
- Google Sheets data model rules preserved (row 1 headers, row 2 metadata, row 3+ data).
- Auth and row-level access control behavior preserved; changes include automated tests.
- Cloudflare Workers + Hono architecture maintained; KV/D1/R2 usage consistent.
- 1000-row limit, cache TTL (60 min), and cache refresh behavior honored.

**Constitution Check Result**: Pass (feature is local-dev focused; no contract or data model changes).
**Post-Design Check Result**: Pass (data model/contracts are local-only and do not alter API).

## Project Structure

### Documentation (this feature)

```text
specs/001-local-dev-setup/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
./
├── src/
│   ├── index.tsx
│   ├── db/
│   │   └── migrations/
│   └── dev/
│       ├── parity-check.ts
│       ├── smoke-check.ts
│       └── reset.ts
├── public/
├── scripts/
│   ├── local-setup.md
│   └── seed-data/
│       └── baseline.json
└── specs/
    └── 001-local-dev-setup/
```

**Structure Decision**: Single-project Workers app with static assets. Add a `dev/`
module for local tooling and `scripts/seed-data/` for the baseline dataset.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

None.
