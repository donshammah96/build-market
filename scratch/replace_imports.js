const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function replaceInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/@\/lib\/validation\//g, '@/app/lib/validation/');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// Find all files in apps/client using grep
try {
  const res = execSync(`git grep -l "@/lib/validation/"`, { cwd: path.join(__dirname, '../apps/client') });
  const files = res.toString().split('\n').filter(Boolean);
  
  for (const file of files) {
    // Skip the apps/client/lib/validation directory as we are deleting it!
    if (file.startsWith('lib/validation/')) continue;
    
    replaceInFile(path.join(__dirname, '../apps/client', file));
  }
} catch (e) {
  console.log("No files matched.");
}

// Also update the HomeownerForm.tsx import
const homeownerFormPath = path.join(__dirname, '../apps/client/components/forms/HomeownerForm.tsx');
if (fs.existsSync(homeownerFormPath)) {
  let content = fs.readFileSync(homeownerFormPath, 'utf8');
  content = content.replace(/@\/lib\/schemas\/onboarding/g, '@/app/lib/validation/onboarding');
  fs.writeFileSync(homeownerFormPath, content, 'utf8');
  console.log('Updated HomeownerForm.tsx');
}
