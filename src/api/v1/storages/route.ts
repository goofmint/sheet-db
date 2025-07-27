import { Hono } from 'hono';
import type { Env } from '../../../types/env';
import storagesPostHandler from './post';
import storagesDeleteHandler from './delete';

const storagesRouter = new Hono<{ Bindings: Env }>();

// POST /api/v1/storages - Create/upload file
storagesRouter.post('/', storagesPostHandler);

// DELETE /api/v1/storages/:id - Delete file
storagesRouter.delete('/:id', storagesDeleteHandler);

export default storagesRouter;