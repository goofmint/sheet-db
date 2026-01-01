# Data Model: Next Tasks Execution

## Entities

### Task

**Fields**:
- id: string (identifier within the list)
- description: string
- status: enum (open, done)
- basic_section: string (BASIC.md section reference)

### Task Status Update

**Fields**:
- task_id: string
- updated_at: date
- note: string (optional context)

## Relationships

- A Task can have zero or more Task Status Updates.
