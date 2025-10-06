import dotenv from 'dotenv';
import { Server } from './server';
import { SheetDBConfig } from './SheetDB';

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Validate required environment variables
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.SHEET_NAME || 'Sheet1';
    const port = parseInt(process.env.PORT || '3000', 10);

    if (!spreadsheetId) {
      throw new Error('SPREADSHEET_ID environment variable is required');
    }

    // Configure SheetDB
    const sheetDBConfig: SheetDBConfig = {
      spreadsheetId,
      sheetName,
    };

    // Use key file if provided, otherwise use default credentials
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      sheetDBConfig.keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else if (process.env.GOOGLE_CREDENTIALS_JSON) {
      sheetDBConfig.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    }

    // Create and start server
    const server = new Server({
      port,
      sheetDBConfig,
    });

    await server.start();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();

export { SheetDB } from './SheetDB';
export { Server } from './server';
