import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const configTable = sqliteTable('Config', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  value: text().notNull(),
});

export const cacheTable = sqliteTable('Cache', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  value: text().notNull(),
});

export const queueTable = sqliteTable('Queue', {
  id: int().primaryKey({ autoIncrement: true }),
  userId: text().notNull(),
  action: text().notNull(),
  value: text().notNull(),
});
