#!/usr/bin/env tsx

/**
 * Database migration script for Sheet DB
 * Executes schema.sql against Cloudflare D1 database
 */

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface MigrationOptions {
  local?: boolean;
  databaseName?: string;
  schemaFile?: string;
}

class DatabaseMigrator {
  private options: Required<MigrationOptions>;

  constructor(options: MigrationOptions = {}) {
    this.options = {
      local: options.local ?? true,
      databaseName: options.databaseName ?? 'sheet-db',
      schemaFile: options.schemaFile ?? 'schema.sql'
    };
  }

  /**
   * Execute the migration
   */
  async migrate(): Promise<void> {
    console.log('🚀 Starting database migration...');
    console.log(`Database: ${this.options.databaseName}`);
    console.log(`Mode: ${this.options.local ? 'local' : 'remote'}`);
    console.log(`Schema file: ${this.options.schemaFile}`);
    console.log('');

    try {
      // Check if wrangler is available
      await this.checkWrangler();

      // Read schema file
      const schemaPath = join(process.cwd(), this.options.schemaFile);
      const schema = readFileSync(schemaPath, 'utf-8');
      console.log(`📖 Read schema file: ${schemaPath}`);

      // Execute migration
      await this.executeSchema(schema);

      console.log('');
      console.log('✅ Migration completed successfully!');

    } catch (error) {
      console.error('');
      console.error('❌ Migration failed:');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Check if wrangler CLI is available
   */
  private async checkWrangler(): Promise<void> {
    try {
      await execAsync('npx wrangler --version');
      console.log('✓ Wrangler CLI available');
    } catch (error) {
      throw new Error('Wrangler CLI not found. Please install @cloudflare/wrangler.');
    }
  }

  /**
   * Execute schema against D1 database
   */
  private async executeSchema(schema: string): Promise<void> {
    // Split schema into individual statements
    const statements = this.parseStatements(schema);
    console.log(`📝 Found ${statements.length} SQL statements`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;

      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await this.executeStatement(statement);
        console.log(`✓ Statement ${i + 1} completed`);
      } catch (error) {
        console.error(`✗ Statement ${i + 1} failed:`, statement.substring(0, 100) + '...');
        throw error;
      }
    }
  }

  /**
   * Execute a single SQL statement using temporary file to prevent command injection
   */
  private async executeStatement(statement: string): Promise<void> {
    const localFlag = this.options.local ? '--local' : '';
    
    // Create temporary file with SQL statement
    const tempFilePath = join(tmpdir(), `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sql`);
    
    try {
      // Write SQL statement to temporary file
      writeFileSync(tempFilePath, statement, 'utf8');
      
      // Execute wrangler command referencing the file
      const command = `npx wrangler d1 execute ${this.options.databaseName} ${localFlag} --file="${tempFilePath}"`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('🌀') && !stderr.includes('⚡')) {
        console.warn('⚠️ Warning:', stderr);
      }
    } finally {
      // Clean up temporary file
      try {
        unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(`Failed to clean up temporary file ${tempFilePath}:`, cleanupError);
      }
    }
  }

  /**
   * Parse SQL schema into individual statements
   */
  private parseStatements(schema: string): string[] {
    // Remove comments and split by semicolons
    const withoutComments = schema
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
      })
      .join('\n');

    // Split by semicolons, but be careful with semicolons inside strings
    const statements: string[] = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < withoutComments.length; i++) {
      const char = withoutComments[i];

      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      } else if (!inString && char === ';') {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = '';
        continue;
      }

      current += char;
    }

    // Add remaining statement if any
    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements.filter(stmt => stmt.length > 0);
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--remote':
        options.local = false;
        break;
      case '--local':
        options.local = true;
        break;
      case '--database':
        options.databaseName = args[++i];
        break;
      case '--schema':
        options.schemaFile = args[++i];
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  const migrator = new DatabaseMigrator(options);
  await migrator.migrate();
}

/**
 * Print help information
 */
function printHelp(): void {
  console.log('Database Migration Script for Sheet DB');
  console.log('');
  console.log('Usage: npm run migrate [options]');
  console.log('');
  console.log('Options:');
  console.log('  --local           Use local D1 database (default)');
  console.log('  --remote          Use remote D1 database');
  console.log('  --database <name> Database name (default: sheet-db)');
  console.log('  --schema <file>   Schema file path (default: schema.sql)');
  console.log('  --help            Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run migrate                    # Migrate local database');
  console.log('  npm run migrate -- --remote       # Migrate remote database');
  console.log('  npm run migrate -- --database my-db --schema custom.sql');
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { DatabaseMigrator };