import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { configTable } from '../db/schema';
import { uploadFileRoute } from '../api-routes';
import { 
	getConfig, 
	getGoogleTokens, 
	isTokenValid, 
	getGoogleCredentials, 
	refreshAccessToken, 
	saveGoogleTokens,
	type DatabaseConnection
} from '../google-auth';
import { authenticateSession } from './auth';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
	R2_BUCKET?: R2Bucket;
};

// Constants
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_EXTENSIONS = 'image/*';

// Helper function to generate random filename
function generateRandomFilename(originalName: string): string {
	const extension = originalName.split('.').pop() || '';
	const randomString = crypto.randomUUID().replace(/-/g, '');
	return extension ? `${randomString}.${extension}` : randomString;
}

// Helper function to check if file type is allowed
function isFileTypeAllowed(file: File, allowedExtensions: string): boolean {
	const fileName = file.name;
	const fileType = file.type;
	
	if (allowedExtensions === '*') {
		return true;
	}
	
	// Parse allowed extensions
	const allowed = allowedExtensions.split(',').map(ext => ext.trim().toLowerCase());
	
	for (const pattern of allowed) {
		if (pattern.includes('*')) {
			// Handle patterns like "image/*"
			const baseType = pattern.split('/')[0];
			if (fileType.startsWith(baseType + '/')) {
				return true;
			}
		} else if (pattern.startsWith('.')) {
			// Handle extensions like ".jpg", ".png"
			if (fileName.toLowerCase().endsWith(pattern)) {
				return true;
			}
		} else {
			// Handle full MIME types like "image/jpeg"
			if (fileType === pattern) {
				return true;
			}
		}
	}
	
	return false;
}

// Helper function to upload to Google Drive
async function uploadToGoogleDrive(
	db: DatabaseConnection,
	file: File,
	filename: string
): Promise<{ url: string; fileId: string }> {
	// Get valid Google tokens
	let tokens = await getGoogleTokens(db);
	if (!tokens) {
		throw new Error('No valid Google token found');
	}

	// Check token validity
	const isValid = await isTokenValid(db);
	if (!isValid) {
		const credentials = await getGoogleCredentials(db);
		if (credentials && tokens.refresh_token) {
			tokens = await refreshAccessToken(tokens.refresh_token, credentials);
			await saveGoogleTokens(db, tokens);
		} else {
			throw new Error('Failed to refresh Google token');
		}
	}

	// Convert file to buffer
	const arrayBuffer = await file.arrayBuffer();
	const buffer = new Uint8Array(arrayBuffer);

	// Upload to Google Drive using simple upload
	const uploadResponse = await fetch(
		`https://www.googleapis.com/upload/drive/v3/files?uploadType=media&name=${encodeURIComponent(filename)}`,
		{
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': file.type
			},
			body: buffer
		}
	);

	if (!uploadResponse.ok) {
		const errorText = await uploadResponse.text();
		throw new Error(`Google Drive upload failed: ${errorText}`);
	}

	const uploadResult = await uploadResponse.json() as any;
	const fileId = uploadResult.id;

	// Make file public
	await fetch(
		`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
		{
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${tokens.access_token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				role: 'reader',
				type: 'anyone'
			})
		}
	);

	const publicUrl = `https://drive.google.com/uc?id=${fileId}`;
	
	return { url: publicUrl, fileId };
}

// Helper function to upload to R2
async function uploadToR2(
	bucket: R2Bucket,
	file: File,
	filename: string
): Promise<{ url: string; key: string }> {
	// Convert file to buffer
	const arrayBuffer = await file.arrayBuffer();
	
	// Upload to R2
	await bucket.put(filename, arrayBuffer, {
		httpMetadata: {
			contentType: file.type
		}
	});

	// Generate public URL (this would need to be configured based on your R2 setup)
	const publicUrl = `https://your-r2-domain.com/${filename}`;
	
	return { url: publicUrl, key: filename };
}

// Register file upload route
export function registerFileUploadRoute(app: OpenAPIHono<{ Bindings: Bindings }>) {
	app.openapi(uploadFileRoute, async (c) => {
		try {
			const db = drizzle(c.env.DB);
			
			// Get configuration values
			const anonymousUpload = await getConfig(db, 'ANONYMOUS_FILE_UPLOAD');
			const maxFileSize = await getConfig(db, 'MAX_FILE_SIZE');
			const allowedExtensions = await getConfig(db, 'ALLOW_UPLOAD_EXTENSTION');
			
			// Get upload destination
			const uploadDestination = await getConfig(db, 'upload_destination');
			if (!uploadDestination) {
				return c.json({
					success: false,
					error: 'Upload destination not configured'
				}, 400);
			}

			// Check authentication if required
			const authHeader = c.req.header('authorization');
			let isAuthenticated = false;
			let userId: string | undefined;

			if (authHeader && authHeader.startsWith('Bearer ')) {
				const sessionId = authHeader.slice(7);
				const authResult = await authenticateSession(db, sessionId);
				isAuthenticated = authResult.valid;
				userId = authResult.userId;
			}

			// Check if anonymous upload is allowed
			if (anonymousUpload !== 'true' && !isAuthenticated) {
				return c.json({
					success: false,
					error: 'Authentication required for file upload'
				}, 401);
			}

			// Get file from form data
			const formData = await c.req.formData();
			const file = formData.get('file') as File;

			if (!file) {
				return c.json({
					success: false,
					error: 'No file provided'
				}, 400);
			}

			// Check file size
			const maxSize = maxFileSize ? parseInt(maxFileSize) : DEFAULT_MAX_FILE_SIZE;
			if (file.size > maxSize) {
				return c.json({
					success: false,
					error: `File size exceeds maximum limit of ${maxSize} bytes`
				}, 413);
			}

			// Check file type
			const allowedExts = allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS;
			if (!isFileTypeAllowed(file, allowedExts)) {
				return c.json({
					success: false,
					error: `File type not allowed. Allowed types: ${allowedExts}`
				}, 415);
			}

			// Generate filename
			const filename = generateRandomFilename(file.name);

			// Upload file based on destination
			let uploadResult: { url: string };

			if (uploadDestination.toLowerCase() === 'google drive') {
				uploadResult = await uploadToGoogleDrive(db, file, filename);
			} else if (uploadDestination.toLowerCase() === 'r2') {
				if (!c.env.R2_BUCKET) {
					return c.json({
						success: false,
						error: 'R2 bucket not configured'
					}, 500);
				}
				uploadResult = await uploadToR2(c.env.R2_BUCKET, file, filename);
			} else {
				return c.json({
					success: false,
					error: 'Invalid upload destination configured'
				}, 500);
			}

			// Return success response
			return c.json({
				success: true,
				data: {
					url: uploadResult.url,
					fileName: file.name,
					contentType: file.type,
					fileSize: file.size
				}
			});

		} catch (error) {
			console.error('File upload error:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return c.json({
				success: false,
				error: `File upload failed: ${errorMessage}`
			}, 500);
		}
	});
}

// Register all file routes
export function registerFileRoutes(app: OpenAPIHono<{ Bindings: Bindings }>) {
	registerFileUploadRoute(app);
}