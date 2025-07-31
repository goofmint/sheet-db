import { z } from '@hono/zod-openapi';

// File Upload Request Schema (multipart/form-data)
export const FileUploadSchema = z.object({
  file: z.string().openapi({
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