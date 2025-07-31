# Storages OpenAPI Documentation Task

## Overview
Create comprehensive OpenAPI documentation for `/api/v1/storages` endpoints using `@hono/zod-openapi`.

## Scope
- **Documentation Only**: This task focuses solely on creating OpenAPI documentation
- **Implementation Prohibited**: Do not implement the actual OpenAPI integration
- **Endpoints Covered**: POST /api/v1/storages, DELETE /api/v1/storages/:id

## Analysis of Existing Endpoints

### POST /api/v1/storages - File Upload
**Purpose**: Upload files to configured storage (R2 or Google Drive)

**Request**:
- Content-Type: multipart/form-data
- Body: FormData with 'file' field
- File validation: size, type based on config

**Responses**:
- 201: File uploaded successfully
- 400: No file provided, validation errors
- 413: File too large
- 415: Invalid file type
- 500: Storage not configured, upload failed
- 503: Upload disabled

### DELETE /api/v1/storages/:id - File Delete
**Purpose**: Delete file from configured storage

**Request**:
- Path parameter: id (file ID)

**Responses**:
- 200: File deleted successfully
- 400: File ID required
- 404: File not found
- 500: Storage not configured, delete failed

## Task Deliverables

### 1. Type Definitions (`src/api/v1/storages/types.ts`)

```typescript
import { z } from 'zod';

// File Upload Request Schema (multipart/form-data)
export const FileUploadSchema = z.object({
  file: z.instanceof(File).openapi({
    type: 'string',
    format: 'binary',
    description: 'File to upload'
  })
});

// File Upload Success Response Schema
export const FileUploadSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: 'Upload success indicator'
  }),
  message: z.string().openapi({
    example: 'File uploaded successfully',
    description: 'Success message'
  }),
  fileId: z.string().openapi({
    example: 'abc123-def456-ghi789',
    description: 'Unique file identifier'
  }),
  fileUrl: z.string().url().openapi({
    example: 'https://storage.example.com/files/abc123-def456-ghi789',
    description: 'Direct URL to access the uploaded file'
  }),
  fileName: z.string().openapi({
    example: 'document.pdf',
    description: 'Original filename'
  }),
  fileSize: z.number().int().positive().openapi({
    example: 1048576,
    description: 'File size in bytes'
  }),
  mimeType: z.string().openapi({
    example: 'application/pdf',
    description: 'MIME type of the uploaded file'
  }),
  storageType: z.enum(['r2', 'gdrive']).openapi({
    description: 'Storage backend used for the upload'
  })
});

// File Delete Path Parameter Schema
export const FileDeleteParamsSchema = z.object({
  id: z.string().openapi({
    param: {
      name: 'id',
      in: 'path'
    },
    example: 'abc123-def456-ghi789',
    description: 'File ID to delete'
  })
});

// File Delete Success Response Schema
export const FileDeleteSuccessSchema = z.object({
  success: z.literal(true).openapi({
    description: 'Delete success indicator'
  }),
  message: z.string().openapi({
    example: 'File deleted successfully',
    description: 'Success message'
  }),
  fileId: z.string().openapi({
    example: 'abc123-def456-ghi789',
    description: 'ID of the deleted file'
  }),
  storageType: z.enum(['r2', 'gdrive']).openapi({
    description: 'Storage backend where file was deleted'
  })
});

// Error Response Schema (shared across endpoints)
export const StorageErrorSchema = z.object({
  error: z.string().openapi({
    example: 'Upload failed',
    description: 'Error type identifier'
  }),
  message: z.string().openapi({
    example: 'File size exceeds maximum limit',
    description: 'Detailed error message'
  })
});

// TypeScript types derived from schemas
export type FileUploadRequest = z.infer<typeof FileUploadSchema>;
export type FileUploadSuccessResponse = z.infer<typeof FileUploadSuccessSchema>;
export type FileDeleteParams = z.infer<typeof FileDeleteParamsSchema>;
export type FileDeleteSuccessResponse = z.infer<typeof FileDeleteSuccessSchema>;
export type StorageErrorResponse = z.infer<typeof StorageErrorSchema>;
```

### 2. OpenAPI Route Definitions (`src/api/v1/storages/route.ts`)

```typescript
import { createRoute } from '@hono/zod-openapi';
import { 
  FileUploadSchema, 
  FileUploadSuccessSchema, 
  FileDeleteParamsSchema,
  FileDeleteSuccessSchema,
  StorageErrorSchema 
} from './types';

/**
 * OpenAPI route definition for file upload
 */
export const uploadFileRoute = createRoute({
  method: 'post',
  path: '/v1/storages',
  tags: ['Storage'],
  summary: 'Upload File',
  description: 'Upload a file to the configured storage backend (R2 or Google Drive)',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: FileUploadSchema
        }
      }
    }
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: FileUploadSuccessSchema
        }
      },
      description: 'File uploaded successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'Bad request - no file provided or validation error'
    },
    413: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'Payload too large - file size exceeds limit'
    },
    415: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'Unsupported media type - file type not allowed'
    },
    500: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'Server error - storage not configured or upload failed'
    },
    503: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'Service unavailable - upload functionality disabled'
    }
  }
});

/**
 * OpenAPI route definition for file deletion
 */
export const deleteFileRoute = createRoute({
  method: 'delete',
  path: '/v1/storages/{id}',
  tags: ['Storage'],
  summary: 'Delete File',
  description: 'Delete a file from the configured storage backend',
  request: {
    params: FileDeleteParamsSchema
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FileDeleteSuccessSchema
        }
      },
      description: 'File deleted successfully'
    },
    400: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'Bad request - file ID required'
    },
    404: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'File not found'
    },
    500: {
      content: {
        'application/json': {
          schema: StorageErrorSchema
        }
      },
      description: 'Server error - storage not configured or delete failed'
    }
  }
});

// Future route definitions for storage management
// export const listFilesRoute = createRoute({ ... });
// export const getFileInfoRoute = createRoute({ ... });
```

## Implementation Notes

### File Upload Considerations
1. **Multipart Form Data**: OpenAPI handles binary file uploads through multipart/form-data
2. **File Validation**: Size and type validation based on configuration
3. **Storage Backend**: Supports both R2 and Google Drive
4. **Response Structure**: Includes file metadata and access URL

### File Deletion Considerations
1. **Path Parameters**: File ID passed as URL parameter
2. **Storage Backend**: Deletion handled by configured storage type
3. **Error Handling**: Proper error responses for missing files

### Security Considerations
1. **File Type Validation**: Prevent upload of dangerous file types
2. **Size Limits**: Enforce configurable file size limits
3. **Authentication**: Should require authentication (to be implemented)

### Configuration Dependencies
- `upload.enabled`: Feature flag for upload functionality
- `upload.max_file_size`: Maximum file size limit
- `upload.allowed_types`: Allowed MIME types
- `storage.type`: Storage backend selection (r2|gdrive)

## Future Enhancements
- GET /api/v1/storages - List uploaded files
- GET /api/v1/storages/:id - Get file information
- PUT /api/v1/storages/:id - Update file metadata
- POST /api/v1/storages/batch - Batch file operations

## Testing Requirements
When implementation is added:
1. Test file upload with various file types and sizes
2. Test file deletion with valid and invalid file IDs
3. Test error responses for all documented scenarios
4. Test configuration-based validation rules
5. Test both R2 and Google Drive storage backends