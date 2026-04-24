import fs from 'fs';

const content = fs.readFileSync('src/lib/i18n.ts', 'utf8');

// Extract the translation object string using basic parsing
const startIndex = content.indexOf('export const translations = {');
if (startIndex === -1) process.exit(1);

// Since it's a big object, we'll just write a custom script to strip `export const translations = ` 
// and evaluate it to JSON, but it contains comments and unquoted keys.
