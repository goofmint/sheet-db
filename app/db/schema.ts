import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

// SheetDB用のテーブル定義
// 必要に応じてここにテーブルを追加してください

// 例:
// export const spreadsheets = sqliteTable('spreadsheets', {
//   id: integer('id').primaryKey({ autoIncrement: true }),
//   name: text('name').notNull(),
//   googleDriveId: text('google_drive_id').notNull(),
//   createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
// });
