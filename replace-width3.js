const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let count = 0;
function processFile(filePath) {
  if (!filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Replace: style={{ width: \\%\ }}
  content = content.replace(/style=\{\{\s*width:\s*\$\{([^}]+)\}%\s*\}\}/g, 'data-width={Math.round()}');
  // Also handle cases with multiple lines or nested parens using a slightly broader regex
  content = content.replace(/style=\{\{\s*width:\s*\$\{([\s\S]*?)\}%\s*\}\}/g, 'data-width={Math.round()}');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    count++;
    console.log("Updated: " + filePath);
  }
}

walkDir('./src/components', processFile);
walkDir('./src/app', processFile);
console.log("Total files updated: " + count);
