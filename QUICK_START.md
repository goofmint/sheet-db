# Quick Start Guide

Get your Google Sheets API up and running in 5 minutes!

## Prerequisites

- Node.js 16 or higher
- A Google Cloud Project with Sheets API enabled
- A Google Sheets document

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Google Credentials

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable "Google Sheets API"
4. Go to "Credentials" → "Create Credentials" → "Service Account"
5. Create a service account and download the JSON key file
6. Save it as `credentials.json` in your project root

### 3. Prepare Your Google Sheet

1. Create a new Google Sheet
2. Add headers in the first row (example: `id`, `name`, `email`)
3. Note the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```
4. Share the sheet with the service account email (found in `credentials.json`)

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SPREADSHEET_ID=your_actual_spreadsheet_id
SHEET_NAME=Sheet1
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=credentials.json
```

### 5. Start the Server

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

### 6. Test the API

Health check:
```bash
curl http://localhost:3000/health
```

Get all records:
```bash
curl http://localhost:3000/api/data
```

Create a record:
```bash
curl -X POST http://localhost:3000/api/data \
  -H "Content-Type: application/json" \
  -d '{"id":"1","name":"John Doe","email":"john@example.com"}'
```

## Common Issues

### "Sheet has no headers"
- Make sure your Google Sheet has headers in the first row
- Headers should not be empty

### "Permission denied"
- Ensure you've shared the sheet with the service account email
- Check that the service account has "Editor" access

### "Invalid credentials"
- Verify your credentials file path is correct
- Ensure the credentials JSON is valid

## Next Steps

- Check the [README.md](README.md) for full API documentation
- See [example.ts](example.ts) for programmatic usage examples
- Deploy to your favorite hosting platform (Heroku, AWS, GCP, etc.)

## Support

For issues and questions, please open an issue on GitHub.
