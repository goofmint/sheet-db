import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { SheetDB, SheetDBConfig } from './SheetDB';

export interface ServerConfig {
  port?: number;
  sheetDBConfig: SheetDBConfig;
}

export class Server {
  private app: express.Application;
  private db: SheetDB;
  private port: number;

  constructor(config: ServerConfig) {
    this.app = express();
    this.port = config.port || 3000;
    this.db = new SheetDB(config.sheetDBConfig);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Get all records
    this.app.get('/api/data', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const records = await this.db.getAll();
        res.json({ success: true, data: records, count: records.length });
      } catch (error) {
        next(error);
      }
    });

    // Get a single record by field
    this.app.get('/api/data/:field/:value', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { field, value } = req.params;
        const record = await this.db.getOne(field, value);
        
        if (!record) {
          return res.status(404).json({ 
            success: false, 
            error: `Record not found with ${field}=${value}` 
          });
        }
        
        res.json({ success: true, data: record });
      } catch (error) {
        next(error);
      }
    });

    // Search records
    this.app.post('/api/search', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const criteria = req.body;
        const records = await this.db.search(criteria);
        res.json({ success: true, data: records, count: records.length });
      } catch (error) {
        next(error);
      }
    });

    // Create a new record
    this.app.post('/api/data', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = req.body;
        const record = await this.db.create(data);
        res.status(201).json({ success: true, data: record });
      } catch (error) {
        next(error);
      }
    });

    // Update a record
    this.app.put('/api/data/:field/:value', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { field, value } = req.params;
        const data = req.body;
        const record = await this.db.update(field, value, data);
        
        if (!record) {
          return res.status(404).json({ 
            success: false, 
            error: `Record not found with ${field}=${value}` 
          });
        }
        
        res.json({ success: true, data: record });
      } catch (error) {
        next(error);
      }
    });

    // Delete a record
    this.app.delete('/api/data/:field/:value', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { field, value } = req.params;
        const deleted = await this.db.delete(field, value);
        
        if (!deleted) {
          return res.status(404).json({ 
            success: false, 
            error: `Record not found with ${field}=${value}` 
          });
        }
        
        res.json({ success: true, message: 'Record deleted successfully' });
      } catch (error) {
        next(error);
      }
    });
  }

  private setupErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
      });
    });
  }

  async start(): Promise<void> {
    try {
      await this.db.initialize();
      this.app.listen(this.port, () => {
        console.log(`SheetDB server is running on port ${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  getApp(): express.Application {
    return this.app;
  }
}
