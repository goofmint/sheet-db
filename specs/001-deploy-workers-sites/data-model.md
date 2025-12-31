# Phase 1 Data Model: Deploy Target Sites to Cloudflare Workers

## Entity: TargetSite

**Purpose**: Represents a site or service that must be deployed to Cloudflare Workers.

**Fields**:
- `id` (string, unique, required)
- `name` (string, required)
- `url` (string, required)
- `workerName` (string, required)
- `environment` (string, required)
- `status` (enum: pending, deployed, failed)

## Entity: DeploymentRecord

**Purpose**: Captures deployment status and timestamps per target site.

**Fields**:
- `id` (string, unique, required)
- `targetSiteId` (string, required)
- `status` (enum: success, failed, rolled_back)
- `startedAt` (datetime, required)
- `finishedAt` (datetime, required)
- `validationSummary` (string, optional)
- `rollbackApplied` (boolean, default false)

## Entity: ValidationChecklistItem

**Purpose**: Defines validation checks for a target site.

**Fields**:
- `id` (string, unique, required)
- `targetSiteId` (string, required)
- `checkName` (string, required)
- `status` (enum: pass, fail, skipped)
- `details` (string, optional)

## Relationships

- `TargetSite` has many `DeploymentRecord` entries.
- `TargetSite` has many `ValidationChecklistItem` entries per deployment.

## Validation Rules

- `TargetSite.url` must be a valid URL format.
- `DeploymentRecord.finishedAt` must be later than `startedAt`.
- `ValidationChecklistItem.status` must be one of: `pass`, `fail`, `skipped`.
