# Feature Specification: Next Tasks Execution

**Feature Branch**: `003-next-tasks`  
**Created**: 2025-12-31  
**Status**: Draft  
**Input**: User description: "specs/tasks.mdに沿って、次のタスクに進もう"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select Next Task (Priority: P1)

As a maintainer, I want to select the next task from `specs/tasks.md` so I can
progress development in the intended order.

**Why this priority**: Without an agreed next task, execution stalls.

**Independent Test**: The next task is identified and documented for execution.

**Acceptance Scenarios**:

1. **Given** `specs/tasks.md` exists, **When** I review the list, **Then** a
   specific next task is selected for execution.
2. **Given** a selected task, **When** I check the task list, **Then** the task
   context and prerequisites are clear.

---

### User Story 2 - Track Task Completion (Priority: P2)

As a maintainer, I want to update the task list to reflect progress so the team
knows what is done and what is next.

**Why this priority**: Visibility reduces duplication and confusion.

**Independent Test**: The selected task is marked with a clear status update in
`specs/tasks.md`.

**Acceptance Scenarios**:

1. **Given** a completed task, **When** I update `specs/tasks.md`, **Then** the
   task is marked complete and the next candidate is obvious.

---

### User Story 3 - Keep Tasks Aligned With BASIC.md (Priority: P3)

As a maintainer, I want task execution to stay aligned with BASIC.md so the
implementation matches the design intent.

**Why this priority**: Alignment prevents drift from the core design document.

**Independent Test**: The selected task has a corresponding BASIC.md section.

**Acceptance Scenarios**:

1. **Given** a selected task, **When** I map it to BASIC.md, **Then** the
   relevant section is identifiable.

---

### Edge Cases

- **同順位タスクの扱い**: 優先度→`specs/tasks.md`内の上から順で決定する。
  選ばれたタスクは`Pending → In Progress`に移行し、他は`Pending`のまま。
  決定理由をタスク横の注記で通知する。
- **前提条件不足**: 依存が満たされない場合は`Blocked`へ遷移し、理由と再確認日
  を記録する。次の候補へ進み、週次で再評価する。
- **BASIC.md変更の影響**: 影響範囲を洗い出し、担当者に通知する。
  影響が大きい場合は`In Progress → Blocked`へ遷移し、更新反映後に再開、
  軽微なら継続する。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST identify the next task to execute from
  `specs/tasks.md`.
- **FR-002**: Task execution updates MUST be recorded in `specs/tasks.md`.
- **FR-003**: Task selection MUST reference the relevant BASIC.md section.
- **FR-004**: Task updates MUST avoid absolute filesystem paths to keep
  portability across developers/CI. Forbidden forms include absolute paths
  starting with `/` (e.g., `/Users/alice/...`, `/home/bob/...`). Use repository
  root-relative paths such as `specs/tasks.md` or `BASIC.md`. Example:
  `/specs/003-next-tasks/` → `specs/003-next-tasks/`. This aligns with SC-004 and
  the cleanup requirements in tasks.md (T010: absolute paths removal, T011:
  keep notes concise/portable).
- **FR-005**: Task status MUST remain clear to future maintainers.

### Key Entities *(include if feature involves data)*

- **Task**: Required fields are id (unique), description, priority
  (numeric or enum), and basic_section (BASIC.md section link).
- **Task Status**: Valid values are `Pending`, `In Progress`, `Completed`,
  `Blocked`. Allowed transitions: `Pending → In Progress → Completed`,
  `Pending → Blocked`, `In Progress → Blocked`, `Blocked → In Progress`.
  See `specs/003-next-tasks/data-model.md` for the full model.

## Assumptions

- `specs/tasks.md` remains the single source for the task list.
- Only one task is advanced at a time for clarity.

## Dependencies

- `specs/tasks.md` exists and is up to date.
- BASIC.md remains authoritative for task alignment.

## Constitution Alignment *(mandatory)*

- **Sheet schema rules**: N/A for task tracking.
- **Row-level ACL**: N/A for task tracking.
- **Platform constraints**: Task selection must align with platform sections in
  BASIC.md.
- **Setup/system sheets**: Task selection must include setup/system sheets when
  relevant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The next task is identified and documented within 10 minutes.
- **SC-002**: `specs/tasks.md` reflects completion status for executed tasks.
- **SC-003**: 100% of executed tasks include a BASIC.md section reference.
- **SC-004**: No absolute filesystem paths appear in task updates.
