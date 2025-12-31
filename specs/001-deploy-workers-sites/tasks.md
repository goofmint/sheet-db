---

description: "Task list for deploying target sites to Cloudflare Workers"
---

# Tasks: Deploy Target Sites to Cloudflare Workers

**Input**: Design documents from `specs/001-deploy-workers-sites/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: See `specs/001-deploy-workers-sites/spec.md` (User Scenarios & Testing, US1-US3) and `specs/001-deploy-workers-sites/plan.md` for the deployment checklist and manual validation steps.

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

**Purpose**: Project initialization and shared deployment assets

- [ ] T001 Create deployment inventory file in scripts/deploy/targets.json
- [ ] T002 Create deployment checklist template in scripts/deploy/checklist.md
- [ ] T003 Add deployment report template in scripts/deploy/report.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared utilities required by all user stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement deployment inventory loader in scripts/deploy/load-targets.ts
- [ ] T005 Implement validation checklist runner in scripts/deploy/run-validation.ts
- [ ] T006 Implement rollback helper in scripts/deploy/run-rollback.ts
- [ ] T007 Implement deployment report generator in scripts/deploy/generate-report.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Deploy All Target Sites (Priority: P1) 🎯 MVP

**Goal**: Deploy all target sites to Cloudflare Workers through a repeatable process.

**Independent Test**: Deploy each target site and confirm the expected URL responds with
primary content.

- [ ] T008 [P] [US1] Implement deployment orchestrator in scripts/deploy/deploy-sites.ts
- [ ] T009 [US1] Add deployment execution guide in scripts/deploy/README.md
- [ ] T010 [US1] Document expected URLs per target in scripts/deploy/targets.json

**Checkpoint**: User Story 1 should be fully functional and independently testable

---

## Phase 4: User Story 2 - Validation & Rollback (Priority: P2)

**Goal**: Validate deployments and provide rollback steps for failed sites.

**Independent Test**: Simulate a failed validation and confirm rollback restores service.

- [ ] T011 [P] [US2] Implement validation status output in scripts/deploy/run-validation.ts
- [ ] T012 [US2] Implement rollback execution path in scripts/deploy/run-rollback.ts
- [ ] T013 [US2] Document rollback steps in scripts/deploy/README.md

**Checkpoint**: User Story 2 should be independently testable with clear rollback steps

---

## Phase 5: User Story 3 - Post-Deployment Confirmation (Priority: P3)

**Goal**: Provide a deployment report with status and timestamps for each site.

**Independent Test**: Generate a deployment report and verify it lists all target sites.

- [ ] T014 [P] [US3] Implement report formatting in scripts/deploy/generate-report.ts
- [ ] T015 [US3] Add report output location to scripts/deploy/report.md

**Checkpoint**: User Story 3 should be independently testable with a complete report

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation alignment and release readiness

- [ ] T016 Update deployment overview in README.md
- [ ] T017 Add troubleshooting guidance in scripts/deploy/README.md

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
- Logic implementation before documentation updates
- Story completion before polish tasks

### Parallel Opportunities

- T008, T011, and T014 can be done in parallel (different files, different stories)
- Documentation tasks (T009, T013, T017) can run in parallel after core logic

---

## Parallel Example: User Story 1

```bash
# Parallelizable tasks for US1:
Task: "Implement deployment orchestrator in scripts/deploy/deploy-sites.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm all target sites respond after deployment

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deliver MVP
3. Add User Story 2 → Test independently → Deliver validation + rollback
4. Add User Story 3 → Test independently → Deliver deployment report
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
