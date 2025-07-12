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

## API Documentation

### Data Management APIs

#### Get Sheet Data
**GET** `/api/sheets/{id}/data`

Retrieves data from a sheet with advanced query capabilities.

**Authentication:** Optional (required for sheets with `public_read=false`)

**Query Parameters:**
- `query` (string): Text search across all fields
- `where` (string): JSON-formatted WHERE conditions with MongoDB-like operators
- `limit` (number): Maximum number of results (1-1000)
- `page` (number): Page number for pagination (starts from 1)
- `order` (string): Sort order (e.g., `name`, `score:desc`, `category,score:desc`)
- `count` (boolean): Include total count in response

**Supported WHERE Operators:**
- `$lt`, `$lte`, `$gt`, `$gte`: Comparison operators
- `$ne`: Not equal
- `$in`, `$nin`: In/not in array
- `$exists`: Field exists check
- `$regex`: Regular expression matching
- `$text`: Full-text search

**Example Request:**
```bash
GET /api/sheets/12345/data?where={"score":{"$gte":100}}&order=score:desc&limit=10
```

**Example Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "uuid-1",
      "name": "John Doe",
      "score": 150,
      "created_at": "2023-01-01T12:00:00Z",
      "updated_at": "2023-01-01T12:00:00Z"
    }
  ],
  "count": 25
}
```

#### Create Sheet Data
**POST** `/api/sheets/{id}/data`

Creates a new row in the specified sheet.

**Authentication:** Optional (required for sheets with `public_write=false`)

**Request Body:** JSON object with field values

**Restrictions:**
- Cannot specify `id`, `created_at`, or `updated_at` (auto-generated)
- All fields must match existing columns in the sheet
- Data is validated against the sheet schema

**Example Request:**
```bash
POST /api/sheets/12345/data
Content-Type: application/json

{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "score": 200,
  "metadata": {
    "department": "Engineering",
    "location": "Tokyo"
  },
  "tags": ["developer", "senior"]
}
```

**Example Response (with read permission):**
```json
{
  "success": true,
  "data": {
    "id": "uuid-generated",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "score": 200,
    "metadata": {
      "department": "Engineering",
      "location": "Tokyo"
    },
    "tags": ["developer", "senior"],
    "created_at": "2023-01-01T12:00:00Z",
    "updated_at": "2023-01-01T12:00:00Z"
  }
}
```

**Example Response (without read permission):**
```json
{
  "success": true,
  "data": {}
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Column 'invalid_field' does not exist in the sheet"
}
```

### User Management APIs

#### Get Current User Information
**GET** `/api/users/me`

Retrieves the authenticated user's information from the _User sheet.

**Authentication:** Required

**Example Request:**
```bash
GET /api/users/me
Authorization: Bearer <session-token>
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "auth0|user123",
    "name": "John Doe",
    "email": "john@example.com",
    "given_name": "John",
    "family_name": "Doe",
    "picture": "https://example.com/avatar.jpg",
    "email_verified": true,
    "locale": "en",
    "roles": ["user"],
    "created_at": "2023-01-01T12:00:00Z",
    "updated_at": "2023-01-01T12:00:00Z"
  }
}
```

#### Delete Current User Account
**DELETE** `/api/users/me`

Deletes the authenticated user's own data from the _User sheet. The user can only delete their own account. Data is cleared rather than deleted to prevent row shifting conflicts.

**Authentication:** Required

**Example Request:**
```bash
DELETE /api/users/me
Authorization: Bearer <session-token>
```

**Example Response:**
```json
{
  "success": true,
  "message": "User account has been successfully deleted"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "User not found in _User sheet"
}
```

### Sheet Management APIs

#### Create Sheet
**POST** `/api/sheets`

Creates a new Google Sheet with specified permissions and configuration.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "MyNewSheet",
  "public_read": true,
  "public_write": false,
  "role_read": ["viewer"],
  "role_write": ["editor"],
  "user_read": ["user123"],
  "user_write": ["user456"]
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "name": "MyNewSheet",
    "sheetId": 12345,
    "public_read": true,
    "public_write": false,
    "role_read": ["viewer"],
    "role_write": ["editor"],
    "user_read": ["user123"],
    "user_write": ["user456"],
    "message": "Sheet 'MyNewSheet' created successfully"
  }
}
```

### Role Management APIs

#### Create Role
**POST** `/api/roles`

Creates a new role with specified permissions.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "admin",
  "public_read": true,
  "public_write": false,
  "role_read": ["manager"],
  "role_write": [],
  "user_read": ["user123"],
  "user_write": [],
  "users": ["user456"],
  "roles": ["parent-role"]
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "name": "admin",
    "users": ["user456"],
    "roles": ["parent-role"],
    "created_at": "2023-01-01T12:00:00Z",
    "updated_at": "2023-01-01T12:00:00Z",
    "public_read": true,
    "public_write": false,
    "role_read": ["manager"],
    "role_write": [],
    "user_read": ["user123"],
    "user_write": []
  }
}
```

#### Update Role
**PUT** `/api/roles/{roleName}`

Updates an existing role's permissions.

**Authentication:** Required

**Request Body:** Partial role object with fields to update

**Example Request:**
```bash
PUT /api/roles/admin
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "public_write": true,
  "role_write": ["editor"]
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "name": "admin",
    "public_write": true,
    "role_write": ["editor"],
    "updated_at": "2023-01-01T12:30:00Z"
  }
}
```

#### Delete Role
**DELETE** `/api/roles/{roleName}`

Deletes a role from the system.

**Authentication:** Required

**Example Request:**
```bash
DELETE /api/roles/admin
Authorization: Bearer <session-token>
```

**Example Response:**
```json
{}
```

### Permission System

Sheet access is controlled by the following fields in the sheet metadata:

- **`public_read`**: Boolean - Allows public read access
- **`public_write`**: Boolean - Allows public write access  
- **`user_read`**: Array - User IDs with read access
- **`user_write`**: Array - User IDs with write access
- **`role_read`**: Array - Roles with read access
- **`role_write`**: Array - Roles with write access

### Authentication

All authenticated endpoints accept a Bearer token in the Authorization header:

```bash
Authorization: Bearer <session-token>
```

To obtain a session token, use the authentication flow via `/api/auth`.