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
  path: '/api/v1/storages',
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
  path: '/api/v1/storages/{id}',
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