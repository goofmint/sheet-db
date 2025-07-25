import { Context } from 'hono';
import { html } from 'hono/html';
import PlaygroundTemplate from './templates/playground';

export const playgroundHandler = (c: Context) => {
  return c.html(
    html`<!DOCTYPE html>
      ${PlaygroundTemplate()}
    `
  );
};