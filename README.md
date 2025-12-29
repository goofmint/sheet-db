# SheetDB

SheetDB is a Cloudflare Workers service that exposes a RESTful API backed by
Google Sheets. It supports CRUD access patterns, authentication, and row-level
access controls for spreadsheet-backed data.

## Setup

```txt
npm install
npm run dev
```

## Deployment

```txt
npm run deploy
```

## Cloudflare Types

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

## Usage

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```
