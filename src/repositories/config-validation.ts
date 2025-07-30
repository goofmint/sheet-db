import { z } from 'zod';

// Google configuration schema
const googleConfigSchema = z.object({
  client_id: z.string().min(1, 'Google Client ID is required'),
  client_secret: z.string().min(1, 'Google Client Secret is required'),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});

// Auth0 configuration schema
const auth0ConfigSchema = z.object({
  domain: z.string().min(1, 'Auth0 Domain is required')
    .refine((val) => {
      try {
        new URL(`https://${val}`);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid Auth0 domain format'),
  client_id: z.string().min(1, 'Auth0 Client ID is required'),
  client_secret: z.string().min(1, 'Auth0 Client Secret is required'),
  audience: z.string().optional(),
});

// R2 storage configuration schema
const r2ConfigSchema = z.object({
  accountId: z.string().min(1, 'R2 Account ID is required'),
  accessKeyId: z.string().min(1, 'R2 Access Key ID is required'),
  secretAccessKey: z.string().min(1, 'R2 Secret Access Key is required'),
  bucketName: z.string().min(1, 'R2 Bucket Name is required'),
  endpoint: z.string().url('Invalid R2 endpoint URL'),
});

// Storage configuration schema
const storageConfigSchema = z.object({
  type: z.enum(['r2', 'google_drive']),
  r2: r2ConfigSchema.optional(),
}).refine((data) => {
  if (data.type === 'r2' && !data.r2) {
    return false;
  }
  return true;
}, 'R2 configuration is required when storage type is R2');

// App configuration schema
const appConfigSchema = z.object({
  config_password: z.string().min(8, 'Config password must be at least 8 characters'),
  setup_completed: z.boolean(),
});

// Complete setup configuration schema
export const setupConfigSchema = z.object({
  google: googleConfigSchema,
  auth0: auth0ConfigSchema,
  storage: storageConfigSchema,
  app: appConfigSchema,
  csrf_token: z.string().min(1, 'CSRF token is required'),
});

// Field type definitions for UI rendering
export const configFieldTypes: Record<string, {
  type: 'text' | 'password' | 'url' | 'boolean';
  sensitive: boolean;
  validation?: z.ZodType<any>;
}> = {
  'google.client_id': { type: 'text', sensitive: false },
  'google.client_secret': { type: 'password', sensitive: true },
  'google.access_token': { type: 'password', sensitive: true },
  'google.refresh_token': { type: 'password', sensitive: true },
  'auth0.domain': { type: 'text', sensitive: false },
  'auth0.client_id': { type: 'text', sensitive: false },
  'auth0.client_secret': { type: 'password', sensitive: true },
  'auth0.audience': { type: 'text', sensitive: false },
  'storage.type': { type: 'text', sensitive: false },
  'storage.r2.accountId': { type: 'text', sensitive: false },
  'storage.r2.accessKeyId': { type: 'text', sensitive: false },
  'storage.r2.secretAccessKey': { type: 'password', sensitive: true },
  'storage.r2.bucketName': { type: 'text', sensitive: false },
  'storage.r2.endpoint': { type: 'url', sensitive: false },
  'app.config_password': { type: 'password', sensitive: true },
  'app.setup_completed': { type: 'boolean', sensitive: false },
};

// Validate configuration update
export function validateConfigUpdate(data: unknown): { 
  success: boolean; 
  data?: z.infer<typeof setupConfigSchema>; 
  errors?: Array<{ field: string; message: string }> 
} {
  try {
    const validated = setupConfigSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return { success: false, errors };
    }
    return { 
      success: false, 
      errors: [{ field: 'unknown', message: 'Validation failed' }] 
    };
  }
}

// Validate individual field
export function validateField(fieldPath: string, value: unknown): {
  valid: boolean;
  error?: string;
} {
  const pathParts = fieldPath.split('.');
  
  try {
    if (pathParts[0] === 'google') {
      const fieldName = pathParts[1];
      const fieldSchema = googleConfigSchema.shape[fieldName as keyof typeof googleConfigSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
      }
    } else if (pathParts[0] === 'auth0') {
      const fieldName = pathParts[1];
      const fieldSchema = auth0ConfigSchema.shape[fieldName as keyof typeof auth0ConfigSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
      }
    } else if (pathParts[0] === 'storage' && pathParts[1] === 'r2') {
      const fieldName = pathParts[2];
      const fieldSchema = r2ConfigSchema.shape[fieldName as keyof typeof r2ConfigSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
      }
    } else if (pathParts[0] === 'app') {
      const fieldName = pathParts[1];
      const fieldSchema = appConfigSchema.shape[fieldName as keyof typeof appConfigSchema.shape];
      if (fieldSchema) {
        fieldSchema.parse(value);
      }
    }
    
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.errors[0].message };
    }
    return { valid: false, error: 'Invalid value' };
  }
}

// Get field metadata
export function getFieldMetadata(fieldPath: string) {
  return configFieldTypes[fieldPath] || { type: 'text', sensitive: false };
}