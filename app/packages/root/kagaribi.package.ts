import { definePackage } from '@kagaribi/core';

export default definePackage({
  name: 'root',
  runtime: ['node', 'cloudflare-workers', 'deno'],
});
