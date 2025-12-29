# Phase 1 Data Model: Local Development Setup

## Entity: LocalConfiguration

**Purpose**: Stores required local settings for running the app and tooling.

**Fields**:
- `key` (string, unique, required)
- `value` (string, required)
- `description` (string, optional)
- `required` (boolean, default true)

## Entity: TestDataset

**Purpose**: Defines the baseline dataset used for smoke checks and resets.

**Fields**:
- `id` (string, unique, required)
- `name` (string, required)
- `source` (string, required) - identifier for the baseline fixture
- `lastSeededAt` (datetime, optional)

## Entity: ParityCheck

**Purpose**: Captures the status of production parity checks in local runs.

**Fields**:
- `id` (string, unique, required)
- `constraintName` (string, required)
- `status` (enum: pass, fail, unknown, required)
- `details` (string, optional)
- `remediation` (string, optional)
- `checkedAt` (datetime, required)

## Relationships

- `ParityCheck` entries are generated per local run.
- `TestDataset` is referenced by smoke check and reset operations.

## Validation Rules

- `LocalConfiguration.key` must be unique.
- `ParityCheck.status` must be one of: `pass`, `fail`, `unknown`, `required`.
- `TestDataset.id` must be stable between resets.
