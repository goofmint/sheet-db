# sheet-db Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-12-29

## Active Technologies
- TypeScript (Cloudflare Workers runtime); Node.js LTS for tooling + Hono, Wrangler CLI (001-deploy-workers-sites)
- Repository-managed configuration files; no runtime storage required for deployment metadata (001-deploy-workers-sites)

- TypeScript (Cloudflare Workers runtime); Node.js LTS for local tooling + Cloudflare Workers, Hono, Wrangler CLI, D1, KV (001-local-dev-setup)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript (Cloudflare Workers runtime); Node.js LTS for local tooling: Follow standard conventions

## Recent Changes
- 001-deploy-workers-sites: Added TypeScript (Cloudflare Workers runtime); Node.js LTS for tooling + Hono, Wrangler CLI

- 001-local-dev-setup: Added TypeScript (Cloudflare Workers runtime); Node.js LTS for local tooling + Cloudflare Workers, Hono, Wrangler CLI, D1, KV

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
