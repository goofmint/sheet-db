/**
 * Build script for client-side bundles
 *
 * Bundles client-side entry points using esbuild and generates TS files with inline code
 */

import { build } from 'esbuild';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const publicDir = `${__dirname}/../public`;
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

const srcDir = `${__dirname}/../src/generated`;
if (!existsSync(srcDir)) {
  mkdirSync(srcDir, { recursive: true });
}

// Build the bundle
await build({
  entryPoints: ['src/client/setup.tsx'],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'public/setup.js',
  minify: false,
  sourcemap: false,
  jsxFactory: 'jsx',
  jsxFragment: 'Fragment',
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx/dom',
  logLevel: 'info',
});

console.log('✓ Client bundle built successfully');
