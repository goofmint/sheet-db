# File Upload API

The File Upload API provides functionality to upload files to configured storage destinations (Google Drive or R2).

## Endpoint

```
POST /api/files
```

## Configuration

The file upload functionality is controlled by several configuration settings stored in the `_Config` sheet:

| Configuration | Description | Default |
|---------------|-------------|---------|
| `ANONYMOUS_FILE_UPLOAD` | Allow uploads without authentication | `false` |
| `MAX_FILE_SIZE` | Maximum file size in bytes | `10485760` (10MB) |
| `ALLOW_UPLOAD_EXTENSION` | Allowed file extensions/MIME types | `image/*` |
| `FILE_UPLOAD_PUBLIC` | Make uploaded files publicly accessible | `true` |
| `upload_destination` | Storage destination | Required (must be set) |

## Storage Destinations

### Google Drive
- Files are uploaded to Google Drive
- Files can be made publicly accessible based on `FILE_UPLOAD_PUBLIC` setting
- Requires valid Google OAuth tokens

### R2 (Cloudflare R2)
- Files are uploaded to the configured R2 bucket
- Files can be stored with public access based on `FILE_UPLOAD_PUBLIC` setting
- Requires R2 bucket configuration

## Authentication

Authentication is optional and depends on the `ANONYMOUS_FILE_UPLOAD` configuration:

- If `ANONYMOUS_FILE_UPLOAD` is `true`: No authentication required
- If `ANONYMOUS_FILE_UPLOAD` is `false`: Bearer token authentication required

### Authentication Header
```
Authorization: Bearer <session-token>
```

## Request

### Content-Type
```
multipart/form-data
```

### Body
- `file`: The file to upload (required)

## Response

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "url": "https://example.com/uploaded-file.jpg",
    "fileName": "original-filename.jpg",
    "contentType": "image/jpeg",
    "fileSize": 204800
  }
}
```

### Error Responses

#### 400 - Bad Request
```json
{
  "success": false,
  "error": "No file provided"
}
```

#### 401 - Unauthorized
```json
{
  "success": false,
  "error": "Authentication required for file upload"
}
```

#### 413 - File Too Large
```json
{
  "success": false,
  "error": "File size exceeds maximum limit of 10485760 bytes"
}
```

#### 415 - Unsupported Media Type
```json
{
  "success": false,
  "error": "File type not allowed. Allowed types: image/*"
}
```

#### 500 - Internal Server Error
```json
{
  "success": false,
  "error": "Upload destination not configured"
}
```

## File Processing

1. **Filename Generation**: Original filename is replaced with a random UUID-based filename while preserving the extension
2. **File Validation**: File size and type are validated against configuration
3. **Storage**: File is uploaded to the configured destination
4. **Public Access**: Files can be made publicly accessible via HTTPS URL based on `FILE_UPLOAD_PUBLIC` setting

## Examples

### Basic Upload with Authentication
```bash
curl -X POST \
  -H "Authorization: Bearer your-session-token" \
  -F "file=@/path/to/your/file.jpg" \
  https://your-domain.com/api/files
```

### Anonymous Upload (if enabled)
```bash
curl -X POST \
  -F "file=@/path/to/your/file.jpg" \
  https://your-domain.com/api/files
```

### JavaScript Example
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/files', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-session-token'
  },
  body: formData
});

const result = await response.json();
console.log(result);
```

## Security Considerations

1. File size limits prevent abuse
2. File type restrictions prevent malicious uploads
3. Random filenames prevent directory traversal attacks
4. Authentication controls access when required
5. Files are stored in secure cloud storage services

## Troubleshooting

### Common Issues

1. **Upload destination not configured**: Ensure `upload_destination` is set in Config table
2. **File too large**: Check `MAX_FILE_SIZE` configuration
3. **File type not allowed**: Verify file type matches `ALLOW_UPLOAD_EXTENSION` patterns
4. **Authentication required**: Check `ANONYMOUS_FILE_UPLOAD` setting and provide valid token
5. **Storage service errors**: Verify Google Drive or R2 credentials and permissions