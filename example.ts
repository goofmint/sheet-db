import { SheetDB } from './src/SheetDB';

/**
 * Example usage of SheetDB
 * 
 * Before running this example:
 * 1. Create a Google Sheet with headers in the first row
 * 2. Share it with your service account
 * 3. Set up your credentials
 */
async function example() {
  const db = new SheetDB({
    spreadsheetId: process.env.SPREADSHEET_ID || 'your_spreadsheet_id',
    sheetName: process.env.SHEET_NAME || 'Sheet1',
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  try {
    // Initialize the database
    console.log('Initializing database...');
    await db.initialize();
    console.log('✓ Database initialized');

    // Get all records
    console.log('\nFetching all records...');
    const allRecords = await db.getAll();
    console.log(`✓ Found ${allRecords.length} records:`, allRecords);

    // Create a new record
    console.log('\nCreating a new record...');
    const newRecord = await db.create({
      id: Date.now().toString(),
      name: 'Example User',
      email: 'example@test.com',
    });
    console.log('✓ Record created:', newRecord);

    // Search for records
    console.log('\nSearching for records...');
    const searchResults = await db.search({ name: 'Example User' });
    console.log(`✓ Found ${searchResults.length} matching records:`, searchResults);

    // Get a single record
    if (searchResults.length > 0) {
      const recordId = searchResults[0].id;
      console.log(`\nFetching record with id=${recordId}...`);
      const record = await db.getOne('id', recordId);
      console.log('✓ Record found:', record);

      // Update the record
      console.log('\nUpdating record...');
      const updatedRecord = await db.update('id', recordId, {
        name: 'Updated User',
      });
      console.log('✓ Record updated:', updatedRecord);

      // Delete the record
      console.log('\nDeleting record...');
      const deleted = await db.delete('id', recordId);
      console.log('✓ Record deleted:', deleted);
    }

    console.log('\n✓ Example completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  example();
}
