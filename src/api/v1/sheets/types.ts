import { z } from '@hono/zod-openapi';

// Request schemas
export const CreateSheetRequestSchema = z.object({
  name: z.string().openapi({
    example: 'MySheet',
    description: 'Sheet name to create or initialize'
  })
});

// Response schemas
export const SheetSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().openapi({ example: 'MySheet sheet initialized successfully' }),
  sheet: z.string().openapi({ example: 'MySheet' })
});

export const SheetErrorSchema = z.object({
  error: z.string().openapi({ example: 'Sheet name is required' }),
  message: z.string().openapi({ example: 'Please provide a valid sheet name in the request body' })
});

// Type exports
export type CreateSheetRequest = z.infer<typeof CreateSheetRequestSchema>;
export type SheetSuccessResponse = z.infer<typeof SheetSuccessResponseSchema>;
export type SheetErrorResponse = z.infer<typeof SheetErrorSchema>;