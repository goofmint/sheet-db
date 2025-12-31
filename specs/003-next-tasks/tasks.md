---

description: "Task list for executing next tasks from specs/tasks.md"
---

# Tasks: Next Tasks Execution

**Input**: Design documents from `/specs/003-next-tasks/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Docs**: `specs/003-next-tasks/`, `specs/tasks.md`, `BASIC.md`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Confirm `specs/tasks.md` exists and is readable
- [ ] T002 Confirm `BASIC.md` is accessible for section references

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Define the priority order to use when selecting tasks in `specs/tasks.md`
- [ ] T004 Define the status update convention (checkbox + optional note) for `specs/tasks.md`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Select Next Task (Priority: P1) 🎯 MVP

**Goal**: Identify and document the next task to execute

**Independent Test**: A specific next task is selected and recorded

### Implementation for User Story 1

- [ ] T005 [US1] Review `specs/tasks.md` and select the next unchecked task
- [ ] T006 [US1] Add a short note in `specs/tasks.md` indicating this task is next

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Track Task Completion (Priority: P2)

**Goal**: Update the task list to reflect progress

**Independent Test**: The selected task is marked complete and the next candidate is clear

### Implementation for User Story 2

- [ ] T007 [US2] Execute the selected task and mark it complete in `specs/tasks.md`
- [ ] T008 [US2] Add a brief completion note in `specs/tasks.md` if needed for context

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Keep Tasks Aligned With BASIC.md (Priority: P3)

**Goal**: Ensure task execution remains aligned with BASIC.md

**Independent Test**: The selected task references the relevant BASIC.md section

### Implementation for User Story 3

- [ ] T009 [US3] Map the selected task to a BASIC.md section and record the section title in `specs/tasks.md`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T010 [P] Scan `specs/tasks.md` for absolute paths and remove any that appear
- [ ] T011 [P] Ensure all added notes in `specs/tasks.md` remain concise and portable

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
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 selection
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Depends on selected task from US1

### Within Each User Story

- Review before update
- Mark status only after task execution
- Keep references to BASIC.md explicit

### Parallel Opportunities

- Foundational conventions can be drafted in parallel (T003, T004)
- Post-execution cleanup can run in parallel (T010, T011)

---

## Parallel Example: User Story 1

```bash
# Select next task:
Task: "Review specs/tasks.md and select the next unchecked task"

# Add note:
Task: "Add a short note in specs/tasks.md indicating this task is next"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Verify the next task is clearly identified

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Validate selection
3. Add User Story 2 → Mark completion
4. Add User Story 3 → Record BASIC.md alignment
