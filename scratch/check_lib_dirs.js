const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const libDir = path.join(__dirname, '../apps/client/lib');
const subdirs = fs.readdirSync(libDir).filter(f => fs.statSync(path.join(libDir, f)).isDirectory());

const unused = [];
const used = [];

for (const dir of subdirs) {
  try {
    const res = execSync(`git grep -E "(from|import).*@/lib/${dir}/|(from|import).*\\.\\./lib/${dir}/"`, { cwd: path.join(__dirname, '../apps/client') });
    used.push({ dir, hits: res.toString().split('\n').filter(Boolean).length });
  } catch (e) {
    unused.push(dir);
  }
}

console.log("UNUSED DIRS:");
console.log(unused.join('\n'));

console.log("\nUSED DIRS:");
used.forEach(u => console.log(`${u.dir} (${u.hits} hits)`));
