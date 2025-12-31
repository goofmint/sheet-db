# Data Model: Local Dev Setup

## Entities

### Local Setup

**Purpose**: Captures the command-driven workflow and generated files needed for
local development.

**Key Attributes**:
- setup_commands: ordered list of bootstrap commands
- generated_paths: directories created by commands
- start_commands: per-surface dev server commands
- prerequisites: required local tooling and credentials

### Service Surface

**Purpose**: Represents each locally runnable surface (main UI, demo server).

**Key Attributes**:
- name
- local_url
- start_command
- status_check (how to verify the surface is up)

## Relationships

- Local Setup produces one or more Service Surfaces.
