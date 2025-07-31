import type { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types/env';
import { uploadToR2, uploadToGoogleDrive } from './helpers';

/**
 * POST /api/v1/storages - Create/upload file
 */
export default async function storagesPostHandler(c: Context<{ Bindings: Env }>) {
  try {
    // Check if upload is enabled
    const uploadEnabled = ConfigService.getBoolean('upload.enabled', true);
    if (!uploadEnabled) {
      return c.json({
        error: 'Upload disabled',
        message: 'File upload functionality is currently disabled'
      }, 503 as const);
    }

    // Get storage configuration
    const storageType = ConfigService.getString('storage.type');
    
    if (!storageType) {
      return c.json({
        error: 'Storage not configured',
        message: 'Storage type is not set in configuration'
      }, 500 as const);
    }

    // Get uploaded file
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({
        error: 'No file provided',
        message: 'Please provide a file to upload'
      }, 400 as const);
    }

    // File size validation (dynamic from config)
    const maxFileSize = ConfigService.getNumber('upload.max_file_size', 10 * 1024 * 1024); // Default 10MB
    if (file.size > maxFileSize) {
      return c.json({
        error: 'File too large',
        message: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum limit of ${Math.round(maxFileSize / 1024 / 1024)}MB`
      }, 413 as const);
    }

    // File type validation (from config)
    const allowedTypes = ConfigService.getJson<string[]>('upload.allowed_types');

    if (!allowedTypes.includes(file.type)) {
      return c.json({
        error: 'Invalid file type',
        message: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      }, 415 as const);
    }

    let fileId: string;
    let fileUrl: string;

    if (storageType === 'r2') {
      const result = await uploadToR2(c.env, file);
      fileId = result.fileId;
      fileUrl = result.fileUrl;
    } else if (storageType === 'gdrive') {
      const result = await uploadToGoogleDrive(file);
      fileId = result.fileId;
      fileUrl = result.fileUrl;
    } else {
      return c.json({
        error: 'Unsupported storage type',
        message: `Storage type '${storageType}' is not supported`
      }, 500 as const);
    }
    
    return c.json({
      success: true,
      message: 'File uploaded successfully',
      fileId,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storageType: storageType as 'r2' | 'gdrive'
    }, 201 as const);
    
  } catch (error) {
    console.error('Storage upload error:', error);
    return c.json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500 as const);
  }
}