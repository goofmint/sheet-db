import { Context } from 'hono';
import { UserSheet } from '../../../sheet/user';
import { RoleService } from '../../../sheet/role';
import type { Env } from '../../../types';
import type { CreateSheetRequest } from './types';

export const sheetsPostHandler = async (c: Context<{ Bindings: Env }>) => {
  try {
    const requestData = await c.req.json() as CreateSheetRequest;
    const { name } = requestData;
    
    if (!name || typeof name !== 'string') {
      return c.json({
        error: 'Sheet name is required',
        message: 'Please provide a valid sheet name in the request body'
      }, 400 as const);
    }
    
    let message: string;
    
    if (name === '_User') {
      const userSheet = new UserSheet(c.env);
      await userSheet.ensureUserSheet();
      message = 'User sheet initialized successfully';
    } else if (name === '_Role') {
      const roleService = RoleService.getInstance();
      await roleService.initializeSheet();
      message = 'Role sheet initialized successfully';
    } else {
      return c.json({
        error: 'Unsupported sheet name',
        message: 'Only _User and _Role sheets are supported for initialization'
      }, 400 as const);
    }
    
    return c.json({ 
      success: true,
      message,
      sheet: name
    }, 200 as const);
    
  } catch (error) {
    console.error('Sheet initialization error:', error);
    return c.json({ 
      error: 'Failed to initialize sheet',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500 as const);
  }
}