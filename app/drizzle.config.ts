import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  // D1 の場合、ローカル開発では wrangler を使用
  // 本番環境では drizzle-kit migrate で適用
  dbCredentials: {
    url: 'file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<db-id>.sqlite',
  },
});
