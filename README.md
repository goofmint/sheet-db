# sheet-db

Backend as a Service using Google Sheets as a database. Turn your Google Sheets into a RESTful API instantly!

## Features

- 🚀 RESTful API for Google Sheets
- 📊 Full CRUD operations (Create, Read, Update, Delete)
- 🔍 Search and filter capabilities
- 🔐 Google Sheets API authentication
- 🎯 Type-safe with TypeScript
- ⚡ Easy to set up and deploy

## Installation

```bash
npm install
```

## Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Sheets API
4. Create a service account
5. Download the service account credentials JSON file

### 2. Configure Your Google Sheet

1. Create a Google Sheet
2. Add headers in the first row (e.g., `id`, `name`, `email`)
3. Share the sheet with the service account email (found in the credentials file)
4. Copy the Spreadsheet ID from the URL (the long string between `/d/` and `/edit`)

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
SPREADSHEET_ID=your_spreadsheet_id_here
SHEET_NAME=Sheet1
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

Returns the server status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Get All Records

```
GET /api/data
```

Returns all records from the sheet.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "count": 1
}
```

### Get Single Record

```
GET /api/data/:field/:value
```

Get a record by field value.

**Example:**
```
GET /api/data/id/1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Search Records

```
POST /api/search
```

Search records by multiple criteria.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "count": 1
}
```

### Create Record

```
POST /api/data
```

Create a new record.

**Request Body:**
```json
{
  "id": "2",
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "2",
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
}
```

### Update Record

```
PUT /api/data/:field/:value
```

Update a record by field value.

**Example:**
```
PUT /api/data/id/1
```

**Request Body:**
```json
{
  "name": "John Updated",
  "email": "john.updated@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "John Updated",
    "email": "john.updated@example.com"
  }
}
```

### Delete Record

```
DELETE /api/data/:field/:value
```

Delete a record by field value.

**Example:**
```
DELETE /api/data/id/1
```

**Response:**
```json
{
  "success": true,
  "message": "Record deleted successfully"
}
```

## Programmatic Usage

You can also use SheetDB directly in your Node.js applications:

```typescript
import { SheetDB } from 'sheet-db';

const db = new SheetDB({
  spreadsheetId: 'your_spreadsheet_id',
  sheetName: 'Sheet1',
  keyFile: 'path/to/credentials.json'
});

// Initialize
await db.initialize();

// Get all records
const records = await db.getAll();

// Create a record
await db.create({ id: '1', name: 'John', email: 'john@example.com' });

// Update a record
await db.update('id', '1', { name: 'John Updated' });

// Delete a record
await db.delete('id', '1');

// Search records
const results = await db.search({ name: 'John' });
```

## Error Handling

All endpoints return a consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

HTTP status codes:
- `200` - Success
- `201` - Created
- `404` - Not Found
- `500` - Internal Server Error

## License

MIT