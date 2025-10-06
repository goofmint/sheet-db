# Deployment Guide

This guide covers deploying sheet-db to popular hosting platforms.

## Prerequisites

- Your sheet-db project set up and tested locally
- Google Sheets credentials (service account JSON)
- Git repository (optional but recommended)

## Environment Variables

All platforms require these environment variables:

```
SPREADSHEET_ID=your_spreadsheet_id
SHEET_NAME=Sheet1
PORT=3000
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

**Important**: For security, use `GOOGLE_CREDENTIALS_JSON` (the entire credentials as a JSON string) rather than uploading the credentials file.

## Heroku

### One-Click Deploy

1. Create a Heroku account at [heroku.com](https://heroku.com)
2. Install the Heroku CLI
3. Deploy:

```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set SPREADSHEET_ID=your_spreadsheet_id
heroku config:set SHEET_NAME=Sheet1
heroku config:set GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'

# Deploy
git push heroku main
```

### Procfile

Create a `Procfile` in your root directory:

```
web: npm start
```

## Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard
4. Add `vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ]
}
```

## Railway

1. Visit [railway.app](https://railway.app)
2. Create new project
3. Connect your GitHub repo
4. Set environment variables in Railway dashboard
5. Railway auto-detects and deploys Node.js apps

## Google Cloud Run

```bash
# Build container
gcloud builds submit --tag gcr.io/PROJECT_ID/sheet-db

# Deploy
gcloud run deploy sheet-db \
  --image gcr.io/PROJECT_ID/sheet-db \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars SPREADSHEET_ID=your_id,SHEET_NAME=Sheet1
```

## AWS (Elastic Beanstalk)

1. Install AWS EB CLI
2. Initialize:

```bash
eb init
```

3. Create environment:

```bash
eb create production
```

4. Set environment variables:

```bash
eb setenv SPREADSHEET_ID=your_id SHEET_NAME=Sheet1 GOOGLE_CREDENTIALS_JSON='...'
```

5. Deploy:

```bash
eb deploy
```

## Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t sheet-db .
docker run -p 3000:3000 \
  -e SPREADSHEET_ID=your_id \
  -e SHEET_NAME=Sheet1 \
  -e GOOGLE_CREDENTIALS_JSON='...' \
  sheet-db
```

## DigitalOcean App Platform

1. Connect your GitHub repository
2. DigitalOcean auto-detects Node.js
3. Set environment variables in the dashboard
4. Deploy automatically on git push

## Security Considerations

1. **Never commit credentials** to version control
2. **Use environment variables** for all secrets
3. **Enable HTTPS** on your deployment platform
4. **Set up monitoring** and error tracking
5. **Limit API access** with authentication if needed
6. **Regular updates** of dependencies

## Health Checks

Most platforms support health checks. Use:

```
GET /health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

## Scaling

For high-traffic deployments:

1. **Increase instances** on your platform
2. **Add caching** (Redis/Memcached)
3. **Rate limiting** with express-rate-limit
4. **Consider read replicas** for Google Sheets
5. **Monitor Google Sheets API quotas**

## Troubleshooting

### Authentication Errors
- Verify `GOOGLE_CREDENTIALS_JSON` is properly formatted
- Check service account has access to the sheet
- Ensure Google Sheets API is enabled

### Connection Timeouts
- Increase timeout settings
- Check Google Sheets API quotas
- Verify network connectivity

### Build Failures
- Ensure `npm run build` works locally
- Check Node.js version compatibility
- Verify all dependencies are in package.json

## Support

For deployment issues, check the platform-specific documentation or open an issue on GitHub.
