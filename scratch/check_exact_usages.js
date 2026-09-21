const { execSync } = require('child_process');
const path = require('path');

const dirs = ['services', 'validation', 'schemas', 'security'];

for (const dir of dirs) {
  console.log(`\n--- USAGES OF lib/${dir} ---`);
  try {
    const res = execSync(`git grep -E "(from|import).*@/lib/${dir}/|(from|import).*\\.\\./lib/${dir}/"`, { cwd: path.join(__dirname, '../apps/client') });
    console.log(res.toString());
  } catch (e) {
    console.log('None found');
  }
}
