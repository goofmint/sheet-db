import type { Context } from 'hono';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types/env';
import { deleteFromR2, deleteFromGoogleDrive } from './helpers';

/**
 * DELETE /api/v1/storages/:id - Delete file
 */
export default async function storagesDeleteHandler(c: Context<{ Bindings: Env }>) {
  try {
    const fileId = c.req.param('id');
    
    if (!fileId) {
      return c.json({
        error: 'File ID is required'
      }, 400);
    }
    
    // Get storage configuration
    const storageType = ConfigService.getString('storage.type');
    
    if (!storageType) {
      return c.json({
        error: 'Storage not configured',
        message: 'Storage type is not set in configuration'
      }, 500);
    }

    if (storageType === 'r2') {
      await deleteFromR2(c.env, fileId);
    } else if (storageType === 'gdrive') {
      await deleteFromGoogleDrive(fileId);
    } else {
      return c.json({
        error: 'Unsupported storage type',
        message: `Storage type '${storageType}' is not supported`
      }, 500);
    }
    
    return c.json({
      success: true,
      message: 'File deleted successfully',
      fileId,
      storageType
    });
    
  } catch (error) {
    console.error('Storage delete error:', error);
    return c.json({
      error: 'Delete failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}