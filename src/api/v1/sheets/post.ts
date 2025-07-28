import { Context } from 'hono';
import { UserSheet } from '../../../sheet/user';
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
      }, 400);
    }
    
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