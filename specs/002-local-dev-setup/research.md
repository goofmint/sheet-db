# Phase 0 Research: Local Dev Setup

## Decision: Monorepo layout with separate apps

**Decision**: Use a monorepo layout with `apps/main-ui` for the React Router UI
and `apps/demo` for the Hono Cloudflare Workers demo server.

**Rationale**: Matches the constitution requirement to keep `sheetdb.app`
(main UI) and `demo.sheetdb.app` (demo/playground/setup) separate while keeping
local workflows consistent.

**Alternatives considered**:
- Single project mixing UI and demo worker code (rejected: blurs domain split)
- Separate repos per surface (rejected: higher coordination overhead)

## Decision: Demo server bootstrap via create-hono

**Decision**: Use the official `create-hono` flow and select the
`cloudflare-workers` template for the demo server, then run the included dev
command.

**Rationale**: Directly follows the Hono Cloudflare Workers getting-started
guide and ensures the demo server targets the correct runtime.

**Alternatives considered**:
- Manual Wrangler initialization (rejected: deviates from guide)
- Non-Hono framework (rejected: violates platform constraint)

## Decision: Main UI bootstrap via React Router tooling

**Decision**: Use official React Router project tooling to generate the main UI
without version pinning, then start the dev server using the generated command.

**Rationale**: Satisfies the main UI requirement while keeping setup
reproducible via commands and avoiding manual file creation.

**Alternatives considered**:
- Hand-crafted UI project files (rejected: violates command-only bootstrap)
- Demo server serving the UI (rejected: conflicts with separation of concerns)
