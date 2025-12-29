# Phase 1 Quickstart: Local Development Setup

## Goal

Stand up the local SheetDB environment, run a smoke check, verify parity constraints,
and reset local data to a clean baseline when needed.

## Prerequisites

- Access to required configuration values and credentials.
- Local tooling capable of running the Workers project and bindings.
- Network access to any external dependencies used during setup.

## Steps

1. Install required local tooling for Workers development.
2. Configure local environment values using the documented configuration list.
3. Start the local runtime and confirm the service is reachable.
4. Run the smoke check to validate a read and write against the test dataset.
5. Run the parity checklist and review any failed constraints.
6. If needed, run the reset command to restore the baseline dataset.

## Validation

- Smoke check returns a successful read/write status.
- Parity checklist shows pass/fail status for all listed constraints.
- Reset completes and the baseline dataset is restored.

## Troubleshooting

- If configuration is missing, confirm required values are set and re-run setup.
- If parity checks cannot be evaluated, document the gap and remediation steps.
- If reset fails, confirm the baseline dataset is accessible and retry.
