# Deployment Guide

## Prerequisites

- Cloudflare account
- Cloudflare API Token with Workers deploy permissions

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Run tests:
```bash
npm run test
npm run test:e2e
```

## Production Deployment

### Manual Deployment

1. Set up Cloudflare API Token:
```bash
export CLOUDFLARE_API_TOKEN=your_token_here
```

2. Deploy to production:
```bash
npm run deploy
```

### Automatic Deployment (GitHub Actions)

1. Add `CLOUDFLARE_API_TOKEN` to GitHub repository secrets:
   - Go to repository Settings → Secrets and variables → Actions
   - Add new secret: `CLOUDFLARE_API_TOKEN`

2. Push to main branch to trigger automatic deployment:
```bash
git push origin main
```

## Environment Variables

### Development
- `ENVIRONMENT`: "development" (set in wrangler.toml)

### Production
- `ENVIRONMENT`: "production" (set in wrangler.toml)

## Verification

After deployment, verify the following:

1. Health check endpoint:
```bash
curl https://your-worker-url.workers.dev/api/health
```

2. Frontend:
```bash
curl https://your-worker-url.workers.dev/
```

## Troubleshooting

- Check wrangler logs: `wrangler tail`
- View deployment logs in GitHub Actions
- Verify environment variables in Cloudflare Workers dashboard
