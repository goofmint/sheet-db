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
- **Config**: Application configuration storage
- **Cache**: 10-minute TTL cache for Google Sheets data
- **Queue**: Background processing queue for CRUD operations
- **Session**: User session management

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
