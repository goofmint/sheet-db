import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',

  // D1 の場合、マイグレーションは wrangler コマンドで適用します:
  // ローカル: npx wrangler d1 execute sheet-db --local --file=./drizzle/[migration].sql
  // 本番環境: npx wrangler d1 execute sheet-db --remote --file=./drizzle/[migration].sql
  //
  // drizzle-kit studio を使用する場合は、以下の設定が必要です:
  // 1. pnpm run dev を一度実行して .wrangler/state ディレクトリを作成
  // 2. ls .wrangler/state/v3/d1/miniflare-D1DatabaseObject/ で DB ID を確認
  // 3. 下記の <db-id> を実際の ID に置き換え
  // dbCredentials: {
  //   url: 'file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<db-id>.sqlite',
  // },
});
