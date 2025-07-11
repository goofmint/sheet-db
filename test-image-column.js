// Simple test to verify image column type support
const { parseColumnSchema, validateValue } = require('./dist/utils/schema-parser.js');

// Test if parsing works correctly
console.log('Testing image column type parsing...');

// Test simple image type
const simpleImageSchema = parseColumnSchema('image');
console.log('Simple image schema:', simpleImageSchema);

// Test JSON image schema
const jsonImageSchema = parseColumnSchema('{"type": "image", "required": true}');
console.log('JSON image schema:', jsonImageSchema);

// Test image validation
console.log('\nTesting image validation...');

// Test valid data URL
const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const dataUrlResult = validateValue(validDataUrl, { type: 'image' });
console.log('Valid data URL validation:', dataUrlResult);

// Test valid HTTP URL
const validHttpUrl = 'https://example.com/image.png';
const httpUrlResult = validateValue(validHttpUrl, { type: 'image' });
console.log('Valid HTTP URL validation:', httpUrlResult);

// Test invalid value
const invalidValue = 'not-an-image';
const invalidResult = validateValue(invalidValue, { type: 'image' });
console.log('Invalid value validation:', invalidResult);

console.log('\nImage column support test completed!');