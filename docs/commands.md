# Command Reference

This document contains commonly used commands for developing and managing Sheet DB.

## Database Commands

### Execute SQL from File

Execute SQL commands from a file against the local D1 database:

```bash
npx wrangler d1 execute sheet-db --local --file=./schema.sql
```

### Execute SQL Command Directly

Execute a single SQL command against the local D1 database:

```bash
npx wrangler d1 execute sheet-db --local --command="SELECT * FROM Cache"
```

### Database Migrations

Generate new migration files:

```bash
npx drizzle-kit generate
```

Apply migrations to local database:

```bash
npx drizzle-kit push
```

## Development Commands

### Start Development Server

```bash
npm run dev
# or
npm run start
```

### Deploy to Production

```bash
npm run deploy
```

### Run Tests

```bash
npm run test
```

### Generate Cloudflare Worker Types

```bash
npm run cf-typegen
```

## Environment Management

### Set Production Secrets

```bash
# Set Google OAuth credentials
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Set Auth0 credentials
npx wrangler secret put AUTH0_DOMAIN
npx wrangler secret put AUTH0_CLIENT_ID
npx wrangler secret put AUTH0_CLIENT_SECRET
```

### View Current Secrets

```bash
npx wrangler secret list
```

## Database Query Examples

### Check Cache Contents

```bash
npx wrangler d1 execute sheet-db --local --command="SELECT * FROM Cache"
```

### View Session Data

```bash
npx wrangler d1 execute sheet-db --local --command="SELECT id, user_id, expires_at FROM Session"
```

### Check Configuration

```bash
npx wrangler d1 execute sheet-db --local --command="SELECT name, value FROM Config"
```

### Clear Queue

```bash
npx wrangler d1 execute sheet-db --local --command="DELETE FROM Queue"
```

## Production Database Commands

Remove `--local` flag to execute against production database:

```bash
# Production database query
npx wrangler d1 execute sheet-db --command="SELECT COUNT(*) FROM Cache"

# Production migration
npx wrangler d1 execute sheet-db --file=./drizzle/0001_migration.sql
```