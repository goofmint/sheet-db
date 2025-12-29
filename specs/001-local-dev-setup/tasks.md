---

description: "Task list for Local Development Setup"
---

# Tasks: Local Development Setup

**Input**: Design documents from `/Users/nakatsugawa/Code/MOONGIFT/sheet-db/specs/001-local-dev-setup/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested for this feature. Only add tests if later required by scope changes.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `scripts/` at repository root
- Paths shown below assume single project

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and baseline assets

- [X] T001 Create local tooling directories in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev and /Users/nakatsugawa/Code/MOONGIFT/sheet-db/scripts/seed-data
- [X] T002 Add local setup guide in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/scripts/local-setup.md
- [X] T003 Add baseline dataset fixture in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/scripts/seed-data/baseline.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities required by all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Implement local-only guard helper in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/local-guard.ts
- [X] T005 Implement local configuration inventory in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/local-config.ts
- [X] T006 Implement baseline dataset loader in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/baseline-loader.ts
- [X] T007 Wire local-only router and errors into /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/index.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Local Setup & Smoke Check (Priority: P1) 🎯 MVP

**Goal**: Enable a guided local setup and a repeatable smoke check (read + write).

**Independent Test**: Follow local setup and run the smoke check to receive pass statuses.

- [X] T008 [P] [US1] Implement smoke check logic in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/smoke-check.ts
- [X] T009 [US1] Add /_local/smoke-check handler wiring in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/index.tsx
- [X] T010 [US1] Document smoke check usage in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/scripts/local-setup.md

**Checkpoint**: User Story 1 should be fully functional and independently testable

---

## Phase 4: User Story 2 - Production Parity Awareness (Priority: P2)

**Goal**: Provide a parity checklist for production edge-runtime constraints with remediation hints.

**Independent Test**: Run parity checklist and see pass/fail status for each constraint.

- [X] T011 [P] [US2] Define parity constraint list in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/parity-constraints.ts
- [X] T012 [US2] Implement parity check logic in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/parity-check.ts
- [X] T013 [US2] Add /_local/parity handler wiring in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/index.tsx
- [X] T014 [US2] Document parity checklist outputs in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/scripts/local-setup.md

**Checkpoint**: User Story 2 should be independently testable with clear pass/fail output

---

## Phase 5: User Story 3 - Resettable Local State (Priority: P3)

**Goal**: Reset local data to a documented baseline quickly and safely.

**Independent Test**: Modify local data, run reset, confirm baseline is restored.

- [X] T015 [P] [US3] Implement reset logic in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/reset.ts
- [X] T016 [US3] Add /_local/reset handler wiring in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/index.tsx
- [X] T017 [US3] Document reset usage in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/scripts/local-setup.md

**Checkpoint**: User Story 3 should be independently testable with a clean reset

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation alignment and developer experience polish

- [X] T018 Update local development overview in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/README.md
- [X] T019 Add troubleshooting guidance in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/scripts/local-setup.md

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent from US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent from US1/US2

### Within Each User Story

- Shared utilities before story-specific implementations
- Logic implementation before route wiring
- Documentation updates after behavior exists

### Parallel Opportunities

- T008 and T011/T015 can be done in parallel (different files, different stories)
- Documentation tasks (T010, T014, T017, T019) can run in parallel after core logic

---

## Parallel Example: User Story 1

```bash
# Parallelizable tasks for US1:
Task: "Implement smoke check logic in /Users/nakatsugawa/Code/MOONGIFT/sheet-db/src/dev/smoke-check.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run smoke check and confirm read/write behavior

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deliver MVP
3. Add User Story 2 → Test independently → Deliver parity checklist
4. Add User Story 3 → Test independently → Deliver reset workflow
5. Add polish tasks for documentation and troubleshooting

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
