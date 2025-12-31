# Quickstart: Local Dev Setup

## Prerequisites

- Local runtime prerequisites installed (Node.js, package manager, Wrangler CLI)
- Access to any required service credentials for the demo server

## Bootstrap (Command-Only)

### 1) Create the main UI

```sh
mkdir -p apps
cd apps
npm create vite@latest main-ui
```

Then follow the prompt to select the React Router-ready React setup. Do not
manually create files.

### 2) Create the demo server (Cloudflare Workers)

```sh
cd /Users/nakatsugawa/Code/MOONGIFT/sheet-db/apps
npm create hono@latest demo
```

Select the `cloudflare-workers` template when prompted. This follows the Hono
Cloudflare Workers guide.

### 3) Install dependencies

```sh
cd /Users/nakatsugawa/Code/MOONGIFT/sheet-db/apps/main-ui
npm install

cd /Users/nakatsugawa/Code/MOONGIFT/sheet-db/apps/demo
npm install
```

### 4) Start local servers

```sh
cd /Users/nakatsugawa/Code/MOONGIFT/sheet-db/apps/main-ui
npm run dev
```

```sh
cd /Users/nakatsugawa/Code/MOONGIFT/sheet-db/apps/demo
npm run dev
```

## Verification

- Main UI is reachable at the dev server URL shown in the terminal.
- Demo server is reachable at the Workers dev URL shown in the terminal.

## Notes

- Use command-driven setup only; do not hand-create files or directories.
- Avoid version pinning in bootstrap commands.
- If ports are occupied, update the dev server configuration in the generated
  project configuration files.
