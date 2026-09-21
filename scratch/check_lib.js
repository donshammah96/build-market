const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const libDir = path.join(__dirname, '../apps/client/lib');
const files = fs.readdirSync(libDir).filter(f => f.endsWith('.ts'));

const unused = [];
const used = [];

for (const file of files) {
  const baseName = file.replace('.ts', '');
  try {
    // Search for imports like @/lib/filename or ../lib/filename
    const res = execSync(`git grep -E "(from|import).*@/lib/${baseName}|(from|import).*\\.\\./lib/${baseName}"`, { cwd: path.join(__dirname, '../apps/client') });
    used.push({ file, hits: res.toString().split('\n').length - 1 });
  } catch (e) {
    unused.push(file);
  }
}

console.log("UNUSED FILES:");
console.log(unused.join('\n'));

console.log("\nUSED FILES:");
used.forEach(u => console.log(`${u.file} (${u.hits} hits)`));
