<!--
Sync Impact Report
- Version change: N/A (template) → 1.0.0
- Modified principles: N/A (initial constitution fill)
- Added sections: Core Principles, Architecture & Data Model Constraints,
  Development Workflow & Quality Gates, Governance
- Removed sections: None
- Templates requiring updates: ✅ .specify/templates/plan-template.md,
  ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: TODO(RATIFICATION_DATE): original adoption date not found in repo
-->
# SheetDB Constitution

## Core Principles

### I. Parse-Compatible API Contract
SheetDB MUST maintain compatibility with the Parse Server REST API where documented.
Breaking changes are only allowed with a versioned endpoint and updated docs, and any
contract change MUST ship with matching API documentation updates.

### II. Google Sheets as Source of Truth
Google Sheets are the canonical datastore. Row 1 MUST remain the header, row 2 MUST
define column metadata as JSON, and row data MUST start at row 3. CRUD operations MUST
respect column definitions, defaults, and validation rules derived from row 2.

### III. Row-Level Access Control & Authentication (NON-NEGOTIABLE)
Authentication MUST be enforced via the `_Users` sheet and session IDs stored in D1.
Row-level access control MUST honor `_publicRead`, `_publicWrite`, `_roleRead`,
`_roleWrite`, `_userRead`, and `_userWrite`. Sheets prefixed with `_` MUST require
authentication unless accessed with a master key.

### IV. Cloudflare Edge Architecture
The backend MUST run on Cloudflare Workers using Hono. Configuration data MUST be
stored in D1, cache data in KV, and file uploads MUST target Google Drive or R2.

### V. Operational Limits & Cache Behavior
API responses MUST enforce the 1000-row-per-request limit and configured rate limits.
Write operations MUST trigger background cache refreshes, and cache TTL MUST remain
60 minutes unless explicitly revised with documentation updates.

## Architecture & Data Model Constraints

- **Frontend**: React.
- **Backend**: Cloudflare Workers with Hono.
- **Storage**: Google Sheets for data, Cloudflare KV for caching, Cloudflare D1 for
  configs/sessions, Google Drive or Cloudflare R2 for file storage.
- **Default Sheets**: `_Users`, `_Roles`, `_Files` MUST exist with documented columns.
- **Default D1 Tables**: `configs`, `sessions` MUST exist for service state.
- **Sheet Names**: User-created sheet names MUST be alphanumeric + underscore only.

## Development Workflow & Quality Gates

- Any API contract change MUST include updated API docs and a versioning note.
- Access control or authentication changes MUST include automated tests covering the
  affected permission paths.
- Changes to default sheets, default columns, or D1 tables MUST include a migration
  plan and backward compatibility notes.
- Cache or rate-limit changes MUST include validation steps and updated limits docs.
- PR review MUST verify compliance with this constitution and README alignment.

## Governance

- This constitution supersedes conflicting guidance in other documents.
- Amendments require an updated Sync Impact Report, semantic version bump, and
  documentation of migration impact.
- Versioning follows MAJOR.MINOR.PATCH: MAJOR for breaking governance changes,
  MINOR for new principles/sections, PATCH for clarifications.
- Compliance MUST be reviewed in feature plans (Constitution Check) and PR reviews.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date not found in repo | **Last Amended**: 2025-12-29
