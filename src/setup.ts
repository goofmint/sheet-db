import { Context } from 'hono';
import { html } from 'hono/html';
import SetupTemplate from './templates/setup';

export const setupHandler = (c: Context) => {
  return c.html(
    html`<!DOCTYPE html>
      ${SetupTemplate()}
    `
  );
};