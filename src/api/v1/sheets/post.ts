import { Context } from 'hono';
import { UserService } from '../../../sheet/user';
import { RoleService } from '../../../sheet/role';

export async function sheetsPostHandler(c: Context) {
  try {
    const requestData = await c.req.json();
    const { name } = requestData;
    
    if (!name || typeof name !== 'string') {
      return c.json({
        error: 'Sheet name is required',
        message: 'Please provide a valid sheet name in the request body'
      }, 400);
    }
    
    let service;
    let message;
    
    if (name === '_User') {
      service = UserService.getInstance();
      message = 'User sheet initialized successfully';
    } else if (name === '_Role') {
      service = RoleService.getInstance();
      message = 'Role sheet initialized successfully';
    } else {
      return c.json({
        error: 'Unsupported sheet name',
        message: 'Only _User and _Role sheets are supported for initialization'
      }, 400);
    }
    
    await service.initializeSheet();
    
    return c.json({ 
      success: true,
      message,
      sheet: name
    });
    
  } catch (error) {
    console.error('Sheet initialization error:', error);
    return c.json({ 
      error: 'Failed to initialize sheet',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}