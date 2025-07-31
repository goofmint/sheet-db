import type { Context } from 'hono';
import type { Env } from '../../../types/env';
import storagesPostHandler from './post';
import storagesDeleteHandler from './delete';

/**
 * OpenAPI-compatible wrapper for storage POST handler
 */
export async function openApiStoragesPostHandler(c: Context<{ Bindings: Env }>) {
  return await storagesPostHandler(c);
}

/**
 * OpenAPI-compatible wrapper for storage DELETE handler
 */
export async function openApiStoragesDeleteHandler(c: Context<{ Bindings: Env }>) {
  return await storagesDeleteHandler(c);
}