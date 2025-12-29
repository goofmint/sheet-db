# Local Development Setup

## Goal

Run SheetDB locally with a smoke check, parity checklist, and reset workflow that
reflect production edge-runtime constraints.

## Prerequisites

- Wrangler CLI installed
- Access to required configuration values and credentials
- Local environment variables configured (see `.dev.vars` and `wrangler.toml`)

## Setup Steps

1. Install dependencies (if applicable).
2. Configure environment variables for local runs.
3. Start the local Workers runtime (Wrangler).
4. Run the smoke check endpoint to validate read/write.
5. Run the parity checklist endpoint to review constraints.
6. Use the reset endpoint to restore baseline data when needed.

## Local Endpoints

- `POST /_local/smoke-check` - Validate read/write against baseline dataset
- `GET /_local/parity` - Review parity constraints status
- `POST /_local/reset` - Reset local data to baseline (Authorization: Bearer <MASTER_KEY>)

## Smoke Check Usage

- Call the endpoint and confirm `readStatus` and `writeStatus` are `pass`.

## Parity Checklist Output

- Review each constraint for pass/fail/unknown and follow remediation hints.

## Reset Usage

- Call the endpoint with `Authorization: Bearer <MASTER_KEY>` after local changes to
  restore baseline data.

## Troubleshooting

- Missing configuration: confirm required variables are set and restart local runtime.
- Parity checks unknown: verify local runtime supports the constraint or document the gap.
- Reset fails: confirm baseline dataset is accessible and retry.
