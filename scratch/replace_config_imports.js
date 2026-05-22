const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

try {
  const res = execSync('git grep -l "@/lib/config/"', { cwd: path.join(__dirname, '../apps/client') });
  const files = res.toString().split('\n').filter(Boolean);
  
  for (const file of files) {
    if (file.startsWith('lib/config/')) continue;
    
    const filePath = path.join(__dirname, '../apps/client', file);
    const content = fs.readFileSync(filePath, 'utf8');
    const newContent = content.replace(/@\/lib\/config\//g, '@/app/lib/config/');
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log('Updated ' + file);
    }
  }
} catch (e) {
  console.log('No files matched.');
}
