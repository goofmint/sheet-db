import { Context } from 'hono';
import { html } from 'hono/html';
import { ConfigService } from './services/config';
import SetupTemplate from './templates/setup';
import type { Env } from './types';

export const setupHandler = async (c: Context<{ Bindings: Env }>) => {
  return c.html(html`${SetupTemplate()}`);
};