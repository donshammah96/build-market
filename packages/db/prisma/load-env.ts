/**
 * Load .env before any Prisma/database imports.
 * Must be imported first in seed.ts so DATABASE_URL is available.
 */
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts
        .slice(1)
        .join('=')
        .trim()
        .replace(/(^"|"$)/g, '');
      if (key && !process.env[key]) process.env[key] = value;
    }
  });
}
