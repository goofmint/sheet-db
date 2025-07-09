# Sheet DB

This application enables using Google Sheets as a BaaS (Backend as a Service).

## Features

Sheet DB operates Google Sheets through JSON APIs. Main features include:

- Authentication
- Database
- File Storage
  - R2
  - Google Drive
- ACL (Access Control Lists)

Data retrieval is cached in D1 with a 10-minute expiration time, and data is updated in the background.

For data creation, updates, and deletions, operations are queued and processed in the backend. Processing results are notified via WebSocket.

Authentication supports Auth0 only.

## Architecture

- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- TypeScript
- Hono
- Drizzle