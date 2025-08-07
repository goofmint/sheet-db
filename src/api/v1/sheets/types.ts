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
  success: z.literal(false),
  error: z.string().openapi({ example: 'service_not_configured' }),
  message: z.string().openapi({ example: 'Google Sheets service is not properly configured. Please complete the setup first.' })
});

// Sheets list schemas
export const SheetsListQuerySchema = z.object({
  filter: z.string().optional().openapi({
    description: 'Filter sheet names by partial match',
    example: 'user'
  })
});

export const ColumnInfoSchema = z.object({
  name: z.string().openapi({ example: 'id' }),
  type: z.string().openapi({ example: 'string' }),
  default: z.any().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  required: z.boolean().optional(),
  pattern: z.string().optional()
});

export const SheetInfoSchema = z.object({
  name: z.string().openapi({ example: 'users' }),
  columns: z.array(ColumnInfoSchema)
});

export const SheetsListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    sheets: z.array(SheetInfoSchema),
    total: z.number(),
    accessible_count: z.number(),
    system_sheet_count: z.number().optional()
  }),
  meta: z.object({
    user_id: z.string().optional(),
    is_master_key_auth: z.boolean(),
    include_system: z.boolean(),
    filter_applied: z.string().optional()
  })
});

// Type exports
export type CreateSheetRequest = z.infer<typeof CreateSheetRequestSchema>;
export type SheetSuccessResponse = z.infer<typeof SheetSuccessResponseSchema>;
export type SheetErrorResponse = z.infer<typeof SheetErrorSchema>;
export type SheetsListQuery = z.infer<typeof SheetsListQuerySchema>;
export type ColumnInfo = z.infer<typeof ColumnInfoSchema>;
export type SheetInfo = z.infer<typeof SheetInfoSchema>;
export type SheetsListResponse = z.infer<typeof SheetsListResponseSchema>;