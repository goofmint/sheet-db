---

description: "Task list for local dev setup implementation"
---

# Tasks: Local Dev Setup

**Input**: Design documents from `/specs/002-local-dev-setup/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `apps/main-ui/`, `apps/demo/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create base app directory at `apps/`
- [ ] T002 [P] Bootstrap main UI via `npm create vite@latest main-ui` in `apps/`
- [ ] T003 [P] Bootstrap demo server via `npm create hono@latest demo` in `apps/` and select the `cloudflare-workers` template
- [ ] T004 [P] Install main UI dependencies in `apps/main-ui/` using `npm install`
- [ ] T005 [P] Install demo server dependencies in `apps/demo/` using `npm install`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Review `BASIC.md` for local prerequisites/credentials; add only missing items for this feature
- [ ] T007 Review `BASIC.md` for command-only bootstrap steps; update only if missing or inconsistent (no version pinning)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Run Main UI Locally (Priority: P1) 🎯 MVP

**Goal**: Developers can start the main UI locally and see the landing view

**Independent Test**: Run the dev command and load the main UI in a browser

### Implementation for User Story 1

- [ ] T008 [US1] Start the main UI dev server from `apps/main-ui/` using `npm run dev` and verify the UI loads
- [ ] T009 [US1] Record the main UI local URL and command in `BASIC.md`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Run Demo Server Locally (Priority: P2)

**Goal**: Developers can start the demo server locally and access the demo surface

**Independent Test**: Run the dev command and load the demo surface in a browser

### Implementation for User Story 2

- [ ] T010 [US2] Start the demo server dev process from `apps/demo/` using `npm run dev` and verify the demo surface loads
- [ ] T011 [US2] Record the demo server local URL and command in `BASIC.md`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Command-Based Bootstrap (Priority: P3)

**Goal**: Developers can reproduce the full setup using documented commands only

**Independent Test**: Run the documented commands and confirm files are generated automatically

### Implementation for User Story 3

- [ ] T012 [US3] Add a command-only bootstrap checklist (no manual file creation) to `BASIC.md`
- [ ] T013 [US3] Add troubleshooting notes for missing prerequisites and port conflicts to `BASIC.md`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T014 [P] Verify `BASIC.md` contains no version-pinned bootstrap commands
- [ ] T015 [P] Run the quickstart steps in `/specs/002-local-dev-setup/quickstart.md` and confirm they match `BASIC.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on other stories

### Within Each User Story

- Command execution before documentation updates
- Verification before documenting URLs
- Story complete before moving to next priority

### Parallel Opportunities

- Bootstrap main UI and demo server in parallel (T002, T003)
- Install dependencies in parallel (T004, T005)
- Documentation updates in `BASIC.md` can be coordinated but avoid conflicts

---

## Parallel Example: User Story 1

```bash
# Run main UI dev server:
Task: "Start the main UI dev server from apps/main-ui/ using npm run dev"

# Document main UI local URL and command:
Task: "Record the main UI local URL and command in BASIC.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify main UI loads locally

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo
3. Add User Story 2 → Test independently → Demo
4. Add User Story 3 → Test independently → Documentation complete
