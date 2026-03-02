#!/usr/bin/env tsx

/**
 * GDPR/Compliance Import Migration Script
 *
 * This script automatically updates import paths across the codebase to reflect
 * the new consolidated GDPR/compliance module structure.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-gdpr-imports.ts --dry-run  # Generate report without making changes
 *   pnpm tsx scripts/migrate-gdpr-imports.ts            # Apply changes to files
 */

import { config } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";

// ============================================
// Environment Loading
// ============================================

import { fileURLToPath } from "url";

// Determine script directory and load .env from parent (apps/client)
const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const CLIENT_DIR = path.resolve(SCRIPT_DIR, "..");
const envPath = path.join(CLIENT_DIR, ".env");

if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log(`[Config] Loaded environment from ${envPath}`);
}

// ============================================
// Configuration
// ============================================

interface ImportMapping {
  pattern: RegExp;
  replacement: string;
  description: string;
}

const IMPORT_MAPPINGS: ImportMapping[] = [
  // 1. Remove re-export wrapper for ComplianceService
  {
    pattern: /from ['"]@\/app\/services\/compliance\.service['"]/g,
    replacement: "from '@/app/lib/gdpr/services/compliance.service'",
    description: "Update ComplianceService imports to use lib/gdpr/services",
  },

  // 2. Update ExportService to new location
  {
    pattern: /from ['"]@\/app\/services\/export\.service['"]/g,
    replacement: "from '@/app/lib/gdpr/services/export.service'",
    description: "Update ExportService imports to use lib/gdpr/services",
  },

  // 3. Remove duplicate lib/gdpr/export.service imports (should not exist but check)
  {
    pattern: /from ['"]@\/app\/lib\/gdpr\/export\.service['"]/g,
    replacement: "from '@/app/lib/gdpr/services/export.service'",
    description:
      "Update old lib/gdpr/export.service imports to new services location",
  },

  // 4. Update ExportProcessor imports to new workers/export structure
  {
    pattern: /from ['"]@\/app\/workers\/export\.processor['"]/g,
    replacement: "from '@/app/workers/export/processor'",
    description: "Update ExportProcessor imports to use workers/export folder",
  },

  // 5. Update ExportWorker imports to new workers/export structure
  {
    pattern: /from ['"]@\/app\/workers\/export\.workers['"]/g,
    replacement: "from '@/app/workers/export'",
    description: "Update ExportWorker imports to use workers/export index",
  },

  // 6. Update Redis connection imports
  {
    pattern: /from ['"]@\/app\/lib\/queues\/connection['"]/g,
    replacement: "from '@/app/lib/queues/redis-connection'",
    description: "Update Redis connection imports to new filename",
  },

  // 7. Update relative imports from workers/export.processor
  {
    pattern: /from ['"]\.\/export\.processor['"]/g,
    replacement: "from './processor'",
    description: "Update relative ExportProcessor imports",
  },

  // 8. Update encryption imports to new subfolder
  {
    pattern: /from ['"]@\/app\/lib\/gdpr\/encryption['"]/g,
    replacement: "from '@/app/lib/gdpr/encryption/field-encryption'",
    description: "Update encryption imports to use encryption subfolder",
  },

  // 9. Update prisma-extension imports to new subfolder
  {
    pattern: /from ['"]@\/app\/lib\/gdpr\/prisma-extension['"]/g,
    replacement: "from '@/app/lib/gdpr/encryption/prisma-extension'",
    description: "Update prisma-extension imports to encryption subfolder",
  },
];

// Files to exclude from processing
const EXCLUDE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/scripts/migrate-gdpr-imports.ts", // Don't process this file
];

// ============================================
// Types
// ============================================

interface FileChange {
  filePath: string;
  changes: Change[];
}

interface Change {
  lineNumber: number;
  oldLine: string;
  newLine: string;
  description: string;
}

interface MigrationReport {
  totalFiles: number;
  modifiedFiles: number;
  totalChanges: number;
  changes: FileChange[];
  errors: string[];
}

// ============================================
// Core Functions
// ============================================

/**
 * Find all TypeScript files to process
 */
async function findFilesToProcess(): Promise<string[]> {
  const patterns = ["app/**/*.ts", "app/**/*.tsx"];

  const files: string[] = [];

  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: CLIENT_DIR,
      ignore: EXCLUDE_PATTERNS,
      absolute: true,
    });
    files.push(...matches);
  }

  return [...new Set(files)].sort();
}

/**
 * Process a single file and detect changes
 */
function processFile(filePath: string, dryRun: boolean): FileChange | null {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const changes: Change[] = [];
  let modifiedContent = content;

  // Apply each import mapping
  for (const mapping of IMPORT_MAPPINGS) {
    const matches = [...content.matchAll(mapping.pattern)];

    if (matches.length > 0) {
      // Replace in content
      modifiedContent = modifiedContent.replace(
        mapping.pattern,
        mapping.replacement,
      );

      // Find line numbers for reporting
      for (const match of matches) {
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split("\n").length;
        const oldLine = lines[lineNumber - 1] || "";
        const newLine = oldLine!.replace(mapping.pattern, mapping.replacement);

        changes.push({
          lineNumber,
          oldLine: oldLine!.trim(),
          newLine: newLine.trim(),
          description: mapping.description,
        });
      }
    }
  }

  // Write changes if not dry run
  if (changes.length > 0 && !dryRun) {
    fs.writeFileSync(filePath, modifiedContent, "utf-8");
  }

  return changes.length > 0 ? { filePath, changes } : null;
}

/**
 * Generate a detailed migration report
 */
function generateReport(
  fileChanges: FileChange[],
  errors: string[],
): MigrationReport {
  const totalChanges = fileChanges.reduce(
    (sum, file) => sum + file.changes.length,
    0,
  );

  return {
    totalFiles: fileChanges.length,
    modifiedFiles: fileChanges.length,
    totalChanges,
    changes: fileChanges,
    errors,
  };
}

/**
 * Print report to console
 */
function printReport(report: MigrationReport, dryRun: boolean): void {
  const mode = dryRun ? "DRY RUN" : "APPLIED";

  console.log("\n" + "=".repeat(80));
  console.log(`GDPR/Compliance Import Migration - ${mode}`);
  console.log("=".repeat(80) + "\n");

  if (report.modifiedFiles === 0) {
    console.log("✅ No changes required. All imports are up to date!\n");
    return;
  }

  console.log(`📊 Summary:`);
  console.log(`   Files to modify: ${report.modifiedFiles}`);
  console.log(`   Total changes: ${report.totalChanges}`);
  console.log();

  // Group changes by description
  const changesByDescription = new Map<string, FileChange[]>();
  for (const fileChange of report.changes) {
    for (const change of fileChange.changes) {
      if (!changesByDescription.has(change.description)) {
        changesByDescription.set(change.description, []);
      }
      changesByDescription.get(change.description)!.push(fileChange);
    }
  }

  console.log(`📝 Changes by Type:\n`);
  let changeTypeIndex = 1;
  for (const [description, files] of changesByDescription) {
    const uniqueFiles = [...new Set(files.map((f) => f.filePath))];
    console.log(`   ${changeTypeIndex}. ${description}`);
    console.log(`      Affected files: ${uniqueFiles.length}`);
    changeTypeIndex++;
  }
  console.log();

  console.log(`📁 Detailed Changes:\n`);

  for (const fileChange of report.changes) {
    const relativePath = path.relative(CLIENT_DIR, fileChange.filePath);
    console.log(`\n   ${relativePath}`);
    console.log(`   ${"─".repeat(relativePath.length)}`);

    for (const change of fileChange.changes) {
      console.log(`   Line ${change.lineNumber}:`);
      console.log(`   ${dryRun ? "- " : "✓ "} ${change.oldLine}`);
      console.log(`   ${dryRun ? "+ " : "→ "} ${change.newLine}`);
      console.log();
    }
  }

  if (report.errors.length > 0) {
    console.log(`\n❌ Errors:\n`);
    for (const error of report.errors) {
      console.log(`   ${error}`);
    }
    console.log();
  }

  if (dryRun) {
    console.log(
      "\n💡 To apply these changes, run: pnpm tsx scripts/migrate-gdpr-imports.ts\n",
    );
  } else {
    console.log("\n✅ Migration completed successfully!\n");
    console.log("📋 Next Steps:");
    console.log("   1. Review the changes with: git diff");
    console.log("   2. Run tests: pnpm test");
    console.log("   3. Fix any TypeScript errors: pnpm type-check");
    console.log(
      '   4. Commit changes: git add . && git commit -m "chore: consolidate GDPR imports"',
    );
    console.log();
  }

  console.log("=".repeat(80) + "\n");
}

/**
 * Save report to file
 */
function saveReportToFile(report: MigrationReport, dryRun: boolean): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const mode = dryRun ? "dry-run" : "applied";
  const filename = `migration-report-${mode}-${timestamp}.json`;
  const reportPath = path.join(CLIENT_DIR, filename);

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(
    `📄 Detailed report saved to: ${path.relative(CLIENT_DIR, reportPath)}\n`,
  );
}

// ============================================
// Main Execution
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("\n🔍 Scanning for files to process...\n");
  console.log(`   Working directory: ${CLIENT_DIR}\n`);

  const files = await findFilesToProcess();
  console.log(`   Found ${files.length} TypeScript files to check\n`);

  const fileChanges: FileChange[] = [];
  const errors: string[] = [];

  console.log("🔄 Processing files...\n");

  for (const file of files) {
    try {
      const result = processFile(file, dryRun);
      if (result) {
        fileChanges.push(result);
        const relativePath = path.relative(CLIENT_DIR, file);
        console.log(`   ✓ ${relativePath} (${result.changes.length} changes)`);
      }
    } catch (error) {
      const relativePath = path.relative(CLIENT_DIR, file);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`${relativePath}: ${errorMessage}`);
      console.error(`   ✗ ${relativePath}: ${errorMessage}`);
    }
  }

  const report = generateReport(fileChanges, errors);
  printReport(report, dryRun);

  if (fileChanges.length > 0 || errors.length > 0) {
    saveReportToFile(report, dryRun);
  }

  // Exit with error code if there were errors
  if (errors.length > 0) {
    process.exit(1);
  }
}

// Run the migration
main().catch((error) => {
  console.error("\n❌ Migration failed:", error);
  process.exit(1);
});
