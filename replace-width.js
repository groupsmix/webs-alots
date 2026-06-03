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
walkDir('./src/components', (filePath) => {
  if (!filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Replace: style={{ width: ${expr}% }} -> data-width={Math.round(expr)}
  content = content.replace(/style=\{\{\s*width:\s*\\$\{([^}]+)\}\%\\s*\}\}/g, 'data-width={Math.round()}');
  // Replace: style={{ width: "100%" }} -> data-width={100}
  content = content.replace(/style=\{\{\s*width:\s*"(100|0)%"\s*\}\}/g, 'data-width={}');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    count++;
    console.log("Updated: " + filePath);
  }
});

walkDir('./src/app', (filePath) => {
  if (!filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  content = content.replace(/style=\{\{\s*width:\s*\\$\{([^}]+)\}\%\\s*\}\}/g, 'data-width={Math.round()}');
  content = content.replace(/style=\{\{\s*width:\s*"(100|0)%"\s*\}\}/g, 'data-width={}');
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    count++;
    console.log("Updated: " + filePath);
  }
});
console.log("Total files updated: " + count);
