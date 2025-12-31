<!--
Sync Impact Report
- Version: N/A (template) -> 1.0.0
- Modified principles: N/A (template placeholders replaced)
- Added sections: Core Principles, Data Model & Validation Requirements, Development Workflow & Quality Gates, Governance
- Removed sections: None
- Templates requiring updates: ✅ .specify/templates/plan-template.md; ✅ .specify/templates/spec-template.md; ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: TODO(RATIFICATION_DATE): original ratification date unknown
-->
# SheetDB Constitution

## Core Principles

### I. Sheet-As-Database Schema
Google Sheets MUST follow the schema contract: row 1 is headers, row 2 is JSON
metadata for type/validation/defaults, row 3+ are data rows. All create/update
operations MUST validate and apply defaults using row 2 metadata. Sheets created
via API MUST include the default ACL/system fields defined in this constitution.
Rationale: a predictable schema keeps APIs consistent and enables safe validation.

### II. Row-Level ACL Is Mandatory
All reads and writes MUST enforce row-level ACL fields. Authentication MUST use
the `_Users` sheet as the source of truth. ACL evaluation order is public →
role → user, and the master key in the HTTP header MAY bypass ACL. Rationale:
security and multi-tenant access control are core to the product.

### III. Edge-First Architecture
Runtime MUST target Cloudflare Workers with Hono. `sheetdb.app` MUST use React
Router for the main site, and `demo.sheetdb.app` MUST host demo, playground, and
setup flows. D1 stores config/session state, KV stores cached data with TTL, and
Google Sheets remains the source of record. File storage MUST be Google Drive
or S3-compatible. Rationale: platform constraints define how the system scales.

### IV. Deterministic API Flow & Caching
Read flow MUST be: optional auth → KV lookup → sheet fetch + cache fill on miss
→ ACL evaluation → response limiting/paging. Write flow MUST be: optional auth
→ ACL evaluation → sheet update → background cache regeneration. Rationale:
predictable flows keep performance and security consistent.

### V. Setup Wizard & System Sheets
When no configuration exists, the setup wizard at `demo.sheetdb.app/setup` MUST
be the only entry point to configure the system. It MUST link the target Google
Sheet and storage provider, establish the admin user and master key, and create
`_Users`, `_Roles`, and `_Files` sheets when missing. Rationale: a single, safe
bootstrap path prevents inconsistent deployments.

## Data Model & Validation Requirements

- System sheet names `_Users`, `_Roles`, `_Files` are reserved; user-created
  sheets MUST be alphanumeric/underscore and MUST NOT start with `_`.
- `_Users` fields MUST include: id, user_name, password, locked_at, email,
  confirmed_at, confirm_key, created_at, updated_at.
- `_Roles` fields MUST include: name, users (array, default `[]`), created_at,
  updated_at.
- `_Files` fields MUST include: id, name, url, size, content_type, created_at,
  updated_at, public_read, public_write, roles_read, roles_write, users_read,
  users_write.
- New data sheets created via API MUST include default fields: id, created_at,
  updated_at, public_read, public_write, roles_read, roles_write, users_read,
  users_write.
- Metadata in row 2 MAY specify: required, unique, type, format (regex), min,
  max, default. Allowed types are string, number, boolean, date, array, object,
  formula.

## Development Workflow & Quality Gates

- Any change to schema rules, ACL behavior, or API flow MUST update BASIC.md and
  the setup wizard behavior in `demo.sheetdb.app/setup`.
- D1 default configuration values MUST match the documented defaults in BASIC.md
  (e.g., response limit, TTLs, anonymous user policy).
- KV caching TTL MUST remain 60 minutes unless a constitution amendment updates
  it, and cache regeneration MUST happen after write operations.
- Changes that affect system sheets or reserved fields MUST include a migration
  plan and backward compatibility note.

## Governance
<!-- Example: Constitution supersedes all other practices; Amendments require documentation, approval, migration plan -->

- This constitution supersedes other guidance. If conflicts exist, update the
  conflicting document through an amendment.
- Amendments require a documented proposal, review by a project maintainer, and
  an explicit migration plan for breaking changes.
- Versioning follows semver: MAJOR for breaking governance changes, MINOR for
  new principles/sections, PATCH for clarifications.
- Every feature plan MUST include a constitution check, and reviews MUST verify
  compliance with principles and workflow requirements.
- BASIC.md is the runtime architecture source of truth for implementation
  details aligned with this constitution.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original ratification date unknown | **Last Amended**: 2025-12-31
