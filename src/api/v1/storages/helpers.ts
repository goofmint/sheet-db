import { ConfigService } from '../../../services/config';
import type { Env } from '../../../types/env';

/**
 * Upload file to R2 storage
 */
export async function uploadToR2(env: Env, file: File): Promise<{ fileId: string; fileUrl: string }> {
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

/**
 * Delete file from R2 storage
 */
export async function deleteFromR2(env: Env, fileId: string): Promise<void> {
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

/**
 * Upload file to Google Drive
 */
export async function uploadToGoogleDrive(file: File): Promise<{ fileId: string; fileUrl: string }> {
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

/**
 * Delete file from Google Drive
 */
export async function deleteFromGoogleDrive(fileId: string): Promise<void> {
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