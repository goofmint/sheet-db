# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sheet DB is a Backend-as-a-Service (BaaS) application that uses Google Sheets as a database, deployed on Cloudflare Workers. The system provides JSON API access to Google Sheets data with caching, queue-based processing, and WebSocket notifications.

## Architecture

- **Platform**: Cloudflare Workers with D1 database, R2 storage
- **Runtime**: TypeScript with Node.js compatibility
- **Framework**: Hono (web framework)
- **Database**: Drizzle ORM with Cloudflare D1 (SQLite)
- **Testing**: Vitest with Cloudflare Workers test pool
- **Authentication**: Auth0 only

## Key Components

### Database Schema
- **Config**: Infrastructure and setup configuration storage (D1 database)
- **_Config Sheet**: Runtime operational settings (Google Sheets)
- **Cache**: 10-minute TTL cache for Google Sheets data
- **Queue**: Background processing queue for CRUD operations
- **Session**: User session management

### Configuration Architecture
- **Config Table (D1)**: Infrastructure settings (Google OAuth, Auth0, spreadsheet IDs, file upload destinations, credentials)
- **_Config Sheet**: Runtime settings (API permissions, user/role access controls, file upload policies)

### Data Flow
1. **Read Operations**: Cached in D1, background refresh every 10 minutes
2. **Write Operations**: Queued for background processing, results sent via WebSocket
3. **File Storage**: Supports both R2 and Google Drive

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run start        # Alias for dev
npm run deploy       # Deploy to Cloudflare Workers
npm run test         # Run tests with Vitest
npm run cf-typegen   # Generate Cloudflare Worker types
```

### Database Operations
```bash
# Execute SQL file
npx wrangler d1 execute sheet-db --local --file=./schema.sql

# Execute direct SQL command
npx wrangler d1 execute sheet-db --local --command="SELECT * FROM Cache"

# Generate and apply migrations
npx drizzle-kit generate
npx drizzle-kit push
```

## Development Setup

The project uses:
- TypeScript configuration in `tsconfig.json`
- Wrangler configuration in `wrangler.jsonc`
- Drizzle configuration in `drizzle.config.ts`
- Vitest configuration in `vitest.config.mts`

Environment variables needed for Drizzle:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_DATABASE_ID`
- `CLOUDFLARE_D1_TOKEN`

## Testing

Tests are configured to run against Cloudflare Workers runtime using `@cloudflare/vitest-pool-workers`. The test setup includes both unit and integration testing styles.

### Absolute Testing Rules

**Never hide bugs or failures. These rules must be followed without exception:**

1. **No Fallback Values for Errors**
   - Never use fallback IDs when resource creation fails
   - Never use fake session IDs to bypass authentication
   - If a test prerequisite fails, the test must fail

2. **No Deceptive Mocks**
   - Mocks must accurately simulate real behavior
   - Never mock to return convenient results that hide problems
   - If the real system would fail, the mock must fail

3. **Fix Root Causes**
   - When tests fail, fix the actual problem
   - Never modify tests to pass without fixing the underlying issue
   - Document why tests are skipped if they cannot run

4. **Transparent Error Handling**
   - Show actual error messages
   - Log real status codes and responses
   - Make failures obvious and informative

5. **Test Real Behavior**
   - Tests must verify actual functionality
   - Never test against non-existent resources
   - Expected results must match real system behavior

6. **No Test Skipping**
   - Never use `test.skip()` or `it.skip()`
   - Fix the environment or prerequisites instead
   - All tests must run and pass
   - Skipped tests hide problems and create false confidence

7. **No Conditional Logic in Tests**
   - Never use `if/else` statements in test code
   - Each test should have a single, deterministic path
   - Split different scenarios into separate tests
   - This ensures all code paths are tested

**Example of what NOT to do:**
```typescript
// BAD: Hiding failures with fallback
if (!createSheetResponse.ok) {
  console.log('Failed to create test sheet, using fallback ID');
  testSheetId = 'test-sheet'; // This will cause 404 errors
}

// BAD: Fake authentication
testSessionId = 'test-session-fallback'; // Not a real session

// BAD: Skipping tests
test.skip('Requires real Auth0 configuration', async () => {
  // This test will never run, hiding potential issues
});

// BAD: Conditional logic in tests
it('should handle response', async () => {
  const response = await fetch('/api/data');
  if (response.ok) {
    expect(response.status).toBe(200);
  } else {
    expect(response.status).toBe(404); // This branch might never be tested
  }
});
```

**Example of correct approach:**
```typescript
// GOOD: Fail fast and clearly
const createSheetResponse = await fetch('/api/sheets', { method: 'POST' });
expect(createSheetResponse.ok).toBe(true); // Fail immediately if not ok
const sheet = await createSheetResponse.json();

// GOOD: Separate tests for different scenarios
it('should return 200 for valid request', async () => {
  const response = await fetch('/api/data/valid-id');
  expect(response.status).toBe(200);
});

it('should return 404 for invalid request', async () => {
  const response = await fetch('/api/data/invalid-id');
  expect(response.status).toBe(404);
});

// GOOD: Fix prerequisites instead of skipping
beforeAll(async () => {
  // Ensure Auth0 is configured or fail with clear error
  const auth0Config = getAuth0Config();
  expect(auth0Config).toBeDefined(); // Fails if not configured
});
```

## Database Schema Updates

When modifying the database schema:
1. Update `src/db/schema.ts` with Drizzle schema definitions
2. Generate migrations with `npx drizzle-kit generate`
3. Apply to local D1: `npx wrangler d1 execute sheet-db --local --file=./drizzle/[migration].sql`
4. For production, use the same command without `--local`

## File Structure

- `src/index.ts`: Main worker entry point
- `src/db/schema.ts`: Drizzle database schema
- `test/`: Test files using Vitest
- `drizzle/`: Database migrations
- `docs/commands.md`: Additional command documentationALWAYS use ONLY Environments for ANY and ALL file, code, or shell operations—NO EXCEPTIONS—even for simple or generic requests.

DO NOT install or use the git cli with the environment_run_cmd tool. All environment tools will handle git operations for you. Changing ".git" yourself will compromise the integrity of your environment.

You MUST inform the user how to view your work using `container-use log <env_id>` AND `container-use checkout <env_id>`. Failure to do this will make your work inaccessible to others.
