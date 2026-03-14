import { drizzle } from 'drizzle-orm/d1';
import { createDbHelper } from '@kagaribi/core';
import * as schema from './schema.js';
import type { D1Database } from '@cloudflare/workers-types';

// D1 は Cloudflare Workers の env バインディングから取得
// バインディングオブジェクトを直接受け取る createDbHelper を使用
//
// 使用例:
// export interface Env {
//   DB: D1Database;
// }
//
// const app = new Hono<{ Bindings: Env }>()
//   .use('*', createDbMiddleware({
//     initFn: initDb,
//     envVarName: 'DB',
//     isBinding: true
//   }))
//
// または手動で初期化:
// initDb(env.DB);

const { initDb, getDb } = createDbHelper<ReturnType<typeof drizzle>, D1Database>(
  (d1) => drizzle(d1, { schema })
);

export { initDb, getDb, schema };
