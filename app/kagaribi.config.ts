import { defineConfig } from '@kagaribi/core';

export default defineConfig({
  packages: {
    root: {
      target: 'cloudflare-workers',
    },
  },
  db: {
    dialect: 'sqlite',
    driver: 'd1',
  },
  environments: {
    development: {
      packages: {
        '*': { colocateWith: 'root' },
      },
    },
  },
});
