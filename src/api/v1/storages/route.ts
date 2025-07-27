import { Hono } from 'hono';
import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types/env';

const storagesRouter = new Hono<{ Bindings: Env }>();

// POST /api/v1/storages - Create/upload file
storagesRouter.post('/', async (c) => {
  try {
    // Get storage configuration
    const storageType = ConfigService.getString('storage.type');
    
    if (!storageType) {
      return c.json({
        error: 'Storage not configured',
        message: 'Storage type is not set in configuration'
      }, 500);
    }

    // Get uploaded file
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({
        error: 'No file provided',
        message: 'Please provide a file to upload'
      }, 400);
    }

    // File size validation (10MB limit)
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxFileSize) {
      return c.json({
        error: 'File too large',
        message: `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum limit of ${Math.round(maxFileSize / 1024 / 1024)}MB`
      }, 413);
    }

    // File type validation
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/json',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      return c.json({
        error: 'Invalid file type',
        message: `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      }, 415);
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
      }, 500);
    }
    
    return c.json({
      success: true,
      message: 'File uploaded successfully',
      fileId,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storageType
    });
    
  } catch (error) {
    console.error('Storage upload error:', error);
    return c.json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// DELETE /api/v1/storages/:id - Delete file
storagesRouter.delete('/:id', async (c) => {
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
});

// R2 Storage Functions
async function uploadToR2(env: Env, file: File): Promise<{ fileId: string; fileUrl: string }> {
  const bucket = ConfigService.getString('storage.r2.bucket');
  const accessKeyId = ConfigService.getString('storage.r2.accessKeyId');
  const secretAccessKey = ConfigService.getString('storage.r2.secretAccessKey');
  const endpoint = ConfigService.getString('storage.r2.endpoint');
  
  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error('R2 configuration is incomplete');
  }

  // Generate unique file ID
  const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.name}`;
  
  // Convert File to ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    if (!env.R2_BUCKET) {
      throw new Error('R2 bucket not configured in environment');
    }
    
    // Upload to R2 using the bucket binding
    const r2Object = await env.R2_BUCKET.put(fileId, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });
    
    if (!r2Object) {
      throw new Error('Failed to upload to R2');
    }
    
    // Construct file URL
    const fileUrl = `${endpoint}/${fileId}`;
    
    return { fileId, fileUrl };
    
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error(`R2 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function deleteFromR2(env: Env, fileId: string): Promise<void> {
  try {
    if (!env.R2_BUCKET) {
      throw new Error('R2 bucket not configured in environment');
    }
    
    await env.R2_BUCKET.delete(fileId);
  } catch (error) {
    console.error('R2 delete error:', error);
    throw new Error(`R2 delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Google Drive Storage Functions
async function uploadToGoogleDrive(file: File): Promise<{ fileId: string; fileUrl: string }> {
  const folderId = ConfigService.getString('storage.gdrive.folderId');
  const accessToken = ConfigService.getString('google.access_token');
  
  if (!folderId) {
    throw new Error('Google Drive folder ID is not configured');
  }
  
  if (!accessToken) {
    throw new Error('Google Drive access token is not available. Please re-authenticate.');
  }

  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Create metadata for the file
    const metadata = {
      name: file.name,
      parents: [folderId]
    };
    
    // Create form data for multipart upload
    const delimiter = '-------314159265358979323846';
    const close_delim = `\r\n--${delimiter}--`;
    
    let body = `--${delimiter}\r\n`;
    body += 'Content-Type: application/json\r\n\r\n';
    body += JSON.stringify(metadata) + '\r\n';
    body += `--${delimiter}\r\n`;
    body += `Content-Type: ${file.type}\r\n\r\n`;
    
    // Combine text and binary data
    const bodyParts = [
      new TextEncoder().encode(body),
      new Uint8Array(arrayBuffer),
      new TextEncoder().encode(close_delim)
    ];
    
    // Calculate total length
    const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
    const combinedBody = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const part of bodyParts) {
      combinedBody.set(part, offset);
      offset += part.length;
    }
    
    // Upload to Google Drive
    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary="${delimiter}"`
      },
      body: combinedBody
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Google Drive upload failed: ${uploadResponse.status} ${errorText}`);
    }
    
    const result = await uploadResponse.json() as { id: string };
    const fileId = result.id;
    
    // Make file publicly viewable (optional)
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    
    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
    
    return { fileId, fileUrl };
    
  } catch (error) {
    console.error('Google Drive upload error:', error);
    throw new Error(`Google Drive upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function deleteFromGoogleDrive(fileId: string): Promise<void> {
  const accessToken = ConfigService.getString('google.access_token');
  
  if (!accessToken) {
    throw new Error('Google Drive access token is not available. Please re-authenticate.');
  }

  try {
    const deleteResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      throw new Error(`Google Drive delete failed: ${deleteResponse.status} ${errorText}`);
    }
    
  } catch (error) {
    console.error('Google Drive delete error:', error);
    throw new Error(`Google Drive delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export default storagesRouter;