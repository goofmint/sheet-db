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

// Build options
const buildOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: false,
  sourcemap: false,
  jsxFactory: 'jsx',
  jsxFragment: 'Fragment',
  jsx: 'automatic',
  jsxImportSource: 'hono/jsx/dom',
  logLevel: 'info',
};

// Build setup bundle
await build({
  ...buildOptions,
  entryPoints: ['src/client/setup.tsx'],
  outfile: 'public/setup.js',
});

// Build login bundle
await build({
  ...buildOptions,
  entryPoints: ['src/client/login.tsx'],
  outfile: 'public/login.js',
});

// Build settings bundle
await build({
  ...buildOptions,
  entryPoints: ['src/client/settings.tsx'],
  outfile: 'public/settings.js',
});

console.log('✓ Client bundles built successfully');
